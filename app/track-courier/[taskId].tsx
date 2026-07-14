import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../../components/RTLIcon';
import { safeBack } from '../../utils/navigation';
import OsmMap, { type OsmMapHandle, type OsmMarker } from '../../components/OsmMap';
import { getDeliveryTaskById, deliveryLegLabel, type DeliveryTask } from '../../services/courierService';
import { subscribeToCourierLocation, type CourierLocation } from '../../services/locationTrackingService';
import { formatAppTimeOnly } from '../../lib/formatDate';
import { logger } from '../../utils/logger';
import GearLoader from '../../components/GearLoader';

// Straight-line distance (km). ponytail: good enough for an ETA proxy; swap for
// a routing API if road-accurate ETA is ever needed.
const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const AVG_KMH = 28; // urban courier average — ETA = distance / this.
const ARRIVED_KM = 0.15;

export default function TrackCourierScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);

  const [task, setTask] = useState<DeliveryTask | null>(null);
  const [loc, setLoc] = useState<CourierLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<OsmMapHandle>(null);

  useEffect(() => {
    if (!taskId) return;
    getDeliveryTaskById(String(taskId))
      .then(setTask)
      .catch((e) => logger.warn('track-courier task load failed', e))
      .finally(() => setLoading(false));
    const unsub = subscribeToCourierLocation(String(taskId), setLoc);
    return unsub;
  }, [taskId]);

  // The courier's current destination stop (where the device is heading on this
  // leg) — used for the distance/ETA readout and the target marker.
  const dest = useMemo(() => {
    if (!task) return null;
    const beforePickup = task.status === 'accepted' || task.status === 'available';
    const lat = beforePickup ? task.pickup_latitude : task.dropoff_latitude;
    const lng = beforePickup ? task.pickup_longitude : task.dropoff_longitude;
    return lat != null && lng != null ? { lat, lng } : null;
  }, [task?.status, task?.pickup_latitude, task?.dropoff_latitude]);

  const distanceKm = loc && dest ? haversineKm(loc.latitude, loc.longitude, dest.lat, dest.lng) : null;
  const arrived = distanceKm != null && distanceKm <= ARRIVED_KM;
  const etaMin = distanceKm != null ? Math.max(1, Math.round((distanceKm / AVG_KMH) * 60)) : null;

  const markers: OsmMarker[] = useMemo(() => {
    const m: OsmMarker[] = [];
    if (loc) m.push({ lat: loc.latitude, lng: loc.longitude, color: '#8B5CF6' });
    if (dest) m.push({ lat: dest.lat, lng: dest.lng, color: '#10b981' });
    return m;
  }, [loc?.latitude, loc?.longitude, dest?.lat, dest?.lng]);

  useEffect(() => {
    if (loc && markers.length > 1) mapRef.current?.fitToMarkers();
    else if (loc) mapRef.current?.recenter(loc.latitude, loc.longitude, 15);
  }, [loc?.latitude, loc?.longitude, markers.length]);

  const legLabel = task ? deliveryLegLabel(task.task_type, task.status)[isRTL ? 'ar' : 'en'] : '';
  const stateLabel = !loc
    ? isRTL ? 'بانتظار بدء التتبع…' : 'Waiting for the courier to start…'
    : arrived
      ? isRTL ? 'وصل المندوب' : 'Courier has arrived'
      : isRTL ? 'المندوب في الطريق' : 'Courier is on the way';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'تتبع المندوب' : 'Track courier'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><GearLoader size={48} /></View>
      ) : !task ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
          <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>{isRTL ? 'لم يتم العثور على المهمة' : 'Task not found'}</Text>
        </View>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            {loc || dest ? (
              <OsmMap
                ref={mapRef}
                latitude={loc?.latitude ?? dest?.lat ?? 24.7}
                longitude={loc?.longitude ?? dest?.lng ?? 46.7}
                zoom={14}
                interactive
                markers={markers}
                style={{ flex: 1 }}
              />
            ) : (
              <View style={styles.center}>
                <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={COLORS.textSecondary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 30 }}>
                  {isRTL
                    ? 'سيظهر موقع المندوب هنا فور بدء المهمة وتشغيل الموقع.'
                    : 'The courier’s position appears here once the task starts and location is on.'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.stateRow}>
              <View style={[styles.dot, { backgroundColor: arrived ? '#10b981' : loc ? '#8B5CF6' : COLORS.textSecondary }]} />
              <Text style={styles.stateText}>{stateLabel}</Text>
            </View>
            <Text style={styles.legText}>{legLabel}</Text>
            <View style={styles.metrics}>
              <Metric
                icon="map-marker-distance"
                label={isRTL ? 'المسافة' : 'Distance'}
                value={distanceKm != null ? `${distanceKm < 1 ? Math.round(distanceKm * 1000) + (isRTL ? ' م' : ' m') : distanceKm.toFixed(1) + (isRTL ? ' كم' : ' km')}` : '—'}
                COLORS={COLORS}
              />
              <Metric
                icon="clock-outline"
                label={isRTL ? 'الوصول المتوقع' : 'ETA'}
                value={arrived ? (isRTL ? 'وصل' : 'Arrived') : etaMin != null ? `~${etaMin} ${isRTL ? 'دقيقة' : 'min'}` : '—'}
                COLORS={COLORS}
              />
              <Metric
                icon="update"
                label={isRTL ? 'آخر تحديث' : 'Updated'}
                value={loc?.updated_at ? formatAppTimeOnly(loc.updated_at, isRTL) : '—'}
                COLORS={COLORS}
              />
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Metric({ icon, label, value, COLORS }: { icon: any; label: string; value: string; COLORS: any }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <MaterialCommunityIcons name={icon} size={20} color={COLORS.primary} />
      <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14, marginTop: 4 }}>{value}</Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
      backgroundColor: COLORS.card,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      padding: SPACING.m,
      paddingBottom: SPACING.l,
    },
    stateRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    stateText: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
    legText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    metrics: { flexDirection: 'row', marginTop: 16 },
  });
