import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Animated,
  Easing,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
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
import InvoiceDownloadButton from '../components/InvoiceDownloadButton';
import { getPlatformSettings } from '../services/platformSettingsService';
import { useLoyalty } from '../contexts/LoyaltyContext';
import { getOrderTotals, fmtSAR } from '../utils/orderMoney';
import { PAYMENT_MODE_LABELS } from '../utils/paymentPlan';
import { resolveStorageUrls } from '../utils/resolveStorageUrls';
import { getOrderTimeline, actorTypeLabel, type OrderTimelineEvent } from '../services/orderTimelineService';
import { getDeliveryTasksForOrder, deliveryLegLabel, type DeliveryTask } from '../services/courierService';
import { formatAppDate } from '../lib/formatDate';

const ORDER_TIMELINE: { status: string; arLabel: string; enLabel: string; icon: string }[] = [
  { status: 'pending', arLabel: 'بانتظار العروض', enLabel: 'Awaiting offers', icon: 'clock-outline' },
  { status: 'awaiting_payment', arLabel: 'تأكيد الدفع', enLabel: 'Payment confirmation', icon: 'credit-card-clock' },
  { status: 'accepted', arLabel: 'تم التأكيد', enLabel: 'Confirmed', icon: 'check-circle' },
  { status: 'picking_up', arLabel: 'جاري الاستلام', enLabel: 'Picking Up', icon: 'car' },
  { status: 'diagnosing', arLabel: 'جاري الفحص', enLabel: 'Diagnosing', icon: 'magnify' },
  { status: 'waiting_parts', arLabel: 'انتظار قطع غيار', enLabel: 'Waiting for Parts', icon: 'clock-outline' },
  { status: 'repairing', arLabel: 'جاري الإصلاح', enLabel: 'Repairing', icon: 'tools' },
  { status: 'testing', arLabel: 'اختبار الجودة', enLabel: 'Quality Testing', icon: 'flask' },
  { status: 'delivering', arLabel: 'جاري التوصيل', enLabel: 'Delivering', icon: 'truck-delivery' },
  { status: 'completed', arLabel: 'مكتمل', enLabel: 'Completed', icon: 'check-all' },
  { status: 'cancelled', arLabel: 'ملغي', enLabel: 'Cancelled', icon: 'close-circle' },
  // Legacy pre-v2 state — kept so historical rows render, never a step in the
  // happy-path stepper (filtered below alongside 'cancelled').
  { status: 'quoted', arLabel: 'بانتظار تأكيد السعر', enLabel: 'Price confirmation', icon: 'cash-check' },
];

