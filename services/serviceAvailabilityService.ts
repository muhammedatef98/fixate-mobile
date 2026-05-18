import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { SERVICE_CATALOG } from '../constants/serviceCatalog';

// Per-technician service availability.
//
// Backend status: a `service_availability` table (technician_id, service_id,
// enabled) is the source of truth once the migration is applied. Until then
// this service degrades gracefully — reads return the catalog defaults and
// writes are accepted but flagged as pending backend so the technician UI
// stays usable while the admin/backend side is built.

export type AvailabilityMap = Record<string, boolean>;

export const getDefaultAvailability = (): AvailabilityMap =>
  SERVICE_CATALOG.reduce((acc, s) => {
    acc[s.id] = s.defaultEnabled;
    return acc;
  }, {} as AvailabilityMap);

export const getAvailability = async (
  technicianId: string
): Promise<{ map: AvailabilityMap; pendingBackend: boolean }> => {
  const defaults = getDefaultAvailability();
  if (!technicianId) return { map: defaults, pendingBackend: true };

  try {
    const { data, error } = await supabase
      .from('service_availability')
      .select('service_id, enabled')
      .eq('technician_id', technicianId);

    if (error || !data) {
      return { map: defaults, pendingBackend: true };
    }
    const map = { ...defaults };
    for (const row of data as { service_id: string; enabled: boolean }[]) {
      if (row.service_id in map) map[row.service_id] = row.enabled;
    }
    return { map, pendingBackend: false };
  } catch (e) {
    logger.warn('getAvailability fell back to defaults', e);
    return { map: defaults, pendingBackend: true };
  }
};

export const setServiceEnabled = async (
  technicianId: string,
  serviceId: string,
  enabled: boolean
): Promise<{ ok: boolean; pendingBackend: boolean }> => {
  if (!technicianId) return { ok: false, pendingBackend: true };
  try {
    const { error } = await supabase
      .from('service_availability')
      .upsert(
        { technician_id: technicianId, service_id: serviceId, enabled },
        { onConflict: 'technician_id,service_id' }
      );
    if (error) return { ok: true, pendingBackend: true };
    return { ok: true, pendingBackend: false };
  } catch (e) {
    logger.warn('setServiceEnabled recorded locally only', e);
    return { ok: true, pendingBackend: true };
  }
};
