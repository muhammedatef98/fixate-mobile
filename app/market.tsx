import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  browseListings,
  type MarketListing,
  type ListingCondition,
  type DeviceType,
  type SortKey,
  MARKET_DEVICE_TYPES,
} from '../services/marketService';
import SaudiCityPicker from '../components/SaudiCityPicker';
import SkeletonLoader from '../components/SkeletonLoader';
import MarketBottomTabs, { MARKET_TABS_HEIGHT } from '../components/MarketBottomTabs';
import { AnimatedTouchable } from '../components/ui/PressableScale';

// Tiny SVG blurhash-equivalent placeholder used while the network image
// streams in. expo-image fades the real image in over this, so cards never
// flash a hard-edged grey square. Same string for every card so the
// runtime caches/decodes it once.
const IMG_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GUTTER = 12;
const CARD_W = (SCREEN_W - GRID_GUTTER * 3) / 2;

// Items posted within this window get a "🔥 Hot" badge — buyers scan
// for it like Haraj users scan for "جديد اليوم". 24h keeps the badge
// rare enough to be meaningful.
const HOT_WINDOW_MS = 24 * 60 * 60 * 1000;

const FAVORITES_KEY = 'fixate.market.favorites.v1';

const loadFavorites = async (): Promise<Set<string>> => {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
};

