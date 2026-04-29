import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Switch,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { translations } from '../constants/translations';
import api from '../lib/supabase-api';
import { logger } from '../utils/logger';
import { RTLMaterialIcon } from './RTLIcon';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

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

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [user, setUser] = useState<any>(null);
  const t = translations[language];

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.getCurrentUser();
      if (currentUser) {
        const profile = await api.auth.getUserProfile(currentUser.id);
        setUser(profile);
      }
    } catch (error) {
      logger.debug('User not logged in');
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
              logger.error('Logout error', error);
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
      color: '#10B981',
    },
    {
      icon: 'shopping-cart',
      label: language === 'ar' ? 'طلباتي' : 'My Orders',
      route: '/(customer)/orders',
      color: '#3B82F6',
    },
    {
      icon: 'history',
      label: language === 'ar' ? 'السجل' : 'History',
      route: '/(customer)/history',
      color: '#8B5CF6',
    },
    {
      icon: 'heart',
      label: language === 'ar' ? 'المفضلة' : 'Favorites',
      route: '/(customer)/favorites',
      color: '#EC4899',
    },
  ];

  const settingItems = [
    {
      icon: 'account-circle',
      label: language === 'ar' ? 'الملف الشخصي' : 'Profile',
      route: '/(customer)/profile',
      color: '#F59E0B',
    },
    {
      icon: 'bell',
      label: language === 'ar' ? 'الإشعارات' : 'Notifications',
      route: '/(customer)/notifications',
      color: '#06B6D4',
    },
    {
      icon: 'lock',
      label: language === 'ar' ? 'الخصوصية' : 'Privacy',
      route: '/(customer)/privacy',
      color: '#6366F1',
    },
  ];

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [
                {
                  translateX: isRTL
                    ? slideAnim.interpolate({
                        inputRange: [-DRAWER_WIDTH, 0],
                        outputRange: [DRAWER_WIDTH, 0],
                      })
                    : slideAnim,
                },
              ],
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header with Gradient Background */}
            <View style={[styles.header, { backgroundColor: COLORS.primary + '15' }]}>
              <View style={[styles.avatarContainer, { backgroundColor: COLORS.primary }]}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                ) : (
                  <MaterialIcons name="account-circle" size={50} color="#fff" />
                )}
              </View>
              <Text style={[styles.userName, { color: COLORS.text }]}>
                {user?.name || (language === 'ar' ? 'ضيف' : 'Guest')}
              </Text>
              <Text style={[styles.userEmail, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'العميل المميز' : 'Premium Member'}
              </Text>
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'الرئيسية' : 'MAIN'}
              </Text>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, { backgroundColor: COLORS.card }, SHADOWS.small]}
                  onPress={() => {
                    onClose();
                    router.push(item.route as any);
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: item.color + '20' }]}>
                    <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.menuItemText, { color: COLORS.text }]}>{item.label}</Text>
                  <RTLMaterialIcon name="chevron-right"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Settings Section */}
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'الإعدادات' : 'SETTINGS'}
              </Text>
              {settingItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.settingItem, { backgroundColor: COLORS.card }, SHADOWS.small]}
                  onPress={() => {
                    onClose();
                    router.push(item.route as any);
                  }}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: item.color + '20' }]}>
                      <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={[styles.settingText, { color: COLORS.text }]}>{item.label}</Text>
                  </View>
                  <RTLMaterialIcon name="chevron-right"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Appearance Section */}
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'المظهر' : 'APPEARANCE'}
              </Text>

              {/* Dark Mode Toggle */}
              <View style={[styles.settingItem, { backgroundColor: COLORS.card }, SHADOWS.small]}>
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.settingIcon,
                      { backgroundColor: isDark ? '#7C3AED' : '#FCD34D' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isDark ? 'moon-waning-crescent' : 'white-balance-sunny'}
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <Text style={[styles.settingText, { color: COLORS.text }]}>
                    {language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                  thumbColor={isDark ? COLORS.primary : '#FCD34D'}
                />
              </View>
            </View>

            {/* Language Section */}
            <View style={styles.settingsSection}>
              <Text style={[styles.sectionTitle, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'اللغة' : 'LANGUAGE'}
              </Text>
              <View style={[styles.languageContainer, { backgroundColor: COLORS.card }, SHADOWS.small]}>
                <TouchableOpacity
                  style={[
                    styles.langButton,
                    language === 'en' && [styles.langButtonActive, { backgroundColor: COLORS.primary }],
                  ]}
                  onPress={() => setLanguage('en')}
                >
                  <Text
                    style={[
                      styles.langButtonText,
                      language === 'en' && styles.langButtonTextActive,
                      language === 'en' && { color: '#fff' },
                    ]}
                  >
                    English
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.langButton,
                    language === 'ar' && [styles.langButtonActive, { backgroundColor: COLORS.primary }],
                  ]}
                  onPress={() => setLanguage('ar')}
                >
                  <Text
                    style={[
                      styles.langButtonText,
                      language === 'ar' && styles.langButtonTextActive,
                      language === 'ar' && { color: '#fff' },
                    ]}
                  >
                    العربية
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Logout Button */}
            <View style={styles.logoutSection}>
              <TouchableOpacity
                style={[styles.logoutButton, { backgroundColor: '#EF4444' + '15' }, SHADOWS.small]}
                onPress={handleLogout}
              >
                <MaterialIcons name="logout" size={24} color="#EF4444" />
                <Text style={[styles.logoutText, { color: '#EF4444' }]}>
                  {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* App Version */}
            <Text style={[styles.version, { color: COLORS.textSecondary }]}>Fixate v1.0.0</Text>
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
      flexDirection: 'row',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
      flex: 1,
    },
    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      backgroundColor: COLORS.background,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
    },
    scrollContent: {
      paddingVertical: SPACING.lg,
    },

    // Header
    header: {
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.lg,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
    },
    avatarContainer: {
      width: 70,
      height: 70,
      borderRadius: 35,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
    },
    userName: {
      fontSize: 16,
      fontWeight: '700',
      marginTop: SPACING.sm,
    },
    userEmail: {
      fontSize: 12,
      marginTop: 4,
    },

    // Menu Section
    menuSection: {
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.lg,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: SPACING.md,
      letterSpacing: 1,
      paddingHorizontal: SPACING.sm,
    },
    menuItem: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.sm,
    },
    menuItemIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: isRTL ? 0 : SPACING.md,
      marginLeft: isRTL ? SPACING.md : 0,
    },
    menuItemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },

    // Settings Section
    settingsSection: {
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.lg,
    },
    settingItem: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.sm,
    },
    settingLeft: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: isRTL ? 0 : SPACING.md,
      marginLeft: isRTL ? SPACING.md : 0,
    },
    settingText: {
      fontSize: 15,
      fontWeight: '600',
    },

    // Language Container
    languageContainer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.sm,
      gap: SPACING.sm,
    },
    langButton: {
      flex: 1,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    langButtonActive: {},
    langButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    langButtonTextActive: {},

    // Logout Section
    logoutSection: {
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.lg,
      marginTop: SPACING.lg,
    },
    logoutButton: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      gap: SPACING.sm,
    },
    logoutText: {
      fontSize: 15,
      fontWeight: '600',
    },

    // Version
    version: {
      textAlign: 'center',
      fontSize: 12,
      marginTop: SPACING.lg,
      marginBottom: SPACING.lg,
    },
  });
}
