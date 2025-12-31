import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Animated, StatusBar, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import BottomNav from '../../components/BottomNav';
import { auth } from '../../lib/supabase-api';

export default function ProfileScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    white: '#ffffff',
    danger: '#ef4444',
  };

  const [user, setUser] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadUser();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadUser = async () => {
    const currentUser = await auth.getCurrentUser();
    if (currentUser) {
      const profile = await auth.getUserProfile(currentUser.id);
      setUser(profile);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Logout',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRTL ? 'خروج' : 'Logout', style: 'destructive', onPress: async () => {
          await auth.signOut();
          router.replace('/role-selection');
        }}
      ]
    );
  };

  const handleMenuPress = (id: string) => {
    switch (id) {
      case 'orders':
        router.push('/(customer)/orders');
        break;
      case 'help':
        router.push('/contact');
        break;
      default:
        Alert.alert(
          isRTL ? 'قريباً' : 'Coming Soon',
          isRTL ? 'هذه الميزة ستكون متاحة في التحديث القادم' : 'This feature will be available in the next update'
        );
    }
  };

  const MENU_ITEMS = [
    { id: 'orders', icon: 'receipt-outline', labelAr: 'طلباتي', labelEn: 'My Orders' },
    { id: 'wallet', icon: 'wallet-outline', labelAr: 'المحفظة', labelEn: 'Wallet' },
    { id: 'address', icon: 'location-outline', labelAr: 'عناويني', labelEn: 'Addresses' },
    { id: 'notifications', icon: 'notifications-outline', labelAr: 'الإشعارات', labelEn: 'Notifications' },
    { id: 'settings', icon: 'settings-outline', labelAr: 'الإعدادات', labelEn: 'Settings' },
    { id: 'help', icon: 'help-circle-outline', labelAr: 'المساعدة والدعم', labelEn: 'Help & Support' },
  ];

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'الملف الشخصي' : 'Profile'}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Image 
                source={{ uri: `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=10b981&color=fff` }} 
                style={styles.avatar} 
              />
              <TouchableOpacity style={styles.editAvatarBtn}>
                <Ionicons name="camera" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>{user?.name || (isRTL ? 'مستخدم' : 'User')}</Text>
            <Text style={styles.userEmail}>{user?.email || (isRTL ? 'لا يوجد بريد' : 'No email')}</Text>
            
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => router.push('/(customer)/orders')}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>{isRTL ? 'طلب' : 'Orders'}</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>4.9</Text>
                <Text style={styles.statLabel}>{isRTL ? 'تقييم' : 'Rating'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => handleMenuPress(item.id)}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.icon as any} size={22} color={COLORS.text} />
                  </View>
                  <Text style={styles.menuLabel}>{isRTL ? item.labelAr : item.labelEn}</Text>
                </View>
                <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color={COLORS.border} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
            <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Logout'}</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
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
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white },
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