const persistFavorites = (next: Set<string>): void => {
  AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])).catch(() => undefined);
};

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
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const deviceStripRef = useRef<ScrollView>(null);

  // Hydrate favorites once on mount. AsyncStorage is async so the heart
  // icons fade in after the first paint — that's fine, users notice the
  // listing image first.
  useEffect(() => {
    loadFavorites().then(setFavorites).catch(() => undefined);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistFavorites(next);
      return next;
    });
  }, []);

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

  // When "Saved only" is on, narrow the visible grid to favorited listings
  // (the underlying `listings` array stays untouched so toggling is
  // instant and doesn't trigger a refetch).
  const displayedListings = useMemo(
    () => (savedOnly ? listings.filter((l) => favorites.has(l.id)) : listings),
    [listings, savedOnly, favorites]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await browseListings({
        deviceType: device === 'all' ? undefined : device,
        condition: condition ?? undefined,
        city: city.trim() || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        search: appliedSearch.trim() || undefined,
        sort,
      });
      // Plain state swap — no LayoutAnimation. The earlier ease-in-out
      // wrap caused the device-chip strip and result-bar text to briefly
      // shrink and re-expand on every filter change. The default React
      // re-render is the correct, stable behaviour.
      setListings(next);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [device, condition, city, minPrice, maxPrice, appliedSearch, sort]);

  useEffect(() => { load(); }, [load]);

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const renderCard = ({ item }: { item: MarketListing }) => {
    const posted = timeAgo(item.created_at, isRTL);
    const isVerified = item.status === 'live' || (item.status as any) === 'active';
    const isFavorite = favorites.has(item.id);
    const createdMs = item.created_at ? new Date(item.created_at).getTime() : 0;
    const isHot = createdMs > 0 && Date.now() - createdMs < HOT_WINDOW_MS;
    const condLabel = item.condition
      ? CONDITION_OPTS.find((c) => c.id === item.condition)?.[isRTL ? 'ar' : 'en']
      : null;

    return (
      <AnimatedTouchable
        style={styles.card}
        activeOpacity={0.92}
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

          {/* Top-left badge stack: HOT + verified */}
          <View style={styles.cardTopBadges}>
            {isHot && (
              <View style={styles.hotBadge}>
                <Text style={styles.hotBadgeText}>🔥 {isRTL ? 'جديد' : 'HOT'}</Text>
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={9} color="#fff" />
                <Text style={styles.verifiedBadgeText}>{isRTL ? 'موثّق' : 'Verified'}</Text>
              </View>
            )}
          </View>

          {/* Favorite heart — top-right, large tap area */}
          <AnimatedTouchable
            onPress={() => toggleFavorite(item.id)}
            style={styles.heartBtn}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? (isRTL ? 'إزالة من المفضلة' : 'Remove from saved') : (isRTL ? 'حفظ' : 'Save')}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={16}
              color={isFavorite ? '#ef4444' : '#fff'}
            />
          </AnimatedTouchable>

          {item.images && item.images.length > 1 && (
            <View style={styles.imageCountPill}>
              <Ionicons name="images" size={10} color="#fff" />
              <Text style={styles.imageCountText}>{item.images.length}</Text>
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

          <View style={styles.priceRow}>
            <Text style={styles.cardPrice}>
              {item.price.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </Text>
            <Text style={styles.cardCurrency}>{isRTL ? 'ر.س' : 'SAR'}</Text>
            {condLabel ? (
              <View style={styles.condInline}>
                <Text style={styles.condInlineText} numberOfLines={1}>{condLabel}</Text>
              </View>
            ) : null}
          </View>

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
                <Ionicons name="time-outline" size={10} color={COLORS.textSecondary} />
                <Text style={styles.cardMetaText} numberOfLines={1}>{posted}</Text>
              </>
            ) : null}
          </View>
        </View>
      </AnimatedTouchable>
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
          paddingBottom: MARKET_TABS_HEIGHT + 24,
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
          <AnimatedTouchable onPress={() => router.back()} accessibilityRole="button">
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </AnimatedTouchable>
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
        <AnimatedTouchable
          onPress={() => router.back()}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={20} color={COLORS.text} />
        </AnimatedTouchable>
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={styles.title}>{isRTL ? 'سوق Fixate' : 'Fixate Market'}</Text>
          {!loading && listings.length > 0 ? (
            <Text style={styles.subtitle}>
              {isRTL
                ? `${listings.length.toLocaleString('ar-SA')} إعلان مباشر`
                : `${listings.length.toLocaleString('en-US')} listings live`}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <AnimatedTouchable
            onPress={() => router.replace('/(customer)' as never)}
            style={[styles.headerIconBtn, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'الرئيسية' : 'Home'}
          >
            <Ionicons name="home" size={17} color={COLORS.primary} />
          </AnimatedTouchable>
          <AnimatedTouchable
            onPress={() => setSavedOnly((v) => !v)}
            style={[
              styles.headerIconBtn,
              { backgroundColor: savedOnly ? '#ef444415' : COLORS.card },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'المحفوظات' : 'Saved'}
          >
            <Ionicons
              name={savedOnly ? 'heart' : 'heart-outline'}
              size={18}
              color={savedOnly ? '#ef4444' : COLORS.text}
            />
            {favorites.size > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{favorites.size}</Text>
              </View>
            )}
          </AnimatedTouchable>
        </View>
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
            <AnimatedTouchable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </AnimatedTouchable>
          )}
        </View>
        <AnimatedTouchable
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
        </AnimatedTouchable>
      </View>

      {/* Device-type chips.
          RTL fix: with `flexDirection: row-reverse`, the FIRST array
          entry ("الكل") is laid out at the rightmost edge of the scroll
          buffer, but the ScrollView opens at offset 0 (the LEFT edge),
          which means RTL users used to see the LAST chip ("أخرى") first
          and had to scroll right to find "الكل / جوال / لابتوب". We now
          jump to the content-end on initial layout in RTL so the rail
          opens on the first/main categories. */}
      <ScrollView
        ref={deviceStripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.deviceStrip}
        style={{ maxHeight: 64 }}
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
            // Plain Pressable with no opacity fade / Android ripple. The
            // earlier TouchableOpacity press animation (opacity 1 → 0.75
            // → 1) ran concurrently with the active-state color swap and
            // was perceived as a brief shrink/squeeze of the chip. With
            // visual feedback disabled the chip stays geometrically
            // identical — only its colours change.
            <Pressable
              key={c.id}
              onPress={() => setDevice(c.id)}
              android_ripple={null as any}
              style={[
                styles.deviceChip,
                active && styles.deviceChipActive,
              ]}
            >
              <MaterialCommunityIcons
                name={c.icon as any}
                size={17}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[styles.deviceChipText, active && styles.deviceChipTextActive]}
                numberOfLines={1}
              >
                {isRTL ? c.ar : c.en}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grid */}
      {loading && listings.length === 0 ? (
        renderSkeletonGrid()
      ) : displayedListings.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconBubble, { backgroundColor: COLORS.primary + '15' }]}>
            <MaterialCommunityIcons
              name={savedOnly ? 'heart-outline' : 'storefront-outline'}
              size={48}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {savedOnly
              ? (isRTL ? 'لا توجد محفوظات' : 'No saved listings yet')
              : (isRTL ? 'لا توجد نتائج' : 'No results')}
          </Text>
          <Text style={styles.emptySub}>
            {savedOnly
              ? (isRTL ? 'اضغط القلب على أي إعلان لحفظه هنا' : 'Tap the heart on any listing to save it')
              : (isRTL ? 'جرّب تعديل الفلاتر أو البحث' : 'Try a different filter or search')}
          </Text>
          {!savedOnly && (
            <AnimatedTouchable
              onPress={() => router.push('/market-new')}
              style={[styles.emptyCta, { backgroundColor: COLORS.primary }]}
            >
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.emptyCtaText}>
                {isRTL ? 'انشر إعلانك الآن' : 'Post your listing'}
              </Text>
            </AnimatedTouchable>
          )}
        </View>
      ) : (
        <>
          {/* Result summary + active sort — a real marketplace always
              tells the buyer what they're looking at. */}
          <View style={styles.resultBar}>
            <Text style={styles.resultCount} numberOfLines={1}>
              {savedOnly
                ? (isRTL
                    ? `${displayedListings.length.toLocaleString('ar-SA')} محفوظ`
                    : `${displayedListings.length} saved`)
                : (isRTL
                    ? `${displayedListings.length.toLocaleString('ar-SA')} نتيجة`
                    : `${displayedListings.length} ${displayedListings.length === 1 ? 'result' : 'results'}`)}
            </Text>
            <AnimatedTouchable
              onPress={() => setFiltersOpen(true)}
              style={styles.sortChip}
              accessibilityRole="button"
            >
              <Ionicons name="swap-vertical" size={13} color={COLORS.primary} />
              <Text style={styles.sortChipText}>
                {(SORT_OPTS.find((s) => s.id === sort) ?? SORT_OPTS[0])[isRTL ? 'ar' : 'en']}
              </Text>
              <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
            </AnimatedTouchable>
          </View>
          <FlatList
            data={displayedListings}
            keyExtractor={(l) => l.id}
            renderItem={renderCard}
            extraData={favorites}
            numColumns={2}
            columnWrapperStyle={{ gap: GRID_GUTTER, paddingHorizontal: GRID_GUTTER }}
            contentContainerStyle={{
              gap: GRID_GUTTER,
              paddingVertical: GRID_GUTTER,
              // Leave room for the floating market tab bar + a bit of breathing
              // space so the last row never sits flush against the bar.
              paddingBottom: MARKET_TABS_HEIGHT + 24,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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

      {/* Floating "post a listing" action. Always visible while browsing —
          conversion-critical, so it sits above the grid on the trailing
          side without competing with the scroll content. */}
      <AnimatedTouchable
        style={[styles.fab, { backgroundColor: COLORS.primary }]}
        onPress={() => router.push('/market-new')}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'إضافة إعلان' : 'Post a listing'}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>{isRTL ? 'إعلان' : 'Sell'}</Text>
      </AnimatedTouchable>

      {/* Module-level bottom tab bar — anchors the screen, replaces the
          old in-header Messages / My Listings shortcuts, and gives the
          Market section a navigation surface of its own. */}
      <MarketBottomTabs />

      {/* Filter sheet */}
      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.modalBackdrop}>
          <AnimatedTouchable style={StyleSheet.absoluteFill} onPress={() => setFiltersOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: COLORS.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: COLORS.border }]} />
            <Text style={styles.sheetTitle}>{isRTL ? 'تصفية النتائج' : 'Refine results'}</Text>

            <Text style={styles.sheetLabel}>{isRTL ? 'الحالة' : 'Condition'}</Text>
            <View style={styles.sheetChips}>
              <AnimatedTouchable
                onPress={() => setCondition(null)}
                style={[styles.sheetChip, !condition && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
              >
                <Text style={[styles.sheetChipText, !condition && { color: '#fff' }]}>{isRTL ? 'الكل' : 'Any'}</Text>
              </AnimatedTouchable>
              {CONDITION_OPTS.map((c) => {
                const active = condition === c.id;
                return (
                  <AnimatedTouchable
                    key={c.id}
                    onPress={() => setCondition(c.id)}
                    style={[styles.sheetChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.sheetChipText, active && { color: '#fff' }]}>
                      {isRTL ? c.ar : c.en}
                    </Text>
                  </AnimatedTouchable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>{isRTL ? 'المدينة' : 'City'}</Text>
            {/* Market browse filter — buyers may filter by any city a
                listing was posted from, including ones outside our current
                service coverage. Explicitly opt out of the gating default. */}
            <SaudiCityPicker
              mode="all"
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
                  <AnimatedTouchable
                    key={s.id}
                    onPress={() => setSort(s.id)}
                    style={[styles.sheetChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.sheetChipText, active && { color: '#fff' }]}>
                      {isRTL ? s.ar : s.en}
                    </Text>
                  </AnimatedTouchable>
                );
              })}
            </View>

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 18 }}>
              <AnimatedTouchable
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
              </AnimatedTouchable>
              <AnimatedTouchable
                style={[styles.sheetPrimary, { backgroundColor: COLORS.primary }]}
                onPress={() => setFiltersOpen(false)}
              >
                <Text style={styles.sheetPrimaryText}>{isRTL ? 'تطبيق' : 'Apply'}</Text>
              </AnimatedTouchable>
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
      paddingHorizontal: 12,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    headerActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
      position: 'relative',
    },
    headerBadge: {
      position: 'absolute',
      top: -4,
      [isRTL ? 'left' : 'right']: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#ef4444',
      borderWidth: 2,
      borderColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    title: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
    subtitle: { fontSize: 11, color: C.textSecondary, fontWeight: '700', marginTop: 1 },
    headerActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
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
      gap: 10,
      paddingHorizontal: 14,
      height: 48,
      borderRadius: 16,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    searchInput: { flex: 1, fontSize: 14.5, paddingVertical: Platform.OS === 'ios' ? 0 : 4, fontWeight: '600' },
    filterBtn: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
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
    deviceStrip: {
      paddingHorizontal: SPACING.lg,
      gap: 8,
      paddingVertical: 10,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
    },
    // Chip geometry tuned for Arabic labels — taller pill (38) with
    // generous horizontal padding so words like "لابتوب" / "تابلت" never
    // clip and the icon+text never look squished. Single-line guarantee
    // via numberOfLines={1} on the label.
    deviceChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    // Active state: primary-tinted surface, primary 1.5px border, primary
    // text. Reads decisively without the harshness of a fully solid pill —
    // strong but elegant, as requested.
    deviceChipActive: {
      backgroundColor: C.primarySoft,
      borderColor: C.primary,
      borderWidth: 1.5,
      // Soft lift so the selected chip visibly anchors the row.
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 3,
    },
    deviceChipText: {
      color: C.textSecondary,
      fontSize: 13.5,
      fontWeight: '700',
      letterSpacing: -0.1,
    },
    deviceChipTextActive: { color: C.primary, fontWeight: '800' },

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
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    cardImageWrap: { position: 'relative' },
    cardImage: { width: '100%', height: CARD_W + 16, backgroundColor: C.background },
    cardTopBadges: {
      position: 'absolute',
      top: 8,
      [isRTL ? 'right' : 'left']: 8,
      flexDirection: 'column',
      gap: 4,
      alignItems: isRTL ? 'flex-end' : 'flex-start',
    },
    hotBadge: {
      backgroundColor: '#F97316',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      shadowColor: '#F97316',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 3,
    },
    hotBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
    verifiedBadge: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: C.primary,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    verifiedBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
    heartBtn: {
      position: 'absolute',
      top: 8,
      [isRTL ? 'left' : 'right']: 8,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    condInline: {
      backgroundColor: C.primarySoft,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      marginStart: 4,
    },
    condInlineText: { color: C.primary, fontSize: 10, fontWeight: '800' },
    cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    imageCountPill: {
      position: 'absolute',
      bottom: 8,
      [isRTL ? 'left' : 'right']: 8,
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

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      paddingBottom: MARKET_TABS_HEIGHT,
      gap: 6,
    },
    emptyIconBubble: {
      width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginTop: 10 },
    emptySub: { color: C.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 19 },
    emptyCta: {
      marginTop: 18,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 3,
    },
    emptyCtaText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    // Floating action button — soft elevation, sits above the grid.
    // The vertical offset clears tall-device home indicators and lands
    // squarely in the natural thumb-reach zone for one-handed use.
    fab: {
      position: 'absolute',
      // Sits just above the floating Market tab bar so it stays in the
      // natural thumb zone without ever overlapping the tabs.
      bottom: (Platform.OS === 'ios' ? 30 : 20) + 70 + 4,
      ...(isRTL ? { left: 18 } : { right: 18 }),
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 6,
    },
    fabText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },

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
