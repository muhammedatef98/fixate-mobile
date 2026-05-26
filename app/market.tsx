import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  FlatList,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  MARKET_DEVICE_TYPES,
} from '../services/marketService';
import SaudiCityPicker from '../components/SaudiCityPicker';
import SkeletonLoader from '../components/SkeletonLoader';

// Tiny SVG blurhash-equivalent placeholder used while the network image
// streams in. expo-image fades the real image in over this, so cards never
// flash a hard-edged grey square. Same string for every card so the
// runtime caches/decodes it once.
const IMG_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GUTTER = 12;
const CARD_W = (SCREEN_W - GRID_GUTTER * 3) / 2;

const DEVICE_CHIPS: { id: DeviceType | 'all'; ar: string; en: string; icon: string }[] = [
  { id: 'all', ar: 'الكل', en: 'All', icon: 'view-grid' },
  ...MARKET_DEVICE_TYPES,
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

/**
 * Compact "time since posted" formatter. Marketplaces live or die on
 * freshness signals — buyers trust recent listings far more than month-old
 * ones, so we surface this on every card.
 */
const timeAgo = (iso: string | undefined, isRTL: boolean): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return isRTL ? 'الآن' : 'now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return isRTL ? `قبل ${min} د` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isRTL ? `قبل ${hr} س` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return isRTL ? `قبل ${day} ي` : `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return isRTL ? `قبل ${wk} أ` : `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return isRTL ? `قبل ${mo} ش` : `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return isRTL ? `قبل ${yr} س` : `${yr}y ago`;
};

