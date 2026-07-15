import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';
import { logger } from '../utils/logger';
import type { Invoice, InvoiceSettings } from './invoiceService';
import { getInvoiceSettings } from './invoiceService';
import { BRAND_LOGO_DATA_URI } from '../constants/brandLogo';

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (n: number, isRTL: boolean, currency = 'SAR'): string => {
  const v = (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isRTL ? `${v} ر.س` : `${v} ${currency}`;
};

/**
 * Invoice dates are ALWAYS Gregorian + English (Latin numerals), regardless of
 * the app's RTL/Arabic locale. We pin the calendar to 'gregory', the locale to
 * 'en-GB' (→ "14 Jun 2026"), and the timezone to KSA so the printed date is
 * stable and never falls back to device Hijri/ar-SA defaults. Exported so the
 * admin billing screen formats dates identically.
 */
export const formatInvoiceDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const paymentLabel = (method: string | null, isRTL: boolean): string => {
  const map: Record<string, [string, string]> = {
    cash: ['نقداً', 'Cash'],
    cod: ['نقداً عند الاستلام', 'Cash on delivery'],
    card: ['بطاقة / مدى', 'Card / Mada'],
    transfer: ['تحويل بنكي', 'Bank transfer'],
    apple_pay: ['Apple Pay', 'Apple Pay'],
  };
  const m = method ? map[method] : undefined;
  return m ? (isRTL ? m[0] : m[1]) : isRTL ? 'غير محدد' : 'N/A';
};

const statusLabel = (status: string | null, isRTL: boolean): string => {
  const map: Record<string, [string, string]> = {
    paid: ['مدفوعة', 'Paid'],
    unpaid: ['غير مدفوعة', 'Unpaid'],
    pending: ['قيد الدفع', 'Pending'],
    issued: ['صادرة', 'Issued'],
    void: ['ملغاة', 'Void'],
    refunded: ['مستردة', 'Refunded'],
  };
  const m = status ? map[status] : undefined;
  return m ? (isRTL ? m[0] : m[1]) : esc(status);
};

/** Build the ZATCA QR as an inline SVG data URI (pure JS — no canvas). */
const qrSvgDataUri = async (tlv: string | null): Promise<string | null> => {
  if (!tlv) return null;
  try {
    const svg = await QRCode.toString(tlv, { type: 'svg', margin: 1, width: 120 });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (e) {
    logger.warn('qr generation failed', e);
    return null;
  }
};

/**
 * Renders the shared bilingual / RTL-aware invoice HTML. Used for both admin
 * and customer PDF generation so there is a single source of visual truth.
 */
export const buildInvoiceHtml = async (
  invoice: Invoice,
  settings: InvoiceSettings,
  isRTL: boolean
): Promise<string> => {
  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';
  const qr = await qrSvgDataUri(invoice.zatca_tlv);

  const t = {
    invoice: isRTL ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice',
    number: isRTL ? 'رقم الفاتورة' : 'Invoice #',
    date: isRTL ? 'التاريخ' : 'Date',
    order: isRTL ? 'رقم الطلب' : 'Order #',
    billTo: isRTL ? 'فاتورة إلى' : 'Bill to',
    technician: isRTL ? 'الفني' : 'Technician',
    vatNo: isRTL ? 'الرقم الضريبي' : 'VAT No.',
    crNo: isRTL ? 'السجل التجاري' : 'CR No.',
    desc: isRTL ? 'الوصف' : 'Description',
    qty: isRTL ? 'الكمية' : 'Qty',
    price: isRTL ? 'السعر' : 'Price',
    amount: isRTL ? 'المبلغ' : 'Amount',
    subtotal: isRTL ? 'المجموع (غير شامل الضريبة)' : 'Subtotal (excl. VAT)',
    vat: isRTL ? `ضريبة القيمة المضافة (${Math.round((invoice.vat_rate || 0) * 100)}%)` : `VAT (${Math.round((invoice.vat_rate || 0) * 100)}%)`,
    total: isRTL ? 'الإجمالي' : 'Total',
    payMethod: isRTL ? 'طريقة الدفع' : 'Payment method',
    payStatus: isRTL ? 'حالة الدفع' : 'Payment status',
  };

  const rows = invoice.line_items
    .map(
      (l) => `
      <tr>
        <td class="desc">${esc(isRTL ? l.labelAr : l.labelEn)}</td>
        <td class="num">${esc(l.qty)}</td>
        <td class="num">${money(l.unitPrice, isRTL, invoice.currency)}</td>
        <td class="num">${money(l.amount, isRTL, invoice.currency)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Tahoma, Arial, sans-serif;
         color: #1a1a2e; margin: 0; padding: 28px; direction: ${dir}; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
          border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; }
  .brand { text-align: ${align}; }
  .brand h1 { margin: 0; font-size: 22px; color: #0f172a; }
  .brand .meta { color: #64748b; font-size: 11px; margin-top: 4px; line-height: 1.6; }
  .logo { max-height: 56px; max-width: 160px; object-fit: contain; }
  .doc { text-align: ${isRTL ? 'left' : 'right'}; }
  .doc .title { font-size: 16px; font-weight: 800; color: #0ea5e9; }
  .doc .field { font-size: 12px; color: #334155; margin-top: 3px; }
  .doc .field b { color: #0f172a; }
  .parties { display: flex; gap: 16px; margin: 22px 0; }
  .party { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: ${align}; }
  .party .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; }
  .party .val { font-size: 13px; color: #0f172a; margin-top: 4px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { background: #0f172a; color: #fff; font-size: 11px; padding: 9px 10px; text-align: ${align}; }
  thead th.num { text-align: ${isRTL ? 'left' : 'right'}; }
  tbody td { padding: 10px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
  td.num { text-align: ${isRTL ? 'left' : 'right'}; white-space: nowrap; }
  td.desc { color: #0f172a; }
  .totals { margin-top: 14px; display: flex; justify-content: ${isRTL ? 'flex-start' : 'flex-end'}; }
  .totals table { width: 280px; }
  .totals td { padding: 6px 8px; font-size: 13px; border: none; }
  .totals .grand td { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 10px; }
  .pay { display: flex; gap: 10px; margin-top: 18px; }
  .badge { font-size: 11px; padding: 5px 10px; border-radius: 999px; background: #e0f2fe; color: #0369a1; }
  .badge.paid { background: #dcfce7; color: #166534; }
  .footer { margin-top: 26px; border-top: 1px solid #e2e8f0; padding-top: 14px;
            display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .footer .notes { font-size: 11px; color: #64748b; text-align: ${align}; line-height: 1.7; flex: 1; }
  .qr { width: 110px; height: 110px; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">
      <img class="logo" src="${esc((settings.logoUrl || '').trim() || BRAND_LOGO_DATA_URI)}" /><h1 style="margin-top:6px">${esc(settings.companyName || invoice.seller_name)}</h1>
      <div class="meta">
        ${esc(invoice.seller_address || settings.address)}<br/>
        ${invoice.seller_vat_number ? `${t.vatNo}: ${esc(invoice.seller_vat_number)}<br/>` : ''}
        ${invoice.seller_cr_number ? `${t.crNo}: ${esc(invoice.seller_cr_number)}` : ''}
      </div>
    </div>
    <div class="doc">
      <div class="title">${t.invoice}</div>
      <div class="field">${t.number} <b>${esc(invoice.invoice_number)}</b></div>
      <div class="field">${t.date}: <span dir="ltr">${formatInvoiceDate(invoice.issued_at)}</span></div>
      ${invoice.order_id ? `<div class="field">${t.order} <b>${esc(invoice.order_id.slice(0, 8))}</b></div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="lbl">${t.billTo}</div>
      <div class="val">
        <b>${esc(invoice.customer_name || '—')}</b><br/>
        ${esc(invoice.customer_phone || '')}<br/>
        ${esc(invoice.customer_email || '')}<br/>
        ${esc(invoice.customer_address || '')}
      </div>
    </div>
    ${
      invoice.technician_name
        ? `<div class="party">
        <div class="lbl">${t.technician}</div>
        <div class="val"><b>${esc(invoice.technician_name)}</b><br/>${esc(invoice.technician_phone || '')}</div>
      </div>`
        : ''
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>${t.desc}</th>
        <th class="num">${t.qty}</th>
        <th class="num">${t.price}</th>
        <th class="num">${t.amount}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>${t.subtotal}</td><td class="num">${money(invoice.subtotal, isRTL, invoice.currency)}</td></tr>
      ${invoice.discount_total > 0 ? `<tr><td>${isRTL ? 'الخصم' : 'Discount'}</td><td class="num">- ${money(invoice.discount_total, isRTL, invoice.currency)}</td></tr>` : ''}
      <tr><td>${t.vat}</td><td class="num">${money(invoice.vat_amount, isRTL, invoice.currency)}</td></tr>
      <tr class="grand"><td>${t.total}</td><td class="num">${money(invoice.total, isRTL, invoice.currency)}</td></tr>
    </table>
  </div>

  <div class="pay">
    <span class="badge">${t.payMethod}: ${paymentLabel(invoice.payment_method, isRTL)}</span>
    <span class="badge ${invoice.payment_status === 'paid' ? 'paid' : ''}">${t.payStatus}: ${statusLabel(invoice.payment_status, isRTL)}</span>
  </div>

  <div class="footer">
    <div class="notes">
      ${esc(invoice.footer || settings.footer)}<br/>
      ${esc(settings.legalText)}
    </div>
    ${qr ? `<img class="qr" src="${qr}" />` : ''}
  </div>
</body>
</html>`;
};

export interface InvoicePdfResult {
  uri: string;
}

/**
 * Generates the invoice PDF and opens the share sheet (the user can save to
 * Files, print, or send it). Returns the generated file URI.
 */
export const generateAndShareInvoicePdf = async (
  invoice: Invoice,
  isRTL: boolean,
  settings?: InvoiceSettings
): Promise<InvoicePdfResult> => {
  const s = settings ?? (await getInvoiceSettings());
  const html = await buildInvoiceHtml(invoice, s, isRTL);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Rename to a friendly filename when possible by sharing the generated file.
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: isRTL ? 'فاتورة فيكسات' : 'Fixate invoice',
      UTI: 'com.adobe.pdf',
    });
  }
  return { uri };
};
