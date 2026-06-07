import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Linking,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import * as orderService from '../../services/orderService';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';
import NotificationBell from '../../components/NotificationBell';

const { width } = Dimensions.get('window');

export default function TechnicianHomeScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [availableOrders, setAvailableOrders] = useState<orderService.Order[]>([]);
  const [myOrders, setMyOrders] = useState<orderService.Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my-orders'>('available');
  // Overall technician availability for repair work — separate from
  // per-service availability. Backed by technicians.is_available; degrades
  // gracefully (local-only) if the column/row isn't ready yet.
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('technicians')
          .select('is_available')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data && typeof data.is_available === 'boolean') setIsAvailable(data.is_available);
      } catch (e) {
        logger.warn('load availability fell back to default', e);
      }
    })();
  }, [user?.id]);

  const toggleAvailability = async (next: boolean) => {
    if (!user) return;
    setIsAvailable(next); // optimistic
    setTogglingAvailability(true);
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ is_available: next })
        .eq('user_id', user.id);
      if (error) logger.warn('availability not persisted (backend pending)', error);
    } catch (e) {
      logger.warn('toggleAvailability recorded locally only', e);
    } finally {
      setTogglingAvailability(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch available orders (pending status, no technician assigned)
      const available = await orderService.getAvailableOrders();
      logger.debug('Available orders fetched:', available);
      setAvailableOrders(available || []);

      // Fetch technician's accepted orders
      if (user) {
        const myOrdersList = await orderService.getTechnicianOrders(user.id);
        setMyOrders(myOrdersList || []);
      }
    } catch (error) {
      logger.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // ── Computed dashboard metrics ─────────────────────────────────────────
  // Today's earnings: sum of final/estimated price for the technician's
  // jobs completed since midnight local time. Used to be hard-coded to 0,
  // which made the card useless and discouraged the technician.
  const todaysEarnings = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return myOrders.reduce((sum, o) => {
      if (o.status !== 'completed') return sum;
      const ts = o.updated_at ?? o.created_at;
      if (!ts) return sum;
      const t = new Date(ts).getTime();
      if (!Number.isFinite(t) || t < startOfDay.getTime()) return sum;
      const amount = Number((o as any).final_price ?? (o as any).estimated_price ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [myOrders]);

  // Time-aware greeting feels more personal than a static "Welcome".
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (isRTL) {
      if (h < 12) return 'صباح الخير';
      if (h < 18) return 'مساء النور';
      return 'مساء الخير';
    }
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, [isRTL]);

  // Format dates with Gregorian even on Arabic locale so technicians never
  // see Hijri on their home cards.
  const fmtOrderTime = (iso?: string): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const locale = isRTL ? 'ar-SA-u-ca-gregory' : 'en-US';
      return d.toLocaleString(locale, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  // Orders posted within the last 30 minutes are flagged as "NEW" — gives
  // the technician an obvious nudge to grab a fresh job before peers.
  const FRESH_MS = 30 * 60 * 1000;
  const isFreshOrder = (iso?: string): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && (Date.now() - t) < FRESH_MS;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#F59E0B',
      accepted: '#3B82F6',
      picking_up: '#8B5CF6',
      diagnosing: '#EC4899',
      quoted: '#F59E0B',
      repairing: '#10B981',
      delivering: '#06B6D4',
      completed: '#22C55E',
      cancelled: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getStatusText = (status: string) => {
    const statusTexts: { [key: string]: { ar: string; en: string } } = {
      pending: { ar: 'قيد الانتظار', en: 'Pending' },
      accepted: { ar: 'مقبول', en: 'Accepted' },
      picking_up: { ar: 'جاري الاستلام', en: 'Picking Up' },
      diagnosing: { ar: 'جاري الفحص', en: 'Diagnosing' },
      quoted: { ar: 'بانتظار موافقة العميل', en: 'Awaiting Approval' },
      repairing: { ar: 'جاري الإصلاح', en: 'Repairing' },
      delivering: { ar: 'جاري التوصيل', en: 'Delivering' },
      completed: { ar: 'مكتمل', en: 'Completed' },
      cancelled: { ar: 'ملغي', en: 'Cancelled' },
    };
    return isRTL ? statusTexts[status]?.ar : statusTexts[status]?.en;
  };

  const renderOrderCard = (order: orderService.Order, isAvailable: boolean = false) => (
    <TouchableOpacity
      key={order.id}
      style={[styles.orderCard, SHADOWS.neuFlat]}
      // Always open the full details screen — the technician reviews every
      // request detail there and accepts from inside it.
      onPress={() => router.push(`/(technician)/manage-order?id=${order.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <MaterialCommunityIcons 
            name={order.device_brand?.toLowerCase().includes('apple') ? 'apple' : 
                  order.device_brand?.toLowerCase().includes('samsung') ? 'android' : 
                  'cellphone'} 
            size={32} 
            color={COLORS.primary} 
          />
          <View style={styles.orderInfo}>
            <Text style={[styles.orderTitle, { color: COLORS.text }]}>
              {order.device_brand} {order.device_model}
            </Text>
            <Text style={[styles.orderSubtitle, { color: COLORS.textSecondary }]}>
              {order.issue_description || (isRTL ? 'لا يوجد وصف' : 'No description')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          {isAvailable && isFreshOrder(order.created_at) && (
            <View style={styles.newBadge}>
              <View style={styles.newDot} />
              <Text style={styles.newBadgeText}>{isRTL ? 'جديد' : 'NEW'}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {getStatusText(order.status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.orderDetails}>
        {order.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.detailText, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {order.address}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
          <Text style={[styles.detailText, { color: COLORS.textSecondary }]}>
            {fmtOrderTime(order.created_at)}
          </Text>
        </View>

        {order.service_type && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons 
              name={order.service_type === 'mobile' ? 'account-wrench' : 'truck-delivery'} 
              size={16} 
              color={COLORS.textSecondary} 
            />
            <Text style={[styles.detailText, { color: COLORS.textSecondary }]}>
              {order.service_type === 'mobile' 
                ? (isRTL ? 'فني متنقل' : 'Mobile Service')
                : (isRTL ? 'استلام وتوصيل' : 'Pickup & Delivery')}
            </Text>
          </View>
        )}
      </View>

      {isAvailable && (
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: COLORS.primary }]}
          onPress={() => router.push(`/(technician)/manage-order?id=${order.id}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.acceptButtonText}>
            {isRTL ? 'عرض التفاصيل والقبول' : 'View Details & Accept'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    // Two distinct empty-state messages on the "Available" tab depending on
    // whether the technician is off-duty (their own toggle) or simply has
    // no inbound work right now. Off-duty surfaces a one-tap recovery.
    const isAvailableTab = activeTab === 'available';
    const offDuty = isAvailableTab && !isAvailable;
    return (
      <View style={styles.emptyState}>
        <View style={[
          styles.emptyIconWrap,
          { backgroundColor: offDuty ? '#F59E0B22' : COLORS.primary + '14' },
        ]}>
          <MaterialCommunityIcons
            name={offDuty
              ? 'power-sleep'
              : isAvailableTab ? 'clipboard-search-outline' : 'clipboard-check-outline'}
            size={44}
            color={offDuty ? '#F59E0B' : COLORS.primary}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: COLORS.text }]}>
          {offDuty
            ? (isRTL ? 'أنت في وضع عدم الإتاحة' : 'You are off duty')
            : isAvailableTab
              ? (isRTL ? 'لا توجد طلبات متاحة' : 'No available orders')
              : (isRTL ? 'لا توجد طلبات حالية' : 'No current orders')}
        </Text>
        <Text style={[styles.emptySubtitle, { color: COLORS.textSecondary }]}>
          {offDuty
            ? (isRTL ? 'فعّل الإتاحة لاستقبال طلبات جديدة' : 'Toggle availability on to receive jobs')
            : isAvailableTab
              ? (isRTL ? 'سيظهر هنا الطلبات الجديدة من العملاء' : 'New customer orders will appear here')
              : (isRTL ? 'الطلبات التي قبلتها ستظهر هنا' : 'Orders you accept will appear here')}
        </Text>
        {offDuty ? (
          <TouchableOpacity
            style={[styles.emptyCta, { backgroundColor: COLORS.primary }]}
            onPress={() => toggleAvailability(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="power" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>
              {isRTL ? 'تفعيل الإتاحة' : 'Turn on availability'}
            </Text>
          </TouchableOpacity>
        ) : isAvailableTab ? (
          <TouchableOpacity
            style={[styles.emptyCta, { backgroundColor: COLORS.primary + '18', borderWidth: 1, borderColor: COLORS.primary + '40' }]}
            onPress={() => router.push('/(technician)/service-availability')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="tune-variant" size={16} color={COLORS.primary} />
            <Text style={[styles.emptyCtaText, { color: COLORS.primary }]}>
              {isRTL ? 'إدارة الخدمات' : 'Manage services'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="wrench" size={28} color={COLORS.primary} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: COLORS.text }]}>
              {greeting}
            </Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {userProfile?.name || (isRTL ? 'فني معتمد' : 'Certified Tech')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.sm }}>
          <NotificationBell
            style={[styles.refreshButton, SHADOWS.neuSmall]}
            color={COLORS.text}
            size={22}
          />
          <TouchableOpacity
            style={[styles.refreshButton, SHADOWS.neuSmall]}
            onPress={loadOrders}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تحديث' : 'Refresh'}
          >
            <Ionicons name="refresh" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.refreshButton, SHADOWS.neuSmall]}
            onPress={() => {
              Alert.alert(
                isRTL ? 'تسجيل الخروج' : 'Logout',
                isRTL ? 'هل أنت متأكد؟' : 'Are you sure?',
                [
                  { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
                  {
                    text: isRTL ? 'تسجيل الخروج' : 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                      try { await signOut(); } catch {}
                      router.replace('/role-selection');
                    },
                  },
                ]
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تسجيل الخروج' : 'Logout'}
          >
            <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, SHADOWS.neuFlat]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#10B98120' }]}>
            <MaterialIcons name="attach-money" size={20} color="#10B981" />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statValue, { color: COLORS.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {todaysEarnings.toLocaleString(isRTL ? 'ar-EG' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'أرباح اليوم' : "Today's Earnings"}
            </Text>
          </View>
        </View>

        <View style={[styles.statCard, SHADOWS.neuFlat]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#3B82F620' }]}>
            <MaterialCommunityIcons name="clipboard-check" size={20} color="#3B82F6" />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statValue, { color: COLORS.text }]}>
              {myOrders.filter(o => o.status === 'completed').length}
            </Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'مكتملة' : 'Completed'}
            </Text>
          </View>
        </View>

        <View style={[styles.statCard, SHADOWS.neuFlat]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#F59E0B20' }]}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#F59E0B" />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statValue, { color: COLORS.text }]}>
              {availableOrders.length}
            </Text>
            <Text style={[styles.statLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'متاحة' : 'Available'}
            </Text>
          </View>
        </View>
      </View>

      {/* Availability controls — overall toggle + per-service shortcut */}
      <View style={[styles.availabilityCard, SHADOWS.neuFlat]}>
        <View style={styles.availabilityRow}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={[styles.availabilityDot, { backgroundColor: isAvailable ? '#10B981' : '#9CA3AF' }]} />
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={[styles.availabilityTitle, { color: COLORS.text }]}>
                {isRTL ? 'متاح لاستقبال الطلبات' : 'Available for jobs'}
              </Text>
              <Text style={[styles.availabilitySub, { color: COLORS.textSecondary }]}>
                {isAvailable
                  ? (isRTL ? 'تظهر لك الطلبات الجديدة' : 'You receive new repair requests')
                  : (isRTL ? 'لن تصلك طلبات جديدة' : 'You will not get new requests')}
              </Text>
            </View>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            disabled={togglingAvailability}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity
          style={[styles.manageServicesBtn, { borderColor: COLORS.border }]}
          onPress={() => router.push('/(technician)/service-availability')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="tune-variant" size={18} color={COLORS.primary} />
          <Text style={[styles.manageServicesText, { color: COLORS.primary }]}>
            {isRTL ? 'إدارة الخدمات المتاحة' : 'Manage available services'}
          </Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Support bar — quick line to customer service */}
      <TouchableOpacity
        style={[styles.supportBar, SHADOWS.neuSmall]}
        activeOpacity={0.85}
        onPress={() => router.push('/support-chat')}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'الدعم' : 'Support'}
      >
        <View style={styles.supportBarIcon}>
          <MaterialCommunityIcons name="headset" size={20} color="#10B981" />
        </View>
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={[styles.supportBarTitle, { color: COLORS.text }]}>
            {isRTL ? 'تواصل مع فريق الدعم' : 'Contact the support team'}
          </Text>
          <Text style={[styles.supportBarSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
            {isRTL ? 'مساعدة في الطلبات أو حسابك' : 'Help with jobs or your account'}
          </Text>
        </View>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Tabs */}
      <View style={[styles.tabsContainer, SHADOWS.neuFlat]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'available' && [styles.activeTab, { backgroundColor: COLORS.primary }]
          ]}
          onPress={() => setActiveTab('available')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'available' ? '#fff' : COLORS.textSecondary }
          ]}>
            {isRTL ? `طلبات متاحة (${availableOrders.length})` : `Available (${availableOrders.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'my-orders' && [styles.activeTab, { backgroundColor: COLORS.primary }]
          ]}
          onPress={() => setActiveTab('my-orders')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'my-orders' ? '#fff' : COLORS.textSecondary }
          ]}>
            {isRTL ? `طلباتي (${myOrders.length})` : `My Orders (${myOrders.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
              {isRTL ? 'جاري التحميل...' : 'Loading...'}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {activeTab === 'available' ? (
              availableOrders.length > 0 ? (
                availableOrders.map(order => renderOrderCard(order, true))
              ) : (
                renderEmptyState()
              )
            ) : (
              myOrders.length > 0 ? (
                myOrders.map(order => renderOrderCard(order, false))
              ) : (
                renderEmptyState()
              )
            )}
          </ScrollView>
        )}
      </Animated.View>

    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTextContainer: {
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  newBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  newDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyCta: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 18,
  },
  emptyCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  availabilityCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  availabilityRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  availabilityDot: { width: 10, height: 10, borderRadius: 5 },
  availabilityTitle: { fontSize: 15, fontWeight: '700' },
  availabilitySub: { fontSize: 12, marginTop: 2 },
  manageServicesBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: 4,
  },
  manageServicesText: { fontSize: 14, fontWeight: '700' },
  supportBar: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm + 2,
  },
  supportBarIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#10B98118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBarTitle: { fontSize: 13, fontWeight: '800' },
  supportBarSub: { fontSize: 11, marginTop: 1 },
  tabsContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: 4,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  activeTab: {
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 120,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  orderHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  orderHeaderLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  orderInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderSubtitle: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  detailRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  acceptButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    maxHeight: '70%',
  },
  modalSection: {
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  deviceHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  deviceIconLarge: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceHeaderInfo: {
    flex: 1,
  },
  deviceBrand: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deviceModel: {
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  issueDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  infoRowModal: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  infoLabelModal: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValueModal: {
    fontSize: 14,
    flex: 1,
    textAlign: isRTL ? 'left' : 'right',
  },
  addressText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  mapButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonModal: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  acceptButtonTextModal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
