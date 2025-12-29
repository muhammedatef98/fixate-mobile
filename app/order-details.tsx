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
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitleContainer: {
    marginBottom: SPACING.sm,
  },
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
