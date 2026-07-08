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
  DELIVERY_STATUS_LABELS,
  type DeliveryTask,
  type DeliveryTaskStatus,
} from '../../../services/courierService';
import { isCourierChatOpen } from '../../../services/courierChatService';
import { getFriendlyError } from '../../../utils/errorMessages';
import { logger } from '../../../utils/logger';

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
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [task, setTask] = useState<DeliveryTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

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
    const action = nextDeliveryAction(task.status);
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
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  const action = nextDeliveryAction(task.status);
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
            {DELIVERY_STATUS_LABELS[task.status]?.[isRTL ? 'ar' : 'en'] ?? task.status}
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
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {(currentStop.lat != null || currentStop.address) && (
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  onPress={() => openMaps(currentStop.lat, currentStop.lng, currentStop.address)}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="navigation-variant-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {isRTL ? 'الاتجاهات' : 'Directions'}
                  </Text>
                </TouchableOpacity>
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
              {chatOpen && currentStop === technicianStop && (
                <TouchableOpacity
                  style={[styles.smallBtn, { borderColor: COLORS.primary }]}
                  onPress={() =>
                    router.push({ pathname: '/courier-chat/[taskId]', params: { taskId: task.id } } as any)
                  }
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="chat-outline" size={16} color={COLORS.primary} />
                  <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                    {isRTL ? 'مراسلة الفني' : 'Chat'}
                  </Text>
                </TouchableOpacity>
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
              {task.notes}
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
