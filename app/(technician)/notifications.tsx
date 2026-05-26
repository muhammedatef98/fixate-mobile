import React, { useCallback, useEffect, useState } from 'react';
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

type IconPack = 'ion' | 'mci';
const TYPE_META: Record<string, { icon: any; pack: IconPack; color: string }> = {
  order:    { icon: 'cube-outline',                pack: 'ion', color: '#2563EB' },
  listing:  { icon: 'pricetag-outline',            pack: 'ion', color: '#10B981' },
  message:  { icon: 'chatbubble-ellipses-outline', pack: 'ion', color: '#8B5CF6' },
  comment:  { icon: 'chatbox-ellipses-outline',    pack: 'ion', color: '#F59E0B' },
  payment:  { icon: 'cash-multiple',               pack: 'mci', color: '#059669' },
  rating:   { icon: 'star-outline',                pack: 'ion', color: '#EAB308' },
  promo:    { icon: 'pricetags-outline',           pack: 'ion', color: '#DB2777' },
  support:  { icon: 'lifebuoy',                    pack: 'mci', color: '#0EA5E9' },
  warning:  { icon: 'alert-outline',               pack: 'ion', color: '#EF4444' },
  general:  { icon: 'bell-outline',                pack: 'mci', color: '#64748B' },
};
const FALLBACK_META = TYPE_META.general;

function timeAgo(iso: string, isRTL: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return isRTL ? 'الآن' : 'just now';
  if (min < 60) return isRTL ? `قبل ${min} دقيقة` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isRTL ? `قبل ${hr} ساعة` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return isRTL ? `قبل ${d} يوم` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
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
    if (data.some((n) => !n.is_read)) {
      markAllAsRead(user.id).catch(() => undefined);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePress = (n: AppNotification) => {
    if (!n.is_read) markAsRead(n.id).catch(() => undefined);
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
            <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
          ) : (
            <Ionicons name={meta.icon} size={22} color={meta.color} />
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
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
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
      width: 46, height: 46, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
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
