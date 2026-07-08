import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, SPACING } from '../../constants/theme';
import {
  getAvailableDeliveryTasks,
  acceptDeliveryTask,
  subscribeToAvailableDeliveryTasks,
  type DeliveryTask,
} from '../../services/courierService';
import DeliveryTaskCard from '../../components/courier/DeliveryTaskCard';
import { COURIER_NAV_HEIGHT } from '../../components/BottomNavCourier';
import { SkeletonOrderCard } from '../../components/SkeletonLoader';
import { getFriendlyError } from '../../utils/errorMessages';
import { logger } from '../../utils/logger';

/**
 * Available tab: the open delivery-task pool, realtime. Claiming is atomic
 * server-side (accept_delivery_task RPC); losing a race surfaces a clear
 * "someone else took it" message and drops the card.
 */
export default function CourierAvailableScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [available, setAvailable] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setErrorMessage(null);
      setAvailable(await getAvailableDeliveryTasks());
    } catch (e) {
      logger.warn('courier available load failed', e);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'المهمات المتاحة' : 'Available Tasks'}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL
              ? 'تظهر المهمات الجديدة هنا فوراً'
              : 'New tasks appear here instantly'}
          </Text>
        </View>
        {available.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: COLORS.primary + '18' }]}>
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 14 }}>
              {available.length}
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

          {available.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="truck-fast-outline" size={64} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>
                {isRTL ? 'لا توجد مهمات متاحة الآن' : 'No tasks available right now'}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6 }}>
                {isRTL
                  ? 'تظهر المهمات الجديدة هنا فوراً — أبقِ التطبيق مفتوحاً أو اسحب للتحديث.'
                  : 'New tasks appear here instantly — keep the app open or pull to refresh.'}
              </Text>
              <View style={[styles.hintCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'كيف تعمل المهمات؟' : 'How tasks work'}
                </Text>
                {[
                  isRTL
                    ? 'مهمة الاستلام: خذ الجهاز من العميل وسلّمه للفني.'
                    : 'Pickup task: collect the device from the customer and hand it to the technician.',
                  isRTL
                    ? 'مهمة الإعادة: خذ الجهاز المُصلَح من الفني وأعده للعميل.'
                    : 'Return task: collect the repaired device from the technician and return it to the customer.',
                  isRTL
                    ? 'بعد قبول المهمة تظهر لك الاتجاهات والاتصال ومحادثة الفني حسب مرحلتك.'
                    : 'Once you accept, directions, calling and the technician chat appear for your current stage.',
                ].map((line, i) => (
                  <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 6 }}>
                    <MaterialCommunityIcons name="check-circle-outline" size={15} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <Text style={{ flex: 1, color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            available.map((t) => (
              <DeliveryTaskCard
                key={t.id}
                task={t}
                mode="available"
                onAccept={handleAccept}
                acceptingId={acceptingId}
              />
            ))
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
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 8 },
  hintCard: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
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
