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
  I18nManager,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { requests, auth } from '../lib/supabase-api';
import type { Order } from '../lib/supabase-api';

const ORDER_TIMELINE = [
  { status: 'pending', arLabel: 'قيد الانتظار', enLabel: 'Pending', icon: 'clock-outline' },
  { status: 'accepted', arLabel: 'تم القبول', enLabel: 'Accepted', icon: 'check-circle' },
  { status: 'picking_up', arLabel: 'جاري الاستلام', enLabel: 'Picking Up', icon: 'car' },
  { status: 'diagnosing', arLabel: 'جاري الفحص', enLabel: 'Diagnosing', icon: 'magnify' },
  { status: 'repairing', arLabel: 'جاري الإصلاح', enLabel: 'Repairing', icon: 'tools' },
  { status: 'delivering', arLabel: 'جاري التوصيل', enLabel: 'Delivering', icon: 'truck-delivery' },
  { status: 'completed', arLabel: 'مكتمل', enLabel: 'Completed', icon: 'check-all' },
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
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [userType, setUserType] = useState<'customer' | 'technician'>('customer');
  const [rating, setRating] = useState(0);
  const [isRating, setIsRating] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    checkUserType();
  }, []);

  const checkUserType = async () => {
    const user = await auth.getCurrentUser();
    if (user?.user_metadata?.user_type) {
      setUserType(user.user_metadata.user_type);
    }
  };

  const CANCEL_REASONS = isRTL 
    ? ['السعر مرتفع جداً', 'وجدت فني آخر بسعر أفضل', 'لم أعد بحاجة للإصلاح', 'تأخر الفني في الرد', 'أخرى']
    : ['Price is too high', 'Found another technician', 'No longer need repair', 'Technician delayed', 'Other'];

  useEffect(() => {
    loadOrderDetails();
    
    // Subscribe to real-time updates
    const subscription = requests.subscribeToUpdates(id as string, (updatedOrder) => {
      // Preserve order_items if the update doesn't include them
      setOrder(prev => {
        if (!prev) return updatedOrder;
        return {
          ...updatedOrder,
          order_items: prev.order_items || updatedOrder.order_items
        };
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  const loadOrderDetails = async () => {
    try {
      const orderData = await requests.getById(id as string);
      setOrder(orderData);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return -1;
    return ORDER_TIMELINE.findIndex(step => step.status === order.status);
  };

  const openLocation = () => {
    if (order?.latitude && order?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`;
      Linking.openURL(url);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason) {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'الرجاء اختيار سبب الإلغاء' : 'Please select a reason');
      return;
    }

    setIsCancelling(true);
    try {
      await requests.updateStatus(id as string, 'cancelled');
      // You might want to save the reason in a separate field or table
      Alert.alert(isRTL ? 'تم' : 'Done', isRTL ? 'تم إلغاء الطلب بنجاح' : 'Order cancelled successfully');
      setCancelModalVisible(false);
      loadOrderDetails();
    } catch (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إلغاء الطلب' : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    setIsUpdatingStatus(true);
    try {
      await requests.updateStatus(id as string, newStatus);
      Alert.alert(isRTL ? 'تم' : 'Done', isRTL ? 'تم تحديث حالة الطلب' : 'Status updated successfully');
      loadOrderDetails();
    } catch (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل تحديث الحالة' : 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getNextStatus = (currentStatus: string): Order['status'] | null => {
    const statuses: Order['status'][] = ['pending', 'accepted', 'picking_up', 'diagnosing', 'repairing', 'delivering', 'completed'];
    const currentIndex = statuses.indexOf(currentStatus as any);
    if (currentIndex >= 0 && currentIndex < statuses.length - 1) {
      return statuses[currentIndex + 1];
    }
    return null;
  };

  const handleRateOrder = async (stars: number) => {
    setRating(stars);
    setIsRating(true);
    try {
      // In a real app, you'd save this to a 'reviews' table
      Alert.alert(isRTL ? 'شكراً لك' : 'Thank You', isRTL ? 'تم استلام تقييمك بنجاح' : 'Your rating has been received');
      // Update order status or a 'rated' flag if needed
    } catch (error) {
      console.error('Error rating order:', error);
    } finally {
      setIsRating(false);
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

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = order.status === 'cancelled';
  const orderItems = order.order_items && order.order_items.length > 0 
    ? order.order_items 
    : [{
        id: 'main',
        device_brand: order.device_brand,
        device_model: order.device_model,
        issue_description: order.issue_description,
        estimated_price: order.estimated_price
      }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons 
            name={isRTL ? 'arrow-forward' : 'arrow-back'} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'تفاصيل الطلب' : 'Order Details'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Rating Section (For completed orders) */}
          {userType === 'customer' && order.status === 'completed' && (
            <View style={[styles.ratingCard, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
              <Text style={[styles.ratingTitle, { color: COLORS.text }]}>
                {isRTL ? 'كيف كانت تجربتك؟' : 'How was your experience?'}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => handleRateOrder(star)}>
                    <MaterialIcons 
                      name={star <= rating ? "star" : "star-border"} 
                      size={40} 
                      color={star <= rating ? "#F59E0B" : COLORS.border} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.ratingSub, { color: COLORS.textSecondary }]}>
                {isRTL ? 'تقييمك يساعدنا على تحسين الخدمة' : 'Your rating helps us improve the service'}
              </Text>
            </View>
          )}

          {/* Technician Action Bar */}
          {userType === 'technician' && order.status !== 'completed' && order.status !== 'cancelled' && (
            <View style={[styles.techActionBar, { backgroundColor: COLORS.primary + '10' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.techActionTitle, { color: COLORS.text }]}>
                  {isRTL ? 'سير العمل' : 'Workflow Control'}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                  {isRTL ? 'اختر المرحلة الحالية للطلب' : 'Select current order stage'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.techActionBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => setShowStatusPicker(true)}
              >
                <Text style={styles.techActionBtnText}>
                  {isRTL ? 'تغيير الحالة' : 'Change Status'}
                </Text>
                <MaterialIcons name="edit" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Customer Info (For Technicians) */}
          {userType === 'technician' && (
            <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
              <Text style={[styles.cardTitle, { color: COLORS.text, marginBottom: 16 }]}>
                {isRTL ? 'بيانات العميل' : 'Customer Details'}
              </Text>
              <View style={styles.infoRow}>
                <MaterialIcons name="person" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>{isRTL ? 'الاسم' : 'Name'}</Text>
                  <Text style={[styles.infoValue, { color: COLORS.text }]}>{order.user_id ? 'محمد أحمد' : 'عميل'}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>{isRTL ? 'رقم الجوال' : 'Phone'}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL('tel:0500000000')}>
                    <Text style={[styles.infoValue, { color: COLORS.primary, textDecorationLine: 'underline' }]}>0500000000</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Cancel Button (Only for pending orders and customers) */}
          {userType === 'customer' && order.status === 'pending' && (
            <TouchableOpacity 
              style={[styles.cancelOrderBtn, { borderColor: COLORS.error }]} 
              onPress={() => setCancelModalVisible(true)}
            >
              <MaterialIcons name="cancel" size={20} color={COLORS.error} />
              <Text style={[styles.cancelOrderText, { color: COLORS.error }]}>
                {isRTL ? 'إلغاء الطلب' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          )}

        {/* Chat Button */}
        {order.status !== 'pending' && order.status !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.chatButton, { backgroundColor: '#10B981' }, SHADOWS.small]}
            onPress={() => router.push({
              pathname: '/chat',
              params: { orderId: order.id, otherUserName: isRTL ? 'الفني' : 'Technician' }
            })}
          >
            <MaterialIcons name="chat" size={24} color="#FFFFFF" />
            <Text style={styles.chatButtonText}>
              {isRTL ? 'مراسلة الفني' : 'Chat with Technician'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Order Items List */}
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            {isRTL ? 'الأجهزة المطلوبة' : 'Requested Devices'} ({orderItems.length})
          </Text>
        </View>

        {orderItems.map((item, index) => (
          <View key={index} style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: COLORS.text }]}>
                {isRTL ? `جهاز ${index + 1}` : `Device ${index + 1}`}
              </Text>
              <View style={[styles.priceTag, { backgroundColor: COLORS.primary + '15' }]}>
                <Text style={[styles.priceText, { color: COLORS.primary }]}>
                  {item.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
                </Text>
              </View>
            </View>
            
            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'الجهاز' : 'Device'}
                </Text>
                <Text style={[styles.infoValue, { color: COLORS.text }]}>
                  {item.device_brand} {item.device_model}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="wrench" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'المشكلة' : 'Issue'}
                </Text>
                <Text style={[styles.infoValue, { color: COLORS.text }]}>
                  {item.issue_description}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* Total Price Card */}
        <View style={[styles.totalCard, { backgroundColor: COLORS.primary }, SHADOWS.medium]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {isRTL ? 'إجمالي السعر التقديري' : 'Total Estimated Price'}
            </Text>
            <Text style={styles.totalValue}>
              {order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        {!isCancelled && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text, marginBottom: SPACING.md }]}>
              {isRTL ? 'حالة الطلب' : 'Order Status'}
            </Text>
            <View style={styles.timeline}>
              {ORDER_TIMELINE.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isLast = index === ORDER_TIMELINE.length - 1;

                return (
                  <View key={step.status} style={styles.timelineStep}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineIcon,
                          {
                            backgroundColor: isCompleted ? COLORS.primary : COLORS.border,
                            borderColor: isCurrent ? COLORS.primary : 'transparent',
                            borderWidth: isCurrent ? 2 : 0,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={step.icon as any}
                          size={16}
                          color={isCompleted ? '#FFFFFF' : COLORS.textSecondary}
                        />
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLine,
                            {
                              backgroundColor: index < currentStepIndex ? COLORS.primary : COLORS.border,
                            },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          {
                            color: isCompleted ? COLORS.text : COLORS.textSecondary,
                            fontWeight: isCurrent ? 'bold' : 'normal',
                            opacity: isCompleted ? 1 : 0.7,
                          },
                        ]}
                      >
                        {isRTL ? step.arLabel : step.enLabel}
                      </Text>
                      {isCurrent && (
                        <Text style={[styles.currentBadge, { color: COLORS.primary }]}>
                          {isRTL ? 'الحالة الحالية' : 'Current'}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Cancelled Status */}
        {isCancelled && (
          <View style={[styles.card, { backgroundColor: '#EF444415', borderColor: '#EF4444', borderWidth: 1 }, SHADOWS.medium]}>
            <View style={styles.cancelledContainer}>
              <MaterialCommunityIcons name="close-circle" size={48} color="#EF4444" />
              <Text style={[styles.cancelledText, { color: '#EF4444' }]}>
                {isRTL ? 'تم إلغاء الطلب' : 'Order Cancelled'}
              </Text>
            </View>
          </View>
        )}

        {/* Location Card */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'الموقع' : 'Location'}
          </Text>
          <View style={styles.locationContainer}>
            <MaterialIcons name="location-on" size={24} color={COLORS.primary} />
            <Text style={[styles.locationText, { color: COLORS.textSecondary }]}>
              {order.location}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.mapButton, { backgroundColor: COLORS.primary }]}
            onPress={openLocation}
          >
            <MaterialIcons name="map" size={20} color="#FFFFFF" />
            <Text style={styles.mapButtonText}>
              {isRTL ? 'عرض على الخريطة' : 'View on Map'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Media */}
        {order.media_urls && order.media_urls.length > 0 && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'الصور المرفقة' : 'Attached Photos'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
              {order.media_urls.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status Picker Modal */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>
              {isRTL ? 'تحديث حالة الطلب' : 'Update Status'}
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {ORDER_TIMELINE.map((step) => (
                <TouchableOpacity 
                  key={step.status} 
                  style={[styles.reasonItem, order.status === step.status && { backgroundColor: COLORS.primary + '15' }]}
                  onPress={() => {
                    handleUpdateStatus(step.status as any);
                    setShowStatusPicker(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <MaterialCommunityIcons name={step.icon as any} size={24} color={order.status === step.status ? COLORS.primary : COLORS.textSecondary} />
                    <Text style={[styles.reasonText, { color: order.status === step.status ? COLORS.primary : COLORS.text }]}>
                      {isRTL ? step.arLabel : step.enLabel}
                    </Text>
                  </View>
                  {order.status === step.status && <MaterialIcons name="check-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: COLORS.border, marginTop: 16 }]} 
              onPress={() => setShowStatusPicker(false)}
            >
              <Text style={{ color: COLORS.text }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal (Bottom Sheet Style) */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity 
            style={styles.bottomSheetBackdrop} 
            activeOpacity={1} 
            onPress={() => setCancelModalVisible(false)} 
          />
          <View style={[styles.bottomSheetContent, { backgroundColor: COLORS.card }]}>
            <View style={[styles.bottomSheetHandle, { backgroundColor: COLORS.border }]} />
            
            <Text style={[styles.bottomSheetTitle, { color: COLORS.text }]}>
              {isRTL ? 'لماذا تود إلغاء الطلب؟' : 'Why do you want to cancel?'}
            </Text>
            <Text style={[styles.bottomSheetSub, { color: COLORS.textSecondary }]}>
              {isRTL ? 'يساعدنا معرفة السبب على تحسين خدمتنا' : 'Knowing the reason helps us improve our service'}
            </Text>

            <View style={styles.reasonsGrid}>
              {CANCEL_REASONS.map((reason, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.reasonChip, 
                    { backgroundColor: COLORS.background, borderColor: COLORS.border },
                    cancelReason === reason && { backgroundColor: COLORS.error + '10', borderColor: COLORS.error }
                  ]}
                  onPress={() => setCancelReason(reason)}
                >
                  <MaterialCommunityIcons 
                    name={cancelReason === reason ? "check-circle" : "circle-outline"} 
                    size={20} 
                    color={cancelReason === reason ? COLORS.error : COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.reasonChipText, 
                    { color: COLORS.text },
                    cancelReason === reason && { color: COLORS.error, fontWeight: 'bold' }
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.bottomSheetFooter}>
              <TouchableOpacity 
                style={[styles.cancelActionBtn, { backgroundColor: COLORS.error }]} 
                onPress={handleCancelOrder}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="close" size={20} color="#fff" />
                    <Text style={styles.cancelActionBtnText}>{isRTL ? 'تأكيد الإلغاء' : 'Confirm Cancellation'}</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.backActionBtn, { borderColor: COLORS.border }]} 
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={[styles.backActionBtnText, { color: COLORS.textSecondary }]}>{isRTL ? 'تراجع' : 'Go Back'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    gap: SPACING.md,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
    chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: SPACING.sm,
  },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cancelOrderText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  techActionBar: {
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  techActionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  techActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  techActionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  ratingCard: {
    padding: 24,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ratingSub: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  reasonItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 8 },
  reasonText: { fontSize: 15 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  // Bottom Sheet Styles
  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  bottomSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  bottomSheetContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  bottomSheetHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  bottomSheetTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  bottomSheetSub: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30, justifyContent: 'center' },
  reasonChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15, borderWidth: 1, gap: 8, minWidth: '45%' },
  reasonChipText: { fontSize: 14 },
  bottomSheetFooter: { gap: 12 },
  cancelActionBtn: { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  cancelActionBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backActionBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  backActionBtnText: { fontSize: 16, fontWeight: '600' },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  timeline: {
    marginTop: SPACING.sm,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 60,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 40,
  },
  timelineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineRight: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: SPACING.sm,
  },
  timelineLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  currentBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelledContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  cancelledText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaScroll: {
    marginTop: SPACING.sm,
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
  },
});
