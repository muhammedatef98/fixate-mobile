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
  Image,
  TextInput,
  FlatList,
  Modal,
  Dimensions,
  Platform,
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
  type ListingCondition,
  type DeviceType,
  type SortKey,
} from '../services/marketService';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GUTTER = 12;
const CARD_W = (SCREEN_W - GRID_GUTTER * 3) / 2;

const DEVICE_CHIPS: { id: DeviceType | 'all'; ar: string; en: string; icon: string }[] = [
  { id: 'all',       ar: 'الكل',     en: 'All',     icon: 'view-grid' },
  { id: 'phone',     ar: 'جوّالات',  en: 'Phones',  icon: 'cellphone' },
  { id: 'laptop',    ar: 'لابتوب',   en: 'Laptops', icon: 'laptop' },
  { id: 'tablet',    ar: 'تابلت',    en: 'Tablets', icon: 'tablet' },
  { id: 'watch',     ar: 'ساعات',    en: 'Watches', icon: 'watch' },
  { id: 'accessory', ar: 'إكسسوار',  en: 'Accessories', icon: 'headphones' },
  { id: 'other',     ar: 'أخرى',     en: 'Other',   icon: 'dots-horizontal' },
];

const CONDITION_OPTS: { id: ListingCondition; ar: string; en: string }[] = [
  { id: 'new',         ar: 'جديد',        en: 'New' },
  { id: 'like_new',    ar: 'شبه جديد',    en: 'Like new' },
  { id: 'refurbished', ar: 'مجدّد',       en: 'Refurbished' },
  { id: 'used',        ar: 'مستعمل',      en: 'Used' },
  { id: 'for_parts',   ar: 'قطع غيار',    en: 'For parts' },
];

const SORT_OPTS: { id: SortKey; ar: string; en: string }[] = [
  { id: 'newest',     ar: 'الأحدث',          en: 'Newest' },
  { id: 'price_asc',  ar: 'الأقل سعراً',     en: 'Price: low to high' },
  { id: 'price_desc', ar: 'الأعلى سعراً',    en: 'Price: high to low' },
];

