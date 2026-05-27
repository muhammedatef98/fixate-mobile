import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Admin-controlled device-type catalogue powering the customer repair
 * request flow. Reads are open to everyone (the request chooser needs
 * them); writes are gated by the `request_device_types_admin_all` RLS
 * policy → only users with `is_admin = true` can mutate. The admin UI
 * exposes enable/disable + edit + create. There is no hard-delete in
 * the UI; the schema permits it via RLS but admins should rely on the
 * `enabled` flag (matches the project-wide "no client hard-delete"
 * posture).
 */
export interface RequestDeviceType {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  icon: string;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// 5-minute in-memory cache mirrors the patterns used elsewhere
// (platformSettingsService, serviceAreasService). Mutations bust the
// cache so an admin toggle propagates to the request flow on next read.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { ts: number; rows: RequestDeviceType[] } | null = null;

export const invalidateRequestDeviceTypesCache = (): void => {
  cache = null;
};

/** All device types, ordered by `sort_order` then `name_en`. */
export const listRequestDeviceTypes = async (): Promise<RequestDeviceType[]> => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rows;
  try {
    const { data, error } = await supabase
      .from('request_device_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as RequestDeviceType[];
    cache = { ts: Date.now(), rows };
    return rows;
  } catch (e) {
    logger.warn('listRequestDeviceTypes failed', e);
    return [];
  }
};

/** Only enabled rows — used by the customer request flow when it needs
 *  to filter out disabled options without checking the flag itself. The
 *  chooser today shows both enabled + disabled (with a "Coming soon"
 *  pill on disabled), so most callers should use `listRequestDeviceTypes`. */
export const listEnabledRequestDeviceTypes = async (): Promise<RequestDeviceType[]> => {
  const all = await listRequestDeviceTypes();
  return all.filter((d) => d.enabled);
};

export type CreateRequestDeviceTypeInput = {
  code: string;
  name_ar: string;
  name_en: string;
  icon?: string;
  enabled?: boolean;
  sort_order?: number;
};

export const createRequestDeviceType = async (
  input: CreateRequestDeviceTypeInput
): Promise<RequestDeviceType> => {
  const row = {
    code: input.code.trim(),
    name_ar: input.name_ar.trim(),
    name_en: input.name_en.trim(),
    icon: (input.icon ?? 'devices').trim(),
    enabled: input.enabled ?? true,
    sort_order: input.sort_order ?? 100,
  };
  const { data, error } = await supabase
    .from('request_device_types')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  invalidateRequestDeviceTypesCache();
  return data as RequestDeviceType;
};

export const updateRequestDeviceType = async (
  id: string,
  patch: Partial<Pick<RequestDeviceType, 'code' | 'name_ar' | 'name_en' | 'icon' | 'enabled' | 'sort_order'>>
): Promise<RequestDeviceType> => {
  const { data, error } = await supabase
    .from('request_device_types')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  invalidateRequestDeviceTypesCache();
  return data as RequestDeviceType;
};

/** Shortcut for the most common admin action: toggle enabled. */
export const setRequestDeviceTypeEnabled = async (
  id: string,
  enabled: boolean
): Promise<RequestDeviceType> => updateRequestDeviceType(id, { enabled });
