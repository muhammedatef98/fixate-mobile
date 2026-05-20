import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  TextInput,
  FlatList,
  Dimensions,
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
  type DeviceType,
} from '../services/marketService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.md) / 2;

interface DeviceFilter {
  id: DeviceType | 'all';
  ar: string;
  en: string;
  icon: string;
}

const DEVICE_FILTERS: DeviceFilter[] = [
  { id: 'all',       ar: 'الكل',      en: 'All',         icon: 'view-grid' },
  { id: 'phone',     ar: 'جوالات',    en: 'Phones',      icon: 'cellphone' },
  { id: 'laptop',    ar: 'لابتوب',    en: 'Laptops',     icon: 'laptop' },
  { id: 'tablet',    ar: 'تابلت',     en: 'Tablets',     icon: 'tablet' },
  { id: 'accessory', ar: 'إكسسوارات', en: 'Accessories', icon: 'headphones' },
  { id: 'watch',     ar: 'ساعات',     en: 'Watches',     icon: 'watch' },
  { id: 'other',     ar: 'أخرى',      en: 'Other',       icon: 'dots-horizontal' },
];

const conditionLabels: Record<string, { ar: string; en: string }> = {
  new:         { ar: 'جديد',     en: 'New' },
  like_new:    { ar: 'شبه جديد', en: 'Like new' },
  refurbished: { ar: 'مجدّد',    en: 'Refurbished' },
  used:        { ar: 'مستعمل',   en: 'Used' },
  for_parts:   { ar: 'قطع غيار', en: 'For parts' },
};

const statusAr = (s: string) =>
  ({ pending: 'بانتظار الموافقة', active: 'مفعّل', sold: 'تم البيع', rejected: 'مرفوض', archived: 'مؤرشف' } as Record<string, string>)[s] ?? s;

export default function MarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [deviceFilter, setDeviceFilter] = useState<DeviceType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce the search box so each keystroke doesn't hammer the DB.
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine' && user) {
        setListings(await myListings(user.id));
      } else {
        setListings(
          await browseListings({
            deviceType: deviceFilter === 'all' ? undefined : deviceFilter,
            search: searchDebounced || undefined,
          })
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, deviceFilter, searchDebounced, user]);

  useEffect(() => { load(); }, [load]);

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'سوق Fixate' : 'Fixate Market'}</Text>
        <TouchableOpacity onPress={() => router.push('/market-new')} style={{ padding: 4 }}>
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
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'ابحث عن جهاز، ماركة، موديل...' : 'Search device, brand, model...'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.searchInput, { color: COLORS.text }]}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8, paddingVertical: 6 }}
            style={{ maxHeight: 50 }}
          >
            {DEVICE_FILTERS.map((c) => {
              const active = deviceFilter === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setDeviceFilter(c.id)}
                  style={[styles.chip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                >
                  <MaterialCommunityIcons
                    name={c.icon as any}
                    size={14}
                    color={active ? '#fff' : COLORS.text}
                  />
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>
                    {isRTL ? c.ar : c.en}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {loading && listings.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : listings.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        >
          <View style={styles.empty}>
            <MaterialCommunityIcons name="storefront-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>
              {tab === 'mine'
                ? (isRTL ? 'لم تنشر أي إعلان بعد' : 'You have no listings yet')
                : (searchDebounced
                    ? (isRTL ? 'لا نتائج تطابق بحثك' : 'No results match your search')
                    : (isRTL ? 'لا توجد إعلانات حالياً' : 'No listings yet'))}
            </Text>
            <Text style={styles.emptySub}>
              {tab === 'mine'
                ? (isRTL ? 'انشر أول إعلان ودعنا نُوصلك بالمشترين' : 'Post your first listing and reach buyers')
                : (isRTL ? 'كن أول من ينشر إعلاناً في سوق Fixate' : 'Be the first to post on Fixate Market')}
            </Text>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/market-new')}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.ctaText}>{isRTL ? 'انشر إعلاناً' : 'Post a listing'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          numColumns={2}
          columnWrapperStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}
          contentContainerStyle={{ paddingVertical: SPACING.md, gap: SPACING.md, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/market-detail', params: { id: item.id } })}
            >
              {item.images?.[0] ? (
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: item.images[0] }} style={styles.thumb} />
                  {item.images.length > 1 && (
                    <View style={styles.imgCount}>
                      <Ionicons name="images" size={10} color="#fff" />
                      <Text style={styles.imgCountText}>{item.images.length}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.thumbWrap, { alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialCommunityIcons name="image-off" size={28} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={{ padding: 10, gap: 4 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardPrice}>
                  {item.price.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {item.currency || (isRTL ? 'ر.س' : 'SAR')}
                </Text>
                <View style={styles.cardMeta}>
                  {item.condition ? (
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {conditionLabels[item.condition]?.[isRTL ? 'ar' : 'en'] ?? item.condition}
                    </Text>
                  ) : null}
                  {item.city ? (
                    <Text style={styles.cardMetaDot} numberOfLines={1}>· {item.city}</Text>
                  ) : null}
                </View>
                {tab === 'mine' && (
                  <Text style={styles.statusBadge}>
                    {isRTL ? statusAr(item.status) : item.status}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    title: { fontSize: 18, fontWeight: '800', color: C.text },
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
    searchBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: SPACING.lg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
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
    empty: { alignItems: 'center', padding: 40, gap: 8, marginTop: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 6 },
    emptySub: { color: C.textSecondary, fontSize: 13, textAlign: 'center' },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: BORDER_RADIUS.md,
      marginTop: 12,
    },
    ctaText: { color: '#fff', fontWeight: '700' },
    card: {
      width: CARD_WIDTH,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg ?? 14,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    thumbWrap: { width: '100%', aspectRatio: 1, backgroundColor: C.background, position: 'relative' },
    thumb: { width: '100%', height: '100%' },
    imgCount: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    imgCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    cardTitle: { fontSize: 13, fontWeight: '700', color: C.text },
    cardPrice: { fontSize: 15, fontWeight: '800', color: C.primary, marginTop: 2 },
    cardMeta: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    cardMetaText: { color: C.textSecondary, fontSize: 11 },
    cardMetaDot: { color: C.textSecondary, fontSize: 11 },
    statusBadge: { color: C.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  });
