import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';
import { logger } from '../utils/logger';
import { getInvoiceSettings, type InvoiceSettings } from './invoiceService';
import { formatInvoiceDate } from './invoicePdf';
import { deriveWarranty, deviceLabel, WARRANTY_MONTHS, type WarrantyOrderLike } from '../utils/warranty';

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Stable, human-readable certificate number derived from the order id. */
export const certificateNumber = (order: { id: string; order_number?: string | null }): string =>
  `WR-${(order.order_number ?? order.id.slice(0, 8)).replace(/^#/, '').toUpperCase()}`;

/** QR encodes the certificate number + order id so support can verify a printout. */
const qrSvgDataUri = async (payload: string): Promise<string | null> => {
  try {
    const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, width: 120 });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (e) {
    logger.warn('warranty qr generation failed', e);
    return null;
  }
};

export interface WarrantyCertificateOrder extends WarrantyOrderLike {
  order_number?: string | null;
}

export const buildWarrantyHtml = async (
  order: WarrantyCertificateOrder,
  customerName: string,
  settings: InvoiceSettings,
  isRTL: boolean
): Promise<string> => {
  const w = deriveWarranty(order);
  if (!w) throw new Error('no_warranty');

  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';
  const certNo = certificateNumber(order);
  const qr = await qrSvgDataUri(`FIXATE|WARRANTY|${certNo}|${order.id}`);

  const t = {
    title: isRTL ? 'شهادة ضمان إصلاح' : 'Repair Warranty Certificate',
    certNo: isRTL ? 'رقم الشهادة' : 'Certificate No.',
    order: isRTL ? 'رقم الطلب' : 'Order No.',
    holder: isRTL ? 'صاحب الضمان' : 'Warranty holder',
    device: isRTL ? 'الجهاز' : 'Device',
    repair: isRTL ? 'الإصلاح المشمول' : 'Covered repair',
    issued: isRTL ? 'تاريخ الإصدار' : 'Issued on',
    validUntil: isRTL ? 'ساري حتى' : 'Valid until',
    duration: isRTL ? 'مدة التغطية' : 'Coverage period',
    months: isRTL ? `${WARRANTY_MONTHS} شهراً` : `${WARRANTY_MONTHS} months`,
    status: isRTL ? 'الحالة' : 'Status',
    active: isRTL ? 'ساري' : 'Active',
    expired: isRTL ? 'منتهٍ' : 'Expired',
    remaining: isRTL ? `متبقٍّ ${w.daysRemaining} يوماً` : `${w.daysRemaining} days remaining`,
    termsTitle: isRTL ? 'شروط الضمان' : 'Warranty terms',
    verify: isRTL
      ? 'امسح الرمز للتحقق من صحة الشهادة لدى خدمة العملاء.'
      : 'Scan to verify this certificate with customer support.',
  };

  const terms = isRTL
    ? [
        `يغطي هذا الضمان عيوب الإصلاح وقطع الغيار المستبدلة لمدة ${WARRANTY_MONTHS} شهراً من تاريخ إتمام الإصلاح.`,
        'لا يشمل الضمان الأضرار الناتجة عن سوء الاستخدام أو السقوط أو السوائل أو محاولات الإصلاح خارج فيكسات.',
        'يسقط الضمان عند فتح الجهاز أو إصلاحه لدى جهة أخرى.',
        'لتفعيل الضمان، تواصل مع خدمة العملاء من داخل التطبيق مع رقم الشهادة الموضح أعلاه.',
      ]
    : [
        `This warranty covers repair defects and replaced parts for ${WARRANTY_MONTHS} months from the repair completion date.`,
        'It does not cover damage from misuse, drops, liquid, or repairs attempted outside Fixate.',
        'The warranty is void if the device is opened or serviced by another party.',
        'To claim, contact customer support from within the app quoting the certificate number above.',
      ];

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Tahoma, Arial, sans-serif;
         color: #0f172a; margin: 0; padding: 30px; direction: ${dir}; }
  .sheet { border: 2px solid #16A34A; border-radius: 16px; padding: 26px; position: relative; overflow: hidden; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
               font-size: 108px; font-weight: 800; color: rgba(22,163,74,.05); transform: rotate(-24deg); }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
          border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; }
  .brand { text-align: ${align}; }
  .brand h1 { margin: 0; font-size: 20px; }
  .brand .meta { color: #64748b; font-size: 11px; margin-top: 4px; line-height: 1.6; }
  .logo { max-height: 52px; max-width: 150px; object-fit: contain; }
  .doc { text-align: ${isRTL ? 'left' : 'right'}; }
  .doc .title { font-size: 17px; font-weight: 800; color: #16A34A; }
  .doc .field { font-size: 12px; color: #334155; margin-top: 4px; }
  .pill { display: inline-block; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px;
          background: #dcfce7; color: #166534; margin-top: 8px; }
  .pill.expired { background: #f1f5f9; color: #64748b; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 22px 0; }
  .cell { flex: 1 1 40%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
          padding: 12px 14px; text-align: ${align}; }
  .cell .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; }
  .cell .val { font-size: 14px; font-weight: 700; margin-top: 4px; line-height: 1.5; }
  .cell .val.accent { color: #16A34A; }
  .terms { text-align: ${align}; margin-top: 6px; }
  .terms h2 { font-size: 13px; margin: 0 0 8px; }
  .terms li { font-size: 11.5px; color: #475569; line-height: 1.9; }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 16px;
          border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 16px; }
  .foot .notes { font-size: 11px; color: #64748b; text-align: ${align}; line-height: 1.7; flex: 1; }
  .qr { width: 104px; height: 104px; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="watermark">${esc(settings.companyName || 'Fixate')}</div>

    <div class="head">
      <div class="brand">
        ${settings.logoUrl ? `<img class="logo" src="${esc(settings.logoUrl)}" />` : `<h1>${esc(settings.companyName || 'Fixate')}</h1>`}
        <div class="meta">
          ${esc(settings.address)}<br/>
          ${esc(settings.phone)} ${settings.email ? `· ${esc(settings.email)}` : ''}
        </div>
      </div>
      <div class="doc">
        <div class="title">${t.title}</div>
        <div class="field">${t.certNo}: <b>${esc(certNo)}</b></div>
        <div class="field">${t.order}: <b>${esc(order.order_number ?? order.id.slice(0, 8).toUpperCase())}</b></div>
        <div class="pill ${w.isActive ? '' : 'expired'}">${w.isActive ? `${t.active} · ${t.remaining}` : t.expired}</div>
      </div>
    </div>

    <div class="grid">
      <div class="cell">
        <div class="lbl">${t.holder}</div>
        <div class="val">${esc(customerName)}</div>
      </div>
      <div class="cell">
        <div class="lbl">${t.device}</div>
        <div class="val">${esc(deviceLabel(order, isRTL))}</div>
      </div>
      <div class="cell">
        <div class="lbl">${t.issued}</div>
        <div class="val"><span dir="ltr">${formatInvoiceDate(w.startDate.toISOString())}</span></div>
      </div>
      <div class="cell">
        <div class="lbl">${t.validUntil}</div>
        <div class="val accent"><span dir="ltr">${formatInvoiceDate(w.endDate.toISOString())}</span></div>
      </div>
      <div class="cell">
        <div class="lbl">${t.duration}</div>
        <div class="val">${t.months}</div>
      </div>
      <div class="cell">
        <div class="lbl">${t.repair}</div>
        <div class="val">${esc(order.issue_description || (isRTL ? 'إصلاح عام' : 'General repair'))}</div>
      </div>
    </div>

    <div class="terms">
      <h2>${t.termsTitle}</h2>
      <ul>${terms.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>

    <div class="foot">
      <div class="notes">${t.verify}<br/>${esc(settings.legalText)}</div>
      ${qr ? `<img class="qr" src="${qr}" />` : ''}
    </div>
  </div>
</body>
</html>`;
};

/**
 * Renders the warranty certificate to a PDF and opens the share sheet (save to
 * Files, print, or send) — same flow as the invoice PDF.
 */
export const generateAndShareWarrantyPdf = async (
  order: WarrantyCertificateOrder,
  customerName: string,
  isRTL: boolean
): Promise<{ uri: string }> => {
  const settings = await getInvoiceSettings();
  const html = await buildWarrantyHtml(order, customerName, settings, isRTL);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: isRTL ? 'شهادة ضمان فيكسات' : 'Fixate warranty certificate',
      UTI: 'com.adobe.pdf',
    });
  }
  return { uri };
};
