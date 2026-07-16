import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../../constants/theme';
import { RTLIonicon } from '../../../components/RTLIcon';
import {
  getDeliveryTaskById,
  advanceDeliveryTask,
  nextDeliveryAction,
  deliveryLegLabel,
  localizeTaskNotes,
  type DeliveryTask,
  type DeliveryTaskStatus,
} from '../../../services/courierService';
import OsmMap from '../../../components/OsmMap';
import LiveTrackingMap from '../../../components/LiveTrackingMap';
import { isCourierChatOpen } from '../../../services/courierChatService';
import {
  subscribeToTechnicianLocation,
  startBroadcastingCourierLocation,
  stopBroadcastingCourierLocation,
  type TechnicianLocation,
} from '../../../services/locationTrackingService';
import { useAuth } from '../../../contexts/AuthContext';
import { getFriendlyError } from '../../../utils/errorMessages';
import { logger } from '../../../utils/logger';
import GearLoader from '../../../components/GearLoader';

const STEPS: DeliveryTaskStatus[] = ['accepted', 'picked_up', 'delivered', 'completed'];

interface Stop {
  kind: 'pickup' | 'dropoff';
  label: string;
  address: string | null;
  name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Courier task detail — stage-focused (§8): the CURRENT target stop is
 * emphasized with Directions / Call / Chat; the other stop is collapsed to a
 * one-line summary so the screen never gets noisy. Before pickup the target
 * is the origin party; after pickup it's the destination party. Transitions
 * are enforced server-side (advance_delivery_task) so the UI can't skip
 * steps, and the courier↔technician chat auto-closes with the task.
 */
export default function CourierTaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [task, setTask] = useState<DeliveryTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  // Technician live position — RLS only serves it during the exact window
  // where the technician is this courier's target stop, so subscribing here
  // is safe and simply yields nothing outside that window.
  const [techLoc, setTechLoc] = useState<TechnicianLocation | null>(null);

  useEffect(() => {
    if (!task?.order_id) return;
    const unsub = subscribeToTechnicianLocation(task.order_id, (loc) => setTechLoc(loc));
    return unsub;
  }, [task?.order_id]);

  // §12 — broadcast the courier's own live position while the task is active
  // so the order's technician (and customer) can track the delivery. Stops
  // automatically when the task leaves the active window or the screen closes.
  useEffect(() => {
    const active = task && ['accepted', 'picked_up'].includes(task.status);
    if (active && user?.id && task?.id && task?.order_id) {
      void startBroadcastingCourierLocation(user.id, task.id, task.order_id);
    } else {
      void stopBroadcastingCourierLocation();
    }
    return () => {
      void stopBroadcastingCourierLocation();
    };
  }, [task?.id, task?.order_id, task?.status, user?.id]);

