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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { requests, auth } from '../../lib/supabase-api';
import type { Order } from '../../lib/supabase-api';

const STATUS_ACTIONS = [
  { status: 'accepted', arLabel: 'قبول الطلب', enLabel: 'Accept Order', icon: 'check-circle', color: '#10B981' },
  { status: 'picking_up', arLabel: 'جاري الاستلام', enLabel: 'Picking Up', icon: 'car', color: '#3B82F6' },
  { status: 'diagnosing', arLabel: 'بدء الفحص', enLabel: 'Start Diagnosing', icon: 'magnify', color: '#8B5CF6' },
  { status: 'repairing', arLabel: 'بدء الإصلاح', enLabel: 'Start Repairing', icon: 'tools', color: '#EC4899' },
  { status: 'delivering', arLabel: 'جاري التوصيل', enLabel: 'Out for Delivery', icon: 'truck-delivery', color: '#06B6D4' },
  { status: 'completed', arLabel: 'إكمال الطلب', enLabel: 'Complete Order', icon: 'check-all', color: '#10B981' },
];

export default function ManageOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

  const handleAcceptOrder = async () => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) return;

      setUpdating(true);
      await requests.acceptRequest(id as string, user.id);
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

  const getNextActions = () => {
    if (!order) return [];
    
    const statusIndex = STATUS_ACTIONS.findIndex(a => a.status === order.status);
    
    if (order.status === 'pending') {
      return [STATUS_ACTIONS[0]]; // Only show "Accept Order"
    }
    
    if (statusIndex === -1 || statusIndex === STATUS_ACTIONS.length - 1) {
      return [];
    }
    
    return [STATUS_ACTIONS[statusIndex + 1]];
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
          {isRTL ? 'إدارة الطلب' : 'Manage Order'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        {nextActions.length > 0 && (
          <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
            <Text style={[styles.cardTitle, { color: COLORS.text }]}>
              {isRTL ? 'الإجراء التالي' : 'Next Action'}
            </Text>
            {nextActions.map((action) => (
              <TouchableOpacity
                key={action.status}
                style={[styles.actionButton, { backgroundColor: action.color }]}
                onPress={() => {
                  if (action.status === 'accepted') {
                    handleAcceptOrder();
                  } else {
                    handleUpdateStatus(action.status);
                  }
                }}
                disabled={updating}
              >
                <MaterialCommunityIcons name={action.icon as any} size={24} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>
                  {isRTL ? action.arLabel : action.enLabel}
                </Text>
                {updating && <ActivityIndicator size="small" color="#FFFFFF" />}
              </TouchableOpacity>
            ))}
          </View>
        )}

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
              {isRTL ? 'السعر' : 'Price'}
            </Text>
            <Text style={[styles.infoValue, { color: COLORS.primary, fontWeight: 'bold' }]}>
              {order.estimated_price} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        </View>

        {/* Location */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'الموقع' : 'Location'}
          </Text>
          <Text style={[styles.locationText, { color: COLORS.textSecondary }]}>
            {order.location}
          </Text>
          <View style={styles.locationButtons}>
            <TouchableOpacity
              style={[styles.locationButton, { backgroundColor: COLORS.primary }]}
              onPress={openLocation}
            >
              <MaterialIcons name="map" size={20} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>
                {isRTL ? 'عرض' : 'View'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locationButton, { backgroundColor: '#10B981' }]}
              onPress={openNavigation}
            >
              <MaterialIcons name="navigation" size={20} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>
                {isRTL ? 'توجيه' : 'Navigate'}
              </Text>
            </TouchableOpacity>
          </View>
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

        {/* All Status Updates */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'تحديث الحالة' : 'Update Status'}
          </Text>
          {STATUS_ACTIONS.filter(a => a.status !== 'accepted').map((action) => {
            const isCurrentStatus = order.status === action.status;
            const statusIndex = STATUS_ACTIONS.findIndex(a => a.status === order.status);
            const actionIndex = STATUS_ACTIONS.findIndex(a => a.status === action.status);
            const isPast = actionIndex < statusIndex;
            const isDisabled = isPast || isCurrentStatus || order.status === 'pending';

            return (
              <TouchableOpacity
                key={action.status}
                style={[
                  styles.statusOption,
                  {
                    backgroundColor: isCurrentStatus ? `${action.color}15` : COLORS.background,
                    borderColor: isCurrentStatus ? action.color : COLORS.border,
                  },
                ]}
                onPress={() => !isDisabled && handleUpdateStatus(action.status)}
                disabled={isDisabled || updating}
              >
                <MaterialCommunityIcons 
                  name={action.icon as any} 
                  size={24} 
                  color={isCurrentStatus ? action.color : COLORS.textSecondary} 
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    { color: isCurrentStatus ? action.color : COLORS.textSecondary },
                  ]}
                >
                  {isRTL ? action.arLabel : action.enLabel}
                </Text>
                {isCurrentStatus && (
                  <MaterialIcons name="check-circle" size={20} color={action.color} />
                )}
              </TouchableOpacity>
            );
          })}
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
  locationText: {
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  locationButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  locationButtonText: {
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
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
