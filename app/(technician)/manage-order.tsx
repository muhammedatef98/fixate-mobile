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
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import * as ImagePicker from 'expo-image-picker';
import { requests, auth } from '../../lib/supabase-api';
import type { Order } from '../../lib/supabase-api';
import { logger } from '../../utils/logger';
import { ORDER_STATUS_LABELS_AR, ORDER_STATUS_LABELS_EN } from '../../types/order';
import { safeBack } from '../../utils/navigation';
import { RTLIonicon } from '../../components/RTLIcon';
import ImageViewer from '../../components/ImageViewer';
import ImagePickerSheet from '../../components/ImagePickerSheet';
import { supabase } from '../../services/supabaseClient';
import { uploadOrderMedia } from '../../services/storageService';

const STATUS_ACTIONS = [
  { status: 'accepted', arLabel: 'قبول الطلب', enLabel: 'Accept Order', icon: 'check-circle', color: '#10B981', description: 'تأكيد استلام الطلب والبدء في المعالجة' },
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

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<'before' | 'after'>('before');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

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

  const loadOrderDetails = async () => {
    try {
      const orderData = await requests.getById(id as string);
      setOrder(orderData);
      
      if (orderData?.user_id) {
        const customerProfile = await auth.getUserProfile(orderData.user_id);
        setCustomer(customerProfile);
      }
      if (orderData) {
        setNotesDraft((orderData as any).technician_notes ?? '');
        setBeforePhotos((orderData as any).before_photos ?? []);
        setAfterPhotos((orderData as any).after_photos ?? []);
      }
    } catch (error) {
      logger.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      setUpdating(true);
      await requests.acceptOrder(id as string);
      Alert.alert(
        isRTL ? 'نجح' : 'Success',
        isRTL ? 'تم قبول الطلب بنجاح' : 'Order accepted successfully'
      );
    } catch (error) {
      logger.error('Error accepting order:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ أثناء قبول الطلب' : 'Error accepting order'
      );
    } finally {
      setUpdating(false);
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
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setUploadingPhotos(false);
    }
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
      Alert.alert(
        isRTL ? 'تم إرسال السعر' : 'Quote sent',
        isRTL
          ? 'سيراجع العميل السعر ويوافق أو يرفض قبل بدء الإصلاح'
          : 'The customer will review the price and accept or reject before repair starts'
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

    if (order.status === 'pending') {
      return [STATUS_ACTIONS[0]]; // Only show "Accept Order"
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

        {/* Inspection quote — technician sets the final price AFTER inspecting
            the device. The customer must approve it before repair begins. */}
        {order.status !== 'pending' &&
          order.status !== 'completed' &&
          order.status !== 'cancelled' &&
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
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="clock-alert-outline" size={24} color="#F59E0B" />
              <Text style={{ flex: 1, color: COLORS.text, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? `بانتظار موافقة العميل على السعر (${(order as any).final_price} ر.س)`
                  : `Awaiting customer approval of the price (${(order as any).final_price} SAR)`}
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
        {order.status !== 'quoted' &&
          order.status !== 'awaiting_payment' &&
          order.status !== 'completed' &&
          order.status !== 'cancelled' && (
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
                    onPress={() => {
                      if (action.status === 'accepted' && order.status === 'pending') {
                        handleAcceptOrder();
                      } else {
                        handleUpdateStatus(action.status);
                      }
                    }}
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
          </View>
        )}

        {/* Action Buttons */}
        {order.status !== 'pending' && order.status !== 'cancelled' && (
          <View style={styles.actionButtonRow}>
            <TouchableOpacity
              style={[styles.chatButton, { backgroundColor: COLORS.primary, flex: 1, marginRight: 8 }, SHADOWS.small]}
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

            {order.customer_phone && (
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

        {/* Customer Info */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'معلومات العميل' : 'Customer Information'}
          </Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'الاسم' : 'Name'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {customer?.name || (isRTL ? 'عميل' : 'Customer')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'الهاتف' : 'Phone'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {order.customer_phone || customer?.phone || (isRTL ? 'غير متوفر' : 'N/A')}
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
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="cash" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {(order as any).final_price ? (isRTL ? 'السعر النهائي' : 'Final price') : (isRTL ? 'السعر التقديري' : 'Est. price')}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.primary, fontWeight: 'bold' }]}>
              {(order as any).final_price ?? order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
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
              <MapView
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={{ flex: 1, opacity: mapReady ? 1 : 0 }}
                initialRegion={{
                  latitude: Number(order.latitude),
                  longitude: Number(order.longitude),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                onMapReady={() => setMapReady(true)}
              >
                <Marker
                  coordinate={{
                    latitude: Number(order.latitude),
                    longitude: Number(order.longitude),
                  }}
                >
                  <View style={{ backgroundColor: COLORS.primary, padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' }}>
                    <MaterialIcons name="person-pin-circle" size={24} color="#FFF" />
                  </View>
                </Marker>
              </MapView>
              
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
                  flexDirection: 'row',
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
              style={[styles.locationButton, { backgroundColor: COLORS.primary, height: 50 }]}
              onPress={openNavigation}
            >
              <Ionicons name="navigate-circle" size={24} color="#FFFFFF" />
              <Text style={[styles.locationButtonText, { fontSize: 16 }]}>
                {isRTL ? 'بدء التوجه للموقع' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Media — tap any photo to open the in-app full-screen viewer */}
        {order.media_urls && order.media_urls.length > 0 && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'الصور المرفقة' : 'Attached photos'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {order.media_urls.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => { setViewerIndex(index); setViewerOpen(true); }}
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
            { key: 'before' as const, label: isRTL ? 'قبل الإصلاح' : 'Before repair', photos: beforePhotos },
            { key: 'after' as const, label: isRTL ? 'بعد الإصلاح' : 'After repair', photos: afterPhotos },
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
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: 72, height: 72, borderRadius: BORDER_RADIUS.md, marginRight: 8 }}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      </ScrollView>

      <ImageViewer
        visible={viewerOpen}
        images={order?.media_urls ?? []}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
      <ImagePickerSheet
        visible={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onPick={pickPhotos}
        isRTL={isRTL}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
  },
  actionButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
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
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  workflowGrid: {
    gap: SPACING.m,
  },
  workflowButton: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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
  },
  locationText: {
    fontSize: 14,
    marginBottom: SPACING.m,
  },
  locationButtons: {
    flexDirection: 'row',
    gap: SPACING.m,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: SPACING.s,
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.m,
    marginRight: SPACING.m,
  },
  actionButton: {
    flexDirection: 'row',
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
