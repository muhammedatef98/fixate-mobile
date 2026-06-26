import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabaseClient';
import { getColors, SPACING } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { EmptyState } from '../components/ui/EmptyState';
import { AdminActivityRow } from '../components/admin/AdminUI';
import { logger } from '../utils/logger';

type ActivityKind = 'order' | 'listing' | 'user';
type Filter = 'all' | ActivityKind;

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  meta: string;
  time: string;
  raw: string;
  onPress: () => void;
}

const PAGE = 25;

// Full, stable timestamp (Gregorian, KSA) for the dedicated log — distinct
// from the dashboard's short relative time.
function fullStamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AdminActivityScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);

  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const FILTERS: { id: Filter; ar: string; en: string }[] = useMemo(
    () => [
      { id: 'all', ar: 'الكل', en: 'All' },
      { id: 'order', ar: 'الطلبات', en: 'Orders' },
      { id: 'listing', ar: 'الإعلانات', en: 'Listings' },
      { id: 'user', ar: 'المستخدمون', en: 'Users' },
    ],
    []
  );

  // Fetch the most-recent `lim` rows of each active source, merge and sort.
  // Increasing `lim` (load more) always yields a consistent merged prefix.
  const fetchData = useCallback(
    async (lim: number, f: Filter): Promise<{ merged: ActivityItem[]; more: boolean }> => {
      const wantOrders = f === 'all' || f === 'order';
      const wantListings = f === 'all' || f === 'listing';
      const wantUsers = f === 'all' || f === 'user';

      const [ord, lst, usr] = await Promise.all([
        wantOrders
          ? supabase
              .from('orders')
              .select('id, order_number, device_brand, device_model, status, created_at')
              .order('created_at', { ascending: false })
              .limit(lim)
          : Promise.resolve({ data: [] as any[] }),
        wantListings
          ? supabase
              .from('market_listings')
              .select('id, title, status, created_at')
              .order('created_at', { ascending: false })
              .limit(lim)
          : Promise.resolve({ data: [] as any[] }),
        wantUsers
          ? supabase
              .from('users')
              .select('id, name, phone, created_at')
              .order('created_at', { ascending: false })
              .limit(lim)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const orders = (ord.data ?? []) as any[];
      const listings = (lst.data ?? []) as any[];
      const users = (usr.data ?? []) as any[];

      const merged: ActivityItem[] = [
        ...orders.map((o) => ({
          id: `o:${o.id}`,
          kind: 'order' as const,
          title:
            (o.order_number ? `#${o.order_number} · ` : '') +
            ([o.device_brand, o.device_model].filter(Boolean).join(' ') ||
              (isRTL ? 'طلب' : 'Order')),
          meta: (isRTL ? 'الحالة: ' : 'Status: ') + o.status,
          time: fullStamp(o.created_at),
          raw: o.created_at,
          onPress: () => router.push({ pathname: '/admin-order-detail', params: { id: o.id } } as any),
        })),
        ...listings.map((l) => ({
          id: `l:${l.id}`,
          kind: 'listing' as const,
          title: l.title || (isRTL ? 'إعلان' : 'Listing'),
          meta: (isRTL ? 'الحالة: ' : 'Status: ') + l.status,
          time: fullStamp(l.created_at),
          raw: l.created_at,
          onPress: () => router.push('/admin-market' as any),
        })),
        ...users.map((u) => ({
          id: `u:${u.id}`,
          kind: 'user' as const,
          title: u.name || u.phone || (isRTL ? 'مستخدم جديد' : 'New user'),
          meta: u.phone || '',
          time: fullStamp(u.created_at),
          raw: u.created_at,
          onPress: () => router.push('/admin-users' as any),
        })),
      ]
        .filter((x) => x.raw)
        .sort((a, b) => new Date(b.raw).getTime() - new Date(a.raw).getTime())
        .slice(0, lim);

      // More available if any active source filled its page.
      const more =
        (wantOrders && orders.length >= lim) ||
        (wantListings && listings.length >= lim) ||
        (wantUsers && users.length >= lim);

      return { merged, more };
    },
    [isRTL, router]
  );

  const load = useCallback(
    async (lim: number, f: Filter) => {
      try {
        const { merged, more } = await fetchData(lim, f);
        setItems(merged);
        setHasMore(more);
      } catch (e) {
        logger.warn('admin activity load failed', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fetchData]
  );

  // (Re)load whenever the filter changes — reset paging.
  useEffect(() => {
    setLoading(true);
    setLimit(PAGE);
    load(PAGE, filter);
  }, [filter, load]);

  const onRefresh = () => {
    setRefreshing(true);
    setLimit(PAGE);
    load(PAGE, filter);
  };

  const onEndReached = () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const next = limit + PAGE;
    setLimit(next);
    load(next, filter);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          onPress={() => safeBack('/admin')}
          style={styles.backButton}
        >
          <RTLIonicon name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'سجل النشاط' : 'Activity log'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {isRTL ? f.ar : f.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          renderItem={({ item: a }) => (
            <AdminActivityRow
              icon={
                a.kind === 'order'
                  ? 'clipboard-text-outline'
                  : a.kind === 'listing'
                    ? 'storefront-outline'
                    : 'account-plus-outline'
              }
              iconColor={a.kind === 'order' ? '#3b82f6' : a.kind === 'listing' ? '#f59e0b' : '#10b981'}
              title={a.title}
              meta={a.meta}
              time={a.time}
              onPress={a.onPress}
            />
          )}
          contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ marginTop: 60 }}>
              <EmptyState
                icon="pulse"
                title={isRTL ? 'لا يوجد نشاط' : 'No activity'}
                description={
                  isRTL ? 'سيظهر هنا كل نشاط جديد على المنصة.' : 'New platform activity will appear here.'
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    filterRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
    chipTextActive: { color: '#fff' },
  });
