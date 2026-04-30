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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { requests, auth } from '../lib/supabase-api';
import type { Order } from '../lib/supabase-api';
import { logger } from '../utils/logger';
import LiveTrackingMap from '../components/LiveTrackingMap';

const ORDER_TIMELINE: { status: string; arLabel: string; enLabel: string; icon: string }[] = [
  { status: 'pending', arLabel: 'قيد الانتظار', enLabel: 'Pending', icon: 'clock-outline' },
  { status: 'accepted', arLabel: 'تم القبول', enLabel: 'Accepted', icon: 'check-circle' },
  { status: 'picking_up', arLabel: 'جاري الاستلام', enLabel: 'Picking Up', icon: 'car' },
  { status: 'diagnosing', arLabel: 'جاري الفحص', enLabel: 'Diagnosing', icon: 'magnify' },
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header removed to use Stack Header */}

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
          <Text style={styles.heroStatusOrderId}>#{order.id?.slice(0, 8)}</Text>
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
              <Text style={[styles.infoValue, { color: COLORS.text }]}>
                {order.issue_description}
              </Text>
            </View>
          </View>
        </View>

        {/* Price Information Card */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.small]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="payments" size={24} color={COLORS.primary} />
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'السعر المقدر' : 'Estimated Price'}
            </Text>
          </View>

          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'التكلفة المقدرة' : 'Estimated Cost'}
              </Text>
              <Text style={[styles.priceAmount, { color: COLORS.primary }]}>
                {order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {order.technician_id && order.status !== 'pending' && order.status !== 'completed' && order.status !== 'cancelled' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary, flex: 1, marginRight: 8 }, SHADOWS.small]}
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
            <Text style={[styles.cardTitle, { color: COLORS.text, marginBottom: 16 }]}>
              {isRTL ? 'كيف كانت تجربتك؟' : 'Rate your experience'}
            </Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} style={styles.starButton}>
                  <MaterialIcons name="star-outline" size={32} color={COLORS.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, marginTop: 16 },

  header: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderIdLabel: { fontSize: 14, fontWeight: '500' },
  orderId: { fontSize: 16, fontWeight: 'bold' },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  timelineCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
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
    borderRadius: 16,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', flex: 1 },

  deviceInfo: { gap: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 13, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', textAlign: 'right' },

  divider: { height: 1 },

  priceContainer: { gap: 8 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { fontSize: 14, fontWeight: '500' },
  priceAmount: { fontSize: 20, fontWeight: 'bold' },

  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  starButton: { padding: 8 },
});
