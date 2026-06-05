/**
 * Builds a multi-sheet Excel workbook for the admin reports screen and
 * hands it to the OS share sheet. The workbook layout is fixed; callers
 * pass in already-aggregated data and we serialize it.
 *
 * The `xlsx` package is dynamically imported so a stale build that has
 * not yet installed the dep can still run — the export button will just
 * error with a clear message instead of crashing module init.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface ExportSummary {
  rangeFromIso: string;
  rangeToIso: string;
  revenueCompleted: number;
  totalOrders: number;
  avgOrderValue: number;
  topTechnicianName: string;
  topTechnicianCount: number;
}

export interface ExportOrderRow {
  id: string;
  customer: string;
  device: string;
  issue: string;
  status: string;
  city: string;
  delivery_fee: number;
  estimated_price: number;
  created_at: string;
}

export interface ExportTechnicianRow {
  name: string;
  completed_orders: number;
  total_earned: number;
}

export interface ExportMarketRow {
  category: string;
  status: string;
  count: number;
}

export interface ExportPayload {
  isRTL: boolean;
  summary: ExportSummary;
  orders: ExportOrderRow[];
  technicians: ExportTechnicianRow[];
  market: ExportMarketRow[];
}

const fmtDateOnly = (iso: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
};

const autoWidths = (rows: (string | number)[][]): { wch: number }[] => {
  if (rows.length === 0) return [];
  const cols = rows[0].length;
  const widths: number[] = new Array(cols).fill(8);
  for (const r of rows) {
    for (let i = 0; i < cols; i++) {
      const cell = r[i] == null ? '' : String(r[i]);
      if (cell.length > widths[i]) widths[i] = Math.min(cell.length, 40);
    }
  }
  return widths.map((w) => ({ wch: w + 2 }));
};

/** Base64-encode a binary string. RN runtimes ship a `btoa` polyfill so
 *  this is safe in Expo without pulling in a base64 dep. */
const toBase64 = (binary: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (typeof g.btoa === 'function') return g.btoa(binary);
  // Fallback: should never hit in Expo, but keep it safe.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return Buffer.from(binary, 'binary').toString('base64');
};

export const exportReportXlsx = async (payload: ExportPayload): Promise<void> => {
  // Dynamic import so the absence of xlsx (e.g. before `npm install`) is
  // surfaced as a friendly error, not a module-load crash.
  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch (e) {
    throw new Error(
      'xlsx package not installed. Run `npm install xlsx@^0.18.5` and rebuild.'
    );
  }

  const { isRTL, summary, orders, technicians, market } = payload;
  const sar = isRTL ? 'ر.س' : 'SAR';
  const wb = XLSX.utils.book_new();

  // 1) Summary
  const summaryRows: (string | number)[][] = [
    [isRTL ? 'ملخص / Summary' : 'Summary / ملخص'],
    [isRTL ? 'الفترة من / From' : 'From / من', fmtDateOnly(summary.rangeFromIso)],
    [isRTL ? 'إلى / To' : 'To / إلى', fmtDateOnly(summary.rangeToIso)],
    [],
    [isRTL ? 'المقياس / Metric' : 'Metric / المقياس', isRTL ? 'القيمة / Value' : 'Value / القيمة'],
    [isRTL ? `الإيرادات (${sar})` : `Revenue (${sar})`, Number(summary.revenueCompleted.toFixed(2))],
    [isRTL ? 'إجمالي الطلبات' : 'Total Orders', summary.totalOrders],
    [isRTL ? `متوسط قيمة الطلب (${sar})` : `Avg Order Value (${sar})`, Number(summary.avgOrderValue.toFixed(2))],
    [isRTL ? 'أفضل فني' : 'Top Technician', summary.topTechnicianName || '—'],
    [isRTL ? 'طلبات أفضل فني' : 'Top Technician Orders', summary.topTechnicianCount],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = autoWidths(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // 2) Orders
  const ordersHeader = [
    'ID',
    isRTL ? 'العميل / Customer' : 'Customer / العميل',
    isRTL ? 'الجهاز / Device' : 'Device / الجهاز',
    isRTL ? 'العطل / Issue' : 'Issue / العطل',
    isRTL ? 'الحالة / Status' : 'Status / الحالة',
    isRTL ? 'المدينة / City' : 'City / المدينة',
    isRTL ? `رسوم التوصيل (${sar})` : `Delivery Fee (${sar})`,
    isRTL ? `السعر التقديري (${sar})` : `Estimated Price (${sar})`,
    isRTL ? 'تاريخ الإنشاء / Created' : 'Created / تاريخ الإنشاء',
  ];
  const orderRows: (string | number)[][] = [
    ordersHeader,
    ...orders.map((o) => [
      o.id,
      o.customer,
      o.device,
      o.issue,
      o.status,
      o.city,
      Number(o.delivery_fee || 0),
      Number(o.estimated_price || 0),
      fmtDateOnly(o.created_at),
    ]),
  ];
  const wsOrders = XLSX.utils.aoa_to_sheet(orderRows);
  wsOrders['!cols'] = autoWidths(orderRows);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');

  // 3) Technicians
  const techHeader = [
    isRTL ? 'الاسم / Name' : 'Name / الاسم',
    isRTL ? 'طلبات مكتملة / Completed' : 'Completed Orders / طلبات مكتملة',
    isRTL ? `إجمالي الكسب (${sar})` : `Total Earned (${sar})`,
  ];
  const techRows: (string | number)[][] = [
    techHeader,
    ...technicians.map((t) => [
      t.name,
      t.completed_orders,
      Number(t.total_earned.toFixed(2)),
    ]),
  ];
  const wsTech = XLSX.utils.aoa_to_sheet(techRows);
  wsTech['!cols'] = autoWidths(techRows);
  XLSX.utils.book_append_sheet(wb, wsTech, 'Technicians');

  // 4) Market
  const marketHeader = [
    isRTL ? 'الفئة / Category' : 'Category / الفئة',
    isRTL ? 'الحالة / Status' : 'Status / الحالة',
    isRTL ? 'العدد / Count' : 'Count / العدد',
  ];
  const marketRows: (string | number)[][] = [
    marketHeader,
    ...market.map((m) => [m.category, m.status, m.count]),
  ];
  const wsMarket = XLSX.utils.aoa_to_sheet(marketRows);
  wsMarket['!cols'] = autoWidths(marketRows);
  XLSX.utils.book_append_sheet(wb, wsMarket, 'Market');

  const binary = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
  const base64 = toBase64(binary);

  const fileUri = `${FileSystem.documentDirectory}fixate-report-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Fixate Report',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
};
