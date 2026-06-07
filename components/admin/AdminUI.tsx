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
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../RTLIcon';
import { safeBack } from '../../utils/navigation';
import { AnimatedBackButton } from '../AnimatedBackButton';

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
    case 'awaiting_payment':
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
      <AnimatedBackButton
        onPress={() => safeBack('/admin')}
        color={COLORS.text}
        backgroundColor={COLORS.background}
        size={42}
        iconSize={22}
        rtl
        accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
      />

      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
        <Text
          style={[styles.headerTitle, { color: COLORS.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[styles.headerSubtitle, { color: COLORS.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {rightIcon ? (
        <TouchableOpacity
          onPress={onRightPress}
          style={[styles.headerBack, { backgroundColor: COLORS.primary + '15' }]}
          accessibilityRole="button"
          accessibilityLabel={rightLabel}
        >
          <Ionicons name={rightIcon} size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
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
              numberOfLines={1}
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
        <Ionicons
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 11, marginTop: 2, fontWeight: '600' },

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
    flexShrink: 0,
  },
  chipText: { fontWeight: '700', fontSize: 13, includeFontPadding: false },

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

// ─── Card shadow token ────────────────────────────────────────────────────────
export const ADMIN_CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
}) as object;

// ─── adminTimeAgo ─────────────────────────────────────────────────────────────
export function adminTimeAgo(iso: string, isRTL: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'just now';
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRTL ? `منذ ${days} ي` : `${days}d ago`;
}

// ─── AdminSectionLabel ────────────────────────────────────────────────────────
interface AdminSectionLabelProps {
  icon: string;
  text: string;
  hint?: string;
}
export function AdminSectionLabel({ icon, text, hint }: AdminSectionLabelProps) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  return (
    <View style={[sl.wrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <MaterialCommunityIcons name={icon as any} size={16} color={COLORS.primary} />
      <Text style={[sl.text, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
      {hint ? <Text style={[sl.hint, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>{hint}</Text> : null}
    </View>
  );
}
const sl = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 },
  text: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  hint: { fontSize: 11, fontWeight: '600' },
});

// ─── AdminStatTile ────────────────────────────────────────────────────────────
interface AdminStatTileProps {
  icon: string;
  label: string;
  value: string;
  color: string;
  loading?: boolean;
  hint?: string;
  onPress?: () => void;
}
export function AdminStatTile({ icon, label, value, color, loading, hint, onPress }: AdminStatTileProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={[
        st.tile,
        { backgroundColor: COLORS.card, borderColor: COLORS.border },
        ADMIN_CARD_SHADOW,
      ]}
    >
      <View style={[st.iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      {loading ? (
        <ActivityIndicator color={color} style={{ marginTop: 8 }} />
      ) : (
        <Text style={[st.value, { color: COLORS.text }]}>{value}</Text>
      )}
      <Text style={[st.label, { color: COLORS.textSecondary }]} numberOfLines={2}>{label}</Text>
      {hint ? <Text style={[st.hint, { color }]} numberOfLines={1}>{hint}</Text> : null}
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  tile: { width: '47%', borderRadius: BORDER_RADIUS.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  hint: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

// ─── AdminActionCard ──────────────────────────────────────────────────────────
interface AdminActionCardProps {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}
export function AdminActionCard({ icon, iconColor, title, subtitle, badge, onPress }: AdminActionCardProps) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        ac.card,
        { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ADMIN_CARD_SHADOW,
      ]}
    >
      <View style={[ac.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ac.title, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        <Text style={[ac.sub, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>{subtitle}</Text>
      </View>
      {(badge ?? 0) > 0 ? (
        <View style={[ac.badge, { backgroundColor: iconColor }]}>
          <Text style={ac.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.textLight ?? COLORS.textSecondary} />
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  card: { alignItems: 'center', borderRadius: BORDER_RADIUS.md, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  badge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

// ─── AdminAttentionBar ────────────────────────────────────────────────────────
interface AdminAttentionBarProps {
  count: number;
  title: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
}
export function AdminAttentionBar({ count, title, body, ctaLabel, onPress }: AdminAttentionBarProps) {
  const { language } = useApp();
  const isRTL = language === 'ar';
  if (!count || count <= 0) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[ab.bar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#f59e0b" />
      <View style={{ flex: 1 }}>
        <Text style={[ab.title, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        {body ? <Text style={[ab.body, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>{body}</Text> : null}
      </View>
      <View style={ab.cta}>
        <Text style={ab.ctaText}>{ctaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  bar: { alignItems: 'center', borderRadius: BORDER_RADIUS.md, padding: 14, marginBottom: 12, borderWidth: 1, gap: 10, backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  title: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  body: { fontSize: 12, color: '#b45309', marginTop: 2, lineHeight: 17 },
  cta: { backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

// ─── AdminQuickAction ─────────────────────────────────────────────────────────
interface AdminQuickActionProps {
  icon: string;
  label: string;
  badge?: number;
  color: string;
  onPress: () => void;
}
export function AdminQuickAction({ icon, label, badge, color, onPress }: AdminQuickActionProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[qa.wrap, { backgroundColor: COLORS.card, borderColor: COLORS.border }, ADMIN_CARD_SHADOW]}
    >
      <View style={[qa.iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
        {(badge ?? 0) > 0 ? (
          <View style={[qa.badge, { backgroundColor: color }]}>
            <Text style={qa.badgeText}>{badge! > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[qa.label, { color: COLORS.textSecondary }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', borderRadius: BORDER_RADIUS.md, padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

// ─── AdminActivityRow ─────────────────────────────────────────────────────────
interface AdminActivityRowProps {
  icon: string;
  iconColor: string;
  title: string;
  meta: string;
  time: string;
  onPress?: () => void;
}
export function AdminActivityRow({ icon, iconColor, title, meta, time, onPress }: AdminActivityRowProps) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={[
        arRow.row,
        { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ADMIN_CARD_SHADOW,
      ]}
    >
      <View style={[arRow.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[arRow.title, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{title}</Text>
        <Text style={[arRow.meta, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={[arRow.time, { color: COLORS.textLight ?? COLORS.textSecondary }]}>{time}</Text>
    </TouchableOpacity>
  );
}
const arRow = StyleSheet.create({
  row: { alignItems: 'center', borderRadius: BORDER_RADIUS.sm, padding: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  time: { fontSize: 11, fontWeight: '600' },
});
