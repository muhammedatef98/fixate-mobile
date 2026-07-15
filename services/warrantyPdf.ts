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

  const brandName = esc(settings.companyName || 'Fixate');
  const sealRingTop = isRTL ? 'شهادة ضمان معتمدة' : 'CERTIFIED WARRANTY';
  // Professional round emblem (SVG): concentric rings, arced text, centered
  // check. Crisp at any size and far less template-looking than a rotated
  // rubber-stamp. Latin brand text on the lower arc reads reliably in print.
  const sealSvg = `
    <svg viewBox="0 0 140 140" width="112" height="112" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true">
      <defs>
        <path id="wcarcTop" d="M 24,70 A 46,46 0 0 1 116,70" />
        <path id="wcarcBottom" d="M 26,70 A 44,44 0 0 0 114,70" />
      </defs>
      <circle cx="70" cy="70" r="66" fill="none" stroke="#065f46" stroke-width="1"/>
      <circle cx="70" cy="70" r="61" fill="none" stroke="#0e7a54" stroke-width="2.5"/>
      <circle cx="70" cy="70" r="37" fill="#f4faf7" stroke="#c9e2d8" stroke-width="1"/>
      <text font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="9" font-weight="700" letter-spacing="2.4" fill="#065f46">
        <textPath xlink:href="#wcarcTop" startOffset="50%" text-anchor="middle">${esc(sealRingTop)}</textPath>
      </text>
      <text font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="8" font-weight="700" letter-spacing="2.8" fill="#0e7a54">
        <textPath xlink:href="#wcarcBottom" startOffset="50%" text-anchor="middle">${brandName.toUpperCase()}</textPath>
      </text>
      <circle cx="21" cy="70" r="1.7" fill="#0e7a54"/>
      <circle cx="119" cy="70" r="1.7" fill="#0e7a54"/>
      <circle cx="70" cy="70" r="21" fill="#065f46"/>
      <path d="M60.5,70.5 l6,6 l12.5,-14" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Tahoma, Arial, sans-serif;
         color: #101f19; margin: 0; padding: 30px; direction: ${dir};
         background: #f3f6f4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Clean single sheet: hairline border + a soft inner keyline, one slim accent
     rule under the header. No heavy frame, no rotated watermark. */
  .sheet { position: relative; background: #ffffff; border: 1px solid #dfe8e4; border-radius: 6px;
           box-shadow: 0 12px 34px rgba(16,31,25,.10); }
  .accent-strip { height: 4px; border-radius: 6px 6px 0 0;
                  background: linear-gradient(90deg, #065f46 0%, #0e7a54 60%, #34d399 100%); }
  .inner { padding: 34px 38px 30px; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
          padding-bottom: 18px; border-bottom: 1px solid #e8efeb; }
  .brand { text-align: ${align}; display: flex; align-items: center; gap: 12px;
           flex-direction: ${isRTL ? 'row-reverse' : 'row'}; }
  .monogram { width: 44px; height: 44px; border-radius: 10px; background: #065f46; color: #fff;
              font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .brand h1 { margin: 0; font-size: 19px; font-weight: 800; color: #0b3b2c; letter-spacing: .3px; }
  .brand .meta { color: #6a7a73; font-size: 10.5px; margin-top: 3px; line-height: 1.6; }
  .logo { max-height: 48px; max-width: 150px; object-fit: contain; }
  .doc { text-align: ${isRTL ? 'left' : 'right'}; }
  .doc .kicker { font-size: 9.5px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: #34d399; }
  .doc .title { font-size: 20px; font-weight: 800; color: #0b3b2c; margin-top: 4px; letter-spacing: .2px; }
  .doc .field { font-size: 11.5px; color: #3d4f48; margin-top: 5px; }
  .doc .field b { color: #065f46; font-weight: 700; }
  .pill { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 5px 13px; border-radius: 999px;
          margin-top: 11px; letter-spacing: .3px; background: #e7f6ee; color: #0b6b47; border: 1px solid #bfe6d3; }
  .pill.expired { background: #f1f4f2; color: #66756e; border-color: #e0e6e3; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 26px 0 22px;
          border: 1px solid #e8efeb; border-radius: 8px; overflow: hidden; }
  .cell { padding: 14px 18px; text-align: ${align}; border-bottom: 1px solid #eef3f0; }
  .cell:nth-child(odd) { ${isRTL ? 'border-left' : 'border-right'}: 1px solid #eef3f0; }
  .cell:nth-last-child(-n+2) { border-bottom: none; }
  .cell .lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #8a9a92; font-weight: 700; }
  .cell .val { font-size: 14px; font-weight: 700; margin-top: 5px; line-height: 1.45; color: #101f19; }
  .cell .val.accent { color: #0b6b47; }

  .terms { text-align: ${align}; margin-top: 2px; }
  .terms h2 { font-size: 11px; margin: 0 0 8px; color: #8a9a92; font-weight: 800;
              text-transform: uppercase; letter-spacing: 1.4px; }
  .terms ul { margin: 0; padding-${isRTL ? 'right' : 'left'}: 16px; }
  .terms li { font-size: 11px; color: #46574f; line-height: 1.9; }

  /* Footer: emblem seal sits BELOW the details, beside the signature. */
  .foot { display: flex; align-items: center; gap: 22px; margin-top: 26px; padding-top: 20px;
          border-top: 1px solid #e8efeb; flex-direction: ${isRTL ? 'row-reverse' : 'row'}; }
  .seal { flex: 0 0 auto; line-height: 0; }
  .sign { flex: 1; text-align: center; }
  .sign .line { width: 78%; margin: 0 auto 6px; border-top: 1px solid #46574f; }
  .sign .cap { font-size: 10px; color: #6a7a73; font-weight: 700; letter-spacing: .4px; }
  .sign .sub { font-size: 9px; color: #9aa8a1; margin-top: 2px; }
  .qrwrap { flex: 0 0 auto; text-align: center; }
  .qr { width: 92px; height: 92px; }
  .qrwrap .verify { font-size: 8.5px; color: #8a9a92; margin-top: 4px; max-width: 96px; line-height: 1.4; }
  .legal { margin-top: 16px; font-size: 9px; color: #9aa8a1; text-align: ${align}; line-height: 1.6; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="accent-strip"></div>
    <div class="inner">
      <div class="head">
        <div class="brand">
          ${settings.logoUrl
            ? `<img class="logo" src="${esc(settings.logoUrl)}" />`
            : `<div class="monogram">${brandName.slice(0, 1).toUpperCase()}</div>`}
          <div>
            ${settings.logoUrl ? '' : `<h1>${brandName}</h1>`}
            <div class="meta">${esc(settings.address)}<br/>${esc(settings.phone)} ${settings.email ? `· ${esc(settings.email)}` : ''}</div>
          </div>
        </div>
        <div class="doc">
          <div class="kicker">${brandName}</div>
          <div class="title">${t.title}</div>
          <div class="field">${t.certNo}: <b>${esc(certNo)}</b></div>
          <div class="field">${t.order}: <b>${esc(order.order_number ?? order.id.slice(0, 8).toUpperCase())}</b></div>
          <div class="pill ${w.isActive ? '' : 'expired'}">${w.isActive ? `${t.active} · ${t.remaining}` : t.expired}</div>
        </div>
      </div>

      <div class="grid">
        <div class="cell"><div class="lbl">${t.holder}</div><div class="val">${esc(customerName)}</div></div>
        <div class="cell"><div class="lbl">${t.device}</div><div class="val">${esc(deviceLabel(order, isRTL))}</div></div>
        <div class="cell"><div class="lbl">${t.issued}</div><div class="val"><span dir="ltr">${formatInvoiceDate(w.startDate.toISOString())}</span></div></div>
        <div class="cell"><div class="lbl">${t.validUntil}</div><div class="val accent"><span dir="ltr">${formatInvoiceDate(w.endDate.toISOString())}</span></div></div>
        <div class="cell"><div class="lbl">${t.duration}</div><div class="val">${t.months}</div></div>
        <div class="cell"><div class="lbl">${t.repair}</div><div class="val">${esc(order.issue_description || (isRTL ? 'إصلاح عام' : 'General repair'))}</div></div>
      </div>

      <div class="terms">
        <h2>${t.termsTitle}</h2>
        <ul>${terms.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>

      <div class="foot">
        <div class="seal">${sealSvg}</div>
        <div class="sign">
          <div class="line"></div>
          <div class="cap">${brandName}</div>
          <div class="sub">${isRTL ? 'التوقيع المعتمد' : 'Authorized signature'}</div>
        </div>
        ${qr ? `<div class="qrwrap"><img class="qr" src="${qr}" /><div class="verify">${t.verify}</div></div>` : ''}
      </div>

      <div class="legal">${esc(settings.legalText)}</div>
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
