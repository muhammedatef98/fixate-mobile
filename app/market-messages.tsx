import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import {
  listMyMarketThreads,
  subscribeMyMarketThreads,
  setMarketThreadArchived,
  type MarketThreadSummary,
} from '../services/marketService';
import { logger } from '../utils/logger';
import MarketBottomTabs, { MARKET_TABS_HEIGHT } from '../components/MarketBottomTabs';

/**
 * Marketplace inbox — every conversation the current user participates in
 * (as buyer OR seller), most recent first. Tapping a row opens
 * /market-chat for that listing + counterparty.
 *
 * Data is server-joined via the `list_my_market_threads` RPC so each row
 * already has counterparty profile + listing summary. Realtime UPDATEs on
 * `market_threads` trigger a re-fetch.
 */
export default function MarketMessagesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);

  const [threads, setThreads] = useState<MarketThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Single source of truth — refetch handles both initial load and the
  // realtime "thread changed" pings. Keeping it stateless avoids merge
  // bugs between optimistic updates and Postgres truth.
  const refetch = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await listMyMarketThreads({ limit: 50 });
      setThreads(rows);
    } catch (e) {
      logger.warn('inbox refetch failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      router.replace('/login-otp');
      return;
    }
    refetch();
    const unsubscribe = subscribeMyMarketThreads(user.id, () => {
      refetch();
    });
    return () => unsubscribe();
  }, [user?.id, refetch, router]);

  // Re-fetch on focus too — the realtime channel can miss events while the
  // app is backgrounded.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const openThread = useCallback(
    (row: MarketThreadSummary) => {
      // Reuse the existing market-chat screen — it already knows how to
      // open a thread by listing+seller. Passing the counterparty seller
      // id is the canonical way; for inbox rows where the current user
      // IS the seller, we pass the buyer as "sellerId" param so the
      // chat screen can resolve the thread by (listing, buyer) and still
      // land on the right row.
      router.push({
        pathname: '/market-chat',
        params: {
          listingId: row.listing_id,
          sellerId: row.my_role === 'buyer' ? row.counterparty_id : user?.id ?? '',
          // When the current user is the seller, the existing
          // (listing_id, buyer_id) thread is what we want to open —
          // pass the buyer id explicitly so the chat screen can use it.
          buyerId: row.my_role === 'seller' ? row.counterparty_id : user?.id ?? '',
          threadId: row.thread_id,
          counterpartyName: row.counterparty_name ?? '',
          listingTitle: row.listing_title ?? '',
          listingImage: row.listing_image ?? '',
        },
      });
    },
    [router, user?.id]
  );

  const archiveRow = useCallback(
    async (row: MarketThreadSummary) => {
      try {
        await setMarketThreadArchived(row.thread_id, true);
        // Optimistic local removal — the realtime UPDATE will follow.
        setThreads((prev) => prev.filter((t) => t.thread_id !== row.thread_id));
      } catch (e: any) {
        Alert.alert(
          isRTL ? 'تعذّر الأرشفة' : 'Could not archive',
          e?.message ?? String(e)
        );
      }
    },
    [isRTL]
  );

  const formatTime = useCallback(
    (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      if (sameDay) {
        return d.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
    },
    [isRTL]
  );

  const renderRow = ({ item, index }: { item: MarketThreadSummary; index: number }) => {
    const counterparty =
      item.counterparty_name?.trim() || (isRTL ? 'مستخدم' : 'User');
    const preview = item.last_message_preview?.trim() ||
      (isRTL ? 'ابدأ المحادثة' : 'Start the conversation');

    const isOdd = index % 2 === 1;
    const rowBg = isOdd
      ? COLORS.card
      : (isDark ? COLORS.card + '80' : COLORS.background);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openThread(item)}
        onLongPress={() => archiveRow(item)}
        delayLongPress={450}
        style={[
          styles.row,
          {
            backgroundColor: rowBg,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${counterparty} — ${preview}`}
      >
        <View style={styles.avatarWrap}>
          {item.counterparty_avatar ? (
            <Image
              source={{ uri: item.counterparty_avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(counterparty[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          {item.unread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTopLine}>
            <Text
              numberOfLines={1}
              style={[
                styles.name,
                item.unread && { fontWeight: '800', color: COLORS.text },
              ]}
            >
              {counterparty}
            </Text>
            <Text style={styles.time}>
              {formatTime(item.last_message_at)}
            </Text>
          </View>

          {!!item.listing_title && (
            <View style={styles.listingChip}>
              {item.listing_image ? (
                <Image
                  source={{ uri: item.listing_image }}
                  style={styles.listingThumb}
                />
              ) : (
                <View style={[styles.listingThumb, styles.listingThumbFallback]}>
                  <MaterialCommunityIcons
                    name="image-outline"
                    size={12}
                    color={COLORS.textSecondary}
                  />
                </View>
              )}
              <Text numberOfLines={1} style={styles.listingTitle}>
                {item.listing_title}
              </Text>
              {item.listing_price != null && (
                <Text style={styles.listingPrice}>
                  {Number(item.listing_price).toLocaleString(
                    isRTL ? 'ar-SA' : 'en-US'
                  )}{' '}
                  {item.listing_currency ?? 'SAR'}
                </Text>
              )}
            </View>
          )}

          <Text
            numberOfLines={1}
            style={[
              styles.preview,
              item.unread && {
                color: COLORS.text,
                fontWeight: '700',
              },
            ]}
          >
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack('/market')}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isRTL ? 'الرسائل' : 'Messages'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.thread_id}
          renderItem={renderRow}
          contentContainerStyle={
            threads.length === 0
              ? { flexGrow: 1, paddingBottom: MARKET_TABS_HEIGHT + 24 }
              : { paddingVertical: SPACING.sm, paddingBottom: MARKET_TABS_HEIGHT + 24 }
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                refetch();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={36}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {isRTL
                  ? 'افتح إعلاناً في السوق وابدأ مراسلة البائع — وستظهر هنا.'
                  : 'Open a listing in the marketplace and message the seller — your chats will appear here.'}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/market')}
                style={styles.emptyCta}
                accessibilityRole="button"
              >
                <Ionicons name="storefront-outline" size={16} color="#fff" />
                <Text style={styles.emptyCtaText}>
                  {isRTL ? 'تصفح السوق' : 'Browse the marketplace'}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <MarketBottomTabs />
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
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.background,
    },
    title: {
      color: C.text,
      fontWeight: '800',
      fontSize: 17,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: 12,
      gap: 12,
      backgroundColor: C.background,
    },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.card,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    avatarInitial: { color: C.text, fontWeight: '800', fontSize: 18 },
    unreadDot: {
      position: 'absolute',
      top: 0,
      [isRTL ? 'left' : 'right']: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: C.primary,
      borderWidth: 2,
      borderColor: C.background,
    },

    rowBody: { flex: 1, gap: 4 },
    rowTopLine: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    time: {
      fontSize: 11,
      color: C.textSecondary,
      writingDirection: 'ltr',
    },

    listingChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: 6,
      paddingVertical: 4,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      maxWidth: '100%',
      borderWidth: 1,
      borderColor: C.border,
    },
    listingThumb: {
      width: 18,
      height: 18,
      borderRadius: 4,
      backgroundColor: C.background,
    },
    listingThumbFallback: { alignItems: 'center', justifyContent: 'center' },
    listingTitle: {
      flexShrink: 1,
      fontSize: 11,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    listingPrice: {
      fontSize: 11,
      color: C.primary,
      fontWeight: '700',
    },

    preview: {
      fontSize: 13,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    sep: {
      height: 1,
      backgroundColor: C.border,
      marginHorizontal: SPACING.lg,
      opacity: 0.5,
    },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primary + '15',
      marginBottom: 12,
    },
    emptyTitle: {
      color: C.text,
      fontWeight: '800',
      fontSize: 16,
      textAlign: 'center',
    },
    emptyBody: {
      color: C.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: 6,
    },
    emptyCta: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: C.primary,
      borderRadius: BORDER_RADIUS.md,
    },
    emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  });
