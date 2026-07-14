import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, SPACING } from '../../constants/theme';
import { getMyDeliveryTasks, subscribeToMyDeliveryTasks, type DeliveryTask } from '../../services/courierService';
import DeliveryTaskCard from '../../components/courier/DeliveryTaskCard';
import { COURIER_NAV_HEIGHT } from '../../components/BottomNavCourier';
import { SkeletonOrderCard } from '../../components/SkeletonLoader';
import { getFriendlyError } from '../../utils/errorMessages';
import { logger } from '../../utils/logger';

/**
 * My Tasks tab: everything the courier has accepted — active work first,
 * completed/cancelled history below.
 */
export default function CourierMyTasksScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [mine, setMine] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setErrorMessage(null);
      setMine(await getMyDeliveryTasks(user.id));
    } catch (e) {
      logger.warn('courier my-tasks load failed', e);
      setErrorMessage(getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  }, [user, language]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: reflect status advances and newly-assigned tasks without a manual
  // refresh. A short debounce coalesces bursts (e.g. accept → picked_up).
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = subscribeToMyDeliveryTasks(user.id, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 300);
    });
    return () => {
      if (timer) clearTimeout(timer);
      cleanup();
    };
  }, [user?.id, load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openTask = (task: DeliveryTask) =>
    router.push({ pathname: '/(courier)/task/[id]', params: { id: task.id } } as any);

  const activeMine = mine.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const doneMine = mine.filter((t) => ['completed', 'cancelled'].includes(t.status));
  const completedCount = mine.filter((t) => t.status === 'completed').length;
  const earnedFees = mine
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + Number(t.courier_fee ?? 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'مهماتي' : 'My Tasks'}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'المهمات النشطة والمكتملة' : 'Active and completed deliveries'}
          </Text>
        </View>
        {activeMine.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: COLORS.primary + '18' }]}>
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 14 }}>
              {activeMine.length}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ paddingTop: 16, paddingHorizontal: 16 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: SPACING.lg,
            paddingBottom: COURIER_NAV_HEIGHT + SPACING.lg,
            gap: SPACING.md,
          }}
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

          {mine.length > 0 && (
            <View style={[styles.statsRow]}>
              <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <Text style={{ color: COLORS.primary, fontSize: 20, fontWeight: '900' }}>{activeMine.length}</Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11.5, fontWeight: '700' }}>
                  {isRTL ? 'نشطة' : 'Active'}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '900' }}>{completedCount}</Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11.5, fontWeight: '700' }}>
                  {isRTL ? 'مكتملة' : 'Completed'}
                </Text>
              </View>
              {earnedFees > 0 && (
                <View style={[styles.statCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                  <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '900' }}>
                    {earnedFees.toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11.5, fontWeight: '700' }}>
                    {isRTL ? 'أجور (ر.س)' : 'Fees (SAR)'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeMine.length === 0 && doneMine.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 12 }}>
                {isRTL
                  ? 'لم تقبل أي مهمة بعد. تصفح المهمات المتاحة وابدأ التوصيل.'
                  : "You haven't accepted any tasks yet. Browse available tasks to get started."}
              </Text>
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => router.replace('/(courier)' as any)}
                accessibilityRole="button"
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                  {isRTL ? 'تصفح المهمات المتاحة' : 'Browse available tasks'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {activeMine.length > 0 && (
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 13,
                    fontWeight: '800',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {isRTL ? `المهمات النشطة (${activeMine.length})` : `Active tasks (${activeMine.length})`}
                </Text>
              )}
              {activeMine.map((t) => (
                <DeliveryTaskCard key={t.id} task={t} mode="mine" onOpen={openTask} />
              ))}
              {activeMine.length === 0 && doneMine.length > 0 && (
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
                  {isRTL
                    ? 'لا توجد مهمة نشطة الآن — تصفح المهمات المتاحة لبدء توصيلة جديدة.'
                    : 'No active task right now — browse available tasks to start a new delivery.'}
                </Text>
              )}
              {doneMine.length > 0 && (
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontSize: 13,
                    fontWeight: '700',
                    marginTop: 8,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {isRTL ? `السجل (${doneMine.length})` : `History (${doneMine.length})`}
                </Text>
              )}
              {doneMine.map((t) => (
                <DeliveryTaskCard key={t.id} task={t} mode="mine" onOpen={openTask} />
              ))}
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
  countPill: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 4 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  browseBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
