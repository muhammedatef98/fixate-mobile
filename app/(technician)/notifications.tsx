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
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { RTLIonicon } from '../../components/RTLIcon';
import { safeBack } from '../../utils/navigation';
import { PressableScale } from '../../components/ui/PressableScale';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  type AppNotification,
} from '../../utils/notifications';
import { formatAppDateOnly } from '../../lib/formatDate';

type IconPack = 'ion' | 'mci';
// Filled glyphs — same palette as the customer notifications screen so
// both surfaces look consistent. Each type maps to an icon that reads as
// the concrete action.
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

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const animateNext = () =>
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

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

export default function TechnicianNotificationsScreen() {
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

  // Defensive role guard: a customer must never see technician deep-link
  // routing (would push them to /(technician)/manage-order which the
  // technician layout will then bounce them out of anyway — but bouncing
  // here is faster and cleaner).
  const role =
    (userProfile as any)?.role ??
    (user?.user_metadata as any)?.role ??
    null;
  useEffect(() => {
    if (role && role !== 'technician') {
      router.replace('/notifications');
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
    // Unread items stay highlighted until tapped or "Mark all as read".
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
    // Technician deep links — orders open the technician manage-order
    // workflow, not the customer's order-details page.
    if (n.type === 'order' || n.type === 'message') {
      router.push(`/(technician)/manage-order?id=${n.related_id}` as any);
    } else if (n.type === 'listing' || n.type === 'comment') {
      router.push({ pathname: '/market-detail', params: { id: n.related_id } });
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const meta = TYPE_META[item.type] ?? FALLBACK_META;
    const title = isRTL ? item.title_ar : item.title_en;
    const body = isRTL ? item.body_ar : item.body_en;
    return (
      <PressableScale
        to={0.985}
        onPress={() => handlePress(item)}
        style={[styles.card, !item.is_read && styles.cardUnread]}
      >
        <View style={[styles.iconContainer, { backgroundColor: meta.color + '20' }]}>
          {meta.pack === 'mci' ? (
            <MaterialCommunityIcons name={meta.icon} size={24} color={meta.color} />
          ) : (
            <Ionicons name={meta.icon} size={24} color={meta.color} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!body && (
            <Text style={styles.body} numberOfLines={2}>{body}</Text>
          )}
          <Text style={styles.time}>{timeAgo(item.created_at, isRTL)}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
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
          {isRTL ? 'إشعارات الفني' : 'Technician notifications'}
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
          <ActivityIndicator size="large" color={COLORS.primary} />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={{ marginTop: 60 }}>
              <EmptyState
                icon="bell-off-outline"
                title={isRTL ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                description={
                  isRTL
                    ? 'سنخبرك هنا بكل طلب جديد وتحديث على عملك.'
                    : "We'll alert you here as soon as a new job or update arrives."
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
      fontSize: 13,
      fontWeight: '800',
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      marginTop: 6,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      gap: 14,
      ...SHADOWS.small,
    },
    cardUnread: {
      borderWidth: 1,
      borderColor: C.primary + '40',
      backgroundColor: C.primarySoft,
    },
    iconContainer: {
      width: 48, height: 48, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.05)',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    info: { flex: 1 },
    title: {
      fontSize: 15, fontWeight: '700', marginBottom: 3,
      color: C.text, textAlign: isRTL ? 'right' : 'left',
    },
    body: {
      fontSize: 13, marginBottom: 4, color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left', lineHeight: 19,
    },
    time: { fontSize: 11, color: C.textLight, textAlign: isRTL ? 'right' : 'left' },
    unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary },
  });
