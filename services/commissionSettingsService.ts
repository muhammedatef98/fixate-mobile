import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Commission split between the technician and the platform (§11). Single-row
 * `commission_settings` table is the source of truth — replaces the previous
 * device-local AsyncStorage value so the split is consistent across admins and
 * devices, and every financial calculation reads from the same place.
 */
export interface CommissionSettings {
  /** Technician share of order revenue, 0–100. */
  technicianPct: number;
  /** Platform share, derived as 100 - technicianPct. */
  platformPct: number;
  updatedAt?: string | null;
}

const DEFAULT_TECHNICIAN_PCT = 80;

const fromRow = (technicianPct: number, updatedAt?: string | null): CommissionSettings => {
  const tech = Math.max(0, Math.min(100, Number(technicianPct) || 0));
  return { technicianPct: tech, platformPct: 100 - tech, updatedAt: updatedAt ?? null };
};

/** Read the current split. Falls back to the 80/20 default when unavailable. */
export const getCommissionSettings = async (): Promise<CommissionSettings> => {
  try {
    const { data, error } = await supabase
      .from('commission_settings')
      .select('technician_pct, updated_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return fromRow(data.technician_pct, data.updated_at);
  } catch (e) {
    logger.warn('getCommissionSettings failed (using default)', e);
  }
  return fromRow(DEFAULT_TECHNICIAN_PCT);
};

/** Upsert the single settings row (admin-only via RLS). */
export const saveCommissionSettings = async (
  technicianPct: number,
  updatedBy?: string
): Promise<CommissionSettings> => {
  const tech = Math.max(0, Math.min(100, Number(technicianPct) || 0));
  const { data, error } = await supabase
    .from('commission_settings')
    .upsert(
      { singleton: true, technician_pct: tech, updated_by: updatedBy ?? null },
      { onConflict: 'singleton' }
    )
    .select('technician_pct, updated_at')
    .single();
  if (error) throw error;
  return fromRow(data.technician_pct, data.updated_at);
};
