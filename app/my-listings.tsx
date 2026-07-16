import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import SkeletonLoader from '../components/SkeletonLoader';
import MarketBottomTabs, { MARKET_TABS_HEIGHT } from '../components/MarketBottomTabs';
import { Riyal } from '../components/Riyal';
import {
  myListings,
  hideListing,
  unhideListing,
  markListingSold,
  requestListingDeletion,
  type MarketListing,
  type ListingStatus,
} from '../services/marketService';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Owner-facing status metadata. The colours intentionally lean softer than
 * the admin queue palette — sellers see this screen often, so the badges
 * stay quiet and informative rather than alarming.
 */
const STATUS_META: Record<ListingStatus, { ar: string; en: string; color: string; icon: string }> = {
  draft:             { ar: 'مسودة',          en: 'Draft',          color: '#94A3B8', icon: 'file-document-outline' },
  pending:           { ar: 'قيد المراجعة',   en: 'Under review',   color: '#F59E0B', icon: 'clock-outline' },
  live:              { ar: 'منشور',          en: 'Live',           color: '#16A34A', icon: 'check-circle-outline' },
  sold:              { ar: 'تم البيع',       en: 'Sold',           color: '#3B82F6', icon: 'tag-check-outline' },
  hidden_by_owner:   { ar: 'مخفي',           en: 'Hidden',         color: '#64748B', icon: 'eye-off-outline' },
  delete_requested:  { ar: 'طلب حذف',        en: 'Delete pending', color: '#B45309', icon: 'delete-clock-outline' },
  rejected:          { ar: 'مرفوض',          en: 'Rejected',       color: '#DC2626', icon: 'close-circle-outline' },
  archived_by_admin: { ar: 'مؤرشف',          en: 'Archived',       color: '#8A94A3', icon: 'archive-outline' },
};

/** Owner-side tab groups. */
type Segment = 'live' | 'pending' | 'hidden' | 'sold' | 'other';

const SEGMENT_META: { id: Segment; ar: string; en: string; statuses: ListingStatus[] }[] = [
  { id: 'live',    ar: 'منشورة',       en: 'Live',     statuses: ['live'] },
  { id: 'pending', ar: 'قيد المراجعة', en: 'Review',   statuses: ['pending', 'draft'] },
  { id: 'hidden',  ar: 'مخفية',        en: 'Hidden',   statuses: ['hidden_by_owner'] },
  { id: 'sold',    ar: 'مباعة',        en: 'Sold',     statuses: ['sold'] },
  { id: 'other',   ar: 'أخرى',         en: 'Other',    statuses: ['rejected', 'delete_requested', 'archived_by_admin'] },
];

const timeAgo = (iso: string | undefined, isRTL: boolean): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return isRTL ? 'الآن' : 'now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return isRTL ? `قبل ${min} د` : `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isRTL ? `قبل ${hr} س` : `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return isRTL ? `قبل ${day} ي` : `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return isRTL ? `قبل ${wk} أ` : `${wk}w`;
  const mo = Math.floor(day / 30);
  return isRTL ? `قبل ${mo} ش` : `${mo}mo`;
};

