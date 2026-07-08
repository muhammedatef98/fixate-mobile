import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { deliveryLegLabel, type DeliveryTask } from '../../services/courierService';
import { fmtRequestDateTime } from '../../utils/dateFormat';

interface DeliveryTaskCardProps {
  task: DeliveryTask;
  /** 'available' renders the Accept CTA; 'mine' renders View & continue. */
  mode: 'available' | 'mine';
  onAccept?: (task: DeliveryTask) => void;
  onOpen?: (task: DeliveryTask) => void;
  /** id of the task currently being accepted — disables CTAs during the race. */
  acceptingId?: string | null;
}

// Pickup legs keep the brand color; return legs get a distinct purple so the
// two directions are never confused at a glance.
const RETURN_ACCENT = '#8B5CF6';

/**
 * One delivery-task card, shared between the Available pool and My Tasks so
 * both tabs stay visually and behaviorally identical. Reads as: leg badge →
 * custody status → from/to route → CTA.
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
  const accent = isPickupLeg ? COLORS.primary : RETURN_ACCENT;
  const custodyLabel = deliveryLegLabel(task.task_type, task.status)[isRTL ? 'ar' : 'en'];
  const isDone = task.status === 'completed' || task.status === 'cancelled';

  const fromLabel = isPickupLeg
    ? isRTL ? 'من العميل' : 'From customer'
    : isRTL ? 'من الفني' : 'From technician';
  const toLabel = isPickupLeg
    ? isRTL ? 'إلى الفني' : 'To technician'
    : isRTL ? 'إلى العميل' : 'To customer';
  const fromText = [task.pickup_contact_name, task.pickup_address].filter(Boolean).join(' — ');
  const toText = [task.dropoff_contact_name, task.dropoff_address].filter(Boolean).join(' — ');

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: COLORS.card, borderColor: COLORS.border, opacity: isDone ? 0.75 : 1 },
        SHADOWS.small,
      ]}
    >
      <View style={[styles.rowBetween, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.badge, { backgroundColor: accent + '18', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons
            name={isPickupLeg ? 'package-up' : 'package-down'}
            size={15}
            color={accent}
          />
          <Text style={{ color: accent, fontSize: 12, fontWeight: '800' }}>
            {isPickupLeg
              ? isRTL ? 'مهمة استلام' : 'Pickup task'
              : isRTL ? 'مهمة إعادة' : 'Return task'}
          </Text>
        </View>
        {task.courier_fee != null && Number(task.courier_fee) > 0 && (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
            <MaterialCommunityIcons name="cash" size={14} color="#10B981" />
            <Text style={{ color: '#10B981', fontSize: 12.5, fontWeight: '800' }}>
              {Number(task.courier_fee)} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        )}
      </View>

      {/* Custody status — where the device is right now. */}
      <Text
        style={{
          color: COLORS.text,
          fontSize: 13.5,
          fontWeight: '700',
          marginTop: 10,
          lineHeight: 19,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {custodyLabel}
      </Text>

      {/* From → to route summary. */}
      <View style={{ gap: 6, marginTop: 10 }}>
        <View style={[styles.line, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons name="circle-outline" size={13} color={COLORS.textSecondary} />
          <Text style={[styles.lineLabel, { color: COLORS.textSecondary }]}>{fromLabel}</Text>
          <Text
            style={[styles.lineText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            {fromText || (isRTL ? 'يُنسَّق عبر المحادثة' : 'Coordinated in chat')}
          </Text>
        </View>
        <View style={[styles.line, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons name="map-marker" size={13} color={accent} />
          <Text style={[styles.lineLabel, { color: COLORS.textSecondary }]}>{toLabel}</Text>
          <Text
            style={[styles.lineText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            {toText || (isRTL ? 'يُنسَّق عبر المحادثة' : 'Coordinated in chat')}
          </Text>
        </View>
      </View>

      {!!task.created_at && mode === 'available' && (
        <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
          {fmtRequestDateTime(task.created_at, isRTL)}
        </Text>
      )}

      {mode === 'available' ? (
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: accent, opacity: acceptingId === task.id ? 0.6 : 1 },
          ]}
          onPress={() => onAccept?.(task)}
          disabled={acceptingId !== null}
          accessibilityRole="button"
        >
          {acceptingId === task.id ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {isRTL ? 'قبول المهمة' : 'Accept task'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            isDone
              ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border }
              : { backgroundColor: accent },
          ]}
          onPress={() => onOpen?.(task)}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={isDone ? 'history' : 'arrow-right-circle-outline'}
            size={18}
            color={isDone ? COLORS.textSecondary : '#fff'}
          />
          <Text style={[styles.primaryBtnText, isDone && { color: COLORS.textSecondary }]}>
            {isDone
              ? isRTL ? 'عرض التفاصيل' : 'View details'
              : isRTL ? 'متابعة المهمة' : 'Continue task'}
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
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  line: { alignItems: 'center', gap: 6 },
  lineLabel: { fontSize: 11.5, fontWeight: '700', minWidth: 72 },
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
