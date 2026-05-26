import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  adminListAll,
  updateListingStatus,
  type MarketListing,
  type ListingStatus,
} from '../services/marketService';

const STATUS_META: Record<ListingStatus, { ar: string; en: string; color: string; icon: string }> = {
  pending:  { ar: 'قيد المراجعة', en: 'Pending',  color: '#F59E0B', icon: 'clock-outline' },
  active:   { ar: 'منشورة',       en: 'Live',     color: '#16A34A', icon: 'check-circle-outline' },
  rejected: { ar: 'مرفوضة',       en: 'Rejected', color: '#DC2626', icon: 'close-circle-outline' },
  archived: { ar: 'مؤرشفة',       en: 'Archived', color: '#8A94A3', icon: 'archive-outline' },
  sold:     { ar: 'مباعة',        en: 'Sold',     color: '#3B82F6', icon: 'tag-check-outline' },
};

const STATUS_FILTERS: ListingStatus[] = ['pending', 'active', 'rejected', 'archived', 'sold'];

export default function AdminMarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ListingStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await adminListAll());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (l: MarketListing, status: ListingStatus) => {
    setBusyId(l.id);
    try {
      const next = await updateListingStatus(l.id, status);
      setListings((prev) => prev.map((x) => (x.id === l.id ? next : x)));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmAction = (l: MarketListing, status: ListingStatus, verb: string) => {
    Alert.alert(
      verb,
      isRTL ? `«${l.title}»` : `"${l.title}"`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: verb, onPress: () => updateStatus(l, status) },
      ]
    );
  };

  const styles = createStyles(COLORS, isRTL);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={48} color={COLORS.error} />
          <Text style={{ color: COLORS.textSecondary }}>
            {isRTL ? 'هذه الصفحة للمسؤولين فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const counts: Record<ListingStatus, number> = {
    pending: 0, active: 0, rejected: 0, archived: 0, sold: 0,
  };
  for (const l of listings) {
    if (counts[l.status as ListingStatus] != null) counts[l.status as ListingStatus] += 1;
  }
  const filtered = listings.filter((l) => l.status === filter);
  const fmtDate = (v?: string | null) =>
    v ? new Date(v).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB') : '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إدارة السوق' : 'Marketplace'}</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }}>
          <MaterialCommunityIcons name="refresh" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Overview tiles — one tap jumps to that queue */}
      <View style={styles.statsRow}>
        {STATUS_FILTERS.map((s) => {
          const meta = STATUS_META[s];
          const active = filter === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.statTile, active && { borderColor: meta.color, borderWidth: 1.5 }]}
              onPress={() => setFilter(s)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={meta.icon as any} size={16} color={meta.color} />
              <Text style={[styles.statValue, { color: meta.color }]}>{counts[s]}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{isRTL ? meta.ar : meta.en}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading && filtered.length === 0 ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="storefront-outline" size={48} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.textSecondary }}>
              {isRTL ? 'لا توجد إعلانات في هذه الحالة' : 'No listings in this state'}
            </Text>
          </View>
        ) : (
          filtered.map((l) => {
            const meta = STATUS_META[l.status as ListingStatus] ?? STATUS_META.pending;
            const busy = busyId === l.id;
            return (
              <View key={l.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardTop}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/market-detail', params: { id: l.id } })}
                >
                  {l.images?.[0] ? (
                    <Image source={{ uri: l.images[0] }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <MaterialCommunityIcons name="image-off-outline" size={22} color={COLORS.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
                      <View style={[styles.statusPill, { backgroundColor: meta.color + '20' }]}>
                        <Text style={[styles.statusPillText, { color: meta.color }]}>
                          {isRTL ? meta.ar : meta.en}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardSub} numberOfLines={2}>{l.description ?? ''}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.price}>
                        {Number(l.price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {l.currency}
                      </Text>
                      {!!l.city && <Text style={styles.metaDim}>· {l.city}</Text>}
                      {!!l.created_at && <Text style={styles.metaDim}>· {fmtDate(l.created_at)}</Text>}
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                  {l.status !== 'active' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_META.active.color }]}
                      onPress={() => updateStatus(l, 'active')}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      <Text style={styles.actionText}>{isRTL ? 'نشر' : 'Approve'}</Text>
                    </TouchableOpacity>
                  )}
                  {l.status !== 'rejected' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_META.rejected.color }]}
                      onPress={() => confirmAction(l, 'rejected', isRTL ? 'رفض' : 'Reject')}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#fff" />
                      <Text style={styles.actionText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                    </TouchableOpacity>
                  )}
                  {l.status !== 'archived' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_META.archived.color }]}
                      onPress={() => confirmAction(l, 'archived', isRTL ? 'أرشفة' : 'Archive')}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="archive-outline" size={14} color="#fff" />
                      <Text style={styles.actionText}>{isRTL ? 'أرشفة' : 'Archive'}</Text>
                    </TouchableOpacity>
                  )}
                  {busy && <ActivityIndicator size="small" color={COLORS.primary} />}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 50, gap: 10 },
  statsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, color: C.textSecondary, fontWeight: '600' },
  card: {
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.md },
  thumb: { width: 76, height: 76, borderRadius: BORDER_RADIUS.md, backgroundColor: C.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  cardSub: { color: C.textSecondary, fontSize: 12, marginTop: 3, textAlign: isRTL ? 'right' : 'left' },
  metaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  price: { color: C.primary, fontWeight: '800', fontSize: 14 },
  metaDim: { color: C.textSecondary, fontSize: 11 },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    flexWrap: 'wrap',
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
});
