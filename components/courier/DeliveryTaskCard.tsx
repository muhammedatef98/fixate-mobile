import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { DELIVERY_STATUS_LABELS, type DeliveryTask } from '../../services/courierService';

interface DeliveryTaskCardProps {
  task: DeliveryTask;
  /** 'available' renders the Accept CTA; 'mine' renders View & continue. */
  mode: 'available' | 'mine';
  onAccept?: (task: DeliveryTask) => void;
  onOpen?: (task: DeliveryTask) => void;
  /** id of the task currently being accepted — disables CTAs during the race. */
  acceptingId?: string | null;
}

/**
 * One delivery-task card, shared between the Available pool and My Tasks so
 * both tabs stay visually and behaviorally identical.
 */
export default function DeliveryTaskCard({
  task,
  mode,
  onAccept,
  onOpen,
  acceptingId = null,
}: DeliveryTaskCardProps) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const isPickupLeg = task.task_type === 'pickup';
  const statusLabel =
    DELIVERY_STATUS_LABELS[task.status]?.[isRTL ? 'ar' : 'en'] ?? task.status;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: COLORS.card, borderColor: COLORS.border },
        SHADOWS.small,
      ]}
    >
      <View style={[styles.rowBetween, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.badge, { backgroundColor: COLORS.primary + '18' }]}>
          <MaterialCommunityIcons
            name={isPickupLeg ? 'package-up' : 'package-down'}
            size={15}
            color={COLORS.primary}
          />
          <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
            {isPickupLeg
              ? isRTL ? 'استلام من العميل' : 'Pickup from customer'
              : isRTL ? 'إعادة للعميل' : 'Return to customer'}
          </Text>
        </View>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>
          {statusLabel}
        </Text>
      </View>

      {!!(task.pickup_address || task.dropoff_address) && (
        <View style={{ gap: 4, marginTop: 10 }}>
          {!!task.pickup_address && (
            <View style={[styles.line, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="circle-outline" size={13} color={COLORS.textSecondary} />
              <Text
                style={[styles.lineText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
                numberOfLines={1}
              >
                {task.pickup_address}
              </Text>
            </View>
          )}
          {!!task.dropoff_address && (
            <View style={[styles.line, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="map-marker" size={13} color={COLORS.primary} />
              <Text
                style={[styles.lineText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
                numberOfLines={1}
              >
                {task.dropoff_address}
              </Text>
            </View>
          )}
        </View>
      )}

      {mode === 'available' ? (
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: COLORS.primary, opacity: acceptingId === task.id ? 0.6 : 1 },
          ]}
          onPress={() => onAccept?.(task)}
          disabled={acceptingId !== null}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>{isRTL ? 'قبول المهمة' : 'Accept task'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.primary },
          ]}
          onPress={() => onOpen?.(task)}
          accessibilityRole="button"
        >
          <Text style={[styles.primaryBtnText, { color: COLORS.primary }]}>
            {isRTL ? 'عرض التفاصيل والمتابعة' : 'View details & continue'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  line: { alignItems: 'center', gap: 6 },
  lineText: { fontSize: 13, flex: 1 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
