import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Animated, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { RTLIonicon } from '../../components/RTLIcon';
import { getColors, getShadows, BORDER_RADIUS } from '../../constants/theme';
import { PressableScale } from '../../components/ui/PressableScale';
import { supabase } from '../../services/supabaseClient';
import { getTechnicianRating } from '../../services/reviewService';
import Avatar from '../../components/Avatar';

export default function TechnicianProfile() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const themeColors = getColors(isDark);

  const COLORS = {
    primary: themeColors.primary,
    background: themeColors.background,
    card: themeColors.card,
    text: themeColors.text,
    textSecondary: themeColors.textSecondary,
    border: themeColors.border,
    white: themeColors.card,
    cardAlt: themeColors.cardAlt,
    primarySoft: themeColors.primarySoft,
    errorSoft: themeColors.errorSoft,
    danger: themeColors.error,
  };

  const { user: authUser, userProfile, signOut } = useAuth();
  const [stats, setStats] = useState<{ total: number; completed: number; rating: number; ratingCount: number; years: number }>({
    total: 0, completed: 0, rating: 0, ratingCount: 0, years: 0,
  });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    loadStats();
  }, [authUser?.id]);

  const loadStats = async () => {
    if (!authUser?.id) return;
    const [{ count: total }, { count: completed }, { data: tech }, ratingSummary] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id).eq('status', 'completed'),
      supabase.from('technicians').select('years_of_experience').eq('user_id', authUser.id).maybeSingle(),
      getTechnicianRating(authUser.id),
    ]);
    setStats({
      total: total ?? 0,
      completed: completed ?? 0,
      rating: Number(ratingSummary?.average_rating ?? 0),
      ratingCount: Number(ratingSummary?.rating_count ?? 0),
      years: Number(tech?.years_of_experience ?? 0),
    });
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Logout',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRTL ? 'خروج' : 'Logout', style: 'destructive', onPress: async () => {
          try { await signOut(); } catch {}
          router.replace('/role-selection');
        }}
      ]
    );
  };

  const MENU_ITEMS = [
    { id: 'my-orders', icon: 'clipboard-outline', labelAr: 'طلباتي المكتملة', labelEn: 'Completed Jobs' },
    { id: 'availability', icon: 'toggle-outline', labelAr: 'الخدمات المتاحة', labelEn: 'Service Availability' },
    { id: 'earnings', icon: 'wallet-outline', labelAr: 'سجل الأرباح', labelEn: 'Earnings History' },
    { id: 'skills', icon: 'construct-outline', labelAr: 'المهارات والخبرات', labelEn: 'Skills & Experience' },
    { id: 'notifications', icon: 'notifications-outline', labelAr: 'الإشعارات', labelEn: 'Notifications' },
    { id: 'settings', icon: 'settings-outline', labelAr: 'الإعدادات', labelEn: 'Settings' },
    { id: 'help', icon: 'help-circle-outline', labelAr: 'الدعم الفني', labelEn: 'Tech Support' },
  ];

  const SHADOWS = getShadows(isDark);
  const styles = createStyles(COLORS, isRTL, SHADOWS);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'ملف الفني' : 'Tech Profile'}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Avatar
                name={userProfile?.name}
                uri={userProfile?.avatar_url}
                size={100}
                style={styles.avatar}
              />
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={18} color="#fff" />
              </View>
            </View>
            <Text style={styles.userName}>{userProfile?.name || (isRTL ? 'فني معتمد' : 'Certified Tech')}</Text>
            <Text style={styles.userEmail}>{userProfile?.email || authUser?.email || (isRTL ? 'فني صيانة' : 'Repair Technician')}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>{isRTL ? 'مكتملة' : 'Completed'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {stats.rating > 0 ? `${stats.rating.toFixed(1)}★` : '—'}
                </Text>
                <Text style={styles.statLabel}>
                  {stats.ratingCount > 0
                    ? `${stats.ratingCount} ${isRTL ? 'تقييم' : 'reviews'}`
                    : (isRTL ? 'تقييم' : 'Rating')}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.years > 0 ? `+${stats.years}` : '—'}</Text>
                <Text style={styles.statLabel}>{isRTL ? 'سنة' : 'Years'}</Text>
              </View>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item) => (
              <PressableScale key={item.id} to={0.985} style={styles.menuItem} onPress={() => {
                if (item.id === 'availability') router.push('/(technician)/service-availability');
                else if (item.id === 'earnings') router.push('/(technician)/earnings');
                else if (item.id === 'my-orders') router.push('/(technician)/my-orders');
                else if (item.id === 'notifications') router.push('/notifications-settings');
                else if (item.id === 'settings') router.push('/settings');
                else if (item.id === 'help') router.push('/contact');
                else if (item.id === 'skills') router.push('/technician-onboarding');
              }}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon as any} size={22} color={COLORS.text} />
                  </View>
                  <Text style={styles.menuLabel}>{isRTL ? item.labelAr : item.labelEn}</Text>
                </View>
                <RTLIonicon name="chevron-forward" size={18} color={COLORS.textSecondary} />
              </PressableScale>
            ))}
          </View>

          {/* Logout Button */}
          <PressableScale to={0.985} style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
            <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Logout'}</Text>
          </PressableScale>
        </Animated.View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean, SHADOWS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingVertical: 14, alignItems: isRTL ? 'flex-end' : 'flex-start', justifyContent: 'center', backgroundColor: COLORS.background },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  scrollContent: { padding: 16 },
  profileCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xxl, padding: 24, alignItems: 'center', marginBottom: 24, ...SHADOWS.small },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { borderWidth: 4, borderColor: COLORS.primarySoft },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  userName: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  userEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 24, width: '100%', justifyContent: 'space-around', paddingTop: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  menuSection: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, padding: 6, marginBottom: 24, ...SHADOWS.small },
  menuItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuItemLeft: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 16 },
  menuIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  logoutButton: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 52, backgroundColor: COLORS.errorSoft, borderRadius: BORDER_RADIUS.md, marginBottom: 24 },
  logoutText: { fontSize: 16, fontWeight: 'bold', color: COLORS.danger },
});
