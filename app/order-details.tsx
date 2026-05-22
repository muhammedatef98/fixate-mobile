import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Linking,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { requests, auth } from '../lib/supabase-api';
import type { Order } from '../lib/supabase-api';
import { logger } from '../utils/logger';
import LiveTrackingMap from '../components/LiveTrackingMap';
import * as reviewService from '../services/reviewService';
import { supabase } from '../services/supabaseClient';
import ImageViewer from '../components/ImageViewer';
import ServiceCenterCard from '../components/ServiceCenterCard';
import { getPlatformSettings } from '../services/platformSettingsService';
import { computeCancellationFee } from '../constants/fees';

const ORDER_TIMELINE: { status: string; arLabel: string; enLabel: string; icon: string }[] = [
  { status: 'pending', arLabel: 'قيد الانتظار', enLabel: 'Pending', icon: 'clock-outline' },
  { status: 'accepted', arLabel: 'تم القبول', enLabel: 'Accepted', icon: 'check-circle' },
  { status: 'picking_up', arLabel: 'جاري الاستلام', enLabel: 'Picking Up', icon: 'car' },
  { status: 'diagnosing', arLabel: 'جاري الفحص', enLabel: 'Diagnosing', icon: 'magnify' },
  { status: 'quoted', arLabel: 'بانتظار موافقتك', enLabel: 'Awaiting Your Approval', icon: 'cash-check' },
  { status: 'awaiting_payment', arLabel: 'بانتظار الدفع', enLabel: 'Awaiting Payment', icon: 'credit-card-clock' },
  { status: 'waiting_parts', arLabel: 'انتظار قطع غيار', enLabel: 'Waiting for Parts', icon: 'clock-outline' },
  { status: 'repairing', arLabel: 'جاري الإصلاح', enLabel: 'Repairing', icon: 'tools' },
  { status: 'testing', arLabel: 'اختبار الجودة', enLabel: 'Quality Testing', icon: 'flask' },
  { status: 'delivering', arLabel: 'جاري التوصيل', enLabel: 'Delivering', icon: 'truck-delivery' },
  { status: 'completed', arLabel: 'مكتمل', enLabel: 'Completed', icon: 'check-all' },
  { status: 'cancelled', arLabel: 'ملغي', enLabel: 'Cancelled', icon: 'close-circle' },
];

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<'customer' | 'technician'>('customer');
  const [myRating, setMyRating] = useState<number>(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [respondingQuote, setRespondingQuote] = useState(false);
  const [feePreview, setFeePreview] = useState<{ total: number; inspection: number; return: number } | null>(null);

  const styles = makeStyles(isRTL);

  useEffect(() => {
    if (!order) return;
    (async () => {
      const settings = await getPlatformSettings();
      const fulfillment = ((order as any).fulfillment_type ?? order.service_type) as any;
      setFeePreview(
        computeCancellationFee({
          inspectionFee: settings.inspectionFee,
          returnFee: settings.returnFee,
          fulfillmentType: fulfillment,
        })
      );
    })();
  }, [order?.id]);

  const respondToQuote = async (accept: boolean) => {
    if (!order || respondingQuote) return;
    setRespondingQuote(true);
    try {
      await requests.respondToQuote(order.id as string, accept);
      if (!accept) {
        // Quote rejected. Inspection is free — but for pickup & delivery
        // and mobile / on-site visits the delivery (visit) fee is still
        // owed, so the customer is sent to pay just that.
        const fulfillment = ((order as any).fulfillment_type ?? order.service_type) as string;
        const deliveryFee = Number((order as any).delivery_fee ?? 0);
        const needsDeliveryPayment =
          ['mobile', 'on_site', 'pickup', 'pickup_delivery'].includes(fulfillment) &&
          deliveryFee > 0;
        if (needsDeliveryPayment) {
          Alert.alert(
            isRTL ? 'تم رفض عرض السعر' : 'Quote rejected',
            isRTL
              ? `الفحص مجاني، لكن تتبقّى رسوم التوصيل (${deliveryFee} ر.س). تابع لإتمام الدفع.`
              : `Inspection is free, but the delivery fee (${deliveryFee} SAR) is still due. Continue to pay it.`,
            [
              {
                text: isRTL ? 'متابعة الدفع' : 'Continue to payment',
                onPress: () =>
                  router.push({
                    pathname: '/payment',
                    params: {
                      orderId: String(order.id),
                      amount: String(deliveryFee),
                      purpose: 'delivery_fee',
                    },
                  }),
              },
            ]
          );
        } else {
          Alert.alert(
            isRTL ? 'تم رفض عرض السعر' : 'Quote rejected',
            isRTL
              ? 'تم إلغاء الطلب ولا توجد رسوم مستحقة. الفحص مجاني.'
              : 'The request was cancelled and no fees are due — inspection is free.'
          );
        }
      } else {
        // Quote accepted → the order is payment-ready. Send the customer
        // straight to the real payment page.
        const gross = Number((order as any).final_price ?? order.estimated_price ?? 0);
        const due = Math.max(0, gross - Number((order as any).discount_amount ?? 0));
        router.push({
          pathname: '/payment',
          params: { orderId: String(order.id), amount: String(due) },
        });
      }
    } catch (e) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذّر إرسال ردك، حاول مرة أخرى' : 'Could not submit your response, try again'
      );
    } finally {
      setRespondingQuote(false);
    }
  };

  useEffect(() => {
    if (!order?.id) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const review = await reviewService.getReviewByOrder(order.id, user.id);
      if (review) {
        setMyRating(review.rating);
        setHasReviewed(true);
      }
    })();
  }, [order?.id]);

  const submitRating = async (rating: number) => {
    if (!order || hasReviewed || submittingRating) return;
    setSubmittingRating(true);
    setMyRating(rating);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await reviewService.submitReview(order.id, user.id, order.technician_id ?? null, rating);
      setHasReviewed(true);
      Alert.alert(
        isRTL ? 'شكراً لك ✓' : 'Thanks ✓',
        isRTL ? 'تم استلام تقييمك بنجاح' : 'Your rating has been recorded'
      );
    } catch (e: any) {
      setMyRating(0);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذّر إرسال التقييم. حاول مرة أخرى.' : 'Could not submit rating'
      );
    } finally {
      setSubmittingRating(false);
    }
  };

  useEffect(() => {
    checkUserType();
    loadOrderDetails();

    // Subscribe to real-time updates for this specific order
    const subscription = requests.subscribeToUpdates(id as string, (updatedOrder) => {
      setOrder(updatedOrder);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  const checkUserType = async () => {
    const user = await auth.getCurrentUser();
    if (user?.user_metadata?.user_type) {
      setUserType(user.user_metadata.user_type);
    }
  };

  const loadOrderDetails = async () => {
    try {
      const orderData = await requests.getById(id as string);
      setOrder(orderData);
    } catch (error) {
      logger.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return -1;
    return ORDER_TIMELINE.findIndex(step => step.status === order.status);
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#F59E0B',
      accepted: '#3B82F6',
      picking_up: '#8B5CF6',
      diagnosing: '#06B6D4',
      quoted: '#F59E0B',
      repairing: '#EC4899',
      delivering: '#10B981',
      completed: '#10B981',
      cancelled: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={COLORS.textSecondary} />
          <Text style={[styles.errorText, { color: COLORS.textSecondary }]}>
            {isRTL ? 'لم يتم العثور على الطلب' : 'Order not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = order.status === 'cancelled';
  const statusColor = getStatusColor(order.status);
  // The repair price only exists once the technician submits a quote.
  const hasFinalPrice = !!(order as any).final_price && order.status !== 'quoted';
  const orderFulfillment = (order as any).fulfillment_type ?? order.service_type;
  const usesServiceCenter =
    orderFulfillment === 'personal_handoff';
  // The discount the customer applied during request creation carries
  // forward and reduces the final quote/payment amount after acceptance.
  const discountAmount = Number((order as any).discount_amount ?? 0);
  const grossAmount = Number((order as any).final_price ?? order.estimated_price ?? 0);
  const amountDue = Math.max(0, grossAmount - discountAmount);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      <View style={[
        { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border }
      ]}>
        <TouchableOpacity
          onPress={() => safeBack('/(customer)/orders')}
          style={{ padding: 6 }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>
          {isRTL ? 'تفاصيل الطلب' : 'Order Details'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Prominent status hero */}
        <View style={[styles.heroStatus, { backgroundColor: statusColor }]}>
          <MaterialCommunityIcons
            name={(ORDER_TIMELINE.find(t => t.status === order.status)?.icon as any) || 'progress-clock'}
            size={36}
            color="#fff"
          />
          <Text style={styles.heroStatusLabel}>
            {isRTL
              ? ORDER_TIMELINE.find(t => t.status === order.status)?.arLabel
              : ORDER_TIMELINE.find(t => t.status === order.status)?.enLabel}
          </Text>
          <Text style={styles.heroStatusOrderId}>
            {(order as any).order_number ?? `#${order.id?.slice(0, 8)}`}
          </Text>
        </View>

        {/* Live Tracking Map */}
        {!isCancelled &&
          order.technician_id &&
          ['accepted', 'picking_up', 'diagnosing', 'repairing', 'delivering'].includes(order.status) && (
            <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
              <LiveTrackingMap
                orderId={order.id as string}
                customerLat={order.latitude as any}
                customerLng={order.longitude as any}
              />
            </View>
          )}

        {/* Timeline Progress */}
        {!isCancelled && (
          <View style={[styles.timelineCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <View style={styles.timelineContainer}>
              {ORDER_TIMELINE.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <View key={step.status} style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineCircle,
                        {
                          backgroundColor: isCompleted ? getStatusColor(step.status) : COLORS.border,
                          borderColor: isCurrent ? getStatusColor(step.status) : 'transparent',
                          borderWidth: isCurrent ? 3 : 0,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={step.icon as any}
                        size={16}
                        color={isCompleted ? '#fff' : COLORS.textSecondary}
                      />
                    </View>
                    {index < ORDER_TIMELINE.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: index < currentStepIndex ? getStatusColor(step.status) : COLORS.border },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Device Information Card */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cellphone" size={24} color={COLORS.primary} />
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'معلومات الجهاز' : 'Device Information'}
            </Text>
          </View>

          <View style={styles.deviceInfo}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'الجهاز' : 'Device'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {order.device_brand} {order.device_model}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'المشكلة' : 'Issue'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr', flex: 1 }]}>
                {order.issue_description}
              </Text>
            </View>

            {order.media_urls && order.media_urls.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary, marginBottom: 8 }]}>
                  {isRTL ? 'الصور المرفقة' : 'Attached photos'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {order.media_urls.map((url, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => { setViewerIndex(idx); setViewerOpen(true); }}
                      activeOpacity={0.85}
                      style={{ marginRight: 8 }}
                    >
                      <Image
                        source={{ uri: url }}
                        style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: COLORS.border }}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>

        {/* Technician inspection quote — customer accepts or rejects */}
        {order.status === 'quoted' && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderWidth: 2, borderColor: '#F59E0B' }, SHADOWS.small]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="cash-check" size={24} color="#F59E0B" />
              <Text style={[styles.cardTitle, { color: COLORS.text }]}>
                {isRTL ? 'عرض السعر بعد الفحص' : 'Price after inspection'}
              </Text>
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 12 }}>
              {isRTL
                ? 'قام الفني بفحص جهازك وحدد السعر النهائي التالي. وافق للمتابعة أو ارفض لإلغاء الطلب.'
                : 'The technician inspected your device and set the final price below. Accept to continue or reject to cancel the request.'}
            </Text>
            <View style={[styles.priceRow, { marginBottom: 8 }]}>
              <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'السعر النهائي' : 'Final price'}
              </Text>
              <Text style={[styles.priceAmount, { color: '#F59E0B' }]}>
                {(order as any).final_price} {isRTL ? 'ر.س' : 'SAR'}
              </Text>
            </View>
            {!!(order as any).quote_notes && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 12, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
                {(order as any).quote_notes}
              </Text>
            )}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#10B981', flex: 1 }, SHADOWS.small]}
                disabled={respondingQuote}
                onPress={() => respondToQuote(true)}
              >
                {respondingQuote ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>{isRTL ? 'قبول السعر' : 'Accept'}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#EF4444', flex: 1 }, SHADOWS.small]}
                disabled={respondingQuote}
                onPress={() => {
                  const feeMsg = feePreview
                    ? isRTL
                      ? `سيتم إلغاء الطلب. ستُحتسب رسوم رمزية ${feePreview.total} ر.س` +
                        ` (فحص ${feePreview.inspection}` +
                        (feePreview.return ? ` + إرجاع ${feePreview.return}` : '') +
                        ' ر.س). متابعة؟'
                      : `This cancels the request. A small fee of ${feePreview.total} SAR applies` +
                        ` (inspection ${feePreview.inspection}` +
                        (feePreview.return ? ` + return ${feePreview.return}` : '') +
                        ' SAR). Continue?'
                    : isRTL
                      ? 'سيتم إلغاء الطلب. متأكد؟'
                      : 'This will cancel the request. Are you sure?';
                  Alert.alert(
                    isRTL ? 'رفض السعر' : 'Reject price',
                    feeMsg,
                    [
                      { text: isRTL ? 'تراجع' : 'Back', style: 'cancel' },
                      { text: isRTL ? 'تأكيد الرفض' : 'Confirm reject', style: 'destructive', onPress: () => respondToQuote(false) },
                    ]
                  );
                }}
              >
                <MaterialIcons name="cancel" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>{isRTL ? 'رفض' : 'Reject'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payment-ready: customer accepted the quote, must now pay. */}
        {order.status === 'awaiting_payment' && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.primary }, SHADOWS.small]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="credit-card-clock" size={24} color={COLORS.primary} />
              <Text style={[styles.cardTitle, { color: COLORS.text }]}>
                {isRTL ? 'أكمل عملية الدفع' : 'Complete your payment'}
              </Text>
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 12 }}>
              {isRTL
                ? 'لقد وافقت على عرض السعر. أكمل الدفع للمتابعة في الإصلاح.'
                : 'You accepted the quote. Complete payment to proceed with the repair.'}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }, SHADOWS.small]}
              onPress={() =>
                router.push({
                  pathname: '/payment',
                  params: {
                    orderId: String(order.id),
                    amount: String(amountDue),
                  },
                })
              }
            >
              <MaterialIcons name="payment" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>
                {isRTL ? 'الانتقال للدفع' : 'Proceed to payment'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Price Information Card */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="payments" size={24} color={COLORS.primary} />
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {hasFinalPrice
                ? (isRTL ? 'السعر النهائي' : 'Final Price')
                : (isRTL ? 'التكلفة' : 'Cost')}
            </Text>
          </View>

          <View style={styles.priceContainer}>
            {hasFinalPrice ? (
              <>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                    {isRTL ? 'سعر الإصلاح' : 'Repair price'}
                  </Text>
                  <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                    {(order as any).final_price} {isRTL ? 'ر.س' : 'SAR'}
                  </Text>
                </View>
                {discountAmount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.primary }]}>
                      {isRTL ? 'الخصم' : 'Discount'}
                      {(order as any).discount_code ? ` (${(order as any).discount_code})` : ''}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.primary, fontSize: 16 }]}>
                      -{discountAmount} {isRTL ? 'ر.س' : 'SAR'}
                    </Text>
                  </View>
                )}
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                    {isRTL ? 'المبلغ المستحق' : 'Amount due'}
                  </Text>
                  <Text style={[styles.priceAmount, { color: COLORS.primary }]}>
                    {amountDue} {isRTL ? 'ر.س' : 'SAR'}
                  </Text>
                </View>
              </>
            ) : (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: COLORS.primary + '12',
                  borderRadius: BORDER_RADIUS.md,
                  padding: 12,
                }}
              >
                <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
                <Text
                  style={{
                    flex: 1,
                    color: COLORS.text,
                    fontSize: 13,
                    fontWeight: '600',
                    lineHeight: 19,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {isRTL
                    ? 'يتم تحديد السعر بعد الفحص'
                    : 'Price will be determined after inspection'}
                </Text>
              </View>
            )}

            {!!(order as any).delivery_fee && (order as any).delivery_fee > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'رسوم التوصيل' : 'Delivery fee'}
                </Text>
                <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                  {(order as any).delivery_fee} {isRTL ? 'ر.س' : 'SAR'}
                </Text>
              </View>
            )}

            {!!(order as any).loyalty_points_earned && (order as any).loyalty_points_earned > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'نقاط الولاء المكتسبة' : 'Loyalty points earned'}
                </Text>
                <Text style={[styles.priceAmount, { color: COLORS.primary, fontSize: 16 }]}>
                  +{(order as any).loyalty_points_earned}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Service center — where to collect the device after completion. */}
        {order.status === 'completed' && usesServiceCenter && (
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <ServiceCenterCard
              isRTL={isRTL}
              COLORS={COLORS}
              subtitle={
                isRTL
                  ? 'جهازك جاهز للاستلام من مركز Fixate'
                  : 'Your device is ready for collection at the Fixate center'
              }
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {order.technician_id && order.status !== 'pending' && order.status !== 'completed' && order.status !== 'cancelled' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary, flex: 1 }, SHADOWS.small]}
                onPress={() => router.push({
                  pathname: `/chat/${order.id}`,
                  params: { otherUserName: isRTL ? 'الفني' : 'Technician' }
                })}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'مراسلة الفني' : 'Chat with technician'}
              >
                <MaterialIcons name="chat" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {isRTL ? 'مراسلة الفني' : 'Chat'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#10B981', flex: 1 }, SHADOWS.small]}
                onPress={async () => {
                  let phone = order.technician_phone;
                  if (!phone) {
                    // Fetch from technicians table as fallback
                    try {
                      const { data } = await import('../lib/supabase').then(m => m.supabase
                        .from('technicians').select('phone').eq('user_id', order.technician_id!).maybeSingle());
                      phone = (data as any)?.phone;
                    } catch {}
                  }
                  if (!phone) {
                    Alert.alert(
                      isRTL ? 'تنبيه' : 'Notice',
                      isRTL ? 'رقم الفني غير متوفّر، استخدم المحادثة' : "Technician's phone unavailable, please use chat"
                    );
                    return;
                  }
                  Linking.openURL(`tel:${phone}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'الاتصال بالفني' : 'Call technician'}
              >
                <MaterialIcons name="phone" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {isRTL ? 'اتصال' : 'Call'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {userType === 'customer' && order.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#EF4444' }, SHADOWS.small]}
              onPress={() => Alert.alert(
                isRTL ? 'إلغاء الطلب' : 'Cancel Order',
                isRTL ? 'هل أنت متأكد من إلغاء الطلب؟' : 'Are you sure you want to cancel this order?',
                [
                  { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                  {
                    text: isRTL ? 'تأكيد' : 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await requests.updateStatus(id as string, 'cancelled');
                        Alert.alert(isRTL ? 'تم' : 'Done', isRTL ? 'تم إلغاء الطلب' : 'Order cancelled');
                        router.back();
                      } catch (error) {
                        Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل الإلغاء' : 'Failed to cancel');
                      }
                    },
                  },
                ]
              )}
            >
              <MaterialIcons name="cancel" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>
                {isRTL ? 'إلغاء الطلب' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Completed Order Rating */}
        {userType === 'customer' && order.status === 'completed' && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <Text style={[styles.cardTitle, { color: COLORS.text, marginBottom: 6 }]}>
              {hasReviewed
                ? (isRTL ? 'تقييمك ⭐' : 'Your rating ⭐')
                : (isRTL ? 'كيف كانت تجربتك؟' : 'Rate your experience')}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 14 }}>
              {hasReviewed
                ? (isRTL ? 'شكراً لمشاركة رأيك' : 'Thanks for your feedback')
                : (isRTL ? 'اضغط على نجمة لتقييم خدمة الفني' : 'Tap a star to rate the technician')}
            </Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= myRating;
                return (
                  <TouchableOpacity
                    key={star}
                    style={styles.starButton}
                    onPress={() => submitRating(star)}
                    disabled={hasReviewed || submittingRating}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} ${isRTL ? 'نجمة' : 'star'}`}
                  >
                    <MaterialIcons
                      name={filled ? 'star' : 'star-outline'}
                      size={36}
                      color={filled ? '#f59e0b' : COLORS.border}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {submittingRating && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                {isRTL ? 'جارٍ الإرسال...' : 'Submitting...'}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
      <ImageViewer
        visible={viewerOpen}
        images={order?.media_urls ?? []}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (isRTL: boolean) => StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, marginTop: 16 },

  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },

  scrollView: { flex: 1 },

  heroStatus: {
    margin: 16,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroStatusLabel: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  heroStatusOrderId: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  orderIdRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderIdLabel: { fontSize: 14, fontWeight: '500' },
  orderId: { fontSize: 16, fontWeight: 'bold' },

  statusBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  timelineCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
  },
  timelineContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    height: 2,
    flex: 1,
    marginHorizontal: 4,
  },

  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
  },

  cardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: isRTL ? 'right' : 'left' },

  deviceInfo: { gap: 12 },
  infoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 13, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },
  infoValue: { fontSize: 14, fontWeight: '600', textAlign: isRTL ? 'left' : 'right' },

  divider: { height: 1 },

  priceContainer: { gap: 8 },
  priceRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { fontSize: 14, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },
  priceAmount: { fontSize: 20, fontWeight: 'bold' },

  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  buttonRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.sm,
    gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  starButton: { padding: 8 },
});