// §13 + courier steps — friendly labels for delivery-leg timeline events
// written by the delivery_tasks trigger (courier_<leg>_<status>).
const COURIER_TIMELINE_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
  courier_pickup_accepted: { ar: 'المندوب في الطريق لاستلام الجهاز منك', en: 'Courier heading to collect from you', icon: 'moped' },
  courier_pickup_picked_up: { ar: 'تم استلام الجهاز من العميل', en: 'Device collected from customer', icon: 'package-up' },
  courier_pickup_delivered: { ar: 'تم تسليم الجهاز للفني', en: 'Device delivered to the technician', icon: 'account-wrench' },
  courier_return_accepted: { ar: 'المندوب في الطريق لإعادة الجهاز', en: 'Courier heading out to return your device', icon: 'moped' },
  courier_return_picked_up: { ar: 'استلم المندوب الجهاز من الفني', en: 'Courier collected the device from the technician', icon: 'package-up' },
  courier_return_delivered: { ar: 'تمت إعادة الجهاز إليك', en: 'Device returned to you', icon: 'check-decagram' },
};

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const { enabled: loyaltyEnabled } = useLoyalty();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<'customer' | 'technician'>('customer');
  const [myRating, setMyRating] = useState<number>(0);
  const [myComment, setMyComment] = useState<string>('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [ratingsEnabled, setRatingsEnabled] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [deliveryTasks, setDeliveryTasks] = useState<DeliveryTask[]>([]);

  const styles = makeStyles(isRTL);

  // FEAT-04/05 — refs + animation state for the status hero and stepper.
  const timelineRef = useRef<ScrollView>(null);
  const statusAnim = useRef(new Animated.Value(1)).current;
  const statusTranslate = useRef(new Animated.Value(0)).current;
  const prevStatusRef = useRef<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Approx width of one stepper item: circle (38) + connector block (28 + 12).
  const STEP_ITEM_WIDTH = 78;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // §13 — load the detailed status-change timeline. Refreshes whenever the
  // order's status changes (the trigger appends a new row server-side).
  useEffect(() => {
    if (!order?.id) return;
    getOrderTimeline(order.id as string).then(setTimeline).catch(() => {});
    // Pickup & delivery orders: custody strip data (who has the device now).
    const fulfillment = (order as any).fulfillment_type ?? order.service_type;
    if (['pickup', 'pickup_delivery'].includes(fulfillment as string)) {
      getDeliveryTasksForOrder(order.id as string).then(setDeliveryTasks).catch(() => {});
    }
  }, [order?.id, order?.status]);

  // FEAT-04 — animate the status hero + stepper whenever the status changes
  // (detected via the realtime subscription that calls setOrder). New content
  // fades in with a slight upward translate. Skipped under reduced motion.
  useEffect(() => {
    if (!order) return;
    const changed = prevStatusRef.current && prevStatusRef.current !== order.status;
    if (changed && !reduceMotion) {
      statusAnim.setValue(0);
      statusTranslate.setValue(8);
      Animated.parallel([
        Animated.timing(statusAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(statusTranslate, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevStatusRef.current = order.status;
  }, [order?.status, reduceMotion]);

  // FEAT-05 — on load / status change, scroll the horizontal stepper so the
  // active stage is in view rather than the far end of the bar. RTL reverses
  // the stage order (stage 1 on the right), so the active index is mirrored.
  useEffect(() => {
    if (!order) return;
    const steps = ORDER_TIMELINE.filter((s) => s.status !== 'cancelled' && s.status !== 'quoted');
    const cur = Math.min(
      steps.findIndex((s) => s.status === order.status),
      steps.length - 1
    );
    if (cur < 0) return;
    const orderedIndex = isRTL ? steps.length - 1 - cur : cur;
    const x = Math.max(0, orderedIndex * STEP_ITEM_WIDTH - STEP_ITEM_WIDTH);
    const t = setTimeout(() => timelineRef.current?.scrollTo({ x, animated: true }), 350);
    return () => clearTimeout(t);
  }, [order?.status, isRTL]);

  useEffect(() => {
    if (!order) return;
    (async () => {
      const settings = await getPlatformSettings();
      setRatingsEnabled(settings.ratingsEnabled);
    })();
  }, [order?.id]);

  useEffect(() => {
    if (!order?.id) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const review = await reviewService.getReviewByOrder(order.id, user.id);
      if (review) {
        setMyRating(review.rating);
        setMyComment(review.comment ?? '');
        setHasReviewed(true);
      }
    })();
  }, [order?.id]);

  const submitRating = async () => {
    if (!order || hasReviewed || submittingRating || myRating < 1) return;
    setSubmittingRating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await reviewService.submitReview(
        order.id,
        user.id,
        order.technician_id ?? null,
        myRating,
        myComment.trim() || undefined,
      );
      setHasReviewed(true);
      Alert.alert(
        isRTL ? 'شكراً لك ✓' : 'Thanks ✓',
        isRTL ? 'تم استلام تقييمك بنجاح' : 'Your rating has been recorded'
      );
    } catch (e: any) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذّر إرسال التقييم. حاول مرة أخرى.' : 'Could not submit rating'
      );
    } finally {
      setSubmittingRating(false);
    }
  };

  const resolveAndSetUrls = async (orderData: any) => {
    const rawUrls: string[] = (orderData?.media_urls ?? []) as string[];
    const signed = await resolveStorageUrls(rawUrls);
    setResolvedUrls(signed.filter((s) => !!s));
  };

  useEffect(() => {
    checkUserType();
    loadOrderDetails();

    const subscription = requests.subscribeToUpdates(id as string, async (updatedOrder) => {
      setOrder(updatedOrder);
      await resolveAndSetUrls(updatedOrder);
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
      await resolveAndSetUrls(orderData);
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
      rejected: '#EF4444',
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
  // Treat rejected like cancelled for the happy-path timeline (hidden); the
  // dedicated rejection notice card renders the reason instead (FEAT-03).
  const isCancelled = order.status === 'cancelled' || order.status === 'rejected';
  const statusColor = getStatusColor(order.status);
  const orderFulfillment = (order as any).fulfillment_type ?? order.service_type;
  const usesServiceCenter = orderFulfillment === 'personal_handoff';
  // Payment architecture v2 — all money figures derive from one helper so
  // amounts can never drift between this screen, payment, and admin views.
  const totals = getOrderTotals(order as any);
  const hasAgreedPrice = totals.agreedAmount > 0 &&
    ((order as any).accepted_offer_amount != null || (order as any).final_price != null);
  const isSplitMode = totals.paymentMode !== 'full_upfront';

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

      {/* Rating/review keyboard fix: the whole content column lives inside a
          KeyboardAvoidingView so the review input at the bottom stays visible
          above the keyboard on small devices. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Prominent status hero (FEAT-04 animated on status change) */}
        <Animated.View
          style={[
            styles.heroStatus,
            { backgroundColor: statusColor, opacity: statusAnim, transform: [{ translateY: statusTranslate }] },
          ]}
        >
          <MaterialCommunityIcons
            name={
              (ORDER_TIMELINE.find(t => t.status === order.status)?.icon as any) ||
              (order.status === 'rejected' ? 'close-octagon' : 'progress-clock')
            }
            size={36}
            color="#fff"
          />
          <Text style={styles.heroStatusLabel}>
            {isRTL
              ? ORDER_TIMELINE.find(t => t.status === order.status)?.arLabel ??
                (order.status === 'rejected' ? 'مرفوض' : '')
              : ORDER_TIMELINE.find(t => t.status === order.status)?.enLabel ??
                (order.status === 'rejected' ? 'Rejected' : '')}
          </Text>
          <Text style={styles.heroStatusOrderId}>
            {(order as any).order_number ?? `#${order.id?.slice(0, 8)}`}
          </Text>
        </Animated.View>

        {/* Custody strip — for pickup & delivery orders, one line that always
            answers "where is my device right now", driven by the courier
            leg's state (shared deliveryLegLabel mapping). */}
        {!isCancelled && deliveryTasks.length > 0 && (() => {
          const active = deliveryTasks.find((t) => !['completed', 'cancelled'].includes(t.status));
          const lastDone = [...deliveryTasks].reverse().find((t) => t.status === 'completed');
          const shown = active ?? lastDone;
          if (!shown) return null;
          // After the pickup leg closes and before a return leg exists, the
          // device is simply with the technician being repaired.
          const withTechnician =
            !active && lastDone?.task_type === 'pickup' &&
            !['delivering', 'completed'].includes(order.status);
          const label = withTechnician
            ? (isRTL
                ? 'جهازك الآن مع الفني — جاري العمل عليه'
                : 'Your device is with the technician — being worked on')
            : deliveryLegLabel(shown.task_type, shown.status)[isRTL ? 'ar' : 'en'];
          const moving = active && ['accepted', 'picked_up'].includes(active.status);
          return (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: SPACING.md,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: COLORS.primary + '10',
                borderColor: COLORS.primary + '30',
                borderWidth: 1,
                borderRadius: BORDER_RADIUS.md,
                padding: 12,
              }}
            >
              <MaterialCommunityIcons
                name={withTechnician ? 'account-wrench' : moving ? 'moped' : 'package-variant-closed'}
                size={22}
                color={COLORS.primary}
              />
              <Text
                style={{
                  flex: 1,
                  color: COLORS.text,
                  fontSize: 13.5,
                  fontWeight: '700',
                  lineHeight: 19,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {label}
              </Text>
            </View>
          );
        })()}

        {!isCancelled &&
          order.technician_id &&
          orderFulfillment !== 'personal_handoff' &&
          ['accepted', 'picking_up', 'diagnosing', 'repairing', 'delivering'].includes(order.status) && (
            <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MaterialCommunityIcons name="map-marker-account" size={18} color={COLORS.primary} />
                <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15 }}>
                  {isRTL ? 'تتبّع الفني' : 'Track your technician'}
                </Text>
              </View>
              <LiveTrackingMap
                orderId={order.id as string}
                customerLat={order.latitude as any}
                customerLng={order.longitude as any}
              />
            </View>
          )}

        {!isCancelled && (() => {
          // Drop the "cancelled" terminal state from the happy-path timeline
          // so it doesn't show as a step every customer is heading toward.
          const visibleSteps = ORDER_TIMELINE.filter((s) => s.status !== 'cancelled' && s.status !== 'quoted');
          const visibleCurrent = Math.min(
            visibleSteps.findIndex((s) => s.status === order.status),
            visibleSteps.length - 1,
          );
          // FEAT-05 — compute the per-step nodes in logical order (so the
          // completed / current / line-fill logic stays correct), then reverse
          // the rendered order for RTL so stage 1 sits on the right and the
          // progress flows leftward. Layout direction stays a plain 'row', which
          // keeps scroll offsets predictable for the initial-scroll effect.
          const nodes = visibleSteps.map((step, index) => {
            const isCompleted = visibleCurrent >= 0 && index <= visibleCurrent;
            const isCurrent = index === visibleCurrent;
            const isLast = index === visibleSteps.length - 1;
            const lineFilled = visibleCurrent >= 0 && index < visibleCurrent;
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
                    size={18}
                    color={isCompleted ? '#fff' : COLORS.textSecondary}
                  />
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: lineFilled ? getStatusColor(step.status) : COLORS.border },
                    ]}
                  />
                )}
              </View>
            );
          });
          const orderedNodes = isRTL ? [...nodes].reverse() : nodes;
          return (
            <Animated.View
              style={[
                styles.timelineCard,
                { backgroundColor: COLORS.card, opacity: statusAnim, transform: [{ translateY: statusTranslate }] },
                SHADOWS.small,
              ]}
            >
              <ScrollView
                ref={timelineRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timelineScroll}
              >
                {orderedNodes}
              </ScrollView>
            </Animated.View>
          );
        })()}

        {/* FEAT-03 — rejection notice shown to the client when a technician
            declined the request, with the reason they provided. Warm,
            apologetic tone + a CTA to encourage re-submitting a new request. */}
        {order.status === 'rejected' && (
          <View style={[styles.card, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1 }, SHADOWS.small]}>
            <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="emoticon-sad-outline" size={24} color="#DC2626" />
              <Text style={[styles.cardTitle, { color: '#991B1B' }]}>
                {isRTL ? 'نعتذر منك' : 'We’re sorry'}
              </Text>
            </View>
            <Text
              style={{
                color: '#7F1D1D',
                fontSize: 15,
                lineHeight: 23,
                marginTop: 8,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {isRTL
                ? `تم رفض طلبك من قِبل الفني بسبب: ${
                    (order as any).rejection_reason || 'لم يُذكر سبب محدد'
                  }`
                : `Your request was declined by the technician for the following reason: ${
                    (order as any).rejection_reason || 'no specific reason given'
                  }`}
            </Text>
            <Text
              style={{
                color: '#9F4444',
                fontSize: 13,
                lineHeight: 20,
                marginTop: 8,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {isRTL
                ? 'لا تقلق — يمكنك إنشاء طلب جديد وسيسعد فنيّ آخر بخدمتك.'
                : 'Don’t worry — you can create a new request and another technician will be glad to help.'}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/request' as any)}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#DC2626',
                paddingVertical: 13,
                borderRadius: BORDER_RADIUS.md,
                marginTop: 14,
              }}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {isRTL ? 'إنشاء طلب جديد' : 'Create a new request'}
              </Text>
            </TouchableOpacity>
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

            <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'المشكلة' : 'Issue'}
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color: COLORS.text,
                    flex: 1,
                    fontSize: 15,
                    lineHeight: 22,
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {order.issue_description}
              </Text>
            </View>

            {resolvedUrls.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary, marginBottom: 8 }]}>
                  {isRTL ? 'الصور المرفقة' : 'Attached photos'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {resolvedUrls.map((url, idx) => (
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

        {/* Awaiting payment — the customer just accepted a technician's offer
            and confirms payment here (this IS the approval moment; they can
            still cancel). */}
        {order.status === 'awaiting_payment' && userType === 'customer' && (
          <View style={[styles.card, { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.primary }, SHADOWS.small]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="credit-card-clock" size={24} color={COLORS.primary} />
              <Text style={[styles.cardTitle, { color: COLORS.text }]}>
                {isRTL ? 'أكّد الدفع لبدء الإصلاح' : 'Confirm payment to start the repair'}
              </Text>
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
              {isSplitMode
                ? isRTL
                  ? `قبلت عرض الفني بقيمة ${fmtSAR(totals.agreedAmount, isRTL)}. المطلوب الآن ${fmtSAR(totals.dueNow, isRTL)} والمتبقي بعد الإصلاح.`
                  : `You accepted the technician's offer of ${fmtSAR(totals.agreedAmount, isRTL)}. ${fmtSAR(totals.dueNow, isRTL)} is due now; the rest after the repair.`
                : isRTL
                  ? `قبلت عرض الفني بقيمة ${fmtSAR(totals.agreedAmount, isRTL)}. أكّد الدفع للمتابعة.`
                  : `You accepted the technician's offer of ${fmtSAR(totals.agreedAmount, isRTL)}. Confirm payment to continue.`}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }, SHADOWS.small]}
              onPress={() =>
                router.push({
                  pathname: '/payment',
                  params: { orderId: String(order.id) },
                })
              }
            >
              <MaterialIcons name="payment" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>
                {isRTL ? 'الانتقال للدفع' : 'Proceed to payment'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={cancellingOrder}
              onPress={() =>
                Alert.alert(
                  isRTL ? 'إلغاء الطلب' : 'Cancel request',
                  isRTL
                    ? 'سيتم إلغاء الطلب وإلغاء إسناد الفني. متأكد؟'
                    : 'This cancels the request and un-assigns the technician. Are you sure?',
                  [
                    { text: isRTL ? 'تراجع' : 'Back', style: 'cancel' },
                    {
                      text: isRTL ? 'تأكيد الإلغاء' : 'Confirm cancel',
                      style: 'destructive',
                      onPress: async () => {
                        setCancellingOrder(true);
                        try {
                          await requests.updateStatus(order.id as string, 'cancelled');
                        } catch (e) {
                          Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل الإلغاء' : 'Failed to cancel');
                        } finally {
                          setCancellingOrder(false);
                        }
                      },
                    },
                  ]
                )
              }
              style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
              accessibilityRole="button"
            >
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
                {isRTL ? 'إلغاء الطلب' : 'Cancel request'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Price card — agreed offer is the price basis; initial estimate is
            shown separately and clearly labelled. Internal spare-part cost is
            never rendered here. */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="payments" size={24} color={COLORS.primary} />
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {hasAgreedPrice
                ? (isRTL ? 'السعر المتفق عليه' : 'Agreed price')
                : (isRTL ? 'التكلفة' : 'Cost')}
            </Text>
          </View>

          <View style={styles.priceContainer}>
            {hasAgreedPrice ? (
              <>
                {!!order.estimated_price && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {isRTL ? 'تقديرك المبدئي' : 'Your initial estimate'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.textSecondary, fontSize: 14 }]}>
                      {fmtSAR(Number(order.estimated_price), isRTL)}
                    </Text>
                  </View>
                )}
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                    {isRTL ? 'السعر المتفق عليه (العرض المقبول)' : 'Agreed price (accepted offer)'}
                  </Text>
                  <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                    {fmtSAR(totals.agreedAmount, isRTL)}
                  </Text>
                </View>
                {totals.deliveryFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {isRTL ? 'رسوم التوصيل' : 'Delivery fee'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                      +{fmtSAR(totals.deliveryFee, isRTL)}
                    </Text>
                  </View>
                )}
                {totals.addonsTotal > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {isRTL ? 'إكسسوارات وإضافات' : 'Accessories & add-ons'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                      +{fmtSAR(totals.addonsTotal, isRTL)}
                    </Text>
                  </View>
                )}
                {totals.discount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.primary }]}>
                      {isRTL ? 'الخصم' : 'Discount'}
                      {(order as any).discount_code ? ` (${(order as any).discount_code})` : ''}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.primary, fontSize: 16 }]}>
                      -{fmtSAR(totals.discount, isRTL)}
                    </Text>
                  </View>
                )}
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: COLORS.text, fontWeight: '800' }]}>
                    {isRTL ? 'الإجمالي' : 'Total'}
                  </Text>
                  <Text style={[styles.priceAmount, { color: COLORS.primary }]}>
                    {fmtSAR(totals.total, isRTL)}
                  </Text>
                </View>
                {isSplitMode && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {PAYMENT_MODE_LABELS[totals.paymentMode][isRTL ? 'ar' : 'en']}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.textSecondary, fontSize: 13 }]}>
                      {isRTL
                        ? `الآن ${fmtSAR(totals.dueNow, isRTL)}`
                        : `now ${fmtSAR(totals.dueNow, isRTL)}`}
                    </Text>
                  </View>
                )}
                {totals.paid > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: '#10B981' }]}>
                      {isRTL ? 'المدفوع' : 'Paid'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: '#10B981', fontSize: 16 }]}>
                      {fmtSAR(totals.paid, isRTL)}
                    </Text>
                  </View>
                )}
                {totals.paid > 0 && totals.remaining > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {isRTL ? 'المتبقي' : 'Remaining'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                      {fmtSAR(totals.remaining, isRTL)}
                    </Text>
                  </View>
                )}
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'الأسعار شاملة ضريبة القيمة المضافة' : 'Prices include VAT'}
                </Text>
              </>
            ) : (
              <>
                {!!order.estimated_price && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {isRTL ? 'التقدير المبدئي' : 'Initial estimate'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                      {fmtSAR(Number(order.estimated_price), isRTL)}
                    </Text>
                  </View>
                )}
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
                      ? 'السعر النهائي يتحدد عند قبولك أحد عروض الفنيين'
                      : 'The final price is set when you accept a technician offer'}
                  </Text>
                </View>
                {totals.deliveryFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                      {isRTL ? 'رسوم التوصيل' : 'Delivery fee'}
                    </Text>
                    <Text style={[styles.priceAmount, { color: COLORS.text, fontSize: 16 }]}>
                      {fmtSAR(totals.deliveryFee, isRTL)}
                    </Text>
                  </View>
                )}
              </>
            )}

            {loyaltyEnabled && !!(order as any).loyalty_points_earned && (order as any).loyalty_points_earned > 0 && (
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

        {/* §13 — detailed status-change history (who + when) */}
        {timeline.length > 0 && (
          <View style={[styles.historyCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={[styles.historyHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="history" size={18} color={COLORS.primary} />
              <Text style={[styles.historyTitle, { color: COLORS.text }]}>
                {isRTL ? 'سجل حالة الطلب' : 'Order status history'}
              </Text>
            </View>
            {timeline.map((ev, i) => {
              const courierMeta = COURIER_TIMELINE_LABELS[ev.status];
              const meta = courierMeta
                ? { icon: courierMeta.icon, arLabel: courierMeta.ar, enLabel: courierMeta.en }
                : ORDER_TIMELINE.find((s) => s.status === ev.status);
              const label = meta ? (isRTL ? meta.arLabel : meta.enLabel) : ev.status;
              const isLast = i === timeline.length - 1;
              return (
                <View key={ev.id} style={[styles.historyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={styles.historyRail}>
                    <View style={[styles.historyDot, { backgroundColor: isLast ? COLORS.primary : COLORS.border }]} />
                    {!isLast && <View style={[styles.historyLine, { backgroundColor: COLORS.border }]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                    <Text style={[styles.historyStatus, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
                      {meta ? (
                        <MaterialCommunityIcons name={meta.icon as any} size={13} color={COLORS.primary} />
                      ) : null}{' '}
                      {label}
                    </Text>
                    <Text style={[styles.historyMeta, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                      {formatAppDate(ev.created_at, isRTL)} · {actorTypeLabel(ev.actor_type, isRTL)}
                    </Text>
                    {!!ev.note && (
                      <Text style={[styles.historyNote, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                        {ev.note}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {order.status === 'completed' && userType === 'customer' && (
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <InvoiceDownloadButton orderId={order.id as string} isRTL={isRTL} COLORS={COLORS} />
          </View>
        )}

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
                    try {
                      const { data } = await import('../lib/supabase').then(m => m.supabase
                        .from('technicians').select('phone').eq('user_id', order.technician_id!).maybeSingle());
                      phone = (data as any)?.phone;
                    } catch (e) {
                      logger.warn('order-details: technician phone lookup failed', e);
                    }
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

          {/* Marketplace: while the request is open, offers from nearby
              technicians land on the dedicated offers screen. */}
          {userType === 'customer' && order.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }, SHADOWS.small]}
              onPress={() =>
                router.push({ pathname: '/order-offers', params: { orderId: id as string } } as any)
              }
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'عروض الفنيين' : 'Technician offers'}
            >
              <MaterialCommunityIcons name="cash-multiple" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>
                {isRTL ? 'عروض الفنيين' : 'View offers'}
              </Text>
            </TouchableOpacity>
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

        {userType === 'customer' && order.status === 'completed' && ratingsEnabled && (
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
                    onPress={() => !hasReviewed && setMyRating(star)}
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
            {hasReviewed ? (
              myComment ? (
                <Text style={{
                  color: COLORS.text,
                  fontSize: 13,
                  lineHeight: 19,
                  marginTop: 12,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}>
                  {`"${myComment}"`}
                </Text>
              ) : null
            ) : (
              <>
                <TextInput
                  value={myComment}
                  onChangeText={setMyComment}
                  placeholder={isRTL
                    ? 'اكتب ملاحظاتك عن خدمة الفني (اختياري)'
                    : 'Leave a comment for the technician (optional)'}
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  maxLength={500}
                  editable={!submittingRating}
                  style={{
                    marginTop: 12,
                    minHeight: 70,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.background,
                    color: COLORS.text,
                    padding: 12,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                    textAlignVertical: 'top',
                  }}
                />
                <TouchableOpacity
                  onPress={submitRating}
                  disabled={myRating < 1 || submittingRating}
                  style={{
                    marginTop: 12,
                    backgroundColor: myRating < 1 ? COLORS.border : COLORS.primary,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    opacity: submittingRating ? 0.6 : 1,
                  }}
                  accessibilityRole="button"
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    {submittingRating
                      ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...')
                      : (isRTL ? 'إرسال التقييم' : 'Submit rating')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
      </KeyboardAvoidingView>
      <ImageViewer
        visible={viewerOpen}
        images={resolvedUrls}
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
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  // Horizontal scroller — gives every step real breathing room instead of
  // squashing 11 circles into ~32px each.
  timelineScroll: {
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Connector line lives between circles, not as a per-item flex child, so
  // the spacing is a fixed visual gap regardless of how many steps render.
  timelineLine: {
    height: 2,
    width: 28,
    marginHorizontal: 6,
    borderRadius: 2,
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
    gap: 12,
  },
  infoBlock: { width: '100%' },
  infoLabel: { fontSize: 13, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: isRTL ? 'left' : 'right',
    flexShrink: 1,
  },

  divider: { height: 1 },

  priceContainer: { gap: 8 },
  priceRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { fontSize: 14, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },
  priceAmount: { fontSize: 20, fontWeight: 'bold' },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: 16,
  },
  historyHeader: { alignItems: 'center', gap: 8, marginBottom: 14 },
  historyTitle: { fontSize: 15, fontWeight: '800' },
  historyRow: { alignItems: 'stretch', gap: 12 },
  historyRail: { width: 14, alignItems: 'center' },
  historyDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  historyLine: { width: 2, flex: 1, marginTop: 2 },
  historyStatus: { fontSize: 14, fontWeight: '800' },
  historyMeta: { fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  historyNote: { fontSize: 12, marginTop: 3, lineHeight: 18 },

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
