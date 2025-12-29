import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRequests } from '../../contexts/RequestContext';
import { useApp } from '../../contexts/AppContext';
import { auth } from '../../lib/supabase-api';
import { registerForPushNotifications, subscribeToNewRequests, unsubscribeFromNewRequests, addNotificationResponseListener } from '../../services/localNotificationService';

const STATS = [
  { title: 'أرباح اليوم', value: '450 ر.س', icon: 'wallet', color: '#10B981' },
  { title: 'الطلبات المكتملة', value: '5', icon: 'check-circle', color: '#3B82F6' },
  { title: 'التقييم', value: '4.9', icon: 'star', color: '#F59E0B' },
];

export default function TechnicianDashboard() {
  const router = useRouter();
  const { requests, updateRequestStatus } = useRequests();
  const [technicianName, setTechnicianName] = useState('فني');
  const { user } = useApp();
  const [isOnline, setIsOnline] = useState(true);

  const pendingRequests = requests.filter(req => req.status === 'pending');

  // Setup notifications and real-time listener
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const currentUser = await auth.getCurrentUser();
        if (currentUser?.user_metadata?.full_name) {
          setTechnicianName(currentUser.user_metadata.full_name);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    loadProfile();

    let subscription: any;
    let notificationListener: any;

    const setupNotifications = async () => {
      // Request notification permissions
      const hasPermission = await registerForPushNotifications();
      if (!hasPermission) {
        console.log('Notification permissions not granted');
        return;
      }

      // Subscribe to new requests
      subscription = subscribeToNewRequests('', (newRequest) => {
        console.log('New request received:', newRequest);
        // The notification is already sent by subscribeToNewRequests
      });

      // Handle notification tap
      notificationListener = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.orderId) {
          // Navigate to the order details or refresh the list
          console.log('Notification tapped for order:', data.orderId);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>أهلاً، كابتن {technicianName} 🔧</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
              <Text style={styles.statusText}>{isOnline ? 'متاح لاستقبال الطلبات' : 'غير متاح حالياً'}</Text>
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
        <View style={styles.statsGrid}>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الطلبات الجديدة ({pendingRequests.length})</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        {pendingRequests.length > 0 ? (
          pendingRequests.map((req) => (
            <Card key={req.id} style={styles.requestCard}>
              <View style={styles.reqHeader}>
                <View style={styles.customerInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>ع</Text>
                  </View>
                  <View>
                    <Text style={styles.customerName}>عميل جديد</Text>
                    <Text style={styles.reqTime}>الآن</Text>
                  </View>
                </View>
                <Text style={styles.price}>{req.price}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.reqDetails}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="smartphone" size={20} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>{req.brand} {req.model} - {req.issue}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="location-on" size={20} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>{req.location}</Text>
                </View>
                {req.description ? (
                  <View style={styles.detailRow}>
                    <MaterialIcons name="description" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.detailText} numberOfLines={2}>{req.description}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.chatBtn]}
                  onPress={() => router.push(`/chat/${req.id}`)}
                >
                  <MaterialIcons name="chat" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => updateRequestStatus(req.id, 'completed')} // Just to remove from list for demo
                >
                  <Text style={styles.rejectText}>رفض</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => updateRequestStatus(req.id, 'accepted')}
                >
                  <Text style={styles.acceptText}>قبول الطلب</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>لا توجد طلبات جديدة حالياً</Text>
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
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: SPACING.s,
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
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
  chatBtn: {
    backgroundColor: COLORS.primaryLight,
    flex: 0.8,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
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