  const load = useCallback(async () => {
    const t = await getDeliveryTaskById(String(id));
    setTask(t);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAdvance = async () => {
    if (!task) return;
    const action = nextDeliveryAction(task.status, task.task_type);
    if (!action) return;
    setUpdating(true);
    try {
      const updated = await advanceDeliveryTask(task.id, action.next);
      setTask(updated);
      if (action.next === 'completed') {
        Alert.alert(
          isRTL ? 'أحسنت! 🎉' : 'Well done! 🎉',
          isRTL ? 'تم إنهاء مهمة التوصيل بنجاح.' : 'Delivery task completed successfully.',
          [{ text: isRTL ? 'حسناً' : 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e) {
      logger.warn('advance task failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = (lat: number | null, lng: number | null, address: string | null) => {
    if (lat != null && lng != null) {
      void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    } else if (address) {
      void Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <GearLoader size={48} />
      </View>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color={COLORS.textSecondary} />
          <Text style={{ color: COLORS.textSecondary, fontSize: 15, marginTop: 12 }}>
            {isRTL ? 'لم يتم العثور على المهمة' : 'Task not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const action = nextDeliveryAction(task.status, task.task_type);
  const isPickupLeg = task.task_type === 'pickup';
  const currentStepIndex = STEPS.indexOf(task.status);
  const chatOpen = isCourierChatOpen(task.status);

  const pickupStop: Stop = {
    kind: 'pickup',
    label: isPickupLeg
      ? isRTL ? 'الاستلام من العميل' : 'Pick up from customer'
      : isRTL ? 'الاستلام من الفني' : 'Pick up from technician',
    address: task.pickup_address,
    name: task.pickup_contact_name,
    phone: task.pickup_contact_phone,
    lat: task.pickup_latitude,
    lng: task.pickup_longitude,
  };
  const dropoffStop: Stop = {
    kind: 'dropoff',
    label: isPickupLeg
      ? isRTL ? 'التسليم إلى الفني' : 'Deliver to technician'
      : isRTL ? 'الإعادة إلى العميل' : 'Return to customer',
    address: task.dropoff_address,
    name: task.dropoff_contact_name,
    phone: task.dropoff_contact_phone,
    lat: task.dropoff_latitude,
    lng: task.dropoff_longitude,
  };

  // §8 — the target flips at pickup: head to the origin party first, then to
  // the destination party.
  const beforePickup = task.status === 'accepted' || task.status === 'available';
  const currentStop = beforePickup ? pickupStop : dropoffStop;
  const otherStop = beforePickup ? dropoffStop : pickupStop;
  const isDone = task.status === 'completed' || task.status === 'cancelled';
  // Chat is with the technician (never the customer): on a pickup leg the
  // technician is the drop-off party; on a return leg the pickup party.
  const technicianStop = isPickupLeg ? dropoffStop : pickupStop;

  const missingAddressHint = (stop: Stop): string =>
    stop.kind === 'pickup'
      ? isRTL ? 'العنوان غير محدد — نسّق عبر الهاتف أو المحادثة' : 'Address not set — coordinate by phone or chat'
      : isPickupLeg
        ? isRTL ? 'سلّم الجهاز للفني — نسّق عبر المحادثة أو الهاتف' : 'Deliver to the technician — coordinate via chat or phone'
        : isRTL ? 'العنوان غير محدد — تواصل هاتفياً' : 'Address not set — coordinate by phone';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: COLORS.border }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(courier)' as any))}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.text }}>
          {isPickupLeg
            ? isRTL ? 'مهمة استلام' : 'Pickup task'
            : isRTL ? 'مهمة إعادة' : 'Return task'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Progress */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'الحالة الحالية' : 'Current status'}
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800', marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
            {deliveryLegLabel(task.task_type, task.status)[isRTL ? 'ar' : 'en']}
          </Text>
          {task.status !== 'cancelled' && (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 6, marginTop: 14 }}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: currentStepIndex >= i ? COLORS.primary : COLORS.border,
                  }}
                />
              ))}
            </View>
          )}
          {task.courier_fee != null && Number(task.courier_fee) > 0 && (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <MaterialCommunityIcons name="cash" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>
                {isRTL
                  ? `أجرة التوصيل: ${Number(task.courier_fee)} ر.س`
                  : `Delivery fee: ${Number(task.courier_fee)} SAR`}
              </Text>
            </View>
          )}
        </View>

        {/* Current-stage stop — emphasized, with the stage's actions. */}
        {!isDone && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.primary, borderWidth: 1.5 }, SHADOWS.small]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons
                name={currentStop.kind === 'pickup' ? 'package-up' : 'map-marker-check'}
                size={20}
                color={COLORS.primary}
              />
              <Text style={{ flex: 1, color: COLORS.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                {currentStop.label}
              </Text>
              <View style={{ backgroundColor: COLORS.primary + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '800' }}>
                  {isRTL ? 'وجهتك الآن' : 'Your stop now'}
                </Text>
              </View>
            </View>
            {!!currentStop.name && (
              <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: isRTL ? 'right' : 'left' }}>
                {currentStop.name}
              </Text>
            )}
            <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' }}>
              {currentStop.address || missingAddressHint(currentStop)}
            </Text>
            {(() => {
              const targetIsTechnician = currentStop === technicianStop;
              // Technician navigation prefers the LIVE position; static task
              // coords / address are the fallback. Customer navigation uses
              // the stamped task coordinates as before.
              const navLat = targetIsTechnician ? (techLoc?.latitude ?? currentStop.lat) : currentStop.lat;
              const navLng = targetIsTechnician ? (techLoc?.longitude ?? currentStop.lng) : currentStop.lng;
              const canNavigate = navLat != null || !!currentStop.address;
              return (
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  {canNavigate ? (
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                      onPress={() => openMaps(navLat, navLng, currentStop.address)}
                      accessibilityRole="button"
                      accessibilityLabel={targetIsTechnician
                        ? isRTL ? 'الاتجاهات إلى الفني' : 'Directions to technician'
                        : isRTL ? 'الاتجاهات إلى العميل' : 'Directions to customer'}
                    >
                      <MaterialCommunityIcons
                        name={targetIsTechnician ? 'account-wrench' : 'map-marker-account'}
                        size={16}
                        color="#fff"
                      />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {targetIsTechnician
                          ? isRTL ? 'الاتجاهات إلى الفني' : 'Directions to technician'
                          : isRTL ? 'الاتجاهات إلى العميل' : 'Directions to customer'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.smallBtn, { borderColor: COLORS.border, opacity: 0.7 }]}>
                      <MaterialCommunityIcons name="map-marker-off-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 13 }}>
                        {targetIsTechnician
                          ? isRTL ? 'موقع الفني غير متاح بعد' : 'Technician location not available yet'
                          : isRTL ? 'الموقع غير متاح' : 'Location not available'}
                      </Text>
                    </View>
                  )}
                  {!!currentStop.phone && (
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: COLORS.primary }]}
                      onPress={() => void Linking.openURL(`tel:${currentStop.phone}`)}
                      accessibilityRole="button"
                    >
                      <MaterialCommunityIcons name="phone-outline" size={16} color={COLORS.primary} />
                      <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                        {isRTL ? 'اتصال' : 'Call'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {chatOpen && (
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: COLORS.primary }]}
                      onPress={() =>
                        router.push({
                          pathname: '/courier-chat/[taskId]',
                          params: {
                            taskId: task.id,
                            thread: targetIsTechnician ? 'technician' : 'customer',
                          },
                        } as any)
                      }
                      accessibilityRole="button"
                    >
                      <MaterialCommunityIcons name="chat-outline" size={16} color={COLORS.primary} />
                      <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                        {targetIsTechnician
                          ? isRTL ? 'مراسلة الفني' : 'Chat with technician'
                          : isRTL ? 'مراسلة العميل' : 'Chat with customer'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            {/* Location of the current target party — same map pattern the
                customer app uses. Technician stop → live technician position
                (LiveTrackingMap handles the "no signal yet" fallback);
                customer stop → static pin from the task coordinates. */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MaterialCommunityIcons
                  name={currentStop === technicianStop ? 'account-wrench' : 'map-marker-account'}
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 13 }}>
                  {currentStop === technicianStop
                    ? isRTL ? 'موقع الفني (مباشر عند توفره)' : 'Technician location (live when available)'
                    : isRTL ? 'موقع العميل' : 'Customer location'}
                </Text>
              </View>
              {currentStop === technicianStop ? (
                <LiveTrackingMap
                  orderId={task.order_id}
                  customerLat={currentStop.lat ?? undefined}
                  customerLng={currentStop.lng ?? undefined}
                  height={180}
                />
              ) : currentStop.lat != null && currentStop.lng != null ? (
                <View style={{ height: 180, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
                  <OsmMap
                    latitude={Number(currentStop.lat)}
                    longitude={Number(currentStop.lng)}
                    zoom={15}
                    markers={[{ lat: Number(currentStop.lat), lng: Number(currentStop.lng), color: '#ef4444' }]}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Text style={{ color: COLORS.textSecondary, fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL
                    ? 'لا يتوفر موقع دقيق — استخدم الاتصال أو المحادثة للتنسيق.'
                    : 'No precise location available — coordinate by phone or chat.'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* The other stop — collapsed one-liner for context. */}
        {!isDone && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border, opacity: 0.75 }]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons
                name={otherStop.kind === 'pickup' ? 'package-up' : 'map-marker-outline'}
                size={18}
                color={COLORS.textSecondary}
              />
              <Text style={{ flex: 1, color: COLORS.textSecondary, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                {beforePickup
                  ? isRTL ? `بعدها: ${otherStop.label}` : `Then: ${otherStop.label}`
                  : isRTL ? `تم: ${otherStop.label}` : `Done: ${otherStop.label}`}
              </Text>
            </View>
            {!!(otherStop.address || otherStop.name) && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12.5, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={2}>
                {[otherStop.name, otherStop.address].filter(Boolean).join(' — ')}
              </Text>
            )}
            {chatOpen && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/courier-chat/[taskId]',
                    params: {
                      taskId: task.id,
                      thread: otherStop === technicianStop ? 'technician' : 'customer',
                    },
                  } as any)
                }
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="chat-outline" size={14} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12.5 }}>
                  {otherStop === technicianStop
                    ? isRTL ? 'مراسلة الفني' : 'Chat with technician'
                    : isRTL ? 'مراسلة العميل' : 'Chat with customer'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Completed: show both stops read-only. */}
        {isDone && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            {[pickupStop, dropoffStop].map((stop) => (
              <View key={stop.kind} style={{ marginBottom: 10 }}>
                <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
                  {stop.label}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
                  {[stop.name, stop.address].filter(Boolean).join(' — ') || (isRTL ? '—' : '—')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!!task.notes && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
            <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'ملاحظات' : 'Notes'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
              {localizeTaskNotes(task.notes, isRTL)}
            </Text>
          </View>
        )}

        {/* Single next action */}
        {action && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.primary, opacity: updating ? 0.7 : 1 }]}
            onPress={handleAdvance}
            disabled={updating}
            accessibilityRole="button"
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="arrow-right-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  {isRTL ? action.ar : action.en}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {task.status === 'completed' && (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <MaterialCommunityIcons name="check-decagram" size={40} color={COLORS.primary} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 6 }}>
              {isRTL ? 'مهمة مكتملة' : 'Task completed'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
});
