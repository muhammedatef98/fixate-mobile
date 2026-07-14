import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import Avatar from '../components/Avatar';
import VerifiedBadge from '../components/VerifiedBadge';
import { safeBack } from '../utils/navigation';
import { Riyal } from '../components/Riyal';
import {
  getUserCard,
  sellerListings,
  type MarketListing,
  type UserCard,
} from '../services/marketService';

/** Compact relative-time label (mirrors the marketplace grid). */
const timeAgo = (iso: string | undefined, isRTL: boolean): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'now';
  if (mins < 60) return isRTL ? `${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `${hrs} س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return isRTL ? `${days} ي` : `${days}d`;
  const months = Math.floor(days / 30);
  return isRTL ? `${months} ش` : `${months}mo`;
};

/**
 * Public seller profile: identity card + everything else this seller has
 * posted. Reached from a listing's seller card in market-detail. Reuses the
 * existing market-detail route for each listing tap, so there is no duplicate
 * listing screen.
 */
export default function MarketSellerScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);
  const router = useRouter();
  const params = useLocalSearchParams<{ sellerId?: string; name?: string }>();
  const sellerId = typeof params.sellerId === 'string' ? params.sellerId : '';

  const [seller, setSeller] = useState<UserCard | null>(null);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const [card, rows] = await Promise.all([
        getUserCard(sellerId),
        sellerListings(sellerId),
      ]);
      setSeller(card);
      setListings(rows);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const sellerName =
    seller?.name?.trim() ||
    (typeof params.name === 'string' && params.name.trim()) ||
    (isRTL ? 'بائع' : 'Seller');

  const openListing = (id: string) =>
    router.push({ pathname: '/market-detail', params: { id } } as any);

  const renderCard = ({ item }: { item: MarketListing }) => {
    const isSold = item.status === 'sold';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => openListing(item.id)}
      >
        <View style={styles.cardImageWrap}>
          {item.images?.[0] ? (
            <Image
              source={{ uri: item.images[0] }}
              style={styles.cardImage}
              transition={200}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={item.id}
            />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
              <MaterialCommunityIcons name="image-off" size={26} color={COLORS.textSecondary} />
            </View>
          )}
          {isSold && (
            <View style={styles.soldOverlay}>
              <View style={styles.soldBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#fff" />
                <Text style={styles.soldBadgeText}>{isRTL ? 'تم البيع' : 'Sold'}</Text>
              </View>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.cardPrice}>{item.price.toLocaleString('en-US')}</Text>
            <Text style={styles.cardCurrency}><Riyal /></Text>
          </View>
          <View style={styles.cardMetaRow}>
            {item.city ? (
              <>
                <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
                <Text style={styles.cardMetaText} numberOfLines={1}>{item.city}</Text>
                <Text style={styles.metaDot}>·</Text>
              </>
            ) : null}
            <Ionicons name="time-outline" size={10} color={COLORS.textSecondary} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{timeAgo(item.created_at, isRTL)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <View style={styles.sellerHero}>
      <Avatar name={sellerName} uri={seller?.avatar_url} size={64} />
      <View style={styles.sellerHeroRow}>
        <Text style={styles.sellerHeroName} numberOfLines={1}>{sellerName}</Text>
        {seller?.is_verified ? <VerifiedBadge size="md" /> : null}
      </View>
      <Text style={styles.sellerHeroMeta}>
        {seller?.is_verified
          ? (isRTL ? 'بائع موثّق في سوق Fixate' : 'Verified seller on Fixate Market')
          : (isRTL ? 'بائع في سوق Fixate' : 'Seller on Fixate Market')}
      </Text>
      <View style={styles.countPill}>
        <MaterialCommunityIcons name="tag-multiple-outline" size={13} color={COLORS.primary} />
        <Text style={styles.countPillText}>
          {isRTL
            ? `${listings.length.toLocaleString('en-US')} إعلان`
            : `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'}`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => safeBack('/market')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{isRTL ? 'ملف البائع' : 'Seller profile'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.stateTitle}>{isRTL ? 'تعذّر تحميل ملف البائع' : 'Could not load this seller'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.retryText}>{isRTL ? 'إعادة المحاولة' : 'Try again'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          renderItem={renderCard}
          numColumns={2}
          ListHeaderComponent={header}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="store-outline" size={46} color={COLORS.textSecondary} />
              <Text style={styles.stateTitle}>{isRTL ? 'لا توجد إعلانات أخرى' : 'No other listings'}</Text>
              <Text style={styles.stateBody}>
                {isRTL
                  ? 'هذا البائع ليس لديه إعلانات منشورة حالياً.'
                  : 'This seller has no published listings right now.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.m,
    },
    topBarTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: C.text },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 12 },
    listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 32 },
    columnWrapper: { gap: 12, marginBottom: 12 },

    sellerHero: {
      alignItems: 'center',
      paddingVertical: 18,
      gap: 6,
    },
    sellerHeroRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    sellerHeroName: { fontSize: 19, fontWeight: '900', color: C.text, maxWidth: 240 },
    sellerHeroMeta: { fontSize: 12.5, color: C.textSecondary, fontWeight: '600' },
    countPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.primary + '14',
    },
    countPillText: { color: C.primary, fontSize: 12.5, fontWeight: '800' },

    card: {
      flex: 1,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
    },
    cardImageWrap: { width: '100%', aspectRatio: 1 },
    cardImage: { width: '100%', height: '100%' },
    cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardAlt },
    soldOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    soldBadge: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#16A34A',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    soldBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    cardBody: { padding: 10, gap: 4 },
    cardTitle: { color: C.text, fontSize: 13, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    priceRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 4 },
    cardPrice: { color: C.primary, fontSize: 15, fontWeight: '900' },
    cardCurrency: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
    cardMetaRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 3 },
    cardMetaText: { color: C.textSecondary, fontSize: 10.5, fontWeight: '600' },
    metaDot: { color: C.textSecondary, fontSize: 10.5, marginHorizontal: 1 },

    emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    stateTitle: { color: C.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
    stateBody: { color: C.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 19 },
    retryBtn: {
      marginTop: 4,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: C.primary,
    },
    retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  });
