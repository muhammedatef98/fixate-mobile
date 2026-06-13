import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface InvoiceLineItem {
  labelEn: string;
  labelAr: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export type InvoiceStatus = 'issued' | 'paid' | 'void' | 'refunded';

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  status: InvoiceStatus;
  issued_at: string;
  currency: string;

  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;

  technician_id: string | null;
  technician_name: string | null;
  technician_phone: string | null;

  device_label: string | null;
  line_items: InvoiceLineItem[];

  subtotal: number;
  discount_total: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  platform_commission: number | null;

  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;

  seller_name: string | null;
  seller_vat_number: string | null;
  seller_cr_number: string | null;
  seller_address: string | null;

  zatca_tlv: string | null;
  notes: string | null;
  footer: string | null;

  created_at: string;
  updated_at: string;
}

export interface InvoiceSettings {
  enabled: boolean;
  prefix: string;
  companyName: string;
  logoUrl: string;
  vatNumber: string;
  crNumber: string;
  address: string;
  email: string;
  phone: string;
  vatRate: number;
  pricesIncludeVat: boolean;
  footer: string;
  legalText: string;
}

export interface ListInvoicesOptions {
  status?: InvoiceStatus | 'all';
  search?: string;
  limit?: number;
}

const normalize = (row: any): Invoice => ({
  ...row,
  line_items: Array.isArray(row.line_items) ? row.line_items : [],
});

export const listInvoices = async (opts: ListInvoicesOptions = {}): Promise<Invoice[]> => {
  const { status = 'all', search, limit = 200 } = opts;
  let q = supabase
    .from('invoices')
    .select('*')
    .order('issued_at', { ascending: false })
    .limit(limit);
  if (status !== 'all') q = q.eq('status', status);
  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(
      `invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,customer_email.ilike.%${s}%`
    );
  }
  const { data, error } = await q;
  if (error) {
    logger.warn('listInvoices failed', error);
    return [];
  }
  return (data ?? []).map(normalize);
};

export const getInvoice = async (id: string): Promise<Invoice | null> => {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error) {
    logger.warn('getInvoice failed', error);
    return null;
  }
  return data ? normalize(data) : null;
};

export const getInvoiceByOrder = async (orderId: string): Promise<Invoice | null> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) {
    logger.warn('getInvoiceByOrder failed', error);
    return null;
  }
  return data ? normalize(data) : null;
};

/**
 * Ensures an invoice exists for a completed order and returns it. Idempotent
 * on the server — calling repeatedly returns the same invoice. Used by both
 * the customer download action and the admin billing screen.
 */
export const ensureInvoiceForOrder = async (orderId: string): Promise<Invoice | null> => {
  const existing = await getInvoiceByOrder(orderId);
  if (existing) return existing;
  const { data, error } = await supabase.rpc('generate_invoice_for_order', {
    p_order_id: orderId,
  });
  if (error) {
    logger.warn('generate_invoice_for_order failed', error);
    throw error;
  }
  const id = typeof data === 'string' ? data : null;
  if (!id) return null;
  return getInvoice(id);
};

export const updateInvoiceStatus = async (id: string, status: InvoiceStatus): Promise<void> => {
  const { error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logger.warn('updateInvoiceStatus failed', error);
    throw error;
  }
};

// ── Invoice settings (stored in platform_settings) ─────────────────────────
const SETTING_KEYS = [
  'invoice_enabled',
  'invoice_prefix',
  'invoice_company_name',
  'invoice_logo_url',
  'invoice_vat_number',
  'invoice_cr_number',
  'invoice_address',
  'invoice_email',
  'invoice_phone',
  'invoice_vat_rate',
  'invoice_prices_include_vat',
  'invoice_footer',
  'invoice_legal_text',
];

const str = (v: any, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));

export const getInvoiceSettings = async (): Promise<InvoiceSettings> => {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', SETTING_KEYS);
  const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
  return {
    enabled: map.get('invoice_enabled') !== false,
    prefix: str(map.get('invoice_prefix'), 'INV'),
    companyName: str(map.get('invoice_company_name'), 'Fixate'),
    logoUrl: str(map.get('invoice_logo_url')),
    vatNumber: str(map.get('invoice_vat_number')),
    crNumber: str(map.get('invoice_cr_number')),
    address: str(map.get('invoice_address')),
    email: str(map.get('invoice_email')),
    phone: str(map.get('invoice_phone')),
    vatRate: Number(map.get('invoice_vat_rate') ?? 0.15) || 0.15,
    pricesIncludeVat: map.get('invoice_prices_include_vat') !== false,
    footer: str(map.get('invoice_footer')),
    legalText: str(map.get('invoice_legal_text')),
  };
};

export const saveInvoiceSettings = async (s: InvoiceSettings): Promise<void> => {
  const entries = [
    { key: 'invoice_enabled', value: s.enabled },
    { key: 'invoice_prefix', value: s.prefix },
    { key: 'invoice_company_name', value: s.companyName },
    { key: 'invoice_logo_url', value: s.logoUrl },
    { key: 'invoice_vat_number', value: s.vatNumber },
    { key: 'invoice_cr_number', value: s.crNumber },
    { key: 'invoice_address', value: s.address },
    { key: 'invoice_email', value: s.email },
    { key: 'invoice_phone', value: s.phone },
    { key: 'invoice_vat_rate', value: s.vatRate },
    { key: 'invoice_prices_include_vat', value: s.pricesIncludeVat },
    { key: 'invoice_footer', value: s.footer },
    { key: 'invoice_legal_text', value: s.legalText },
  ];
  const rows = entries.map((e) => ({ key: e.key, value: e.value, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
  if (error) {
    logger.warn('saveInvoiceSettings failed', error);
    throw error;
  }
};