const debounce = <T extends (...args: any[]) => void>(fn: T, ms: number) => {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const statusAr = (s: string) => ({
  pending: 'بانتظار الموافقة',
  active: 'مفعّل',
  sold: 'تم البيع',
  rejected: 'مرفوض',
  archived: 'مؤرشف',
}[s] ?? s);

export default function MarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [device, setDevice] = useState<DeviceType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const applySearchDebounced = useMemo(
    () => debounce((v: string) => setAppliedSearch(v), 350),
    []
  );
  useEffect(() => { applySearchDebounced(search); }, [search]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (condition) n++;
    if (city.trim()) n++;
    if (minPrice.trim()) n++;
    if (maxPrice.trim()) n++;
    if (sort !== 'newest') n++;
    return n;
  }, [condition, city, minPrice, maxPrice, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine' && user) {
        setListings(await myListings(user.id));
      } else {
        setListings(
          await browseListings({
            deviceType: device === 'all' ? undefined : device,
            condition: condition ?? undefined,
            city: city.trim() || undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            search: appliedSearch.trim() || undefined,
            sort,
          })
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, device, condition, city, minPrice, maxPrice, appliedSearch, sort, user]);

  useEffect(() => { load(); }, [load]);

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const renderCard = ({ item }: { item: MarketListing }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/market-detail', params: { id: item.id } } as any)}
    >
      <View style={styles.cardImageWrap}>
        {item.images?.[0] ? (
          <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <MaterialCommunityIcons name="image-off" size={28} color={COLORS.textSecondary} />
          </View>
        )}
        {item.images && item.images.length > 1 && (
          <View style={styles.imageCountPill}>
            <Ionicons name="images" size={10} color="#fff" />
            <Text style={styles.imageCountText}>{item.images.length}</Text>
          </View>
        )}
        {item.condition && (
          <View style={styles.conditionPill}>
            <Text style={styles.conditionText}>
              {CONDITION_OPTS.find((c) => c.id === item.condition)?.[isRTL ? 'ar' : 'en']}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardPrice}>
          {item.price.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
        </Text>
        <View style={styles.cardFooter}>
          {item.city ? (
            <View style={styles.cardMeta}>
              <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
              <Text style={styles.cardMetaText} numberOfLines={1}>{item.city}</Text>
            </View>
          ) : <View />}
          {tab === 'mine' && (
            <Text style={styles.cardStatus}>
              {isRTL ? statusAr(item.status) : item.status}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'سوق Fixate' : 'Fixate Market'}</Text>
        <TouchableOpacity onPress={() => router.push('/market-new')} accessibilityRole="button">
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search + filter button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isRTL ? 'ابحث عن جهاز، ماركة، أو موديل…' : 'Search devices, brands, models…'}
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left', color: COLORS.text }]}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setFiltersOpen(true)}
          style={[styles.filterBtn, activeFilterCount > 0 && { borderColor: COLORS.primary }]}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'فلاتر' : 'Filters'}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? COLORS.primary : COLORS.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
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

      {/* Device-type chips (Browse tab only) */}
      {tab === 'browse' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deviceStrip}
          style={{ maxHeight: 56 }}
        >
          {(isRTL ? [...DEVICE_CHIPS].reverse() : DEVICE_CHIPS).map((c) => {
            const active = device === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setDevice(c.id)}
                style={[
                  styles.deviceChip,
                  active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                ]}
              >
                <MaterialCommunityIcons
                  name={c.icon as any}
                  size={14}
                  color={active ? '#fff' : COLORS.text}
                />
                <Text style={[styles.deviceChipText, active && { color: '#fff' }]}>
                  {isRTL ? c.ar : c.en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Grid */}
      {loading && listings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconBubble, { backgroundColor: COLORS.primary + '15' }]}>
            <MaterialCommunityIcons name="storefront-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {tab === 'mine'
              ? (isRTL ? 'لم تنشر أي إعلان بعد' : 'You have no listings yet')
              : (isRTL ? 'لا توجد نتائج' : 'No results')}
          </Text>
          <Text style={styles.emptySub}>
            {tab === 'mine'
              ? (isRTL ? 'انشر إعلانك الأول' : 'Post your first listing')
              : (isRTL ? 'جرّب تعديل الفلاتر أو البحث' : 'Try a different filter or search')}
          </Text>
          {tab === 'mine' && (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push('/market-new')}
            >
              <Text style={styles.ctaText}>{isRTL ? 'انشر إعلاناً' : 'Post a listing'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GUTTER, paddingHorizontal: GRID_GUTTER }}
          contentContainerStyle={{ gap: GRID_GUTTER, paddingVertical: GRID_GUTTER, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter sheet */}
      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setFiltersOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: COLORS.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: COLORS.border }]} />
            <Text style={styles.sheetTitle}>{isRTL ? 'تصفية النتائج' : 'Refine results'}</Text>

            <Text style={styles.sheetLabel}>{isRTL ? 'الحالة' : 'Condition'}</Text>
            <View style={styles.sheetChips}>
              <TouchableOpacity
                onPress={() => setCondition(null)}
                style={[styles.sheetChip, !condition && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
              >
                <Text style={[styles.sheetChipText, !condition && { color: '#fff' }]}>{isRTL ? 'الكل' : 'Any'}</Text>
              </TouchableOpacity>
              {CONDITION_OPTS.map((c) => {
                const active = condition === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCondition(c.id)}
                    style={[styles.sheetChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.sheetChipText, active && { color: '#fff' }]}>
                      {isRTL ? c.ar : c.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>{isRTL ? 'المدينة' : 'City'}</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder={isRTL ? 'مثال: الرياض' : 'e.g. Riyadh'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.sheetInput, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
            />

            <Text style={styles.sheetLabel}>{isRTL ? 'السعر (ر.س)' : 'Price (SAR)'}</Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
              <TextInput
                value={minPrice}
                onChangeText={(v) => setMinPrice(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={isRTL ? 'من' : 'Min'}
                placeholderTextColor={COLORS.textSecondary}
                style={[styles.sheetInput, { flex: 1, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
              />
              <TextInput
                value={maxPrice}
                onChangeText={(v) => setMaxPrice(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={isRTL ? 'إلى' : 'Max'}
                placeholderTextColor={COLORS.textSecondary}
                style={[styles.sheetInput, { flex: 1, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
              />
            </View>

            <Text style={styles.sheetLabel}>{isRTL ? 'الترتيب' : 'Sort by'}</Text>
            <View style={styles.sheetChips}>
              {SORT_OPTS.map((s) => {
                const active = sort === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSort(s.id)}
                    style={[styles.sheetChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.sheetChipText, active && { color: '#fff' }]}>
                      {isRTL ? s.ar : s.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[styles.sheetSecondary, { borderColor: COLORS.border }]}
                onPress={() => {
                  setCondition(null);
                  setCity('');
                  setMinPrice('');
                  setMaxPrice('');
                  setSort('newest');
                }}
              >
                <Text style={[styles.sheetSecondaryText, { color: COLORS.text }]}>{isRTL ? 'مسح' : 'Reset'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetPrimary, { backgroundColor: COLORS.primary }]}
                onPress={() => setFiltersOpen(false)}
              >
                <Text style={styles.sheetPrimaryText}>{isRTL ? 'تطبيق' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    title: { fontSize: 18, fontWeight: '800', color: C.text },
    searchRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: SPACING.lg,
      marginBottom: 8,
    },
    searchBox: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: Platform.OS === 'ios' ? 0 : 4 },
    filterBtn: {
      width: 44,
      height: 44,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    tabs: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      marginHorizontal: SPACING.lg,
      marginVertical: 8,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 4,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BORDER_RADIUS.md - 2 },
    tabText: { color: C.text, fontWeight: '700' },
    deviceStrip: { paddingHorizontal: SPACING.lg, gap: 8, paddingVertical: 4 },
    deviceChip: {
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
    deviceChipText: { color: C.text, fontSize: 13, fontWeight: '700' },

    card: {
      width: CARD_W,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    cardImageWrap: { position: 'relative' },
    cardImage: { width: '100%', height: CARD_W, backgroundColor: C.background },
    cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    imageCountPill: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    imageCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    conditionPill: {
      position: 'absolute',
      bottom: 8,
      left: isRTL ? undefined : 8,
      right: isRTL ? 8 : undefined,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    conditionText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    cardBody: { padding: 10, gap: 4 },
    cardTitle: { color: C.text, fontWeight: '700', fontSize: 13, lineHeight: 18 },
    cardPrice: { color: C.primary, fontWeight: '800', fontSize: 15 },
    cardFooter: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    cardMeta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 3,
      flex: 1,
    },
    cardMetaText: { color: C.textSecondary, fontSize: 11 },
    cardStatus: { color: C.textSecondary, fontSize: 10, fontStyle: 'italic' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
    emptyIconBubble: {
      width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginTop: 10 },
    emptySub: { color: C.textSecondary, textAlign: 'center', fontSize: 13 },
    cta: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: BORDER_RADIUS.md, marginTop: 12 },
    ctaText: { color: '#fff', fontWeight: '800' },

    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: 28,
      paddingTop: 10,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
    sheetTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 14 },
    sheetLabel: { color: C.textSecondary, fontWeight: '700', fontSize: 12, marginTop: 12, marginBottom: 8 },
    sheetChips: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },
    sheetChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.background,
    },
    sheetChipText: { color: C.text, fontWeight: '700', fontSize: 12 },
    sheetInput: {
      borderWidth: 1, borderColor: C.border, borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.background, fontSize: 14,
    },
    sheetSecondary: {
      flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    },
    sheetSecondaryText: { fontWeight: '700' },
    sheetPrimary: {
      flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: BORDER_RADIUS.md,
    },
    sheetPrimaryText: { color: '#fff', fontWeight: '800' },
  });
