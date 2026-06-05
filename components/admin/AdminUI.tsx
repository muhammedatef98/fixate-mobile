import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BORDER_RADIUS, SPACING } from '../../constants/theme';

// ─── Shadow token ─────────────────────────────────────────────────────────────
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
  COLORS?: any;
}
export function AdminSectionLabel({ icon, text, hint, COLORS }: AdminSectionLabelProps) {
  const c = COLORS ?? {};
  return (
    <View style={sl.wrap}>
      <MaterialCommunityIcons name={icon as any} size={16} color={c.primary ?? '#6366f1'} />
      <Text style={[sl.text, { color: c.text ?? '#111' }]}>{text}</Text>
      {hint ? <Text style={[sl.hint, { color: c.textSecondary ?? '#888' }]}>{hint}</Text> : null}
    </View>
  );
}
const sl = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 },
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
  COLORS?: any;
}
export function AdminStatTile({ icon, label, value, color, loading, hint, onPress, COLORS }: AdminStatTileProps) {
  const c = COLORS ?? {};
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={[
        st.tile,
        { backgroundColor: c.card ?? '#fff', borderColor: c.border ?? '#e5e7eb' },
        ADMIN_CARD_SHADOW,
      ]}
    >
      <View style={[st.iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      {loading ? (
        <ActivityIndicator color={color} style={{ marginTop: 8 }} />
      ) : (
        <Text style={[st.value, { color: c.text ?? '#111' }]}>{value}</Text>
      )}
      <Text style={[st.label, { color: c.textSecondary ?? '#888' }]} numberOfLines={2}>{label}</Text>
      {hint ? <Text style={[st.hint, { color: color }]} numberOfLines={1}>{hint}</Text> : null}
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  tile: {
    width: '47%',
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
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
  COLORS?: any;
  isRTL?: boolean;
}
export function AdminActionCard({ icon, iconColor, title, subtitle, badge, onPress, COLORS, isRTL }: AdminActionCardProps) {
  const c = COLORS ?? {};
  const rtl = isRTL ?? false;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        ac.card,
        { backgroundColor: c.card ?? '#fff', borderColor: c.border ?? '#e5e7eb', flexDirection: rtl ? 'row-reverse' : 'row' },
        ADMIN_CARD_SHADOW,
      ]}
    >
      <View style={[ac.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ac.title, { color: c.text ?? '#111', textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
        <Text style={[ac.sub, { color: c.textSecondary ?? '#888', textAlign: rtl ? 'right' : 'left' }]} numberOfLines={2}>{subtitle}</Text>
      </View>
      {(badge ?? 0) > 0 ? (
        <View style={[ac.badge, { backgroundColor: iconColor }]}>
          <Text style={ac.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={c.textLight ?? '#aaa'} />
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
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
  COLORS?: any;
  isRTL?: boolean;
}
export function AdminAttentionBar({ count, title, body, ctaLabel, onPress, COLORS, isRTL }: AdminAttentionBarProps) {
  if (!count || count <= 0) return null;
  const c = COLORS ?? {};
  const rtl = isRTL ?? false;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        ab.bar,
        { backgroundColor: '#fef3c7', borderColor: '#f59e0b', flexDirection: rtl ? 'row-reverse' : 'row' },
      ]}
    >
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#f59e0b" />
      <View style={{ flex: 1 }}>
        <Text style={[ab.title, { textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
        {body ? <Text style={[ab.body, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={2}>{body}</Text> : null}
      </View>
      <View style={ab.cta}>
        <Text style={ab.ctaText}>{ctaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  bar: {
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    gap: 10,
  },
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
  COLORS?: any;
}
export function AdminQuickAction({ icon, label, badge, color, onPress, COLORS }: AdminQuickActionProps) {
  const c = COLORS ?? {};
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[qa.wrap, { backgroundColor: c.card ?? '#fff', borderColor: c.border ?? '#e5e7eb' }, ADMIN_CARD_SHADOW]}
    >
      <View style={[qa.iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
        {(badge ?? 0) > 0 ? (
          <View style={[qa.badge, { backgroundColor: color }]}>
            <Text style={qa.badgeText}>{badge! > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[qa.label, { color: c.textSecondary ?? '#888' }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
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
  COLORS?: any;
  isRTL?: boolean;
}
export function AdminActivityRow({ icon, iconColor, title, meta, time, onPress, COLORS, isRTL }: AdminActivityRowProps) {
  const c = COLORS ?? {};
  const rtl = isRTL ?? false;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={[
        ar.row,
        { backgroundColor: c.card ?? '#fff', borderColor: c.border ?? '#e5e7eb', flexDirection: rtl ? 'row-reverse' : 'row' },
        ADMIN_CARD_SHADOW,
      ]}
    >
      <View style={[ar.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ar.title, { color: c.text ?? '#111', textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>{title}</Text>
        <Text style={[ar.meta, { color: c.textSecondary ?? '#888', textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={[ar.time, { color: c.textLight ?? '#aaa' }]}>{time}</Text>
    </TouchableOpacity>
  );
}
const ar = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  time: { fontSize: 11, fontWeight: '600' },
});

// ─── AdminEmptyState ──────────────────────────────────────────────────────────
interface AdminEmptyStateProps {
  variant?: 'default' | 'error';
  icon: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
  COLORS?: any;
}
export function AdminEmptyState({ variant = 'default', icon, title, body, ctaLabel, onCta, COLORS }: AdminEmptyStateProps) {
  const c = COLORS ?? {};
  const color = variant === 'error' ? '#ef4444' : (c.primary ?? '#6366f1');
  return (
    <View style={es.wrap}>
      <View style={[es.iconWrap, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon as any} size={40} color={color} />
      </View>
      <Text style={[es.title, { color: c.text ?? '#111' }]}>{title}</Text>
      {body ? <Text style={[es.body, { color: c.textSecondary ?? '#888' }]}>{body}</Text> : null}
      {ctaLabel && onCta ? (
        <TouchableOpacity onPress={onCta} style={[es.cta, { backgroundColor: color }]}>
          <Text style={es.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
const es = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 14 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  cta: { borderRadius: BORDER_RADIUS.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
