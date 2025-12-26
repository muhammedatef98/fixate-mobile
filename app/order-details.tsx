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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { requests } from '../lib/supabase-api';
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

  useEffect(() => {
    loadOrderDetails();
    
    // Subscribe to real-time updates
    const subscription = requests.subscribeToUpdates(id as string, (updatedOrder) => {
      setOrder(updatedOrder);
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
      logger.error('Error loading order:', error);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
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
        {/* Device Info Card */}
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
              {isRTL ? 'السعر التقديري' : 'Estimated Price'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.primary, fontWeight: 'bold' }]}>
              {order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        {!isCancelled && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
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
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={step.icon as any}
                          size={20}
                          color={isCompleted ? '#FFFFFF' : COLORS.textSecondary}
                        />
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLine,
                            {
                              backgroundColor: isCompleted ? COLORS.primary : COLORS.border,
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
          <View style={[styles.card, { backgroundColor: '#EF444415' }, SHADOWS.medium]}>
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
          <Text style={[styles.locationText, { color: COLORS.textSecondary }]}>
            {order.location}
          </Text>
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
              {isRTL ? 'الصور المرفقة' : 'Attached Images'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

        {/* Order Info */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'معلومات إضافية' : 'Additional Information'}
          </Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="access-time" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'تاريخ الطلب' : 'Order Date'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {new Date(order.created_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="update" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'آخر تحديث' : 'Last Updated'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {new Date(order.updated_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="truck" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'نوع الخدمة' : 'Service Type'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {order.service_type === 'mobile' 
                ? (isRTL ? 'فني متنقل' : 'Mobile Technician')
                : (isRTL ? 'استلام وتوصيل' : 'Pickup & Delivery')}
            </Text>
          </View>
        </View>
      </ScrollView>
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
  },
  errorText: {
    fontSize: 16,
    marginTop: SPACING.md,
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
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  timeline: {
    paddingVertical: SPACING.sm,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 60,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: SPACING.xs,
  },
  timelineRight: {
    flex: 1,
    paddingTop: SPACING.sm,
  },
  timelineLabel: {
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  currentBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelledContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  cancelledText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  locationText: {
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
  },
});
