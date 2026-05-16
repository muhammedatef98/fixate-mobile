import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Animated, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import BottomNavTech from '../../components/BottomNavTech';
import { RTLIonicon } from '../../components/RTLIcon';
import { getColors } from '../../constants/theme';
import { supabase } from '../../services/supabaseClient';

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
    danger: '#ef4444',
  };

  const { user: authUser, userProfile, signOut } = useAuth();
  const [stats, setStats] = useState<{ total: number; completed: number; rating: number; years: number }>({
    total: 0, completed: 0, rating: 0, years: 0,
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
    const [{ count: total }, { count: completed }, { data: tech }] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('technician_id', authUser.id).eq('status', 'completed'),
      supabase.from('technicians').select('rating, years_of_experience').eq('user_id', authUser.id).maybeSingle(),
    ]);
    setStats({
      total: total ?? 0,
      completed: completed ?? 0,
      rating: Number(tech?.rating ?? 0),
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

  const styles = createStyles(COLORS, isRTL);

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
              <Image 
                source={{ uri: `https://ui-avatars.com/api/?name=${userProfile?.name || 'Tech'}&background=10b981&color=fff` }} 
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
                <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : '—'}</Text>
                <Text style={styles.statLabel}>{isRTL ? 'تقييم' : 'Rating'}</Text>
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
              <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => {
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
                <RTLIonicon name="chevron-forward" size={18} color={COLORS.border} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
            <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Logout'}</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNavTech />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContent: { padding: 16 },
  profileCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#ecfdf5' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  userName: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  userEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 24, width: '100%', justifyContent: 'space-around', paddingTop: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  menuSection: { backgroundColor: COLORS.white, borderRadius: 24, padding: 8, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  menuItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  menuItemLeft: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 16 },
  menuIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  logoutButton: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, backgroundColor: '#fef2f2', borderRadius: 20, marginBottom: 24 },
  logoutText: { fontSize: 16, fontWeight: 'bold', color: COLORS.danger },
});
