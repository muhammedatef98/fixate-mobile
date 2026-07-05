import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  I18nManager,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import OsmMap from '../../components/OsmMap';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import * as ImagePicker from 'expo-image-picker';
import { requests, auth } from '../../lib/supabase-api';
import type { Order } from '../../lib/supabase-api';
import { notifyUsers } from '../../services/notifyService';
import { getUserProfile } from '../../services/userService';
import {
  submitOffer,
  getMyOfferForOrder,
  withdrawOffer,
  type OrderOffer,
} from '../../services/offerMarketplaceService';
import { createReturnDeliveryTask } from '../../services/courierService';
import { logger } from '../../utils/logger';
import { fmtRequestDateTime } from '../../utils/dateFormat';
import {
  ORDER_STATUS_LABELS_AR,
  ORDER_STATUS_LABELS_EN,
  SPARE_PART_LABELS,
  type SparePartQuality,
  type AddonItem,
} from '../../types/order';
import { safeBack } from '../../utils/navigation';
import { RTLIonicon } from '../../components/RTLIcon';
import ImageViewer from '../../components/ImageViewer';
import ImagePickerSheet from '../../components/ImagePickerSheet';
import SparePartRequestSheet from '../../components/SparePartRequestSheet';
import { supabase } from '../../services/supabaseClient';
import { uploadOrderMedia } from '../../services/storageService';
import { resolveStorageUrls } from '../../utils/resolveStorageUrls';
import {
  startBroadcastingLocation,
  stopBroadcastingLocation,
} from '../../services/locationTrackingService';

// Human-readable label for how the customer wants the device serviced.
// Mirrors fulfillmentLabel in available-orders.tsx.
function fulfillmentLabel(type: string | null | undefined, ar: boolean): string {
  switch (type) {
    case 'mobile':
    case 'on_site':
      return ar ? 'خدمة في موقعك' : 'On-site service';
    case 'pickup':
    case 'pickup_delivery':
      return ar ? 'استلام وتسليم' : 'Pickup & delivery';
    case 'personal_handoff':
    case 'handoff':
    case 'drop_off':
      return ar ? 'تسليم باليد' : 'Drop-off / handoff';
    default:
      return ar ? 'طريقة الخدمة غير محددة' : 'Service method not specified';
  }
}

// Post-assignment workflow transitions. There is intentionally no 'accepted'
// entry: assignment happens only through the marketplace (the customer
// accepts one technician's offer via the atomic accept_order_offer RPC).
const STATUS_ACTIONS = [
  { status: 'picking_up', arLabel: 'جاري الاستلام', enLabel: 'Picking Up', icon: 'car', color: '#3B82F6', description: 'التوجه لاستلام الجهاز من العميل' },
  { status: 'diagnosing', arLabel: 'بدء الفحص', enLabel: 'Start Diagnosing', icon: 'magnify', color: '#8B5CF6', description: 'فحص الجهاز وتحديد الأعطال بدقة' },
  { status: 'waiting_parts', arLabel: 'انتظار قطع غيار', enLabel: 'Waiting for Parts', icon: 'clock-outline', color: '#F59E0B', description: 'الطلب معلق لحين توفر قطع الغيار' },
  { status: 'repairing', arLabel: 'بدء الإصلاح', enLabel: 'Start Repairing', icon: 'tools', color: '#EC4899', description: 'البدء في عملية الإصلاح الفعلية' },
  { status: 'testing', arLabel: 'اختبار الجودة', enLabel: 'Quality Testing', icon: 'flask', color: '#6366F1', description: 'اختبار الجهاز بعد الإصلاح لضمان الجودة' },
  { status: 'delivering', arLabel: 'جاري التوصيل', enLabel: 'Out for Delivery', icon: 'truck-delivery', color: '#06B6D4', description: 'الجهاز جاهز وجاري توصيله للعميل' },
  { status: 'completed', arLabel: 'إكمال الطلب', enLabel: 'Complete Order', icon: 'check-all', color: '#10B981', description: 'تم تسليم الجهاز وإغلاق الطلب' },
];

