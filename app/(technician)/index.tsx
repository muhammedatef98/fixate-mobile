import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Animated, Dimensions, Switch, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/supabase';
import BottomNavTech from '../../components/BottomNavTech';

const { width } = Dimensions.get('window');

export default function TechnicianDashboard() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    secondary: '#059669',
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    white: '#ffffff',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const [isOnline, setIsOnline] = useState(true);
  const [stats, setStats] = useState({
    todayEarnings: 150,
    completedToday: 3,
    pendingOrders: 5,
    rating: 4.9
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const STAT_CARDS = [
    { id: 'earnings', titleAr: 'أرباح اليوم', titleEn: 'Today Earnings', value: `${stats.todayEarnings} ر.س`, icon: 'wallet-outline', color: COLORS.primary },
    { id: 'pending', titleAr: 'طلبات جديدة', titleEn: 'New Orders', value: stats.pendingOrders.toString(), icon: 'notifications-outline', color: COLORS.warning },
    { id: 'completed', titleAr: 'مكتملة اليوم', titleEn: 'Completed', value: stats.completedToday.toString(), icon: 'checkmark-done-outline', color: COLORS.info },
    { id: 'rating', titleAr: 'التقييم', titleEn: 'Rating', value: stats.rating.toString(), icon: 'star-outline', color: '#f59e0b' },
  ];

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.greeting}>{isRTL ? 'مرحباً، فني' : 'Hello, Tech'} 👋</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.primary : COLORS.textSecondary }]} />
            <Text style={styles.statusText}>{isOnline ? (isRTL ? 'متصل' : 'Online') : (isRTL ? 'غير متصل' : 'Offline')}</Text>
          </View>
        </View>
        <Switch
          value={isOnline}
          onValueChange={setIsOnline}
          trackColor={{ false: COLORS.border, true: '#A7F3D0' }}
          thumbColor={isOnline ? COLORS.primary : COLORS.white}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((stat) => (
              <View key={stat.id} style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: stat.color + '15' }]}>
                  <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{isRTL ? stat.titleAr : stat.titleEn}</Text>
              </View>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(technician)/available-orders')}>
                <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
                  <MaterialCommunityIcons name="clipboard-search-outline" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.actionLabel}>{isRTL ? 'طلبات متاحة' : 'Available'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(technician)/my-orders')}>
                <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                  <MaterialCommunityIcons name="clipboard-list-outline" size={28} color={COLORS.info} />
                </View>
                <Text style={styles.actionLabel}>{isRTL ? 'طلباتي' : 'My Jobs'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(technician)/earnings')}>
                <View style={[styles.actionIcon, { backgroundColor: '#fffbeb' }]}>
                  <MaterialCommunityIcons name="finance" size={28} color={COLORS.warning} />
                </View>
                <Text style={styles.actionLabel}>{isRTL ? 'الأرباح' : 'Earnings'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Orders Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{isRTL ? 'أحدث الطلبات' : 'Recent Orders'}</Text>
              <TouchableOpacity onPress={() => router.push('/(technician)/available-orders')}>
                <Text style={styles.seeAllText}>{isRTL ? 'عرض الكل' : 'See All'}</Text>
              </TouchableOpacity>
            </View>
            
            {/* Sample Order Card */}
            <TouchableOpacity style={styles.orderCard} onPress={() => router.push('/(technician)/available-orders')}>
              <View style={styles.orderHeader}>
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceIconContainer}>
                    <MaterialCommunityIcons name="cellphone" size={24} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.deviceName}>iPhone 13 Pro</Text>
                    <Text style={styles.orderId}>#ORD-7829</Text>
                  </View>
                </View>
                <View style={styles.priceBadge}>
                  <Text style={styles.priceText}>250 ر.س</Text>
                </View>
              </View>
              <View style={styles.orderFooter}>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.locationText}>{isRTL ? 'الرياض، حي الملقا' : 'Riyadh, Al Malqa'}</Text>
                </View>
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.timeText}>{isRTL ? 'منذ 5 دقائق' : '5m ago'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNavTech />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', padding: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerInfo: { alignItems: isRTL ? 'flex-end' : 'flex-start' },
  greeting: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  statusRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  scrollContent: { padding: 16 },
  statsGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: (width - 32 - 12) / 2, backgroundColor: COLORS.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  statIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
  seeAllText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  actionRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 12 },
  actionButton: { flex: 1, backgroundColor: COLORS.white, borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  actionIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: 'bold', color: COLORS.text },
  orderCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  orderHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  deviceInfo: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
  deviceIconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  orderId: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  priceBadge: { backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  priceText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  orderFooter: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f9fafb', paddingTop: 12 },
  locationRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: COLORS.textSecondary },
  timeRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: COLORS.textSecondary },
});
