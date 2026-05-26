import * as Location from 'expo-location';
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

export interface TechnicianLocation {
  technician_id: string;
  order_id: string | null;
  latitude: number;
  longitude: number;
  heading?: number | null;
  updated_at?: string;
}

let watcher: Location.LocationSubscription | null = null;

export const startBroadcastingLocation = async (technicianId: string, orderId: string) => {
  await stopBroadcastingLocation();
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    logger.warn('Location permission not granted');
    return;
  }
  watcher = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
    async (pos) => {
      try {
        await supabase.from('technician_locations').upsert(
          {
            technician_id: technicianId,
            order_id: orderId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'technician_id' }
        );
      } catch (e) {
        logger.error('upsert location failed', e);
      }
    }
  );
};

export const stopBroadcastingLocation = async () => {
  if (watcher) {
    watcher.remove();
    watcher = null;
  }
};

export const subscribeToTechnicianLocation = (
  orderId: string,
  callback: (loc: TechnicianLocation | null) => void
) => {
  // Initial fetch
  supabase
    .from('technician_locations')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
    .then(({ data }) => callback(data));

  // subscribeUnique returns the cleanup callable directly — pass it
  // through as this function's own return so the caller's useEffect
  // wiring still works unchanged.
  return subscribeUnique(`tech-loc-${orderId}`, (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'technician_locations', filter: `order_id=eq.${orderId}` },
      (payload: any) => callback((payload.new as TechnicianLocation) ?? null)
    )
  );
};
