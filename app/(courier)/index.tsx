import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import {
  getAvailableDeliveryTasks,
  getMyDeliveryTasks,
  acceptDeliveryTask,
  subscribeToAvailableDeliveryTasks,
  DELIVERY_STATUS_LABELS,
  type DeliveryTask,
} from '../../services/courierService';
import { SkeletonOrderCard } from '../../components/SkeletonLoader';
import { getFriendlyError } from '../../utils/errorMessages';
import { logger } from '../../utils/logger';

type TabKey = 'available' | 'mine';

/**
 * Courier home: the open delivery-task pool + the courier's own tasks.
 * Claiming is atomic server-side (accept_delivery_task RPC); losing a race
 * surfaces a clear "someone else took it" message and drops the card.
 */
export default function CourierHomeScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [tab, setTab] = useState<TabKey>('available');
  const [available, setAvailable] = useState<DeliveryTask[]>([]);
  const [mine, setMine] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setErrorMessage(null);
      const [avail, my] = await Promise.all([
        getAvailableDeliveryTasks(),
        getMyDeliveryTasks(user.id),
      ]);
      setAvailable(avail);
      setMine(my);
    } catch (e) {
      logger.warn('courier load failed', e);
      setErrorMessage(getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  }, [user, language]);

  useEffect(() => {
    void load();
    const cleanup = subscribeToAvailableDeliveryTasks(() => void load());
    return cleanup;
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAccept = async (task: DeliveryTask) => {
    setAcceptingId(task.id);
    try {
      await acceptDeliveryTask(task.id);
      await load();
      setTab('mine');
      router.push({ pathname: '/(courier)/task/[id]', params: { id: task.id } } as any);
    } catch (e: any) {
      const raced = String(e?.message ?? '').includes('task_no_longer_available');
      if (raced) setAvailable((prev) => prev.filter((t) => t.id !== task.id));
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        raced
          ? isRTL
            ? 'هذه المهمة لم تعد متاحة — قبلها مندوب آخر.'
            : 'This task is no longer available — another courier took it.'
          : getFriendlyError(e, language)
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const activeMine = mine.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const doneMine = mine.filter((t) => ['completed', 'cancelled'].includes(t.status));

  const renderTask = (task: DeliveryTask, mode: TabKey) => {
    const isPickupLeg = task.task_type === 'pickup';
    const statusLabel = DELIVERY_STATUS_LABELS[task.status]?.[isRTL ? 'ar' : 'en'] ?? task.status;
    return (
      <View
        key={task.id}
        style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}
      >
        <View style={[styles.rowBetween, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.badge, { backgroundColor: COLORS.primary + '18' }]}>
            <MaterialCommunityIcons
              name={isPickupLeg ? 'package-up' : 'package-down'}
              size={15}
              color={COLORS.primary}
            />
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
              {isPickupLeg
                ? isRTL ? 'استلام من العميل' : 'Pickup from customer'
                : isRTL ? 'إعادة للعميل' : 'Return to customer'}
            </Text>
          </View>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>
            {statusLabel}
          </Text>
        </View>

        {!!(task.pickup_address || task.dropoff_address) && (
          <View style={{ gap: 4, marginTop: 10 }}>
            {!!task.pickup_address && (
              <View style={[styles.line, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="circle-outline" size={13} color={COLORS.textSecondary} />
                <Text style={[styles.lineText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  {task.pickup_address}
                </Text>
              </View>
            )}
            {!!task.dropoff_address && (
              <View style={[styles.line, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="map-marker" size={13} color={COLORS.primary} />
                <Text style={[styles.lineText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  {task.dropoff_address}
                </Text>
              </View>
            )}
          </View>
        )}

        {mode === 'available' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.primary, opacity: acceptingId === task.id ? 0.6 : 1 }]}
            onPress={() => handleAccept(task)}
            disabled={acceptingId !== null}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {isRTL ? 'قبول المهمة' : 'Accept task'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.primary }]}
            onPress={() =>
              router.push({ pathname: '/(courier)/task/[id]', params: { id: task.id } } as any)
            }
            accessibilityRole="button"
          >
            <Text style={[styles.primaryBtnText, { color: COLORS.primary }]}>
              {isRTL ? 'عرض التفاصيل والمتابعة' : 'View details & continue'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const emptyState = (icon: string, text: string) => (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon as any} size={64} color={COLORS.textSecondary} />
      <Text style={{ color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 12 }}>
        {text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text }}>
          {isRTL ? 'مهمات التوصيل' : 'Delivery Tasks'}
        </Text>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 14, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.replace('/role-selection')}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تبديل الدور' : 'Switch role'}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await signOut();
              router.replace('/role-selection');
            }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
          >
            <MaterialCommunityIcons name="logout" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        {(
          [
            { id: 'available', ar: 'المهمات المتاحة', en: 'Available' },
            { id: 'mine', ar: 'مهماتي', en: 'My tasks' },
          ] as { id: TabKey; ar: string; en: string }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && { backgroundColor: COLORS.primary }]}
            onPress={() => setTab(t.id)}
            accessibilityRole="button"
          >
            <Text style={{ color: tab === t.id ? '#fff' : COLORS.textSecondary, fontWeight: '700', fontSize: 14 }}>
              {isRTL ? t.ar : t.en}
              {t.id === 'available' && available.length > 0 ? ` (${available.length})` : ''}
              {t.id === 'mine' && activeMine.length > 0 ? ` (${activeMine.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ paddingTop: 16, paddingHorizontal: 16 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60, gap: SPACING.md }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
        >
          {errorMessage && (
            <View style={[styles.errorBanner, { backgroundColor: COLORS.error + '15', borderColor: COLORS.error + '40' }]}>
              <Text style={{ color: COLORS.text, fontSize: 13, flex: 1 }}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => void load()} accessibilityRole="button">
                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                  {isRTL ? 'إعادة المحاولة' : 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'available' &&
            (available.length === 0
              ? emptyState(
                  'truck-fast-outline',
                  isRTL
                    ? 'لا توجد مهمات توصيل متاحة حالياً. ستظهر هنا فور توفرها.'
                    : 'No delivery tasks available right now. New tasks appear here instantly.'
                )
              : available.map((t) => renderTask(t, 'available')))}

          {tab === 'mine' && (
            <>
              {activeMine.length === 0 && doneMine.length === 0
                ? emptyState(
                    'clipboard-text-outline',
                    isRTL ? 'لم تقبل أي مهمة بعد.' : "You haven't accepted any tasks yet."
                  )
                : (
                  <>
                    {activeMine.map((t) => renderTask(t, 'mine'))}
                    {doneMine.length > 0 && (
                      <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
                        {isRTL ? 'المكتملة' : 'Completed'}
                      </Text>
                    )}
                    {doneMine.map((t) => renderTask(t, 'mine'))}
                  </>
                )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  tabs: {
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  rowBetween: { alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  line: { alignItems: 'center', gap: 6 },
  lineText: { fontSize: 13, flex: 1 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
