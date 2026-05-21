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
import { Ionicons } from '@expo/vector-icons';
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

const TYPE_META: Record<string, { icon: any; color: string }> = {
  order: { icon: 'cube-outline', color: '#2563EB' },
  listing: { icon: 'pricetag-outline', color: '#10B981' },
  message: { icon: 'chatbubble-ellipses-outline', color: '#8B5CF6' },
  comment: { icon: 'chatbox-ellipses-outline', color: '#F59E0B' },
  general: { icon: 'notifications-outline', color: '#64748B' },
};

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

export default function NotificationsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await fetchNotifications(user.id);
    setItems(data);
    setLoading(false);
    // Mark everything read so the header badge clears. The list keeps the
    // is_read values it loaded with, so freshly-arrived items stay
    // highlighted for this viewing session.
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
    if (n.type === 'order' || n.type === 'message') {
      router.push({ pathname: '/order-details', params: { id: n.related_id } });
    } else if (n.type === 'listing' || n.type === 'comment') {
      router.push({ pathname: '/market-detail', params: { id: n.related_id } });
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const meta = TYPE_META[item.type] ?? TYPE_META.general;
    const title = isRTL ? item.title_ar : item.title_en;
    const body = isRTL ? item.body_ar : item.body_en;
    return (
      <PressableScale
        to={0.985}
        onPress={() => handlePress(item)}
        style={[styles.card, !item.is_read && styles.cardUnread]}
      >
        <View style={[styles.iconContainer, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!body && (
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
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
          {isRTL ? 'الإشعارات' : 'Notifications'}
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
      width: 46,
      height: 46,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    info: { flex: 1 },
    title: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 3,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    body: {
      fontSize: 13,
      marginBottom: 4,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      lineHeight: 19,
    },
    time: {
      fontSize: 11,
      color: C.textLight,
      textAlign: isRTL ? 'right' : 'left',
    },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: C.primary,
    },
  });
