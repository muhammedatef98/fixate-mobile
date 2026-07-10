/**
 * pricingRegistryService.ts — the programmable pricing foundation (§4/§5/§16).
 *
 * Two optional override sources on top of the existing hardcoded logic:
 *   • pricing_addons  — admin-managed accessory/protection catalog.
 *   • pricing_rules   — admin-managed repair-price registry (brand/model/
 *                       category/repair-type granularity, file-import ready).
 *
 * Resolution is fallback-first: when a table has no relevant active rows the
 * app keeps its current behavior (constants / repairData / estimate config).
 * Populate the tables (manually now, or via a future Excel import that inserts
 * source='import' rows) and the app switches to the managed values cleanly.
 *
 * Reads are cached briefly so the request flow never waterfalls on them.
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import type { AddonItem } from '../types/order';
import {
  getAccessorySuggestions,
  PROTECTION_ADDONS,
} from '../types/order';
import { pickBestRulePrice, type RepairPriceContext } from '../utils/pricingMatch';

export type { RepairPriceContext } from '../utils/pricingMatch';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PricingAddonRow {
  id: string;
  kind: 'accessory' | 'protection';
  device_type: string | null;
  item_key: string;
  name_ar: string;
  name_en: string;
  price: number;
  sort: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRuleRow {
  id: string;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  repair_type: string | null;
  price: number;
  active: boolean;
  source: 'manual' | 'import';
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Cache (active rows only, for the customer flow) ──────────────────────────

const TTL = 5 * 60 * 1000;
let addonCache: { ts: number; rows: PricingAddonRow[] } | null = null;
let ruleCache: { ts: number; rows: PricingRuleRow[] } | null = null;

export const invalidatePricingCache = (): void => {
  addonCache = null;
  ruleCache = null;
};

const loadActiveAddons = async (): Promise<PricingAddonRow[]> => {
  if (addonCache && Date.now() - addonCache.ts < TTL) return addonCache.rows;
  try {
    const { data, error } = await supabase
      .from('pricing_addons')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as PricingAddonRow[];
    addonCache = { ts: Date.now(), rows };
    return rows;
  } catch (e) {
    logger.warn('loadActiveAddons failed, using defaults', e);
    return addonCache?.rows ?? [];
  }
};

// ponytail: fetch all active rules and match in JS. Fine for a manual/imported
// catalog in the hundreds; add a server-side resolver RPC if it ever grows to
// tens of thousands of rows.
const loadActiveRules = async (): Promise<PricingRuleRow[]> => {
  if (ruleCache && Date.now() - ruleCache.ts < TTL) return ruleCache.rows;
  try {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('active', true);
    if (error) throw error;
    const rows = (data ?? []) as PricingRuleRow[];
    ruleCache = { ts: Date.now(), rows };
    return rows;
  } catch (e) {
    logger.warn('loadActiveRules failed, using baselines', e);
    return ruleCache?.rows ?? [];
  }
};

// ── Resolvers (customer flow) ────────────────────────────────────────────────

const toAddonItem = (r: PricingAddonRow): AddonItem => ({
  id: r.item_key,
  name_ar: r.name_ar,
  name_en: r.name_en,
  price: Number(r.price),
});

/**
 * Accessory catalog for a device type. Admin rows (device-specific first, then
 * device-agnostic) replace the hardcoded suggestions when any exist; otherwise
 * the current constants are returned unchanged.
 */
export const getAccessories = async (
  deviceType?: string | null
): Promise<AddonItem[]> => {
  const rows = (await loadActiveAddons()).filter((r) => r.kind === 'accessory');
  if (rows.length === 0) return getAccessorySuggestions(deviceType);
  const match = rows.filter(
    (r) => r.device_type == null || r.device_type === deviceType
  );
  const use = match.length > 0 ? match : rows.filter((r) => r.device_type == null);
  if (use.length === 0) return getAccessorySuggestions(deviceType);
  return use.map(toAddonItem);
};

/** Protection add-ons. Admin rows replace PROTECTION_ADDONS when any exist. */
export const getProtection = async (): Promise<AddonItem[]> => {
  const rows = (await loadActiveAddons()).filter((r) => r.kind === 'protection');
  if (rows.length === 0) return PROTECTION_ADDONS;
  return rows.map(toAddonItem);
};

/**
 * Best-matching managed repair price, or null when no rule applies (caller
 * then keeps the existing estimate logic). "Most specific active rule wins":
 * every non-null column on the rule must match the context, and among those
 * the rule matching the most columns is chosen.
 */
export const resolveRepairPrice = async (
  ctx: RepairPriceContext
): Promise<number | null> => {
  const rules = await loadActiveRules();
  if (rules.length === 0) return null;
  return pickBestRulePrice(rules, ctx);
};

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export const adminListAddons = async (): Promise<PricingAddonRow[]> => {
  const { data, error } = await supabase
    .from('pricing_addons')
    .select('*')
    .order('kind', { ascending: true })
    .order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PricingAddonRow[];
};

export interface AddonInput {
  kind: 'accessory' | 'protection';
  device_type?: string | null;
  item_key: string;
  name_ar: string;
  name_en: string;
  price: number;
  sort?: number;
  active?: boolean;
}

export const adminSaveAddon = async (
  input: AddonInput,
  id?: string
): Promise<void> => {
  const payload = {
    kind: input.kind,
    device_type: input.device_type?.trim() || null,
    item_key: input.item_key.trim(),
    name_ar: input.name_ar.trim(),
    name_en: input.name_en.trim(),
    price: input.price,
    sort: input.sort ?? 0,
    active: input.active ?? true,
  };
  const q = id
    ? supabase.from('pricing_addons').update(payload).eq('id', id)
    : supabase.from('pricing_addons').insert(payload);
  const { error } = await q;
  if (error) throw error;
  invalidatePricingCache();
};

export const adminDeleteAddon = async (id: string): Promise<void> => {
  const { error } = await supabase.from('pricing_addons').delete().eq('id', id);
  if (error) throw error;
  invalidatePricingCache();
};

export const adminListRules = async (): Promise<PricingRuleRow[]> => {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PricingRuleRow[];
};

export interface RuleInput {
  device_type?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  repair_type?: string | null;
  price: number;
  active?: boolean;
  note?: string | null;
}

const nz = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export const adminSaveRule = async (
  input: RuleInput,
  id?: string
): Promise<void> => {
  const payload = {
    device_type: nz(input.device_type),
    brand: nz(input.brand),
    model: nz(input.model),
    category: nz(input.category),
    repair_type: nz(input.repair_type),
    price: input.price,
    active: input.active ?? true,
    note: nz(input.note),
    source: 'manual' as const,
  };
  const q = id
    ? supabase.from('pricing_rules').update(payload).eq('id', id)
    : supabase.from('pricing_rules').insert(payload);
  const { error } = await q;
  if (error) throw error;
  invalidatePricingCache();
};

export const adminDeleteRule = async (id: string): Promise<void> => {
  const { error } = await supabase.from('pricing_rules').delete().eq('id', id);
  if (error) throw error;
  invalidatePricingCache();
};
