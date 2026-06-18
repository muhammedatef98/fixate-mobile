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
  amount: number;
  date: string;
}

export interface AccountingData {
  totalRevenue: number;
  totalSpareParts: number;
  netProfit: number;
  pendingPayments: number;
  completedCount: number;
  revenueBuckets: RevenueBucket[];
  technicians: TechnicianEarning[];
  categories: CategorySlice[];
  recent: RecentTransaction[];
}

interface OrderRow {
  id: string;
  order_number: string | null;
  final_price: number | null;
  estimated_price: number | null;
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

const revenueOf = (o: OrderRow): number =>
  Number(o.final_price ?? o.estimated_price ?? 0);

export const getAccountingData = async (
  range: AccountingRange,
  isRTL: boolean
): Promise<AccountingData> => {
  const start = rangeStart(range);

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, final_price, estimated_price, spare_parts_cost, status, payment_status, service_type, created_at, technician_id, customer:users!user_id(name), technician:users!technician_id(name)'
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
  const totalSpareParts = completed.reduce(
    (s, o) => s + Number(o.spare_parts_cost ?? 0),
    0
  );
  const netProfit = totalRevenue - totalSpareParts;
  const pendingPayments = rows
    .filter((o) => o.payment_status === 'pending' || o.payment_status === 'pending_payment')
    .reduce((s, o) => s + revenueOf(o), 0);

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

  const recent: RecentTransaction[] = completed.slice(0, 20).map((o) => ({
    id: o.id,
    orderNumber: o.order_number ?? `#${o.id.slice(0, 6)}`,
    customer: flatName(o.customer) || (isRTL ? 'بدون اسم' : 'No name'),
    technician: flatName(o.technician) || (isRTL ? 'غير معيّن' : 'Unassigned'),
    amount: revenueOf(o),
    date: o.created_at ?? '',
  }));

  return {
    totalRevenue,
    totalSpareParts,
    netProfit,
    pendingPayments,
    completedCount: completed.length,
    revenueBuckets,
    technicians,
    categories,
    recent,
  };
};

const csvCell = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export the per-technician + recent-transaction data as a CSV file. */
export const exportAccountingCsv = async (
  data: AccountingData,
  isRTL: boolean
): Promise<void> => {
  const sar = isRTL ? 'ر.س' : 'SAR';
  const lines: string[] = [];

  lines.push(isRTL ? 'الملخص' : 'Summary');
  lines.push(`${isRTL ? 'إجمالي الإيرادات' : 'Total revenue'} (${sar}),${data.totalRevenue.toFixed(2)}`);
  lines.push(`${isRTL ? 'تكلفة قطع الغيار' : 'Spare parts cost'} (${sar}),${data.totalSpareParts.toFixed(2)}`);
  lines.push(`${isRTL ? 'صافي الربح' : 'Net profit'} (${sar}),${data.netProfit.toFixed(2)}`);
  lines.push(`${isRTL ? 'مدفوعات معلقة' : 'Pending payments'} (${sar}),${data.pendingPayments.toFixed(2)}`);
  lines.push('');

  lines.push(isRTL ? 'أرباح الفنيين' : 'Technician earnings');
  lines.push(
    [
      isRTL ? 'الفني' : 'Technician',
      isRTL ? 'طلبات مكتملة' : 'Completed',
      isRTL ? 'الإيرادات' : 'Revenue',
      isRTL ? 'قطع الغيار' : 'Spare parts',
      isRTL ? 'الصافي' : 'Net',
    ]
      .map(csvCell)
      .join(',')
  );
  for (const t of data.technicians) {
    lines.push(
      [t.name, t.completedOrders, t.revenue.toFixed(2), t.spareParts.toFixed(2), t.net.toFixed(2)]
        .map(csvCell)
        .join(',')
    );
  }
  lines.push('');

  lines.push(isRTL ? 'أحدث المعاملات' : 'Recent transactions');
  lines.push(
    [
      isRTL ? 'رقم الطلب' : 'Order',
      isRTL ? 'العميل' : 'Customer',
      isRTL ? 'الفني' : 'Technician',
      isRTL ? 'المبلغ' : 'Amount',
      isRTL ? 'التاريخ' : 'Date',
    ]
      .map(csvCell)
      .join(',')
  );
  for (const r of data.recent) {
    lines.push(
      [r.orderNumber, r.customer, r.technician, r.amount.toFixed(2), r.date.slice(0, 10)]
        .map(csvCell)
        .join(',')
    );
  }

  // Prepend a BOM so Excel renders Arabic correctly.
  const csv = '﻿' + lines.join('\n');
  const fileUri = `${FileSystem.documentDirectory}fixate-accounting-${Date.now()}.csv`;
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
