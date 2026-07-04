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
import { getFriendlyError } from '../../../utils/errorMessages';
import { logger } from '../../../utils/logger';

const STEPS: DeliveryTaskStatus[] = ['accepted', 'picked_up', 'delivered', 'completed'];

/**
 * Courier task detail: where to pick up, where to deliver, current state and
 * the single next action. Transitions are enforced server-side
 * (advance_delivery_task), so the UI can never skip a step.
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
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const t = await getDeliveryTaskById(String(id));
    setTask(t);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const stop = (
    kind: 'pickup' | 'dropoff',
    label: string,
    address: string | null,
    phone: string | null,
    lat: number | null,
    lng: number | null
  ) => (
    <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons
          name={kind === 'pickup' ? 'package-up' : 'map-marker-check'}
          size={20}
          color={COLORS.primary}
        />
        <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15 }}>{label}</Text>
      </View>
      <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' }}>
        {address ||
          (kind === 'pickup' && !isPickupLeg
            ? isRTL ? 'استلم الجهاز من الفني — نسّق معه عبر الهاتف' : 'Collect from the technician — coordinate by phone'
            : !isPickupLeg || kind === 'pickup'
              ? isRTL ? 'العنوان غير محدد — تواصل هاتفياً' : 'Address not set — coordinate by phone'
              : isRTL ? 'سلّم الجهاز للفني المعتمد — سيصلك العنوان عبر الدعم' : 'Deliver to the assigned technician — address via support')}
      </Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
        {(lat != null || address) && (
          <TouchableOpacity
            style={[styles.smallBtn, { borderColor: COLORS.primary }]}
            onPress={() => openMaps(lat, lng, address)}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="navigation-variant-outline" size={16} color={COLORS.primary} />
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
              {isRTL ? 'الاتجاهات' : 'Directions'}
            </Text>
          </TouchableOpacity>
        )}
        {!!phone && (
          <TouchableOpacity
            style={[styles.smallBtn, { borderColor: COLORS.primary }]}
            onPress={() => void Linking.openURL(`tel:${phone}`)}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="phone-outline" size={16} color={COLORS.primary} />
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
              {isRTL ? 'اتصال' : 'Call'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

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

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 }}>
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
                    backgroundColor:
                      currentStepIndex >= i ? COLORS.primary : COLORS.border,
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Where from / where to. For a pickup leg the customer is the origin;
            for a return leg the customer is the destination. */}
        {isPickupLeg ? (
          <>
            {stop(
              'pickup',
              isRTL ? 'الاستلام من العميل' : 'Pick up from customer',
              task.pickup_address,
              task.pickup_contact_phone,
              task.pickup_latitude,
              task.pickup_longitude
            )}
            {stop(
              'dropoff',
              isRTL ? 'التسليم إلى الفني' : 'Deliver to technician',
              task.dropoff_address,
              task.dropoff_contact_phone,
              task.dropoff_latitude,
              task.dropoff_longitude
            )}
          </>
        ) : (
          <>
            {stop(
              'pickup',
              isRTL ? 'الاستلام من الفني' : 'Pick up from technician',
              task.pickup_address,
              task.pickup_contact_phone,
              task.pickup_latitude,
              task.pickup_longitude
            )}
            {stop(
              'dropoff',
              isRTL ? 'الإعادة إلى العميل' : 'Return to customer',
              task.dropoff_address,
              task.dropoff_contact_phone,
              task.dropoff_latitude,
              task.dropoff_longitude
            )}
          </>
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