export default function MyListingsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [segment, setSegment] = useState<Segment>('live');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setListings(await myListings(user.id));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Segment, number> = { live: 0, pending: 0, hidden: 0, sold: 0, other: 0 };
    for (const l of listings) {
      const seg = SEGMENT_META.find((s) => s.statuses.includes(l.status as ListingStatus));
      if (seg) c[seg.id] += 1;
    }
    return c;
  }, [listings]);

  const segmentStatuses = SEGMENT_META.find((s) => s.id === segment)?.statuses ?? [];
  const filtered = useMemo(
    () => listings.filter((l) => segmentStatuses.includes(l.status as ListingStatus)),
    [listings, segmentStatuses]
  );

  const replaceInList = (next: MarketListing) =>
    setListings((prev) => prev.map((x) => (x.id === next.id ? next : x)));

  const removeFromList = (id: string) =>
    setListings((prev) => prev.filter((x) => x.id !== id));

  const runAction = async (
    id: string,
    fn: () => Promise<MarketListing>,
    successMsg?: string
  ) => {
    setBusyId(id);
    try {
      replaceInList(await fn());
      if (successMsg) Alert.alert(isRTL ? 'تم' : 'Done', successMsg);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmMarkSold = (l: MarketListing) => Alert.alert(
    isRTL ? 'تعليم كمباع' : 'Mark as sold',
    l.title,
    [
      { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: isRTL ? 'تأكيد' : 'Confirm', onPress: () => runAction(l.id, () => markListingSold(l.id)) },
    ]
  );

  const confirmHide = (l: MarketListing) => Alert.alert(
    isRTL ? 'إخفاء الإعلان' : 'Hide listing',
    isRTL
      ? 'سيتم إخفاء الإعلان من السوق العام. يمكنك إعادة نشره لاحقاً.'
      : 'Your listing will be hidden from the public marketplace. You can put it back later.',
    [
      { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: isRTL ? 'إخفاء' : 'Hide', onPress: () => runAction(l.id, () => hideListing(l.id)) },
    ]
  );

  const confirmUnhide = (l: MarketListing) => Alert.alert(
    isRTL ? 'إعادة نشر' : 'Unhide listing',
    isRTL
      ? 'سيخضع الإعلان للمراجعة قبل أن يعود للسوق.'
      : 'Your listing will go through review again before it goes public.',
    [
      { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: isRTL ? 'إرسال' : 'Resubmit', onPress: () => runAction(l.id, () => unhideListing(l.id)) },
    ]
  );

  const confirmRequestDeletion = (l: MarketListing) => Alert.alert(
    isRTL ? 'طلب حذف' : 'Request deletion',
    isRTL
      ? 'سيراجع فريق Fixate طلبك ويحذف الإعلان نهائياً.'
      : 'The Fixate team will review your request and remove the listing permanently.',
    [
      { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      {
        text: isRTL ? 'طلب حذف' : 'Request deletion',
        style: 'destructive',
        onPress: () => runAction(
          l.id,
          () => requestListingDeletion(l.id),
          isRTL ? 'تم إرسال طلب الحذف.' : 'Deletion request sent.'
        ),
      },
    ]
  );

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const renderCard = (l: MarketListing) => {
    const meta = STATUS_META[l.status as ListingStatus] ?? STATUS_META.pending;
    const busy = busyId === l.id;
    const dim = l.status === 'hidden_by_owner'
      || l.status === 'archived_by_admin'
      || l.status === 'delete_requested';
    return (
      <View key={l.id} style={styles.card}>
        <TouchableOpacity
          style={styles.cardTop}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/market-detail', params: { id: l.id } } as any)}
        >
          <View style={[styles.thumbWrap, dim && { opacity: 0.6 }]}>
            {l.images?.[0] ? (
              <Image
                source={{ uri: l.images[0] }}
                style={styles.thumb}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <MaterialCommunityIcons name="image-off-outline" size={22} color={COLORS.textSecondary} />
              </View>
            )}
            {l.status === 'sold' && (
              <View style={styles.thumbSold}>
                <Ionicons name="checkmark-circle" size={12} color="#fff" />
                <Text style={styles.thumbSoldText}>{isRTL ? 'مباع' : 'Sold'}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
              <View style={[styles.statusPill, { backgroundColor: meta.color + '18' }]}>
                <MaterialCommunityIcons name={meta.icon as any} size={11} color={meta.color} />
                <Text style={[styles.statusPillText, { color: meta.color }]}>
                  {isRTL ? meta.ar : meta.en}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.price}>
                {'\u2066'}<Riyal /> {Number(l.price).toLocaleString('en-US')}{'\u2069'}
              </Text>
              {!!l.city && (
                <>
                  <Text style={styles.metaDim}>·</Text>
                  <Text style={styles.metaDim} numberOfLines={1}>{l.city}</Text>
                </>
              )}
              {!!l.created_at && (
                <>
                  <Text style={styles.metaDim}>·</Text>
                  <Text style={styles.metaDim}>{timeAgo(l.created_at, isRTL)}</Text>
                </>
              )}
            </View>
            {l.status === 'rejected' && !!l.moderation_reason && (
              <View style={[styles.reasonRow, { backgroundColor: '#DC262610' }]}>
                <Ionicons name="information-circle" size={12} color="#DC2626" />
                <Text style={[styles.reasonText, { color: '#DC2626' }]} numberOfLines={3}>
                  {l.moderation_reason}
                </Text>
              </View>
            )}
            {l.status === 'archived_by_admin' && (
              <Text style={[styles.helperLine, { color: COLORS.textSecondary }]} numberOfLines={2}>
                {isRTL
                  ? 'تمت أرشفته من قبل الإدارة. تواصل مع الدعم للاستفسار.'
                  : 'Archived by the Fixate team. Contact support to learn more.'}
              </Text>
            )}
            {l.status === 'delete_requested' && (
              <Text style={[styles.helperLine, { color: COLORS.textSecondary }]} numberOfLines={2}>
                {isRTL ? 'طلب الحذف قيد المراجعة.' : 'Your deletion request is being reviewed.'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Quick actions — only show when the state has actionable affordances. */}
        <View style={styles.actions}>
          {l.status === 'live' && (
            <>
              <ActionBtn
                styles={styles}
                onPress={() => confirmMarkSold(l)}
                icon="checkmark-done"
                label={isRTL ? 'تم البيع' : 'Sold'}
                color="#16A34A"
                disabled={busy}
              />
              <ActionBtn
                styles={styles}
                onPress={() => confirmHide(l)}
                icon="eye-off-outline"
                label={isRTL ? 'إخفاء' : 'Hide'}
                color={COLORS.text}
                disabled={busy}
                ghost
                COLORS={COLORS}
              />
            </>
          )}
          {l.status === 'hidden_by_owner' && (
            <ActionBtn
              styles={styles}
              onPress={() => confirmUnhide(l)}
              icon="eye-outline"
              label={isRTL ? 'إعادة نشر' : 'Unhide'}
              color={COLORS.primary}
              disabled={busy}
            />
          )}
          {(l.status === 'live'
            || l.status === 'pending'
            || l.status === 'hidden_by_owner'
            || l.status === 'rejected'
            || l.status === 'sold'
            || l.status === 'draft') && (
            <ActionBtn
              styles={styles}
              onPress={() => confirmRequestDeletion(l)}
              icon="trash-outline"
              label={isRTL ? 'حذف' : 'Delete'}
              color="#DC2626"
              disabled={busy}
              ghost
              COLORS={COLORS}
            />
          )}
          {busy && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إعلاناتي' : 'My Listings'}</Text>
        <TouchableOpacity
          onPress={() => router.push('/market-new')}
          style={styles.addBtn}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Segment chips with counts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 56 }}
        contentContainerStyle={styles.segmentRow}
      >
        {SEGMENT_META.map((s) => {
          const active = segment === s.id;
          const count = counts[s.id];
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSegment(s.id)}
              style={[
                styles.segmentChip,
                active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
              ]}
            >
              <Text style={[styles.segmentText, active && { color: '#fff' }]}>
                {isRTL ? s.ar : s.en}
              </Text>
              <View style={[
                styles.segmentCount,
                { backgroundColor: active ? 'rgba(255,255,255,0.22)' : COLORS.cardAlt },
              ]}>
                <Text style={[
                  styles.segmentCountText,
                  { color: active ? '#fff' : COLORS.textSecondary },
                ]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && filtered.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardTop}>
                <SkeletonLoader width={76} height={76} borderRadius={BORDER_RADIUS.md} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonLoader width="80%" height={14} borderRadius={4} />
                  <SkeletonLoader width="60%" height={12} borderRadius={4} />
                  <SkeletonLoader width="40%" height={11} borderRadius={4} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyBubble, { backgroundColor: COLORS.primary + '14' }]}>
            <MaterialCommunityIcons
              name={STATUS_META[segmentStatuses[0]]?.icon as any ?? 'storefront-outline'}
              size={44}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle(segment, isRTL)}</Text>
          <Text style={styles.emptyBody}>{emptyBody(segment, isRTL)}</Text>
          {segment === 'live' && counts.live === 0 && (
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/market-new')}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>{isRTL ? 'انشر إعلاناً' : 'Post a listing'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, gap: 12, paddingBottom: MARKET_TABS_HEIGHT + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filtered.map(renderCard)}
        </ScrollView>
      )}

      <MarketBottomTabs />
    </SafeAreaView>
  );
}

function ActionBtn(props: {
  styles: any;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  disabled?: boolean;
  ghost?: boolean;
  COLORS?: any;
}) {
  const { styles, onPress, icon, label, color, disabled, ghost, COLORS } = props;
  if (ghost) {
    return (
      <TouchableOpacity
        style={[styles.actionBtnGhost, { borderColor: COLORS?.border ?? '#e5e7eb', opacity: disabled ? 0.55 : 1 }]}
        onPress={onPress}
        disabled={disabled}
      >
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.actionGhostText, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color, opacity: disabled ? 0.55 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={14} color="#fff" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const emptyTitle = (seg: Segment, isRTL: boolean): string => {
  if (seg === 'live') return isRTL ? 'لا توجد إعلانات منشورة' : 'No live listings yet';
  if (seg === 'pending') return isRTL ? 'لا توجد إعلانات قيد المراجعة' : 'Nothing in review';
  if (seg === 'hidden') return isRTL ? 'لا توجد إعلانات مخفية' : 'Nothing hidden';
  if (seg === 'sold') return isRTL ? 'لم تبع أي إعلان بعد' : 'No sales yet';
  return isRTL ? 'لا توجد إعلانات' : 'Nothing here';
};

const emptyBody = (seg: Segment, isRTL: boolean): string => {
  if (seg === 'live') {
    return isRTL
      ? 'انشر إعلانك الأول ليصل إلى آلاف المشترين في Fixate.'
      : 'Post your first listing and reach thousands of buyers on Fixate.';
  }
  if (seg === 'pending') {
    return isRTL
      ? 'الإعلانات الجديدة تظهر هنا حتى تتم الموافقة عليها.'
      : 'New listings appear here until they are approved.';
  }
  if (seg === 'hidden') {
    return isRTL
      ? 'الإعلانات التي تُخفيها بنفسك تظهر هنا — يمكنك إعادة نشرها متى شئت.'
      : 'Listings you hide appear here — bring them back any time.';
  }
  if (seg === 'sold') {
    return isRTL
      ? 'الإعلانات التي علّمتها كمباعة تظهر هنا للأرشيف.'
      : 'Listings you mark as sold show up here for your records.';
  }
  return isRTL
    ? 'الإعلانات المرفوضة والمؤرشفة وطلبات الحذف تظهر هنا.'
    : 'Rejected, archived, and delete-pending listings live here.';
};

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    title: { fontSize: 18, fontWeight: '800', color: C.text },
    addBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    segmentRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 8,
    },
    segmentChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    segmentText: { color: C.text, fontSize: 13, fontWeight: '700' },
    segmentCount: {
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: 999,
      minWidth: 20,
      alignItems: 'center',
    },
    segmentCountText: { fontSize: 11, fontWeight: '800' },

    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
      gap: SPACING.sm,
    },
    cardTop: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.md },
    thumbWrap: { width: 76, height: 76, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', position: 'relative' },
    thumb: { width: '100%', height: '100%', backgroundColor: C.background },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    thumbSold: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      right: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: 'rgba(59,130,246,0.92)',
      paddingVertical: 2,
      borderRadius: 999,
    },
    thumbSoldText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },

    cardTitleRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      color: C.text,
      fontWeight: '800',
      fontSize: 14.5,
      flex: 1,
      textAlign: isRTL ? 'right' : 'left',
    },
    statusPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusPillText: { fontSize: 10, fontWeight: '800' },

    metaRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      flexWrap: 'wrap',
    },
    price: { color: C.primary, fontWeight: '800', fontSize: 13.5 },
    metaDim: { color: C.textSecondary, fontSize: 11 },
    helperLine: { fontSize: 11, marginTop: 2, lineHeight: 16, textAlign: isRTL ? 'right' : 'left' },

    reasonRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 5,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: BORDER_RADIUS.sm,
    },
    reasonText: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 16, textAlign: isRTL ? 'right' : 'left' },

    actions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingTop: SPACING.sm,
    },
    actionBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: BORDER_RADIUS.md,
    },
    actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    actionBtnGhost: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    actionGhostText: { fontWeight: '800', fontSize: 12 },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 8,
    },
    emptyBubble: {
      width: 88, height: 88, borderRadius: 44,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 6,
    },
    emptyTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginTop: 6 },
    emptyBody: {
      color: C.textSecondary,
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 19,
      maxWidth: SCREEN_W * 0.75,
    },
    emptyCta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: BORDER_RADIUS.md,
      marginTop: 14,
    },
    emptyCtaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  });
