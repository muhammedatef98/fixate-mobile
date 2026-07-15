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

  const seal = isRTL ? 'ضمان\nمعتمد' : 'CERTIFIED\nWARRANTY';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Tahoma, Arial, sans-serif;
         color: #0f1e17; margin: 0; padding: 26px; direction: ${dir};
         background: #eef2f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Double-ruled formal frame: an emerald outer border with an inset hairline. */
  .sheet { position: relative; overflow: hidden; border-radius: 14px; background: #ffffff;
           border: 3px solid #065f46; box-shadow: inset 0 0 0 1px #d1ddd8, 0 10px 30px rgba(6,95,70,.12); }
  .accent-strip { height: 6px; background: linear-gradient(90deg, #065f46 0%, #047857 45%, #10b981 100%); }
  .inner { padding: 26px 28px; position: relative; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
               font-size: 120px; font-weight: 900; letter-spacing: 4px;
               color: rgba(6,95,70,.045); transform: rotate(-22deg); pointer-events: none; }

  .head { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 18px;
          border-bottom: 2px solid #065f46; padding-bottom: 18px; }
  .brand { text-align: ${align}; }
  .brand h1 { margin: 0; font-size: 22px; font-weight: 900; color: #065f46; letter-spacing: .5px; }
  .brand .meta { color: #5b6b64; font-size: 11px; margin-top: 6px; line-height: 1.7; }
  .logo { max-height: 54px; max-width: 160px; object-fit: contain; }
  .doc { text-align: ${isRTL ? 'left' : 'right'}; }
  .doc .kicker { font-size: 10px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #10b981; }
  .doc .title { font-size: 19px; font-weight: 900; color: #0f1e17; margin-top: 3px; }
  .doc .field { font-size: 12px; color: #33443d; margin-top: 6px; }
  .doc .field b { color: #065f46; }
  .pill { display: inline-block; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 999px;
          margin-top: 10px; letter-spacing: .3px;
          background: #047857; color: #ffffff; box-shadow: 0 2px 6px rgba(4,120,87,.3); }
  .pill.expired { background: #e2e8e5; color: #556660; box-shadow: none; }

  /* Certified seal — an official round emblem, top-inner corner. */
  .seal { position: absolute; ${isRTL ? 'left' : 'right'}: 26px; top: 96px; width: 92px; height: 92px;
          border-radius: 50%; border: 2px solid #b45309; color: #b45309;
          display: flex; align-items: center; justify-content: center; text-align: center;
          font-size: 11px; font-weight: 900; letter-spacing: 1.5px; line-height: 1.5; white-space: pre-line;
          transform: rotate(-12deg); box-shadow: inset 0 0 0 4px rgba(180,83,9,.12); opacity: .9; }

  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0 20px; }
  .cell { flex: 1 1 40%; background: #f5faf8; border: 1px solid #d8e6e0; border-radius: 10px;
          padding: 13px 15px; text-align: ${align}; ${isRTL ? 'border-right' : 'border-left'}: 3px solid #10b981; }
  .cell .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #6b8078; font-weight: 700; }
  .cell .val { font-size: 14px; font-weight: 800; margin-top: 5px; line-height: 1.5; color: #0f1e17; }
  .cell .val.accent { color: #047857; }

  .terms { text-align: ${align}; margin-top: 4px; background: #fbfdfc; border: 1px solid #e5efeb;
           border-radius: 10px; padding: 14px 16px; }
  .terms h2 { font-size: 13px; margin: 0 0 8px; color: #065f46; font-weight: 800;
              display: flex; align-items: center; gap: 6px; }
  .terms ul { margin: 0; padding-${isRTL ? 'right' : 'left'}: 18px; }
  .terms li { font-size: 11.5px; color: #3f524a; line-height: 1.95; }

  .foot { display: flex; justify-content: space-between; align-items: center; gap: 18px;
          border-top: 2px solid #065f46; margin-top: 20px; padding-top: 16px; }
  .foot .notes { font-size: 11px; color: #5b6b64; text-align: ${align}; line-height: 1.75; flex: 1; }
  .foot .sig { text-align: center; min-width: 130px; }
  .foot .sig .line { border-top: 1.5px solid #33443d; margin-bottom: 5px; }
  .foot .sig .cap { font-size: 10px; color: #6b8078; font-weight: 700; letter-spacing: .4px; }
  .qr { width: 104px; height: 104px; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="accent-strip"></div>
    <div class="inner">
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
          <div class="kicker">${esc(settings.companyName || 'Fixate')}</div>
          <div class="title">${t.title}</div>
          <div class="field">${t.certNo}: <b>${esc(certNo)}</b></div>
          <div class="field">${t.order}: <b>${esc(order.order_number ?? order.id.slice(0, 8).toUpperCase())}</b></div>
          <div class="pill ${w.isActive ? '' : 'expired'}">${w.isActive ? `${t.active} · ${t.remaining}` : t.expired}</div>
        </div>
      </div>

      <div class="seal">${esc(seal)}</div>

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
        <div class="sig">
          <div class="line">&nbsp;</div>
          <div class="cap">${esc(settings.companyName || 'Fixate')}</div>
        </div>
        ${qr ? `<img class="qr" src="${qr}" />` : ''}
      </div>
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
