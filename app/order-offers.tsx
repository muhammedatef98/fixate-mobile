import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getOffersForOrder,
  acceptOffer,
  rejectOffer,
  subscribeToOrderOffers,
  OFFER_STATUS_LABELS,
  type OrderOffer,
} from '../services/offerMarketplaceService';
import { getOrderById, type Order } from '../services/orderService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * Customer offers screen: compare quotes from nearby technicians on an open
 * request and accept exactly one. Acceptance is atomic server-side — the
 * winning technician is assigned, competing offers close, and the order
 * continues into the existing repair flow.
 */
export default function OrderOffersScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [order, setOrder] = useState<Order | null>(null);
  const [offers, setOffers] = useState<OrderOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    const [o, offs] = await Promise.all([
      getOrderById(String(orderId)),
      getOffersForOrder(String(orderId)),
    ]);
    setOrder(o);
    setOffers(offs);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
    if (!orderId) return;
    const cleanup = subscribeToOrderOffers(String(orderId), () => void load());
    return cleanup;
  }, [load, orderId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const isOpen = order?.status === 'pending' && !order?.technician_id;
  const isMine = !!user && order?.user_id === user.id;

  const handleAccept = (offer: OrderOffer) => {
    Alert.alert(
      isRTL ? 'قبول العرض' : 'Accept offer',
      isRTL
        ? `سيتم إسناد الطلب لهذا الفني بسعر ${Math.round(offer.amount)} ر.س وإغلاق باقي العروض. متابعة؟`
        : `The request will be assigned to this technician at ${Math.round(offer.amount)} SAR and the other offers will close. Continue?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'قبول' : 'Accept',
          onPress: async () => {
            setActingOn(offer.id);
            try {
              await acceptOffer(offer);
              Alert.alert(
                isRTL ? 'تم ✓' : 'Done ✓',
                isRTL
                  ? 'تم إسناد الطلب للفني. تابع تقدم الإصلاح من تفاصيل الطلب.'
                  : 'The technician was assigned. Track the repair from the order details.',
                [
                  {
                    text: isRTL ? 'متابعة الطلب' : 'Track order',
                    onPress: () =>
                      router.replace({
                        pathname: '/order-details',
                        params: { id: String(orderId) },
                      } as any),
                  },
                ]
              );
            } catch (e: any) {
              logger.warn('accept offer failed', e);
              const gone =
                String(e?.message ?? '').includes('order_no_longer_open') ||
                String(e?.message ?? '').includes('offer_no_longer_open');
              Alert.alert(
                isRTL ? 'تعذّر القبول' : 'Could not accept',
                gone
                  ? isRTL
                    ? 'هذا العرض أو الطلب لم يعد متاحاً. حدّث الصفحة.'
                    : 'This offer or request is no longer open. Refresh the page.'
                  : getFriendlyError(e, language)
              );
              void load();
            } finally {
              setActingOn(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (offer: OrderOffer) => {
    setActingOn(offer.id);
    try {
      await rejectOffer(offer);
      await load();
    } catch (e) {
      logger.warn('reject offer failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setActingOn(null);
    }
  };

  const renderOffer = (offer: OrderOffer) => {
    const decided = offer.status !== 'pending';
    const statusLabel = OFFER_STATUS_LABELS[offer.status]?.[isRTL ? 'ar' : 'en'] ?? offer.status;
    return (
      <View
        key={offer.id}
        style={[
          styles.offerCard,
          { backgroundColor: COLORS.card, borderColor: offer.status === 'accepted' ? COLORS.primary : COLORS.border },
          SHADOWS.small,
          decided && offer.status !== 'accepted' && { opacity: 0.6 },
        ]}
      >
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
          {offer.technician?.avatar_url ? (
            <Image source={{ uri: offer.technician.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialCommunityIcons name="account-wrench" size={22} color={COLORS.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
              {offer.technician?.name || (isRTL ? 'فني معتمد' : 'Verified technician')}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {offer.technician_rating != null && (
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialCommunityIcons name="star" size={13} color="#F59E0B" />
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                    {Number(offer.technician_rating).toFixed(1)}
                  </Text>
                </View>
              )}
              {offer.technician_total_jobs != null && (
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                  {isRTL
                    ? `${offer.technician_total_jobs} عملية`
                    : `${offer.technician_total_jobs} jobs`}
                </Text>
              )}
            </View>
          </View>
          <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 19 }}>
              {Math.round(offer.amount)} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
            {decided && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                {statusLabel}
              </Text>
            )}
          </View>
        </View>

        {!!offer.note && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: isRTL ? 'right' : 'left' }}>
            {offer.note}
          </Text>
        )}

        {isMine && isOpen && offer.status === 'pending' && (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.rejectBtn, { borderColor: COLORS.border }]}
              onPress={() => handleReject(offer)}
              disabled={actingOn !== null}
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 13 }}>
                {isRTL ? 'رفض' : 'Decline'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: COLORS.primary, opacity: actingOn === offer.id ? 0.6 : 1 }]}
              onPress={() => handleAccept(offer)}
              disabled={actingOn !== null}
              accessibilityRole="button"
            >
              {actingOn === offer.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                  {isRTL ? 'قبول هذا العرض' : 'Accept this offer'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: COLORS.border }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(customer)/orders' as any))}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.text }}>
          {isRTL ? 'عروض الفنيين' : 'Technician offers'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 50 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
        >
          {order && (
            <View style={[styles.summary, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                {order.device_brand} {order.device_model}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={2}>
                {order.issue_description}
              </Text>
              {isOpen ? (
                <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL
                    ? 'طلبك مفتوح للعروض — الأسعار المعروضة نهائية من كل فني، وأنت من يختار.'
                    : 'Your request is open for offers — each price is the technician’s own quote, and the choice is yours.'}
                </Text>
              ) : (
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'هذا الطلب لم يعد مفتوحاً للعروض.' : 'This request is no longer open for offers.'}
                </Text>
              )}
            </View>
          )}

          {offers.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="timer-sand" size={64} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 16, marginTop: 14 }}>
                {isRTL ? 'بانتظار عروض الفنيين' : 'Waiting for offers'}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                {isRTL
                  ? 'تم إشعار الفنيين القريبين بطلبك. ستظهر عروضهم هنا فور وصولها وسيصلك إشعار.'
                  : "Nearby technicians were notified. Their offers appear here the moment they arrive — you'll get a notification too."}
              </Text>
            </View>
          ) : (
            offers.map(renderOffer)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  summary: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  offerCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  acceptBtn: {
    flex: 2,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30 },
});
