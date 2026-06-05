import { supabase } from './supabaseClient';

export interface DeliveryZone {
  id: string;
  city_name_ar: string;
  city_name_en: string;
  neighborhood_name_ar: string;
  neighborhood_name_en: string;
  delivery_fee: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

/** Full list — used by the admin screen. */
export async function listAllDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .order('city_name_en', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('neighborhood_name_en', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeliveryZone[];
}

/**
 * Active zones for a specific city (by either locale).
 * Used by the customer request flow to resolve a per-neighborhood fee.
 */
export async function listActiveZonesForCity(
  cityEn: string,
  cityAr: string
): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .or(`city_name_en.ilike.%${cityEn}%,city_name_ar.ilike.%${cityAr}%`);
  if (error) throw error;
  return (data ?? []) as DeliveryZone[];
}

/** Admin mutations */
export async function createDeliveryZone(
  payload: Omit<DeliveryZone, 'id' | 'created_at'>
): Promise<DeliveryZone> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as DeliveryZone;
}

export async function updateDeliveryZone(
  id: string,
  patch: Partial<Omit<DeliveryZone, 'id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('delivery_zones')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  const { error } = await supabase
    .from('delivery_zones')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Groups a flat array of zones into a Map keyed by "cityEn|cityAr".
 * Stable order: cities appear in the order their first row is encountered
 * (the SQL layer already orders by city_name_en).
 */
export function groupZonesByCity(
  zones: DeliveryZone[]
): Map<string, { cityAr: string; cityEn: string; zones: DeliveryZone[] }> {
  const map = new Map<
    string,
    { cityAr: string; cityEn: string; zones: DeliveryZone[] }
  >();
  for (const z of zones) {
    const key = `${z.city_name_en}|${z.city_name_ar}`;
    if (!map.has(key)) {
      map.set(key, { cityAr: z.city_name_ar, cityEn: z.city_name_en, zones: [] });
    }
    map.get(key)!.zones.push(z);
  }
  return map;
}

/**
 * Given a list of active zones and the customer's free-text address,
 * returns the first zone whose neighborhood name (AR or EN) appears as a
 * substring of the address.  Returns undefined when no match is found.
 */
export function pickNeighborhoodForAddress(
  zones: DeliveryZone[],
  address: string
): DeliveryZone | undefined {
  const normalized = address.toLowerCase();
  return zones.find(
    (z) =>
      normalized.includes(z.neighborhood_name_en.toLowerCase()) ||
      normalized.includes(z.neighborhood_name_ar.toLowerCase())
  );
}
