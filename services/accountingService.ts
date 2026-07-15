import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Accounting data layer for the admin accounting dashboard (FEAT-09).
 * Everything is derived from real `orders` rows — revenue from completed
 * orders, spare-parts cost from the technician's accounting-only field, and
 * net profit as the difference.
 */

export type AccountingRange = 'today' | 'week' | 'month' | 'year' | 'all';

export interface TechnicianEarning {
  technicianId: string;
  name: string;
  completedOrders: number;
  revenue: number;
  spareParts: number;
  net: number;
}

export interface CategorySlice {
  label: string;
  revenue: number;
}

export interface RevenueBucket {
  label: string;
  revenue: number;
}

export interface RecentTransaction {
  id: string;
  orderNumber: string;
  customer: string;
  technician: string;
  service: string;
  amount: number;
  paid: number;
  remaining: number;
  spareParts: number;
  net: number;
  date: string;
}

export interface PendingOrder {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  ageDays: number;
}

export interface AccountingData {
  /** Service revenue = sum of accepted-offer amounts. This is the commission
   *  split base (technician/platform %). Delivery is tracked separately. */
  totalRevenue: number;
  /** Delivery fees collected on completed orders. Attributed 100% to the
   *  platform (not part of the technician/platform % split). */
  totalDelivery: number;
  /** Add-ons (accessories + protection) sold on completed orders. Attributed
   *  100% to the platform, same as delivery. */
  totalAddons: number;
  /** Actually collected (orders.amount_paid — record_order_payment RPC). */
  totalPaid: number;
  /** Accepted-amount balance still uncollected on non-cancelled orders. */
  totalOutstanding: number;
  totalSpareParts: number;
  netProfit: number;
  pendingPayments: number;
  completedCount: number;
  revenueBuckets: RevenueBucket[];
  technicians: TechnicianEarning[];
  categories: CategorySlice[];
  recent: RecentTransaction[];
  pendingOrders: PendingOrder[];
}

interface OrderRow {
  id: string;
  order_number: string | null;
  accepted_offer_amount: number | null;
  final_price: number | null;
  estimated_price: number | null;
  delivery_fee: number | null;
  discount_amount: number | null;
  accessories: { price?: number }[] | null;
  protection_addons: { price?: number }[] | null;
  amount_paid: number | null;
  spare_parts_cost: number | null;
  status: string;
  payment_status: string | null;
  service_type: string | null;
  created_at: string | null;
  technician_id: string | null;
  customer?: { name?: string | null } | { name?: string | null }[] | null;
  technician?: { name?: string | null } | { name?: string | null }[] | null;
}

const rangeStart = (range: AccountingRange): Date | null => {
  if (range === 'all') return null;
  const now = new Date();
  const d = new Date(now);
  switch (range) {
    case 'today':
      d.setHours(0, 0, 0, 0);
      return d;
    case 'week':
      d.setDate(now.getDate() - 7);
      return d;
    case 'month':
      d.setMonth(now.getMonth() - 1);
      return d;
    case 'year':
      d.setFullYear(now.getFullYear() - 1);
      return d;
    default:
      return null;
  }
};

const flatName = (rel: OrderRow['customer']): string => {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name ?? '';
  return rel.name ?? '';
};

// The accepted marketplace offer is the commercial basis (payment v2);
// legacy rows fall back to the old quote / estimate.
const revenueOf = (o: OrderRow): number =>
  Number(o.accepted_offer_amount ?? o.final_price ?? o.estimated_price ?? 0);

const paidOf = (o: OrderRow): number => Number(o.amount_paid ?? 0);

// Delivery fee the customer paid. 100% platform revenue — never part of the
// technician/platform commission split base (which is service price only).
const deliveryOf = (o: OrderRow): number => Number(o.delivery_fee ?? 0);

const sumPrices = (list: { price?: number }[] | null | undefined): number =>
  Array.isArray(list) ? list.reduce((s, a) => s + Number(a?.price ?? 0), 0) : 0;

// Accessories + protection add-ons sold on the order. 100% platform revenue,
// same treatment as delivery — not part of the tech/platform % split.
const addonsOf = (o: OrderRow): number =>
  sumPrices(o.accessories) + sumPrices(o.protection_addons);