export default function ManageOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [sparePartsCost, setSparePartsCost] = useState(''); // FEAT-08 (accounting only)
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  // Signed (display) versions of media / before / after. Raw arrays above
  // stay as the DB values so upload + delete writes use the original paths.
  const [resolvedMedia, setResolvedMedia] = useState<string[]>([]);
  const [resolvedBefore, setResolvedBefore] = useState<string[]>([]);
  const [resolvedAfter, setResolvedAfter] = useState<string[]>([]);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<'before' | 'after'>('before');
  const [sparePartSheet, setSparePartSheet] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [claimedByOther, setClaimedByOther] = useState(false);
  // Marketplace: my offer on this (still-open) request.
  const [myOffer, setMyOffer] = useState<OrderOffer | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  // Return-leg courier request (pickup&delivery orders in 'delivering').
  const [requestingCourier, setRequestingCourier] = useState(false);
  const [returnCourierRequested, setReturnCourierRequested] = useState(false);

  useEffect(() => {
    loadOrderDetails();
    
    // Subscribe to real-time updates
    let subscription: any = null;
    if (id) {
      subscription = requests.subscribeToUpdates(id as string, (updatedOrder) => {
        if (updatedOrder) {
          setOrder(prev => ({ ...prev, ...updatedOrder }));
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [id]);

  // Live location broadcast — while the technician is en route on a
  // pickup&delivery or mobile job, the customer can see where they are.
  // Foreground-only (no background permission) — practical and battery-safe.
  useEffect(() => {
    if (!order || !id) return;
    const enRoute = ['accepted', 'picking_up', 'diagnosing', 'repairing', 'delivering']
      .includes(order.status);
    const fulfillment = (order as any).fulfillment_type ?? order.service_type;
    const travels = fulfillment !== 'personal_handoff';
    let cancelled = false;
    if (enRoute && travels && order.technician_id) {
      (async () => {
        const user = await auth.getCurrentUser();
        if (!cancelled && user && order.technician_id === user.id) {
          startBroadcastingLocation(user.id, String(id));
        }
      })();
    } else {
      stopBroadcastingLocation();
    }
    return () => {
      cancelled = true;
      stopBroadcastingLocation();
    };
  }, [order?.status, order?.technician_id, id]);

  const loadOrderDetails = async () => {
    try {
      const [orderData, me] = await Promise.all([
        requests.getById(id as string),
        auth.getCurrentUser(),
      ]);
      setOrder(orderData);
      // Check at open-time whether another technician already claimed it.
      if (
        orderData &&
        orderData.status !== 'pending' &&
        orderData.technician_id &&
        me?.id &&
        orderData.technician_id !== me.id
      ) {
        setClaimedByOther(true);
      }
      
      // Marketplace: load my offer on a still-open request so the offer card
      // reflects what I already quoted.
      if (orderData && orderData.status === 'pending' && me?.id) {
        const offer = await getMyOfferForOrder(me.id, orderData.id);
        setMyOffer(offer);
        if (offer?.status === 'pending') {
          setOfferAmount(String(Math.round(offer.amount)));
          setOfferNote(offer.note ?? '');
        }
      }

      if (orderData?.user_id) {
        // IMPORTANT: use the userService lookup (queries `users` table by id),
        // NOT auth.getUserProfile() — that one returns the currently-signed-in
        // user (the technician), which caused the technician's own name/phone
        // to show up as if it were the customer.
        const customerProfile = await getUserProfile(orderData.user_id);
        setCustomer(customerProfile);
      }
      if (orderData) {
        setNotesDraft((orderData as any).technician_notes ?? '');
        const beforeArr: string[] = (orderData as any).before_photos ?? [];
        const afterArr: string[] = (orderData as any).after_photos ?? [];
        const mediaArr: string[] = (orderData as any).media_urls ?? [];
        setBeforePhotos(beforeArr);
        setAfterPhotos(afterArr);
        const [rm, rb, ra] = await Promise.all([
          resolveStorageUrls(mediaArr),
          resolveStorageUrls(beforeArr),
          resolveStorageUrls(afterArr),
        ]);
        setResolvedMedia(rm);
        setResolvedBefore(rb);
        setResolvedAfter(ra);
      }
    } catch (error) {
      logger.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  // Marketplace: technicians quote instead of claiming. The customer picks a
  // winner; assignment happens atomically server-side (accept_order_offer).
  const handleSubmitOffer = async () => {
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL ? 'اكتب سعراً صحيحاً بالريال' : 'Enter a valid price in SAR'
      );
      return;
    }
    setSubmittingOffer(true);
    try {
      const offer = await submitOffer(id as string, amount, offerNote.trim() || undefined);
      setMyOffer(offer);
      Alert.alert(
        isRTL ? 'تم الإرسال ✓' : 'Sent ✓',
        isRTL
          ? 'وصل عرضك للعميل. سيصلك إشعار إذا تم قبوله.'
          : "Your offer reached the customer. You'll be notified if it's accepted."
      );
    } catch (error: any) {
      logger.error('Error submitting offer:', error);
      const closed = String(error?.message ?? '').includes('order_not_open');
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        closed
          ? (isRTL ? 'هذا الطلب لم يعد متاحاً للعروض.' : 'This request is no longer open for offers.')
          : (isRTL ? 'تعذّر إرسال العرض' : 'Could not send the offer')
      );
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleWithdrawOffer = async () => {
    if (!myOffer) return;
    try {
      await withdrawOffer(myOffer.id);
      setMyOffer((prev) => (prev ? { ...prev, status: 'withdrawn' } : prev));
      setOfferAmount('');
      setOfferNote('');
    } catch (error) {
      logger.warn('withdraw offer failed', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذّر سحب العرض' : 'Could not withdraw the offer'
      );
    }
  };

  // Pickup&delivery orders: once the device heads back (delivering), the
  // technician can request a courier for the return leg. Idempotent RPC.
  const handleRequestReturnCourier = async () => {
    setRequestingCourier(true);
    try {
      await createReturnDeliveryTask(id as string);
      setReturnCourierRequested(true);
      Alert.alert(
        isRTL ? 'تم ✓' : 'Done ✓',
        isRTL
          ? 'تم إنشاء مهمة إعادة الجهاز — سيقبلها أقرب مندوب متاح.'
          : 'Return delivery task created — the next available courier will take it.'
      );
    } catch (error) {
      logger.warn('return courier request failed', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذّر طلب مندوب الإعادة' : 'Could not request the return courier'
      );
    } finally {
      setRequestingCourier(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await requests.updateStatus(id as string, newStatus as any);
      
      const statusAction = STATUS_ACTIONS.find(a => a.status === newStatus);
      Alert.alert(
        isRTL ? 'نجح' : 'Success',
        isRTL 
          ? `تم تحديث الحالة إلى: ${statusAction?.arLabel}`
          : `Status updated to: ${statusAction?.enLabel}`
      );
    } catch (error) {
      logger.error('Error updating status:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ أثناء تحديث الحالة' : 'Error updating status'
      );
    } finally {
      setUpdating(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ technician_notes: notesDraft.trim() })
        .eq('id', id as string);
      if (error) throw error;
      Alert.alert(isRTL ? 'تم' : 'Saved', isRTL ? 'تم حفظ الملاحظات' : 'Notes saved');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setSavingNotes(false);
    }
  };

  const pickPhotos = async (source: 'camera' | 'gallery') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          isRTL ? 'تنبيه' : 'Alert',
          isRTL ? 'نحتاج إذن الوصول' : 'Permission is required'
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: true,
              quality: 0.7,
            });
      if (result.canceled || !result.assets?.length) return;

      setUploadingPhotos(true);
      const user = await auth.getCurrentUser();
      if (!user) return;
      const uploaded = await uploadOrderMedia(
        user.id,
        result.assets.map((a) => a.uri),
        `orders/${id}/${photoTarget}`
      );
      const column = photoTarget === 'before' ? 'before_photos' : 'after_photos';
      const current = photoTarget === 'before' ? beforePhotos : afterPhotos;
      const next = [...current, ...uploaded].slice(0, 10);
      const { error } = await supabase
        .from('orders')
        .update({ [column]: next })
        .eq('id', id as string);
      if (error) throw error;
      if (photoTarget === 'before') setBeforePhotos(next);
      else setAfterPhotos(next);
      const resolved = await resolveStorageUrls(next);
      if (photoTarget === 'before') setResolvedBefore(resolved);
      else setResolvedAfter(resolved);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = async (kind: 'before' | 'after', url: string) => {
    const column = kind === 'before' ? 'before_photos' : 'after_photos';
    const current = kind === 'before' ? beforePhotos : afterPhotos;
    const next = current.filter((u) => u !== url);
    // Optimistic — revert on failure.
    if (kind === 'before') setBeforePhotos(next);
    else setAfterPhotos(next);
    const currentResolved = kind === 'before' ? resolvedBefore : resolvedAfter;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ [column]: next })
        .eq('id', id as string);
      if (error) throw error;
      const resolved = await resolveStorageUrls(next);
      if (kind === 'before') setResolvedBefore(resolved);
      else setResolvedAfter(resolved);
    } catch (e: any) {
      if (kind === 'before') setBeforePhotos(current);
      else setAfterPhotos(current);
      if (kind === 'before') setResolvedBefore(currentResolved);
      else setResolvedAfter(currentResolved);
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    }
  };

  const openPhotoViewer = (images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // A quote the customer has accepted: the order carries a final_price and is
  // no longer in the 'quoted' (awaiting-approval) state. Rejected quotes move
  // the order to 'cancelled', so any non-cancelled order with a final_price
  // means the customer approved the price.
  const hasAcceptedQuote = !!(order as any)?.final_price && order?.status !== 'quoted';

  const handleSubmitQuote = async () => {
    const price = Number(quotePrice);
    if (!price || price <= 0) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL ? 'أدخل سعراً صحيحاً بعد الفحص' : 'Enter a valid price after inspection'
      );
      return;
    }
    try {
      setSubmittingQuote(true);
      await requests.setQuote(id as string, price, quoteNotes.trim() || undefined);
      // FEAT-08 — persist the accounting-only spare parts cost. Best-effort:
      // never block the quote on it. This value is never shown to the client.
      const spareCost = Number(sparePartsCost);
      if (!Number.isNaN(spareCost) && spareCost > 0) {
        const { error: spareErr } = await supabase
          .from('orders')
          .update({ spare_parts_cost: spareCost })
          .eq('id', id as string);
        if (spareErr) logger.warn('spare_parts_cost update failed', spareErr);
      }
      // Optimistically reflect the quoted state on this screen immediately,
      // even before the realtime subscription fires, so the "awaiting
      // customer approval" card shows up right away.
      setOrder((prev) =>
        prev
          ? ({ ...prev, status: 'quoted', final_price: price } as any)
          : prev
      );
      setQuotePrice('');
      setQuoteNotes('');
      setSparePartsCost('');
      Alert.alert(
        isRTL ? 'تم إرسال السعر ✓' : 'Quote sent ✓',
        isRTL
          ? `تم إرسال عرض السعر بمبلغ ${price} ر.س للعميل. سيظهر بانتظار موافقته أو رفضه.`
          : `Quotation for ${price} SAR has been sent to the customer. It is now awaiting their approval or rejection.`
      );
    } catch (error: any) {
      logger.error('Error submitting quote:', error);
      const raw = error?.message || error?.error_description || String(error);
      Alert.alert(
        isRTL ? 'خطأ في إرسال السعر' : 'Could not send the quote',
        isRTL
          ? `تعذّر إرسال السعر للعميل. الرسالة من الخادم:\n\n${raw}`
          : `Could not send the quote. Server message:\n\n${raw}`
      );
    } finally {
      setSubmittingQuote(false);
    }
  };

  const getNextActions = () => {
    if (!order) return [];

    // Open (pending) requests are offer-based now — no direct claim. The
    // dedicated offer card below handles this state.
    if (order.status === 'pending') {
      return [];
    }

    // Awaiting the customer (quote approval or payment) — no manual
    // transitions until they act.
    if (order.status === 'quoted' || order.status === 'awaiting_payment') return [];

    // Before the customer approves a quote, the technician may only move
    // through the inspection stages. Repair/test/deliver/complete unlock
    // once the customer has accepted the quoted price.
    const preQuoteAllowed = ['picking_up', 'diagnosing'];
    return STATUS_ACTIONS.filter((a) => {
      if (a.status === 'pending' || a.status === 'accepted') return false;
      if (a.status === order.status) return false;
      if (!hasAcceptedQuote && !preQuoteAllowed.includes(a.status)) return false;
      return true;
    });
  };

  const openLocation = () => {
    if (order?.latitude && order?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`;
      Linking.openURL(url);
    }
  };

  const openNavigation = () => {
    if (order?.latitude && order?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
      Linking.openURL(url);
    }
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

  const nextActions = getNextActions();
  // Terminal states — no call/contact actions once the order is closed (Fix 2).
  const isTerminal = ['rejected', 'cancelled', 'completed'].includes(order.status);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Custom header with safeBack — the native Stack header was leaving
          the back button frozen on iOS when this screen was reached via a
          replace from /(technician)/index. */}
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      }}>
        <TouchableOpacity
          onPress={() => safeBack('/(technician)')}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: COLORS.background,
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>
          {isRTL ? 'إدارة الطلب' : 'Manage order'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current status chip */}
        <View style={[styles.card, { backgroundColor: COLORS.card, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }, SHADOWS.medium]}>
          <MaterialCommunityIcons name="information-outline" size={22} color={COLORS.primary} />
          <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
            {isRTL ? 'الحالة الحالية:' : 'Current status:'}
          </Text>
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14 }}>
            {isRTL ? ORDER_STATUS_LABELS_AR[order.status] : ORDER_STATUS_LABELS_EN[order.status]}
          </Text>
        </View>

        {/* Claimed-by-other banner — shown when this technician opened the
            order from a push notification but another tech already accepted. */}
        {claimedByOther && (
          <View style={[styles.card, { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' }, SHADOWS.small]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="account-clock-outline" size={24} color="#B45309" />
              <Text style={{ flex: 1, color: '#92400E', fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'اختار العميل فنياً آخر لهذا الطلب' : 'The customer chose another technician for this request'}
              </Text>
            </View>
          </View>
        )}

        {/* Marketplace offer card — open requests take quotes, not claims. */}
        {order.status === 'pending' && !claimedByOther && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <MaterialCommunityIcons name="cash-plus" size={22} color={COLORS.primary} />
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 16 }}>
                {isRTL ? 'قدّم عرض سعر' : 'Submit your offer'}
              </Text>
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }}>
              {isRTL
                ? 'يرى العميل عرضك مع عروض الفنيين الآخرين ويختار واحداً. السعر الظاهر للعميل تقديري فقط.'
                : 'The customer compares offers from nearby technicians and picks one. The price the customer saw is an estimate only.'}
            </Text>

            {myOffer?.status === 'pending' && (
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={COLORS.primary} />
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL
                    ? `عرضك الحالي: ${Math.round(myOffer.amount)} ر.س — يمكنك تعديله أو سحبه.`
                    : `Your current offer: ${Math.round(myOffer.amount)} SAR — you can revise or withdraw it.`}
                </Text>
                <TouchableOpacity onPress={handleWithdrawOffer} accessibilityRole="button">
                  <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '700' }}>
                    {isRTL ? 'سحب' : 'Withdraw'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 12, minHeight: 50, gap: 8 }}>
              <TextInput
                style={{ flex: 1, fontSize: 15, color: COLORS.text }}
                placeholder={isRTL ? 'السعر المعروض' : 'Offered price'}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={offerAmount}
                onChangeText={setOfferAmount}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>{isRTL ? 'ر.س' : 'SAR'}</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, minHeight: 64, marginTop: 10 }}>
              <TextInput
                style={{ fontSize: 14, color: COLORS.text }}
                placeholder={isRTL ? 'ملاحظة للعميل (اختياري)' : 'Note to the customer (optional)'}
                placeholderTextColor={COLORS.textSecondary}
                value={offerNote}
                onChangeText={setOfferNote}
                multiline
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: submittingOffer ? 0.6 : 1 }}
              onPress={handleSubmitOffer}
              disabled={submittingOffer}
              accessibilityRole="button"
            >
              {submittingOffer ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                  {myOffer?.status === 'pending'
                    ? isRTL ? 'تحديث العرض' : 'Update offer'
                    : isRTL ? 'إرسال العرض' : 'Send offer'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Fix 4 — REJECTED order: read-only terminal summary. No quote, no
            workflow actions; the device/client info below stays visible. */}
        {order.status === 'rejected' && (
          <View style={[styles.card, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }, SHADOWS.small]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="close-octagon" size={24} color="#DC2626" />
              <Text style={{ flex: 1, color: '#991B1B', fontWeight: '800', fontSize: 16, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'الطلب مرفوض' : 'Request rejected'}
              </Text>
            </View>
            <Text style={{ color: '#7F1D1D', fontSize: 14, lineHeight: 22, marginTop: 10, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
              {isRTL ? 'السبب: ' : 'Reason: '}
              {(order as any).rejection_reason || (isRTL ? 'لم يُذكر سبب محدد' : 'No specific reason given')}
            </Text>
            {(order as any).updated_at ? (
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <MaterialCommunityIcons name="clock-outline" size={15} color="#B91C1C" />
                <Text style={{ color: '#B91C1C', fontSize: 12.5, fontWeight: '600' }}>
                  {fmtRequestDateTime((order as any).updated_at, isRTL)}
                </Text>
              </View>
            ) : null}
            <Text style={{ color: '#9F4444', fontSize: 12.5, marginTop: 10, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'هذا الطلب مُغلق ولا يمكن اتخاذ أي إجراء عليه.' : 'This request is closed — no further action is possible.'}
            </Text>
          </View>
        )}

        {/* Inspection quote — technician sets the final price AFTER inspecting
            the device. The customer must approve it before repair begins. */}
        {order.status !== 'pending' &&
          order.status !== 'completed' &&
          order.status !== 'cancelled' &&
          order.status !== 'rejected' &&
          order.status !== 'quoted' &&
          !hasAcceptedQuote && (
            <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
              <Text style={[styles.cardTitle, { color: COLORS.text }]}>
                {isRTL ? 'سعر ما بعد الفحص' : 'Price after inspection'}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: COLORS.textSecondary, marginBottom: SPACING.m }]}>
                {isRTL
                  ? 'افحص الجهاز ثم أرسل السعر النهائي ليوافق عليه العميل قبل بدء الإصلاح'
                  : 'Inspect the device, then send the final price for the customer to approve before repair starts'}
              </Text>
              <TextInput
                value={quotePrice}
                onChangeText={(v) => setQuotePrice(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder={isRTL ? 'السعر النهائي (ر.س)' : 'Final price (SAR)'}
                placeholderTextColor={COLORS.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: BORDER_RADIUS.m,
                  padding: SPACING.m,
                  fontSize: 16,
                  color: COLORS.text,
                  marginBottom: SPACING.s,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              />
              <TextInput
                value={quoteNotes}
                onChangeText={setQuoteNotes}
                placeholder={isRTL ? 'ملاحظات للعميل (اختياري)' : 'Notes for the customer (optional)'}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: BORDER_RADIUS.m,
                  padding: SPACING.m,
                  fontSize: 14,
                  color: COLORS.text,
                  minHeight: 60,
                  marginBottom: SPACING.m,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              />
              {/* FEAT-08 — spare parts cost, accounting only. Never shown to
                  the client; feeds the admin accounting dashboard. */}
              <Text style={{ color: COLORS.textSecondary, fontSize: 12.5, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'تكلفة قطع الغيار (للمحاسبة فقط)' : 'Spare parts cost (accounting only)'}
              </Text>
              <TextInput
                value={sparePartsCost}
                onChangeText={(v) => setSparePartsCost(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder={isRTL ? '0.00 ريال' : '0.00 SAR'}
                placeholderTextColor={COLORS.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: BORDER_RADIUS.m,
                  padding: SPACING.m,
                  fontSize: 15,
                  color: COLORS.text,
                  marginBottom: SPACING.m,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              />
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={handleSubmitQuote}
                disabled={submittingQuote}
              >
                {submittingQuote ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send-check" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>
                      {isRTL ? 'إرسال السعر للعميل' : 'Send price to customer'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

        {/* Awaiting customer's decision on the quote */}
        {order.status === 'quoted' && (
          <View style={[styles.card, { backgroundColor: '#F59E0B15', borderWidth: 1, borderColor: '#F59E0B' }]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <MaterialCommunityIcons name="check-circle" size={22} color="#16A34A" />
              <Text style={{ flex: 1, color: '#16A34A', fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'تم إرسال عرض السعر' : 'Quotation sent'}
              </Text>
            </View>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="clock-alert-outline" size={22} color="#F59E0B" />
              <Text style={{ flex: 1, color: COLORS.text, fontWeight: '700', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? `بانتظار موافقة العميل على السعر (${(order as any).final_price} ر.س)`
                  : `Awaiting customer approval — price ${(order as any).final_price} SAR`}
              </Text>
            </View>
          </View>
        )}

        {/* Awaiting customer payment after quote approval */}
        {order.status === 'awaiting_payment' && (
          <View style={[styles.card, { backgroundColor: '#0EA5E915', borderWidth: 1, borderColor: '#0EA5E9' }]}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="credit-card-clock" size={24} color="#0EA5E9" />
              <Text style={{ flex: 1, color: COLORS.text, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? 'وافق العميل على السعر — بانتظار إتمام الدفع قبل بدء الإصلاح.'
                  : 'Customer approved the price — awaiting payment before the repair starts.'}
              </Text>
            </View>
          </View>
        )}

        {/* Professional Workflow Control */}
        {!claimedByOther &&
          order.status !== 'quoted' &&
          order.status !== 'awaiting_payment' &&
          order.status !== 'completed' &&
          order.status !== 'cancelled' &&
          order.status !== 'rejected' && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'لوحة التحكم في سير العمل' : 'Workflow Control Panel'}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: COLORS.textSecondary, marginBottom: SPACING.m }]}>
              {isRTL ? 'قم بتحديث حالة الطلب بدقة لضمان تتبع العميل' : 'Update order status precisely for client tracking'}
            </Text>

            {!hasAcceptedQuote && order.status !== 'pending' && (
              <Text style={[styles.workflowDesc, { color: '#F59E0B', marginBottom: SPACING.m }]}>
                {isRTL
                  ? 'الإصلاح والإكمال يتفعّلان بعد موافقة العميل على السعر'
                  : 'Repair & completion unlock after the customer approves the price'}
              </Text>
            )}

            <View style={styles.workflowGrid}>
              {getNextActions().length === 0 ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                  {isRTL ? 'لا إجراءات متاحة حالياً' : 'No actions available right now'}
                </Text>
              ) : (
                getNextActions().map((action) => (
                  <TouchableOpacity
                    key={action.status}
                    style={[
                      styles.workflowButton,
                      { borderColor: action.color, backgroundColor: 'transparent' },
                    ]}
                    onPress={() => handleUpdateStatus(action.status)}
                    disabled={updating}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: action.color }]}>
                      <MaterialCommunityIcons name={action.icon as any} size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.workflowTextContainer}>
                      <Text style={[styles.workflowTitle, { color: COLORS.text }]}>
                        {isRTL ? action.arLabel : action.enLabel}
                      </Text>
                      <Text style={[styles.workflowDesc, { color: COLORS.textSecondary }]}>
                        {action.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Pickup&delivery: request the return-leg courier once the
                device heads back to the customer. Idempotent server-side. */}
            {order.status === 'delivering' &&
              ['pickup', 'pickup_delivery'].includes(
                ((order as any).fulfillment_type ?? order.service_type) as string
              ) && (
                <TouchableOpacity
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: COLORS.primary,
                    borderRadius: BORDER_RADIUS.md,
                    minHeight: 46,
                    marginTop: SPACING.m,
                    opacity: requestingCourier ? 0.6 : 1,
                  }}
                  onPress={handleRequestReturnCourier}
                  disabled={requestingCourier || returnCourierRequested}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="moped" size={18} color={COLORS.primary} />
                  <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 14 }}>
                    {returnCourierRequested
                      ? isRTL ? 'تم طلب مندوب الإعادة ✓' : 'Return courier requested ✓'
                      : isRTL ? 'طلب مندوب لإعادة الجهاز' : 'Request return courier'}
                  </Text>
                </TouchableOpacity>
              )}

            {/* The old FEAT-03 "reject request" action was retired with the
                marketplace model: technicians who don't want an open request
                simply don't offer on it. (Letting any technician mark an open
                customer request 'rejected' was also an abuse vector, and the
                RLS policy that permitted it has been dropped.) */}
          </View>
        )}

        {/* Action Buttons — hidden on terminal/rejected orders (Fix 4). */}
        {order.status !== 'pending' && order.status !== 'cancelled' && order.status !== 'rejected' && (
          <View style={styles.actionButtonRow}>
            <TouchableOpacity
              style={[styles.chatButton, { backgroundColor: COLORS.primary, flex: 1 }, SHADOWS.small]}
              onPress={() => router.push({
                pathname: `/chat/${order.id}`,
                params: { otherUserName: isRTL ? 'العميل' : 'Customer' }
              })}
            >
              <MaterialIcons name="chat" size={24} color="#FFFFFF" />
              <Text style={styles.chatButtonText}>
                {isRTL ? 'مراسلة العميل' : 'Chat'}
              </Text>
            </TouchableOpacity>

            {!isTerminal && order.customer_phone && (
              <TouchableOpacity
                style={[styles.chatButton, { backgroundColor: '#10B981', flex: 1 }, SHADOWS.small]}
                onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
              >
                <MaterialIcons name="phone" size={24} color="#FFFFFF" />
                <Text style={styles.chatButtonText}>
                  {isRTL ? 'اتصال' : 'Call'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer Info — strictly from the customer's profile.
            Falls back to a clear "not available" label rather than the
            technician's identity or an ambiguous "Customer" placeholder. */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'معلومات العميل' : 'Customer Information'}
          </Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'الاسم' : 'Name'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {(customer?.name && customer.name.trim())
                || ((order as any).customer_name && String((order as any).customer_name).trim())
                || (isRTL ? 'غير متوفر' : 'Not available')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'الهاتف' : 'Phone'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text, writingDirection: 'ltr', textAlign: isRTL ? 'right' : 'left' }]}>
              {(customer?.phone && customer.phone.trim()) ||
                (order.customer_phone && String(order.customer_phone).trim()) ||
                (isRTL ? 'غير متوفر' : 'Not available')}
            </Text>
          </View>
        </View>

        {/* Device Info */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'معلومات الجهاز' : 'Device Information'}
          </Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'الجهاز' : 'Device'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {order.device_brand} {order.device_model}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="wrench" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'المشكلة' : 'Issue'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {order.issue_description}
            </Text>
          </View>
          {/* Spare-part quality the customer chose — the technician must see
              this BEFORE accepting so they bring the right parts. */}
          {!!(order as any).spare_part_quality && SPARE_PART_LABELS[(order as any).spare_part_quality as SparePartQuality] && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="shield-check" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'جودة قطعة الغيار' : 'Spare-part quality'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {SPARE_PART_LABELS[(order as any).spare_part_quality as SparePartQuality][isRTL ? 'ar' : 'en']}
              </Text>
            </View>
          )}
          {!!((order as any).fulfillment_type ?? order.service_type) && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="truck-fast-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'طريقة الخدمة' : 'Service method'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {fulfillmentLabel((order as any).fulfillment_type ?? order.service_type, isRTL)}
              </Text>
            </View>
          )}
          {/* §12 — request a spare part from a supplier (accepted/active orders).
              Positioned directly below the service-method row. */}
          {!isTerminal && order.status !== 'pending' && (
            <TouchableOpacity
              onPress={() => setSparePartSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'طلب قطعة غيار' : 'Request a spare part'}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 12,
                paddingVertical: 12,
                borderRadius: BORDER_RADIUS.md,
                borderWidth: 1.5,
                borderColor: COLORS.primary,
                backgroundColor: COLORS.primary + '12',
              }}
            >
              <MaterialCommunityIcons name="package-variant-closed" size={18} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 14 }}>
                {isRTL ? 'طلب قطعة غيار' : 'Request a spare part'}
              </Text>
            </TouchableOpacity>
          )}
          {Array.isArray((order as any).accessories) && (order as any).accessories.length > 0 && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="headphones" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'إكسسوارات' : 'Accessories'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {((order as any).accessories as AddonItem[])
                  .map((a) => (isRTL ? a.name_ar : a.name_en))
                  .join(isRTL ? '، ' : ', ')}
              </Text>
            </View>
          )}
          {Array.isArray((order as any).protection_addons) && (order as any).protection_addons.length > 0 && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="shield-plus-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'إضافات الحماية' : 'Protection add-ons'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {((order as any).protection_addons as AddonItem[])
                  .map((a) => (isRTL ? a.name_ar : a.name_en))
                  .join(isRTL ? '، ' : ', ')}
              </Text>
            </View>
          )}
          {/* Customer notes — request.tsx folds them into issue_description
              ("Issue: notes"), so only show separately when they differ. */}
          {typeof (order as any).notes === 'string' && (order as any).notes.trim().length > 0 &&
            !(order.issue_description ?? '').includes((order as any).notes.trim()) && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="note-text-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'ملاحظات العميل' : 'Customer notes'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {(order as any).notes}
              </Text>
            </View>
          )}
          {/* Hide the price row until the technician has actually accepted the
              order. Before acceptance (status === 'pending') seeing an estimate
              biased technicians into cherry-picking high-paying jobs over the
              fit of the work itself. We surface the final price later via the
              quotation flow. */}
          {order.status !== 'pending' && (order as any).final_price ? (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="cash" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'السعر النهائي' : 'Final price'}
              </Text>
              <Text style={[styles.infoValue, { color: COLORS.primary, fontWeight: 'bold' }]}>
                {(order as any).final_price} {isRTL ? 'ر.س' : 'SAR'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Location & Map */}
        <View style={[styles.card, { backgroundColor: COLORS.card, padding: 0, overflow: 'hidden' }, SHADOWS.medium]}>
          <View style={{ padding: SPACING.l }}>
            <Text style={[styles.cardTitle, { color: COLORS.text, marginBottom: 4 }]}>
              {isRTL ? 'موقع العميل' : 'Customer Location'}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.m }}>
              <MaterialIcons name="place" size={16} color={COLORS.primary} />
              <Text style={[styles.locationText, { color: COLORS.textSecondary, marginBottom: 0, flex: 1 }]}>
                {order.location}
              </Text>
            </View>
          </View>

          {order.latitude && order.longitude && (
            <View style={{ height: 200, width: '100%' }}>
              <OsmMap
                latitude={Number(order.latitude)}
                longitude={Number(order.longitude)}
                zoom={15}
                markers={[{ lat: Number(order.latitude), lng: Number(order.longitude), color: COLORS.primary }]}
                onReady={() => setMapReady(true)}
                style={{ flex: 1 }}
              />
              
              {!mapReady && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}
              
              <TouchableOpacity 
                style={{ 
                  position: 'absolute', 
                  bottom: 12, 
                  [isRTL ? 'left' : 'right']: 12, 
                  backgroundColor: '#FFF',
                  padding: 8,
                  borderRadius: 8,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                  elevation: 3,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4
                }}
                onPress={openNavigation}
              >
                <MaterialIcons name="navigation" size={20} color={COLORS.primary} />
                <Text style={{ color: COLORS.text, fontWeight: 'bold', fontSize: 12 }}>
                  {isRTL ? 'فتح في الخرائط' : 'Open in Maps'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.locationButtons, { padding: SPACING.l }]}>
            <TouchableOpacity
              style={[styles.locationButton, { backgroundColor: COLORS.primary, minHeight: 56, paddingVertical: SPACING.m }]}
              onPress={openNavigation}
            >
              <Ionicons name="navigate-circle" size={24} color="#FFFFFF" />
              <Text style={[styles.locationButtonText, { fontSize: 15, lineHeight: 22 }]}>
                {isRTL ? 'بدء التوجه للموقع' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Media — tap any photo to open the in-app full-screen viewer */}
        {resolvedMedia.length > 0 && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'الصور المرفقة' : 'Attached photos'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {resolvedMedia.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => openPhotoViewer(resolvedMedia, index)}
                  activeOpacity={0.85}
                  style={{ marginRight: 8 }}
                  accessibilityRole="button"
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {/* Internal notes — visible to the technician only */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'ملاحظات داخلية' : 'Internal notes'}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: COLORS.textSecondary, marginBottom: SPACING.s }]}>
            {isRTL ? 'تظهر لك فقط — لا يراها العميل' : 'Visible to you only — the customer cannot see these'}
          </Text>
          <TextInput
            value={notesDraft}
            onChangeText={setNotesDraft}
            multiline
            placeholder={isRTL ? 'اكتب ملاحظاتك حول هذا الطلب...' : 'Write your notes about this job...'}
            placeholderTextColor={COLORS.textSecondary}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: BORDER_RADIUS.md,
              padding: 12,
              minHeight: 90,
              color: COLORS.text,
              backgroundColor: COLORS.background,
              textAlignVertical: 'top',
              textAlign: isRTL ? 'right' : 'left',
            }}
          />
          <TouchableOpacity
            onPress={saveNotes}
            disabled={savingNotes}
            style={{
              marginTop: 10,
              backgroundColor: COLORS.primary,
              borderRadius: BORDER_RADIUS.md,
              paddingVertical: 12,
              alignItems: 'center',
              opacity: savingNotes ? 0.6 : 1,
            }}
          >
            {savingNotes ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800' }}>
                {isRTL ? 'حفظ الملاحظات' : 'Save notes'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Before / after repair photos */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'صور قبل / بعد الإصلاح' : 'Before / After photos'}
          </Text>
          {([
            { key: 'before' as const, label: isRTL ? 'قبل الإصلاح' : 'Before repair', photos: resolvedBefore, rawPhotos: beforePhotos },
            { key: 'after' as const, label: isRTL ? 'بعد الإصلاح' : 'After repair', photos: resolvedAfter, rawPhotos: afterPhotos },
          ]).map((group) => (
            <View key={group.key} style={{ marginTop: 12 }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 13, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
                {group.label}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => { setPhotoTarget(group.key); setPhotoSheetOpen(true); }}
                  disabled={uploadingPhotos}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: BORDER_RADIUS.md,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: COLORS.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  {uploadingPhotos && photoTarget === group.key ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Ionicons name="camera" size={22} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
                {group.photos.map((url, i) => (
                  <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openPhotoViewer(group.photos, i)}
                    >
                      <Image
                        source={{ uri: url }}
                        style={{ width: 72, height: 72, borderRadius: BORDER_RADIUS.md }}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removePhoto(group.key, group.rawPhotos[i])}
                      style={{
                        position: 'absolute',
                        top: -7,
                        [isRTL ? 'left' : 'right']: -7,
                        backgroundColor: COLORS.card,
                        borderRadius: 11,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={isRTL ? 'حذف الصورة' : 'Remove photo'}
                    >
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {group.photos.length === 0 && (
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, alignSelf: 'center' }}>
                    {isRTL ? 'لا توجد صور بعد' : 'No photos yet'}
                  </Text>
                )}
              </ScrollView>
            </View>
          ))}
        </View>
      </ScrollView>

      <ImageViewer
        visible={viewerOpen}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
      <ImagePickerSheet
        visible={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onPick={pickPhotos}
        isRTL={isRTL}
      />

      {/* §12 — spare-part supplier sheet */}
      <SparePartRequestSheet
        visible={sparePartSheet}
        onClose={() => setSparePartSheet(false)}
        isRTL={isRTL}
        COLORS={COLORS}
        deviceBrand={order?.device_brand}
        deviceModel={order?.device_model}
        issueDescription={order?.issue_description}
      />

    </SafeAreaView>
  );
}

const makeStyles = (isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  chatButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
  },
  actionButtonRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.m,
    marginBottom: SPACING.l,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: SPACING.s,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    marginTop: SPACING.m,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: SPACING.s,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
    padding: SPACING.m,
  },
  card: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.s,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  sectionSubtitle: {
    fontSize: 14,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  workflowGrid: {
    gap: SPACING.m,
  },
  workflowButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  workflowTextContainer: {
    flex: 1,
    marginRight: SPACING.m,
  },
  workflowTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  workflowDesc: {
    fontSize: 12,
  },
  infoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  infoLabel: {
    marginLeft: SPACING.s,
    fontSize: 14,
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    // Push the value to the opposite side of the label (device & problem
    // rows read like "الجهاز … Apple Watch" / "المشكلة … إصلاح الأزرار").
    textAlign: isRTL ? 'left' : 'right',
  },
  locationText: {
    fontSize: 14,
    marginBottom: SPACING.m,
  },
  locationButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: SPACING.m,
  },
  locationButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    gap: SPACING.s,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.m,
    marginRight: SPACING.m,
  },
  actionButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.s,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: SPACING.s,
    fontSize: 16,
  },
});
