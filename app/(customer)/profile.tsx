import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import NeuCard from '../../components/NeuCard';
import BottomNav from '../../components/BottomNav';
import { auth, requests } from '../../lib/supabase-api';
import { ActivityIndicator, Alert } from 'react-native';
import { useApp } from '../../contexts/AppContext';

const MENU_ITEMS = [
  { id: 'orders', title: 'My Orders', titleAr: 'طلباتي', icon: 'receipt-long' },
  { id: 'account', title: 'Edit Profile', titleAr: 'تعديل الملف الشخصي', icon: 'person-outline' },
  { id: 'wallet', title: 'Wallet & Payment', titleAr: 'المحفظة وطرق الدفع', icon: 'account-balance-wallet' },
  { id: 'notifications', title: 'Notifications', titleAr: 'الإشعارات', icon: 'notifications-none' },
  { id: 'support', title: 'Support & Help', titleAr: 'الدعم والمساعدة', icon: 'headset-mic' },
  { id: 'about', title: 'About App', titleAr: 'عن التطبيق', icon: 'info-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersCount: 0,
    rating: 5.0, // Default for customer
    years: 1 // Default
  });

  useEffect(() => {
    loadUserAndStats();
  }, []);

  const loadUserAndStats = async () => {
    try {
      const currentUser = await auth.getCurrentUser();
      if (currentUser) {
        const profile = await auth.getUserProfile(currentUser.id);
        setUser(profile);

        // Fetch real stats
        const userRequests = await requests.getAll();
        // Filter requests for this user (assuming getAll returns all, or filtered by RLS)
        // If RLS is on, getAll returns only user's requests
        setStats({
          ordersCount: userRequests.length,
          rating: 5.0, // Customers usually don't have ratings shown to them, but keeping for UI consistency
          years: 1 // Could be calculated from created_at
        });
      }
    } catch (error) {
      console.log('User not logged in or error fetching stats');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (user?.avatar_url) return user.avatar_url;
    
    // Simple heuristic for gender based on name (very basic, just for demo)
    // In a real app, you'd have a gender field in the profile
    const name = user?.name || 'User';
    // Default to male color (blue-ish)
    let background = '0D8ABC'; 
    // If name ends with 'a' or 'ah' (common in female names), use pink-ish
    if (name.endsWith('a') || name.endsWith('ah') || name.endsWith('ة')) {
      background = 'E91E63';
    }
    
    return `https://ui-avatars.com/api/?name=${name}&background=${background}&color=fff&size=128`;
  };

  const handleLogout = async () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Logout',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'تسجيل الخروج' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              router.replace('/role-selection');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleMenuPress = (itemId: string) => {
    switch (itemId) {
      case 'orders':
        router.push('/(customer)/orders');
        break;
      case 'account':
        Alert.alert(
          isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile',
          isRTL ? 'هذه الميزة قريباً!' : 'Coming soon!'
        );
        break;
      case 'wallet':
        Alert.alert(
          isRTL ? 'المحفظة' : 'Wallet',
          isRTL ? 'هذه الميزة قريباً!' : 'Coming soon!'
        );
        break;
      case 'notifications':
        Alert.alert(
          isRTL ? 'الإشعارات' : 'Notifications',
          isRTL ? 'هذه الميزة قريباً!' : 'Coming soon!'
        );
        break;
      case 'support':
        router.push('/contact');
        break;
      case 'about':
        Alert.alert(
          'Fixate',
          isRTL 
            ? 'تطبيق Fixate هو منصة شاملة لخدمات الصيانة والإصلاح. نربط العملاء بأفضل الفنيين المعتمدين لإصلاح الأجهزة الإلكترونية.\n\nالإصدار: 1.0.0' 
            : 'Fixate is a comprehensive platform for maintenance and repair services. We connect customers with the best certified technicians to repair electronic devices.\n\nVersion: 1.0.0'
        );
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backButton, SHADOWS.neuFlat]}
          onPress={() => router.back()}
        >
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={20} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{isRTL ? 'الملف الشخصي' : 'Profile'}</Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Info */}
        <NeuCard style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: getAvatarUrl() }} 
              style={styles.avatar} 
            />
            <TouchableOpacity style={[styles.editAvatarBtn, SHADOWS.primaryGlow]}>
              <MaterialIcons name="camera-alt" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Text style={styles.name}>{user?.name || (isRTL ? 'زائر' : 'Guest User')}</Text>
              <Text style={styles.phone}>{user?.email || user?.phone || (isRTL ? 'غير مسجل' : 'Not logged in')}</Text>
            </>
          )}
        </NeuCard>

        {/* Stats */}
        <NeuCard style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.ordersCount}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'طلب' : 'Orders'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.rating}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'التقييم' : 'Rating'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.years}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'سنة' : 'Year'}</Text>
          </View>
        </NeuCard>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => (
            <NeuCard 
              key={item.id} 
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.id)}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIcon}>
                  <MaterialIcons name={item.icon as any} size={24} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.menuTitle}>{isRTL ? item.titleAr : item.title}</Text>
                </View>
              </View>
              <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={24} color={COLORS.textSecondary} />
            </NeuCard>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={[styles.logoutBtn, SHADOWS.neuFlat]} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Logout'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  profileCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: COLORS.border,
  },
  menuContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
    borderColor: '#EF4444',
    marginBottom: SPACING.md,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: SPACING.lg,
  },
});