const discountOf = (o: OrderRow): number => Number(o.discount_amount ?? 0);

export const getAccountingData = async (
  range: AccountingRange,
  isRTL: boolean
): Promise<AccountingData> => {
  const start = rangeStart(range);

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, accepted_offer_amount, final_price, estimated_price, delivery_fee, discount_amount, accessories, protection_addons, amount_paid, spare_parts_cost, status, payment_status, service_type, created_at, technician_id, customer:users!user_id(name), technician:users!technician_id(name)'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (start) query = query.gte('created_at', start.toISOString());

  const { data, error } = await query;
  if (error) {
    logger.warn('getAccountingData failed', error);
    throw error;
  }

  const rows = (data ?? []) as OrderRow[];
  const completed = rows.filter((o) => o.status === 'completed');

  const totalRevenue = completed.reduce((s, o) => s + revenueOf(o), 0);
  const totalDelivery = completed.reduce((s, o) => s + deliveryOf(o), 0);
  const totalAddons = completed.reduce((s, o) => s + addonsOf(o), 0);
  const totalSpareParts = completed.reduce(
    (s, o) => s + Number(o.spare_parts_cost ?? 0),
    0
  );
  const netProfit = totalRevenue - totalSpareParts;
  // Collection view: what was actually collected vs. what is still owed on
  // live/completed (non-cancelled) orders. amount_paid is recorded against the
  // customer's FULL total, so the amount owed must use the same base:
  // service + delivery + add-ons − discount (mirrors orderMoney.getOrderTotals).
  const billableAmount = (o: OrderRow): number =>
    Math.max(0, revenueOf(o) + deliveryOf(o) + addonsOf(o) - discountOf(o));
  const billable = rows.filter(
    (o) => !['cancelled', 'rejected', 'pending'].includes(o.status)
  );
  const totalPaid = billable.reduce((s, o) => s + paidOf(o), 0);
  const totalOutstanding = billable.reduce(
    (s, o) => s + Math.max(0, billableAmount(o) - paidOf(o)),
    0
  );
  const pendingRows = billable.filter(
    (o) => billableAmount(o) - paidOf(o) > 0.009 && o.payment_status !== 'paid'
  );
  const pendingPayments = pendingRows.reduce(
    (s, o) => s + Math.max(0, billableAmount(o) - paidOf(o)),
    0
  );

  const now = Date.now();
  const pendingOrders: PendingOrder[] = pendingRows
    .map((o) => ({
      id: o.id,
      orderNumber: o.order_number ?? `#${o.id.slice(0, 6)}`,
      customer: flatName(o.customer) || (isRTL ? 'بدون اسم' : 'No name'),
      amount: Math.max(0, billableAmount(o) - paidOf(o)),
      ageDays: o.created_at
        ? Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 86400000))
        : 0,
    }))
    .sort((a, b) => b.ageDays - a.ageDays);

  // Per-technician earnings.
  const techMap = new Map<string, TechnicianEarning>();
  for (const o of completed) {
    const tid = o.technician_id ?? 'unassigned';
    const name = flatName(o.technician) || (isRTL ? 'غير معيّن' : 'Unassigned');
    const cur =
      techMap.get(tid) ??
      ({ technicianId: tid, name, completedOrders: 0, revenue: 0, spareParts: 0, net: 0 } as TechnicianEarning);
    cur.completedOrders += 1;
    cur.revenue += revenueOf(o);
    cur.spareParts += Number(o.spare_parts_cost ?? 0);
    cur.net = cur.revenue - cur.spareParts;
    techMap.set(tid, cur);
  }
  const technicians = [...techMap.values()].sort((a, b) => b.revenue - a.revenue);

  // Revenue by service category.
  const catMap = new Map<string, number>();
  for (const o of completed) {
    const key = o.service_type || (isRTL ? 'أخرى' : 'Other');
    catMap.set(key, (catMap.get(key) ?? 0) + revenueOf(o));
  }
  const categories = [...catMap.entries()]
    .map(([label, revenue]) => ({ label, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue buckets for the bar chart. Daily for short ranges, monthly for long.
  const monthly = range === 'year' || range === 'all';
  const bucketMap = new Map<string, number>();
  for (const o of completed) {
    if (!o.created_at) continue;
    const dt = new Date(o.created_at);
    const key = monthly
      ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + revenueOf(o));
  }
  const revenueBuckets = [...bucketMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([label, revenue]) => ({ label, revenue }));

  const recent: RecentTransaction[] = completed.slice(0, 50).map((o) => {
    const amount = revenueOf(o);
    const paid = paidOf(o);
    const spareParts = Number(o.spare_parts_cost ?? 0);
    return {
      id: o.id,
      orderNumber: o.order_number ?? `#${o.id.slice(0, 6)}`,
      customer: flatName(o.customer) || (isRTL ? 'بدون اسم' : 'No name'),
      technician: flatName(o.technician) || (isRTL ? 'غير معيّن' : 'Unassigned'),
      service: o.service_type || (isRTL ? 'خدمة' : 'Service'),
      amount,
      paid,
      // Owed against the full total the customer pays (service + delivery).
      remaining: Math.max(0, billableAmount(o) - paid),
      spareParts,
      net: amount - spareParts,
      date: o.created_at ?? '',
    };
  });

  return {
    totalRevenue,
    totalDelivery,
    totalAddons,
    totalPaid,
    totalOutstanding,
    totalSpareParts,
    netProfit,
    pendingPayments,
    completedCount: completed.length,
    revenueBuckets,
    technicians,
    categories,
    recent,
    pendingOrders,
  };
};

const csvCell = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const shareCsv = async (lines: string[], filePrefix: string): Promise<void> => {
  // Prepend a BOM so Excel renders Arabic correctly.
  const csv = '﻿' + lines.join('\n');
  const fileUri = `${FileSystem.documentDirectory}${filePrefix}-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Fixate Accounting',
      UTI: 'public.comma-separated-values-text',
    });
  }
};

/** Export the full accounting report (all sections) as a CSV file. */
export const exportAccountingCsv = async (
  data: AccountingData,
  isRTL: boolean,
  commissionRate = 0
): Promise<void> => {
  const sar = isRTL ? 'ر.س' : 'SAR';
  // Commission is the platform's % of SERVICE revenue only; delivery is added
  // on top (platform keeps 100% of delivery). Technician share is the rest.
  const platformCommission = (data.totalRevenue * commissionRate) / 100;
  const technicianShare = (data.totalRevenue * (100 - commissionRate)) / 100;
  const platformTotal = platformCommission + data.totalDelivery + data.totalAddons;
  const lines: string[] = [];

  lines.push(isRTL ? 'الملخص' : 'Summary');
  lines.push(`${isRTL ? 'إيرادات الخدمة (المبالغ المتفق عليها)' : 'Service revenue (accepted amounts)'} (${sar}),${data.totalRevenue.toFixed(2)}`);
  lines.push(`${isRTL ? 'إيراد التوصيل (للمنصة)' : 'Delivery revenue (platform)'} (${sar}),${data.totalDelivery.toFixed(2)}`);
  lines.push(`${isRTL ? 'إيراد الإضافات (للمنصة)' : 'Add-ons revenue (platform)'} (${sar}),${data.totalAddons.toFixed(2)}`);
  lines.push(`${isRTL ? 'إجمالي المُحصَّل فعلياً' : 'Total actually collected'} (${sar}),${data.totalPaid.toFixed(2)}`);
  lines.push(`${isRTL ? 'أرصدة غير مُحصَّلة' : 'Outstanding balances'} (${sar}),${data.totalOutstanding.toFixed(2)}`);
  lines.push(`${isRTL ? 'إجمالي المصروفات (قطع الغيار)' : 'Total expenses (spare parts)'} (${sar}),${data.totalSpareParts.toFixed(2)}`);
  lines.push(`${isRTL ? 'صافي الربح' : 'Net profit'} (${sar}),${data.netProfit.toFixed(2)}`);
  lines.push(`${isRTL ? 'مدفوعات معلقة' : 'Pending payments'} (${sar}),${data.pendingPayments.toFixed(2)}`);
  lines.push(`${isRTL ? 'حصة الفنيين' : 'Technician share'} (${100 - commissionRate}%) (${sar}),${technicianShare.toFixed(2)}`);
  lines.push(`${isRTL ? 'عمولة المنصة (من الخدمة)' : 'Platform commission (service)'} (${commissionRate}%) (${sar}),${platformCommission.toFixed(2)}`);
  lines.push(`${isRTL ? 'إجمالي حصة المنصة (عمولة + توصيل + إضافات)' : 'Platform total (commission + delivery + add-ons)'} (${sar}),${platformTotal.toFixed(2)}`);
  lines.push('');

  lines.push(isRTL ? 'أرباح وعمولات الفنيين' : 'Technician P&L');
  lines.push(
    [
      isRTL ? 'الفني' : 'Technician',
      isRTL ? 'طلبات مكتملة' : 'Completed',
      isRTL ? 'الإيرادات' : 'Revenue',
      isRTL ? 'قطع الغيار' : 'Spare parts',
      isRTL ? 'الصافي' : 'Net',
      isRTL ? 'العمولة' : 'Commission',
    ].map(csvCell).join(',')
  );
  for (const t of data.technicians) {
    lines.push(
      [
        t.name,
        t.completedOrders,
        t.revenue.toFixed(2),
        t.spareParts.toFixed(2),
        t.net.toFixed(2),
        ((t.revenue * commissionRate) / 100).toFixed(2),
      ].map(csvCell).join(',')
    );
  }
  lines.push('');

  lines.push(isRTL ? 'المعاملات' : 'Transactions');
  lines.push(
    [
      isRTL ? 'رقم الطلب' : 'Order',
      isRTL ? 'العميل' : 'Customer',
      isRTL ? 'الفني' : 'Technician',
      isRTL ? 'الخدمة' : 'Service',
      isRTL ? 'الإجمالي' : 'Total',
      isRTL ? 'المدفوع' : 'Paid',
      isRTL ? 'المتبقي' : 'Remaining',
      isRTL ? 'قطع الغيار' : 'Spare parts',
      isRTL ? 'الصافي' : 'Net',
      isRTL ? 'التاريخ' : 'Date',
    ].map(csvCell).join(',')
  );
  for (const r of data.recent) {
    lines.push(
      [
        r.orderNumber, r.customer, r.technician, r.service,
        r.amount.toFixed(2), r.paid.toFixed(2), r.remaining.toFixed(2),
        r.spareParts.toFixed(2), r.net.toFixed(2), r.date.slice(0, 10),
      ].map(csvCell).join(',')
    );
  }
  lines.push('');

  lines.push(isRTL ? 'المدفوعات المعلقة والمتأخرة' : 'Pending & overdue');
  lines.push(
    [
      isRTL ? 'رقم الطلب' : 'Order',
      isRTL ? 'العميل' : 'Customer',
      isRTL ? 'المبلغ' : 'Amount',
      isRTL ? 'متأخر (أيام)' : 'Overdue (days)',
    ].map(csvCell).join(',')
  );
  for (const p of data.pendingOrders) {
    lines.push([p.orderNumber, p.customer, p.amount.toFixed(2), p.ageDays].map(csvCell).join(','));
  }

  await shareCsv(lines, 'fixate-accounting');
};

/** Export a focused per-technician P&L + commission summary as a CSV file. */
export const exportTechnicianSummaryCsv = async (
  data: AccountingData,
  isRTL: boolean,
  commissionRate = 0
): Promise<void> => {
  const lines: string[] = [];
  lines.push(isRTL ? 'ملخص الفنيين' : 'Technician summary');
  lines.push(
    [
      isRTL ? 'الفني' : 'Technician',
      isRTL ? 'طلبات مكتملة' : 'Completed orders',
      isRTL ? 'إجمالي الإيرادات' : 'Gross revenue',
      isRTL ? 'مصروف قطع الغيار' : 'Spare parts expense',
      isRTL ? 'صافي الأرباح' : 'Net earnings',
      isRTL ? `عمولة المنصة (${commissionRate}%)` : `Platform commission (${commissionRate}%)`,
    ].map(csvCell).join(',')
  );
  for (const t of data.technicians) {
    lines.push(
      [
        t.name,
        t.completedOrders,
        t.revenue.toFixed(2),
        t.spareParts.toFixed(2),
        t.net.toFixed(2),
        ((t.revenue * commissionRate) / 100).toFixed(2),
      ].map(csvCell).join(',')
    );
  }
  await shareCsv(lines, 'fixate-technician-summary');
};
