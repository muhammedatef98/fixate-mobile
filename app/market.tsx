import React, { useEffect, useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  browseListings,
  myListings,
  type MarketListing,
  type ListingCategory,
} from '../services/marketService';

const CATEGORIES: { id: ListingCategory | 'all'; ar: string; en: string; icon: string }[] = [
  { id: 'all', ar: 'الكل', en: 'All', icon: 'view-grid' },
  { id: 'used_device', ar: 'أجهزة مستعملة', en: 'Used devices', icon: 'cellphone' },
  { id: 'accessory', ar: 'إكسسوارات', en: 'Accessories', icon: 'headphones' },
  { id: 'spare_part', ar: 'قطع غيار', en: 'Spare parts', icon: 'cog' },
  { id: 'other', ar: 'أخرى', en: 'Other', icon: 'dots-horizontal' },
];

export default function MarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [category, setCategory] = useState<ListingCategory | 'all'>('all');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine' && user) {
        setListings(await myListings(user.id));
      } else {
        setListings(
          await browseListings(category === 'all' ? undefined : { category })
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, category, user]);

  useEffect(() => { load(); }, [load]);

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'سوق Fixate' : 'Fixate Market'}</Text>
        <TouchableOpacity onPress={() => router.push('/market-new')}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['browse', 'mine'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && { backgroundColor: COLORS.primary }]}
          >
            <Text style={[styles.tabText, tab === t && { color: '#fff' }]}>
              {t === 'browse'
                ? (isRTL ? 'تصفّح' : 'Browse')
                : (isRTL ? 'إعلاناتي' : 'My listings')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'browse' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8 }}
          style={{ maxHeight: 56 }}
        >
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[
                styles.chip,
                category === c.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
              ]}
            >
              <MaterialCommunityIcons
                name={c.icon as any}
                size={14}
                color={category === c.id ? '#fff' : COLORS.text}
              />
              <Text style={[styles.chipText, category === c.id && { color: '#fff' }]}>
                {isRTL ? c.ar : c.en}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
      >
        {loading && listings.length === 0 ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : listings.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="storefront-outline"
              size={64}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyTitle}>
              {tab === 'mine'
                ? (isRTL ? 'لم تنشر أي إعلان بعد' : 'You have no listings yet')
                : (isRTL ? 'لا توجد إعلانات حالياً' : 'No listings yet')}
            </Text>
            <Text style={styles.emptySub}>
              {isRTL
                ? 'كن أول من ينشر إعلاناً في سوق Fixate'
                : 'Be the first to post a listing on Fixate Market'}
            </Text>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/market-new')}
            >
              <Text style={styles.ctaText}>{isRTL ? 'انشر إعلاناً' : 'Post a listing'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          listings.map((l) => (
            <View key={l.id} style={styles.card}>
              {l.images?.[0] ? (
                <Image source={{ uri: l.images[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card }]}>
                  <MaterialCommunityIcons name="image-off" size={28} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
                {l.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{l.description}</Text>
                ) : null}
                <View style={[styles.cardMeta, { marginTop: 6 }]}>
                  <Text style={styles.price}>{l.price} {l.currency}</Text>
                  {l.city ? <Text style={styles.city}>{l.city}</Text> : null}
                </View>
                {tab === 'mine' && (
                  <Text style={styles.statusBadge}>
                    {isRTL ? statusAr(l.status) : l.status}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const statusAr = (s: string) => ({
  pending: 'بانتظار الموافقة',
  active: 'مفعّل',
  sold: 'تم البيع',
  rejected: 'مرفوض',
  archived: 'مؤرشف',
}[s] ?? s);

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  tabs: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginHorizontal: SPACING.lg,
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: 8,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BORDER_RADIUS.md - 2 },
  tabText: { color: C.text, fontWeight: '600' },
  chip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 6 },
  emptySub: { color: C.textSecondary, textAlign: 'center', fontSize: 13 },
  cta: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: BORDER_RADIUS.md, marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700' },
  card: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  thumb: { width: 72, height: 72, borderRadius: BORDER_RADIUS.md, backgroundColor: C.background },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  cardDesc: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
  price: { color: C.primary, fontWeight: '800' },
  city: { color: C.textSecondary, fontSize: 12 },
  statusBadge: { color: C.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
});
