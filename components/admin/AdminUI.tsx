/**
 * AdminUI.tsx — Shared admin UI primitives
 * Centralises headers, search bars, filter chips, status pills and empty
 * states so every admin screen looks and feels consistent.
 */
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../RTLIcon';
import { safeBack } from '../../utils/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminFilterChip<T extends string = string> {
  key: T;
  ar: string;
  en: string;
  count?: number;
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map an order / verification / market status string to a visual tone. */
export function orderStatusTone(status: string): { tone: StatusTone; icon: string } {
  switch (status) {
    case 'completed':
    case 'approved':
    case 'active':
      return { tone: 'success', icon: 'checkmark-circle-outline' };
    case 'pending':
    case 'under_review':
      return { tone: 'warning', icon: 'time-outline' };
    case 'cancelled':
    case 'rejected':
    case 'suspended':
      return { tone: 'danger', icon: 'close-circle-outline' };
    case 'confirmed':
    case 'accepted':
    case 'picking_up':
    case 'diagnosing':
    case 'repairing':
    case 'testing':
    case 'delivering':
      return { tone: 'info', icon: 'sync-outline' };
    default:
      return { tone: 'neutral', icon: 'ellipse-outline' };
  }
}

const TONE_COLORS: Record<StatusTone, { bg: string; text: string }> = {
  success: { bg: '#D1FAE5', text: '#065F46' },
  warning: { bg: '#FEF3C7', text: '#92400E' },
  danger:  { bg: '#FEE2E2', text: '#991B1B' },
  info:    { bg: '#DBEAFE', text: '#1E40AF' },
  neutral: { bg: '#F3F4F6', text: '#374151' },
};

// ─── AdminScreenHeader ────────────────────────────────────────────────────────

interface AdminScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightLabel?: string;
  onRightPress?: () => void;
}

export function AdminScreenHeader({
  title,
  subtitle,
  rightIcon,
  rightLabel,
  onRightPress,
}: AdminScreenHeaderProps) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  return (
    <View
      style={[
        styles.headerWrap,
        {
          backgroundColor: COLORS.card,
          borderBottomColor: COLORS.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => safeBack('/admin')}
        style={styles.headerBack}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
      >
        <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          style={[
            styles.headerTitle,
            { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightIcon ? (
        <TouchableOpacity
          onPress={onRightPress}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel={rightLabel}
        >
          <Ionicons name={rightIcon} size={22} color={COLORS.primary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

// ─── AdminSearchBar ───────────────────────────────────────────────────────────

interface AdminSearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  resultCount?: number;
}

export function AdminSearchBar({
  value,
  onChangeText,
  placeholder,
  resultCount,
}: AdminSearchBarProps) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  return (
    <View
      style={[
        styles.searchWrap,
        {
          backgroundColor: COLORS.card,
          borderColor: COLORS.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
      <TextInput
        style={[
          styles.searchInput,
          { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? (isRTL ? 'بحث…' : 'Search…')}
        placeholderTextColor={COLORS.textSecondary}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {resultCount !== undefined && (
        <Text style={[styles.searchCount, { color: COLORS.textSecondary }]}>
          {resultCount}
        </Text>
      )}
    </View>
  );
}

// ─── AdminFilterChips ─────────────────────────────────────────────────────────

interface AdminFilterChipsProps<T extends string> {
  filters: AdminFilterChip<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function AdminFilterChips<T extends string>({
  filters,
  value,
  onChange,
}: AdminFilterChipsProps<T>) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.chipsRow,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      {filters.map((f) => {
        const active = f.key === value;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? COLORS.primary : COLORS.card,
                borderColor: active ? COLORS.primary : COLORS.border,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? '#fff' : COLORS.text },
              ]}
            >
              {isRTL ? f.ar : f.en}
              {f.count !== undefined ? ` (${f.count})` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── AdminStatusPill ──────────────────────────────────────────────────────────

interface AdminStatusPillProps {
  label: string;
  tone: StatusTone;
  icon?: string;
}

export function AdminStatusPill({ label, tone, icon }: AdminStatusPillProps) {
  const { bg, text } = TONE_COLORS[tone] ?? TONE_COLORS.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {!!icon && (
        <MaterialCommunityIcons
          name={icon as any}
          size={12}
          color={text}
          style={{ marginRight: 3 }}
        />
      )}
      <Text style={[styles.pillText, { color: text }]}>{label}</Text>
    </View>
  );
}

// ─── AdminEmptyState ──────────────────────────────────────────────────────────

interface AdminEmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  variant?: 'default' | 'error';
}

export function AdminEmptyState({
  icon = 'information-outline',
  title,
  body,
  ctaLabel,
  onCtaPress,
  variant = 'default',
}: AdminEmptyStateProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const iconColor = variant === 'error' ? '#DC2626' : COLORS.primary;

  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconBg, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={36} color={iconColor} />
      </View>
      <Text style={[styles.emptyTitle, { color: COLORS.text }]}>{title}</Text>
      {!!body && (
        <Text style={[styles.emptyBody, { color: COLORS.textSecondary }]}>
          {body}
        </Text>
      )}
      {!!ctaLabel && (
        <TouchableOpacity
          onPress={onCtaPress}
          style={[styles.emptyCta, { backgroundColor: COLORS.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.emptyCtaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  headerWrap: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },

  // Search
  searchWrap: {
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13 },
  searchCount: { fontSize: 12 },

  // Chips
  chipsRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontWeight: '700', fontSize: 13 },

  // Status pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 11, fontWeight: '800' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: SPACING.xl },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  emptyCta: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