export default function MarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  // A deep link of the form /market?device=salvage pre-selects the chip
  // so a customer arriving from the services screen lands on the
  // filtered view directly — no extra tap.
  const params = useLocalSearchParams<{ device?: string }>();
  const validDeviceIds: (DeviceType | 'all')[] = DEVICE_CHIPS.map((c) => c.id);
  const initialDevice: DeviceType | 'all' = validDeviceIds.includes(
    (params.device as DeviceType | 'all') ?? 'all'
  )
    ? ((params.device as DeviceType | 'all') ?? 'all')
    : 'all';

  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [device, setDevice] = useState<DeviceType | 'all'>(initialDevice);
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
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
  const deviceStripRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    import('../services/platformSettingsService')
      .then(({ getPlatformSettings }) => getPlatformSettings())
      .then((s) => { if (!cancelled) setMarketplaceEnabled(s.marketplaceEnabled); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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

  const renderCard = ({ item }: { item: MarketListing }) => {
    const posted = timeAgo(item.created_at, isRTL);
    const isVerified = item.status === 'active'; // admin-approved listings only
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/market-detail', params: { id: item.id } } as any)}
      >
        <View style={styles.cardImageWrap}>
          {item.images?.[0] ? (
            <Image
              source={{ uri: item.images[0] }}
              style={styles.cardImage}
              placeholder={{ blurhash: IMG_BLURHASH }}
              transition={220}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={item.id}
            />
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
          {item.status === 'sold' && (
            <View style={styles.soldOverlay}>
              <View style={styles.soldBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={styles.soldBadgeText}>{isRTL ? 'تم البيع' : 'Sold'}</Text>
              </View>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

          {/* Price block — the single most important piece of info on a
              listing card. Bold, larger, with a quiet currency suffix. */}
          <View style={styles.priceRow}>
            <Text style={styles.cardPrice}>
              {item.price.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </Text>
            <Text style={styles.cardCurrency}>{isRTL ? 'ر.س' : 'SAR'}</Text>
          </View>

          {/* Meta strip — city · time-ago · verified */}
          <View style={styles.cardMetaRow}>
            {item.city ? (
              <View style={styles.cardMeta}>
                <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
                <Text style={styles.cardMetaText} numberOfLines={1}>{item.city}</Text>
              </View>
            ) : null}
            {posted ? (
              <>
                {item.city ? <Text style={styles.metaDot}>·</Text> : null}
                <Text style={styles.cardMetaText} numberOfLines={1}>{posted}</Text>
              </>
            ) : null}
          </View>

          {/* Trust signal — only on admin-approved listings */}
          <View style={styles.trustRow}>
            {isVerified && tab === 'browse' && (
              <View style={styles.verifyChip}>
                <Ionicons name="shield-checkmark" size={10} color={COLORS.primary} />
                <Text style={styles.verifyChipText}>
                  {isRTL ? 'موثّق' : 'Verified'}
                </Text>
              </View>
            )}
            {tab === 'mine' && (
              <Text style={styles.cardStatus}>
                {isRTL ? statusAr(item.status) : item.status}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Two-column skeleton grid shown on the first load (replaces the bare
  // spinner that previously sat on an empty screen — feels much faster).
  const renderSkeletonGrid = () => {
    const rows = 4;
    return (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: GRID_GUTTER,
          paddingVertical: GRID_GUTTER,
          gap: GRID_GUTTER,
        }}
        showsVerticalScrollIndicator={false}
      >
        {Array.from({ length: rows }).map((_, r) => (
          <View
            key={r}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: GRID_GUTTER,
            }}
          >
            {[0, 1].map((c) => (
              <View key={c} style={[styles.card, { padding: 0 }]}>
                <SkeletonLoader width="100%" height={CARD_W} borderRadius={0} />
                <View style={{ padding: 10, gap: 8 }}>
                  <SkeletonLoader width="85%" height={12} borderRadius={4} />
                  <SkeletonLoader width="55%" height={16} borderRadius={4} />
                  <SkeletonLoader width="65%" height={10} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  if (!marketplaceEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isRTL ? 'سوق Fixate' : 'Fixate Market'}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="storefront-outline" size={56} color={COLORS.textSecondary} />
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 12, textAlign: 'center' }}>
            {isRTL ? 'السوق متوقّف مؤقتاً' : 'Marketplace is temporarily off'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            {isRTL
              ? 'سيعود السوق قريباً. شكراً لتفهمكم.'
              : 'The marketplace is taking a quick break. Please check back later.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'سوق Fixate' : 'Fixate Market'}</Text>
        <View style={{ width: 28 }} />
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

      {/* Internal Market tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setTab('browse')}
          style={[styles.tab, tab === 'browse' && { backgroundColor: COLORS.primary }]}
        >
          <Ionicons
            name="grid-outline"
            size={15}
            color={tab === 'browse' ? '#fff' : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, tab === 'browse' && { color: '#fff' }]}>
            {isRTL ? 'تصفّح' : 'Browse'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('mine')}
          style={[styles.tab, tab === 'mine' && { backgroundColor: COLORS.primary }]}
        >
          <Ionicons
            name="pricetags-outline"
            size={15}
            color={tab === 'mine' ? '#fff' : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, tab === 'mine' && { color: '#fff' }]}>
            {isRTL ? 'إعلاناتي' : 'My Listings'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/market-new')}
          style={styles.tab}
        >
          <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} />
          <Text style={[styles.tabText, { color: COLORS.primary }]}>
            {isRTL ? 'إضافة إعلان' : 'Add Listing'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Device-type chips (Browse tab only).
          RTL fix: with `flexDirection: row-reverse`, the FIRST array
          entry ("الكل") is laid out at the rightmost edge of the scroll
          buffer, but the ScrollView opens at offset 0 (the LEFT edge),
          which means RTL users used to see the LAST chip ("أخرى") first
          and had to scroll right to find "الكل / جوال / لابتوب". We now
          jump to the content-end on initial layout in RTL so the rail
          opens on the first/main categories. */}
      {tab === 'browse' && (
        <ScrollView
          ref={deviceStripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deviceStrip}
          style={{ maxHeight: 56 }}
          onContentSizeChange={(w) => {
            if (isRTL && w > 0) {
              // Defer one frame so layout settles before we scroll.
              requestAnimationFrame(() => {
                deviceStripRef.current?.scrollToEnd({ animated: false });
              });
            }
          }}
        >
          {DEVICE_CHIPS.map((c) => {
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
        renderSkeletonGrid()
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
        <>
          {/* Result summary + active sort — a real marketplace always
              tells the buyer what they're looking at. */}
          {tab === 'browse' && (
            <View style={styles.resultBar}>
              <Text style={styles.resultCount} numberOfLines={1}>
                {isRTL
                  ? `${listings.length.toLocaleString('ar-SA')} نتيجة`
                  : `${listings.length} ${listings.length === 1 ? 'result' : 'results'}`}
              </Text>
              <TouchableOpacity
                onPress={() => setFiltersOpen(true)}
                style={styles.sortChip}
                accessibilityRole="button"
              >
                <Ionicons name="swap-vertical" size={13} color={COLORS.primary} />
                <Text style={styles.sortChipText}>
                  {(SORT_OPTS.find((s) => s.id === sort) ?? SORT_OPTS[0])[isRTL ? 'ar' : 'en']}
                </Text>
                <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
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
            initialNumToRender={8}
            windowSize={9}
            removeClippedSubviews
          />
        </>
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
            <SaudiCityPicker
              value={city}
              onSelect={setCity}
              isRTL={isRTL}
              placeholder={isRTL ? 'كل المدن' : 'All cities'}
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
    tab: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: BORDER_RADIUS.md - 2,
    },
    tabText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },
    deviceStrip: {
      paddingHorizontal: SPACING.lg,
      gap: 8,
      paddingVertical: 4,
      flexDirection: isRTL ? 'row-reverse' : 'row',
    },
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

    // Result bar — small but high-value: tells the buyer "we found N
    // items, sorted by X" and gives them a one-tap shortcut to change
    // the sort. Classic Haraj/eBay-style affordance.
    resultBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: 4,
      paddingBottom: 6,
    },
    resultCount: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
    sortChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: C.primary + '12',
    },
    sortChipText: { color: C.primary, fontSize: 12, fontWeight: '700' },

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
      left: isRTL ? 8 : undefined,
      right: isRTL ? undefined : 8,
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
    soldOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15,23,32,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    soldBadge: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#DC2626',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
    },
    soldBadgeText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    cardBody: { padding: 10, gap: 6 },
    cardTitle: {
      color: C.text,
      fontWeight: '700',
      fontSize: 13.5,
      lineHeight: 18,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
      minHeight: 36,
    },
    priceRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    cardPrice: { color: C.primary, fontWeight: '900', fontSize: 17, letterSpacing: -0.2 },
    cardCurrency: { color: C.primary, fontWeight: '700', fontSize: 11, opacity: 0.85 },
    cardMetaRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    cardMeta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 3,
    },
    cardMetaText: { color: C.textSecondary, fontSize: 11 },
    metaDot: { color: C.textSecondary, fontSize: 11, opacity: 0.6 },
    trustRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginTop: 2,
      minHeight: 18,
    },
    verifyChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: C.primary + '15',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    verifyChipText: { color: C.primary, fontWeight: '700', fontSize: 10 },
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
