import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Switch,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { translations } from '../constants/translations';
import api from '../lib/supabase-api';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.65; // Reduced from 80% to 65%

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const router = useRouter();
  const { language, setLanguage, isDark, toggleTheme } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const [slideAnim] = useState(new Animated.Value(isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH));
  const [user, setUser] = useState<any>(null);
  
  const t = translations[language];

  React.useEffect(() => {
    loadUser();
  }, []);

  React.useEffect(() => {
    const hiddenPosition = isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH;
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: hiddenPosition,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  }, [visible, isRTL]);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.getCurrentUser();
      if (currentUser) {
        const profile = await api.auth.getUserProfile(currentUser.id);
        setUser(profile);
      }
    } catch (error) {
      console.log('User not logged in');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t.logout,
      language === 'ar' ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        {
          text: language === 'ar' ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: t.logout,
          style: 'destructive',
          onPress: async () => {
            try {
              await api.auth.signOut();
              onClose();
              router.replace('/role-selection');
            } catch (error) {
              console.log('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    { 
      icon: 'home', 
      label: language === 'ar' ? 'الرئيسية' : 'Home',
      route: '/(customer)',
    },
    { 
      icon: 'build', 
      label: language === 'ar' ? 'الخدمات' : 'Services',
      route: '/(customer)/services',
    },
    { 
      icon: 'calculate', 
      label: language === 'ar' ? 'الحاسبة' : 'Calculator',
      route: '/(customer)/calculator',
    },
    { 
      icon: 'person', 
      label: language === 'ar' ? 'حسابي' : 'Profile',
      route: '/(customer)/profile',
    },
  ];

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View 
          style={[
            styles.drawer,
            isRTL && styles.drawerRTL,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header with User Info */}
            <View style={styles.header}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ 
                    uri: user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=10B981&color=fff&size=128` 
                  }} 
                  style={styles.avatar} 
                />
              </View>
              <Text style={styles.userName}>{user?.name || (language === 'ar' ? 'ضيف' : 'Guest')}</Text>
              <Text style={styles.userEmail}>{user?.email || (language === 'ar' ? 'غير مسجل' : 'Not logged in')}</Text>
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{language === 'ar' ? 'القائمة' : 'Menu'}</Text>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    router.push(item.route as any);
                  }}
                >
                  <View style={styles.menuItemIcon}>
                    <MaterialIcons name={item.icon as any} size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.menuItemText}>{item.label}</Text>
                  <MaterialIcons 
                    name={isRTL ? 'chevron-left' : 'chevron-right'} 
                    size={24} 
                    color={COLORS.textSecondary} 
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Settings Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>{language === 'ar' ? 'الإعدادات' : 'Settings'}</Text>
              
              {/* Language Toggle */}
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIcon}>
                    <MaterialIcons name="language" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.settingText}>{language === 'ar' ? 'اللغة' : 'Language'}</Text>
                </View>
                <View style={styles.languageButtons}>
                  <TouchableOpacity
                    style={[styles.langButton, language === 'ar' && styles.langButtonActive]}
                    onPress={() => setLanguage('ar')}
                  >
                    <Text style={[styles.langButtonText, language === 'ar' && styles.langButtonTextActive]}>
                      عربي
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.langButton, language === 'en' && styles.langButtonActive]}
                    onPress={() => setLanguage('en')}
                  >
                    <Text style={[styles.langButtonText, language === 'en' && styles.langButtonTextActive]}>
                      EN
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dark Mode Toggle */}
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIcon}>
                    <MaterialIcons 
                      name={isDark ? 'dark-mode' : 'light-mode'} 
                      size={24} 
                      color={COLORS.primary} 
                    />
                  </View>
                  <Text style={styles.settingText}>
                    {language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={isDark ? COLORS.primary : COLORS.background}
                />
              </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <MaterialIcons name="logout" size={24} color="#EF4444" />
              <Text style={styles.logoutText}>{t.logout}</Text>
            </TouchableOpacity>

            {/* App Version */}
            <Text style={styles.version}>Fixatee v1.0.0</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(COLORS: any, SHADOWS: any, isRTL: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
      flex: 1,
    },
    drawer: {
      width: DRAWER_WIDTH,
      backgroundColor: COLORS.background,
      ...SHADOWS.large,
    },
    drawerRTL: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
    },
    scrollContent: {
      paddingVertical: SPACING.lg,
    },
    header: {
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      marginBottom: SPACING.md,
    },
    avatarContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: COLORS.background,
      ...SHADOWS.neuLarge,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
    },
    userName: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.text,
      marginTop: SPACING.xs,
    },
    userEmail: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    menuSection: {
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      marginBottom: SPACING.md,
      letterSpacing: 1,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      backgroundColor: COLORS.background,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.sm,
      ...SHADOWS.neu,
    },
    menuItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.sm,
    },
    menuItemText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
    },
    settingsSection: {
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      backgroundColor: COLORS.background,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.sm,
      ...SHADOWS.neu,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.sm,
    },
    settingText: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
    },
    languageButtons: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    langButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: COLORS.background,
      ...SHADOWS.neuSmall,
    },
    langButtonActive: {
      backgroundColor: COLORS.primary,
      ...SHADOWS.neuInset,
    },
    langButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    langButtonTextActive: {
      color: '#FFFFFF',
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.background,
      borderRadius: BORDER_RADIUS.lg,
      ...SHADOWS.neu,
      gap: SPACING.sm,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#EF4444',
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: SPACING.lg,
    },
  });
}
