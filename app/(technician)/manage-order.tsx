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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { requests, auth } from '../../lib/supabase-api';
import type { Order } from '../../lib/supabase-api';

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
      console.error('Error loading order:', error);
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
      console.error('Error accepting order:', error);
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
      console.error('Error updating status:', error);
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
        {/* Professional Workflow Control */}
        <View style={[styles.card, { backgroundColor: COLORS.card }, SHADOWS.medium]}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>
            {isRTL ? 'لوحة التحكم في سير العمل' : 'Workflow Control Panel'}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: COLORS.textSecondary, marginBottom: SPACING.m }]}>
            {isRTL ? 'قم بتحديث حالة الطلب بدقة لضمان تتبع العميل' : 'Update order status precisely for client tracking'}
          </Text>
          
          <View style={styles.workflowGrid}>
            {STATUS_ACTIONS.map((action) => {
              const isActive = order.status === action.status;
              const isNext = nextActions.some(a => a.status === action.status);
              
              return (
                <TouchableOpacity
                  key={action.status}
                  style={[
                    styles.workflowButton, 
                    { 
                      borderColor: isActive ? action.color : isNext ? action.color : COLORS.border,
                      backgroundColor: isActive ? `${action.color}15` : 'transparent',
                      opacity: (isActive || isNext) ? 1 : 0.5
                    }
                  ]}
                  onPress={() => {
                    if (action.status === 'accepted') {
                      handleAcceptOrder();
                    } else {
                      handleUpdateStatus(action.status);
                    }
                  }}
                  disabled={updating || (!isActive && !isNext)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: isActive || isNext ? action.color : COLORS.disabled }]}>
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
                  {isActive && <MaterialIcons name="check-circle" size={20} color={action.color} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Chat Button */}
        {order.status !== 'pending' && order.status !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.chatButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.push({
              pathname: '/chat',
              params: { orderId: order.id, otherUserName: isRTL ? 'العميل' : 'Customer' }
            })}
          >
            <MaterialIcons name="chat" size={24} color="#FFFFFF" />
            <Text style={styles.chatButtonText}>
              {isRTL ? 'مراسلة العميل' : 'Chat with Customer'}
            </Text>
          </TouchableOpacity>
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
      </ScrollView>
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
    marginBottom: SPACING.l,
    ...SHADOWS.small,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    padding: SPACING.l,
  },
  card: {
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.l,
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
