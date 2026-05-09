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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { translations } from '../constants/translations';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { RTLMaterialIcon } from './RTLIcon';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_W * 0.85);

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface Row {
  icon: any;
  label: string;
  route: string;
  iconLib?: 'ion' | 'mc';
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const router = useRouter();
  const { language, setLanguage, isDark, toggleTheme } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const t = translations[language];

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [adminChecked, setAdminChecked] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setAdminChecked(false);
      return;
    }
    Promise.resolve(
      supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
    )
      .then(({ data }: any) => {
        if (!cancelled) setAdminChecked(data?.is_admin === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isAdmin = adminChecked === true || (userProfile as any)?.is_admin === true;
  const displayName = userProfile?.name?.trim() || user?.email?.split('@')[0] || (isRTL ? 'ضيف' : 'Guest');
  const displayEmail = userProfile?.email || user?.email || '';

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const goto = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 80);
  };

  const handleLogout = () => {
    Alert.alert(
      t.logout,
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: t.logout,
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              onClose();
              router.replace('/role-selection');
            } catch (err) {
              logger.warn('Logout failed', err);
            }
          },
        },
      ]
    );
  };

  // Only routes that actually exist in the app. Dead links removed.
  const main: Row[] = [
    { icon: 'home-outline',     label: isRTL ? 'الرئيسية' : 'Home',         route: '/(customer)' },
    { icon: 'receipt-outline',  label: isRTL ? 'طلباتي' : 'My orders',      route: '/(customer)/orders' },
    { icon: 'person-outline',   label: isRTL ? 'حسابي' : 'Profile',         route: '/(customer)/profile' },
    { icon: 'calculator-outline', label: isRTL ? 'حاسبة الأسعار' : 'Price calc', route: '/(customer)/calculator' },
  ];

  const account: Row[] = [
    { icon: 'location-outline',     label: isRTL ? 'عناويني' : 'Addresses',         route: '/addresses' },
    { icon: 'wallet-outline',       label: isRTL ? 'محفظتي' : 'Wallet',             route: '/wallet' },
    { icon: 'notifications-outline', label: isRTL ? 'إشعاراتي' : 'Notifications',   route: '/notifications-settings' },
    { icon: 'settings-outline',     label: isRTL ? 'الإعدادات' : 'Settings',        route: '/settings' },
    { icon: 'help-circle-outline',  label: isRTL ? 'الدعم' : 'Help & support',      route: '/contact' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={staticStyles.overlay}>
        <TouchableOpacity style={staticStyles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles(COLORS, isRTL).drawer,
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: SPACING.lg }}>
            {/* User card */}
            <View style={[styles(COLORS, isRTL).header, { backgroundColor: COLORS.primary + '12' }]}>
              <View style={[styles(COLORS, isRTL).avatar, { backgroundColor: COLORS.primary }]}>
                {(userProfile as any)?.avatar_url ? (
                  <Image source={{ uri: (userProfile as any).avatar_url }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                    {(displayName.trim()[0] || '?').toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={[styles(COLORS, isRTL).userName, { color: COLORS.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              {!!displayEmail && (
                <Text style={[styles(COLORS, isRTL).userEmail, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {displayEmail}
                </Text>
              )}
              {isAdmin && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: '#fbbf2425', paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 999, marginTop: 8,
                }}>
                  <MaterialCommunityIcons name="shield-star" size={12} color="#d97706" />
                  <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '700' }}>
                    {isRTL ? 'مسؤول' : 'Admin'}
                  </Text>
                </View>
              )}
            </View>

            {/* Admin shortcut — appears at the top, super prominent */}
            {isAdmin && (
              <View style={{ paddingHorizontal: SPACING.md }}>
                <TouchableOpacity
                  onPress={() => goto('/admin')}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center',
                    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14,
                    borderRadius: BORDER_RADIUS.lg, gap: 12, marginBottom: SPACING.lg,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? 'لوحة الإدارة' : 'Admin panel'}
                >
                  <MaterialCommunityIcons name="shield-star" size={22} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      {isRTL ? 'لوحة الإدارة' : 'Admin panel'}
                    </Text>
                    <Text style={{ color: '#ffffffaa', fontSize: 12 }}>
                      {isRTL ? 'فنيين، دعم، إحصائيات' : 'Verifications, support, stats'}
                    </Text>
                  </View>
                  <RTLMaterialIcon name="chevron-right" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <Section title={isRTL ? 'القائمة الرئيسية' : 'MAIN'} COLORS={COLORS} isRTL={isRTL}>
              {main.map((row) => (
                <SidebarRow key={row.route} {...row} onPress={() => goto(row.route)} COLORS={COLORS} isRTL={isRTL} />
              ))}
            </Section>

            <Section title={isRTL ? 'حسابي' : 'ACCOUNT'} COLORS={COLORS} isRTL={isRTL}>
              {account.map((row) => (
                <SidebarRow key={row.route} {...row} onPress={() => goto(row.route)} COLORS={COLORS} isRTL={isRTL} />
              ))}
            </Section>

            {/* Compact preferences row */}
            <View style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.md }}>
              <View style={[styles(COLORS, isRTL).pref, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialCommunityIcons
                    name={isDark ? 'moon-waning-crescent' : 'white-balance-sunny'}
                    size={20}
                    color={isDark ? '#7c3aed' : '#f59e0b'}
                  />
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                    {isRTL ? 'الوضع الداكن' : 'Dark mode'}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
                  thumbColor={isDark ? COLORS.primary : '#fff'}
                />
              </View>
              <TouchableOpacity
                onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                style={[styles(COLORS, isRTL).pref, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                accessibilityRole="button"
              >
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="language" size={20} color={COLORS.primary} />
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                    {isRTL ? 'اللغة' : 'Language'}
                  </Text>
                </View>
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                  {language === 'ar' ? 'English' : 'العربية'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Logout */}
            <View style={{ paddingHorizontal: SPACING.md, marginTop: SPACING.md }}>
              <TouchableOpacity
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 14, borderRadius: BORDER_RADIUS.lg, gap: 10,
                  backgroundColor: '#ef444415', borderWidth: 1, borderColor: '#ef444433',
                }}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>
                  {isRTL ? 'تسجيل الخروج' : 'Sign out'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={{ textAlign: 'center', color: COLORS.textSecondary, fontSize: 11, marginTop: SPACING.lg }}>
              Fixatee · v1.0.0
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Section({ title, children, COLORS, isRTL }: any) {
  return (
    <View style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.md }}>
      <Text
        style={{
          color: COLORS.textSecondary,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.2,
          marginBottom: 8,
          paddingHorizontal: 4,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {title}
      </Text>
      <View style={{ borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }}>
        {children}
      </View>
    </View>
  );
}

function SidebarRow({ icon, label, onPress, COLORS, isRTL }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        gap: 12,
      }}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={{ flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
      <RTLMaterialIcon name="chevron-right" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

const staticStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flexDirection: 'row',
  },
  backdrop: { flex: 1 },
});

const styles = (COLORS: any, isRTL: boolean) =>
  StyleSheet.create({
    drawer: {
      position: 'absolute',
      [isRTL ? 'right' : 'left']: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      backgroundColor: COLORS.background,
      borderTopRightRadius: isRTL ? 0 : 24,
      borderBottomRightRadius: isRTL ? 0 : 24,
      borderTopLeftRadius: isRTL ? 24 : 0,
      borderBottomLeftRadius: isRTL ? 24 : 0,
    },
    header: {
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    userName: { fontSize: 17, fontWeight: '800' },
    userEmail: { fontSize: 12, marginTop: 2 },
    pref: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      marginBottom: 8,
    },
  });
