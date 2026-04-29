import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRequests } from '../../contexts/RequestContext';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { assignOrderToTechnician } from '../../services/orderService';
import { registerForPushNotifications, subscribeToNewRequests, unsubscribeFromNewRequests, addNotificationResponseListener } from '../../services/localNotificationService';
import { logger } from '../../utils/logger';

const STATS = [
  { title: 'أرباح اليوم', value: '450 ر.س', icon: 'wallet', color: '#10B981' },
  { title: 'الطلبات المكتملة', value: '5', icon: 'check-circle', color: '#3B82F6' },
  { title: 'التقييم', value: '4.9', icon: 'star', color: '#F59E0B' },
];

export default function TechnicianDashboard() {
  const router = useRouter();
  const { requests: pendingOrders, updateRequestStatus } = useRequests();
  const [technicianName, setTechnicianName] = useState('فني');
  const { language } = useApp();
  const { user, userProfile } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const isRTL = language === 'ar';

  // Local state to hide rejected requests temporarily
  const [rejectedRequestIds, setRejectedRequestIds] = useState<string[]>([]);

  // Filter requests: only pending and not rejected locally
  const pendingRequests = pendingOrders.filter(req =>
    req.status === 'pending' && !rejectedRequestIds.includes(req.id)
  );

  // Setup notifications and real-time listener
  useEffect(() => {
    if (userProfile?.name) {
      setTechnicianName(userProfile.name);
    }

    let subscription: any;
    let notificationListener: any;

    const setupNotifications = async () => {
      // Request notification permissions
      const hasPermission = await registerForPushNotifications();
      if (!hasPermission) {
        logger.debug('Notification permissions not granted');
        return;
      }

      // Subscribe to new requests
      subscription = subscribeToNewRequests('', (newRequest) => {
        logger.debug('New request received:', newRequest);
        // The notification is already sent by subscribeToNewRequests
      });

      // Handle notification tap
      notificationListener = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.orderId) {
          // Navigate to the order details or refresh the list
          logger.debug('Notification tapped for order:', data.orderId);
        }
      });
    };

    setupNotifications();

    // Cleanup
    return () => {
      if (subscription) {
        unsubscribeFromNewRequests(subscription);
      }
      if (notificationListener) {
        notificationListener.remove();
      }
    };
  }, []);

  const handleReject = (requestId: string) => {
    Alert.alert(
      isRTL ? 'رفض الطلب' : 'Reject Request',
      isRTL ? 'هل أنت متأكد من رفض هذا الطلب؟ سيختفي من قائمتك.' : 'Are you sure you want to reject this request? It will be removed from your list.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { 
          text: isRTL ? 'رفض' : 'Reject', 
          style: 'destructive',
          onPress: () => {
            setRejectedRequestIds(prev => [...prev, requestId]);
          }
        }
      ]
    );
  };

  const handleAccept = async (requestId: string) => {
    if (!user?.id) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'يرجى تسجيل الدخول' : 'Please sign in');
      return;
    }
    try {
      await assignOrderToTechnician(requestId, user.id);
      router.push({
        pathname: '/(technician)/manage-order',
        params: { id: requestId }
      });
    } catch (error) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل قبول الطلب. ربما قبله فني آخر.' : 'Failed to accept request. Another technician might have taken it.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.greeting}>
              {isRTL ? `أهلاً، كابتن ${technicianName} 🔧` : `Hello, Captain ${technicianName} 🔧`}
            </Text>
            <View style={[styles.statusContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444', [isRTL ? 'marginLeft' : 'marginRight']: 6 }]} />
              <Text style={styles.statusText}>
                {isOnline 
                  ? (isRTL ? 'متاح لاستقبال الطلبات' : 'Online for requests') 
                  : (isRTL ? 'غير متاح حالياً' : 'Currently offline')}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
            thumbColor={isOnline ? '#10B981' : '#F3F4F6'}
          />
        </View>

        {/* Stats Grid */}
        <View style={[styles.statsGrid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {STATS.map((stat, index) => (
            <View key={index} style={[styles.statCard, SHADOWS.small]}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <FontAwesome5 name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statTitle}>{stat.title}</Text>
            </View>
          ))}
        </View>

        {/* New Requests */}
        <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={styles.sectionTitle}>
            {isRTL ? `الطلبات الجديدة (${pendingRequests.length})` : `New Requests (${pendingRequests.length})`}
          </Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>{isRTL ? 'عرض الكل' : 'See All'}</Text>
          </TouchableOpacity>
        </View>

        {pendingRequests.length > 0 ? (
          pendingRequests.map((req) => (
            <Card key={req.id} style={styles.requestCard}>
              <View style={[styles.reqHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.customerInfo, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.avatar, { [isRTL ? 'marginLeft' : 'marginRight']: SPACING.s }]}>
                    <Text style={styles.avatarText}>{req.customerName ? req.customerName.charAt(0).toUpperCase() : (isRTL ? 'ع' : 'C')}</Text>
                  </View>
                  <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                    <Text style={styles.customerName}>{req.customerName || (isRTL ? 'عميل جديد' : 'New Customer')}</Text>
                    <Text style={styles.reqTime}>{isRTL ? 'الآن' : 'Just now'}</Text>
                  </View>
                </View>
                <Text style={styles.price}>{req.price}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.reqDetails}>
                <View style={[styles.detailRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <MaterialIcons name="smartphone" size={20} color={COLORS.textSecondary} />
                  <Text style={[styles.detailText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: SPACING.s }]}>
                    {req.brand} {req.model} - {req.issue}
                  </Text>
                </View>
                <View style={[styles.detailRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <MaterialIcons name="location-on" size={20} color={COLORS.textSecondary} />
                  <Text style={[styles.detailText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: SPACING.s }]}>
                    {req.location}
                  </Text>
                </View>
                {req.description ? (
                  <View style={[styles.detailRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <MaterialIcons name="description" size={20} color={COLORS.textSecondary} />
                    <Text style={[styles.detailText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: SPACING.s }]} numberOfLines={2}>
                      {req.description}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(req.id)}
                >
                  <Text style={styles.rejectText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => handleAccept(req.id)}
                >
                  <Text style={styles.acceptText}>{isRTL ? 'قبول الطلب' : 'Accept'}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {isRTL ? 'لا توجد طلبات جديدة حالياً' : 'No new requests at the moment'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsGrid: {
    justifyContent: 'space-between',
    padding: SPACING.l,
    gap: SPACING.m,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  requestCard: {
    marginHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  reqHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  customerInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  reqTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.s,
  },
  reqDetails: {
    marginBottom: SPACING.m,
  },
  detailRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
  },
  actions: {
    gap: SPACING.m,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    flex: 2,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
    flex: 1,
  },
  acceptText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rejectText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.l,
  },
  emptyText: {
    marginTop: SPACING.m,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
