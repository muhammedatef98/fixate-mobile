import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  SectionList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  type AppNotification,
} from '../utils/notifications';
import { formatAppDateOnly } from '../lib/formatDate';
import GearLoader from '../components/GearLoader';

type IconPack = 'ion' | 'mci';
// Filled glyphs read more strongly inside the small colored badge than
// their outline equivalents — and each type now uses an icon that maps
// more concretely to the action (e.g. a wrench for order updates, a
// receipt for payments, a hand-coin for promos) instead of generic
// shapes.
const TYPE_META: Record<string, { icon: any; pack: IconPack; color: string }> = {
  order:    { icon: 'tools',                pack: 'mci', color: '#2563EB' },
  listing:  { icon: 'storefront',           pack: 'mci', color: '#10B981' },
  message:  { icon: 'chatbubble',           pack: 'ion', color: '#8B5CF6' },
  comment:  { icon: 'message-text',         pack: 'mci', color: '#F59E0B' },
  payment:  { icon: 'receipt-text-check',   pack: 'mci', color: '#059669' },
  rating:   { icon: 'star',                 pack: 'ion', color: '#EAB308' },
  promo:    { icon: 'sale',                 pack: 'mci', color: '#DB2777' },
  support:  { icon: 'lifebuoy',             pack: 'mci', color: '#0EA5E9' },
  warning:  { icon: 'alert',                pack: 'ion', color: '#EF4444' },
  general:  { icon: 'bell',                 pack: 'mci', color: '#64748B' },
};
const FALLBACK_META = TYPE_META.general;

// LayoutAnimation needs an explicit opt-in on (old-arch) Android so marking
// read and clearing items animate smoothly there too.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const animateNext = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

// Day bucket for grouping: 0 = today, 1 = yesterday, 2 = earlier.
function dayBucket(iso: string): 0 | 1 | 2 {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(iso).getTime();
  if (t >= startToday) return 0;
  if (t >= startToday - 86400000) return 1;
  return 2;
}

function timeAgo(iso: string, isRTL: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return isRTL ? 'الآن' : 'just now';
  if (min < 60) return isRTL ? `قبل ${min} دقيقة` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isRTL ? `قبل ${hr} ساعة` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return isRTL ? `قبل ${d} يوم` : `${d}d ago`;
  return formatAppDateOnly(iso, isRTL);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Role guard — this screen is the customer notifications surface.
  // A technician who lands here (deep link, cached link, stale push tap)
  // is bounced to the technician notifications screen instead of seeing
  // customer-style deep links (e.g. /order-details vs /manage-order).
  const role =
    (userProfile as any)?.role ??
    (user?.user_metadata as any)?.role ??
    null;
  useEffect(() => {
    if (role === 'technician') {
      router.replace('/(technician)/notifications');
    }
  }, [role, router]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await fetchNotifications(user.id);
    setItems(data);
    setLoading(false);
    // Note: we no longer auto-mark everything read on open. Unread items stay
    // highlighted until the user taps one or uses "Mark all as read", so the
    // highlight and the bell badge reflect real unread state.
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  // Group into Today / Yesterday / Earlier (newest first within each).
  const sections = useMemo(() => {
    const buckets: AppNotification[][] = [[], [], []];
    for (const n of items) buckets[dayBucket(n.created_at)].push(n);
    const titles = isRTL ? ['اليوم', 'أمس', 'سابقاً'] : ['Today', 'Yesterday', 'Earlier'];
    return buckets
      .map((data, i) => ({ title: titles[i], data }))
      .filter((s) => s.data.length > 0);
  }, [items, isRTL]);

  const handleMarkAll = () => {
    if (!user?.id || unreadCount === 0) return;
    animateNext();
    setItems((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true })));
    markAllAsRead(user.id).catch(() => undefined);
  };

  const handlePress = (n: AppNotification) => {
    if (!n.is_read) {
      animateNext();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      markAsRead(n.id).catch(() => undefined);
    }
    if (!n.related_id) return;
    if (n.type === 'order' || n.type === 'message') {
      router.push({ pathname: '/order-details', params: { id: n.related_id } });
    } else if (n.type === 'listing' || n.type === 'comment') {
      router.push({ pathname: '/market-detail', params: { id: n.related_id } });
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const meta = TYPE_META[item.type] ?? FALLBACK_META;
    const title = isRTL ? item.title_ar : item.title_en;
    const body = isRTL ? item.body_ar : item.body_en;
    const unread = !item.is_read;
    return (
      <PressableScale
        to={0.985}
        onPress={() => handlePress(item)}
        style={unread ? [styles.card, styles.cardUnread] : styles.card}
      >
        <View style={[styles.iconContainer, { backgroundColor: meta.color + (unread ? '22' : '18') }]}>
          {meta.pack === 'mci' ? (
            <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color} />
          ) : (
            <Ionicons name={meta.icon} size={19} color={meta.color} />
          )}
        </View>
        <View style={styles.info}>
          <View style={styles.topRow}>
            {unread && <View style={styles.unreadDot} />}
            <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.time}>{timeAgo(item.created_at, isRTL)}</Text>
          </View>
          {!!body && (
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
          )}
        </View>
      </PressableScale>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.background}
      />

      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          onPress={() => safeBack()}
          style={styles.backButton}
        >
          <RTLIonicon name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'الإشعارات' : 'Notifications'}
        </Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAll}
            style={styles.markAllBtn}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تحديد الكل كمقروء' : 'Mark all as read'}
          >
            <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
            <Text style={styles.markAllText} numberOfLines={1}>
              {isRTL ? 'تحديد الكل' : 'Mark all'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <GearLoader size={48} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ marginTop: 60 }}>
              <EmptyState
                icon="bell-off-outline"
                title={isRTL ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                description={
                  isRTL
                    ? 'سنخبرك هنا بكل تحديثات طلباتك وإعلاناتك أولاً بأول.'
                    : "We'll let you know here as soon as something happens."
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
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
    markAllBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.primary + '14',
    },
    markAllText: { fontSize: 12.5, fontWeight: '800', color: C.primary },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: C.textLight,
      textAlign: isRTL ? 'right' : 'left',
      marginTop: 14,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Flatter, lighter list rows: a hairline border instead of a per-card
    // shadow keeps the list calm and reduces the "stack of heavy cards"
    // repetition. Density is tighter (10/12 padding, 6 gap between rows).
    card: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 6,
      alignItems: 'center',
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      gap: 12,
    },
    cardUnread: {
      borderColor: C.primary + '33',
      backgroundColor: C.primarySoft,
    },
    iconContainer: {
      width: 38,
      height: 38,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    info: { flex: 1, gap: 2 },
    topRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    titleUnread: {
      fontWeight: '800',
    },
    body: {
      fontSize: 12.5,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      lineHeight: 18,
    },
    time: {
      fontSize: 11,
      fontWeight: '600',
      color: C.textLight,
      // Fixed width keeps the timestamp from squeezing the title and gives the
      // whole column a clean right-edge rhythm.
      textAlign: isRTL ? 'left' : 'right',
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: C.primary,
    },
  });
