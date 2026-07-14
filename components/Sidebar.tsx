/**
 * Sidebar — the hamburger drawer.
 *
 * Animation model:
 *   open  → backdrop fades 0 → 1 (220ms ease-out) AND drawer springs in
 *           from the trailing edge (friction 9, tension 60). Rows stagger
 *           in with a 30ms cascade so the drawer "settles" before the
 *           user starts scanning.
 *   close → backdrop fades back AND drawer springs out. We keep the
 *           Modal mounted via a local `mounted` flag so the exit
 *           animation actually plays before unmount (RN's Modal otherwise
 *           snaps closed the moment `visible` flips).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  ScrollView,
  Switch,
  Dimensions,
  Alert,
  Easing,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { translations } from '../constants/translations';
import { logger } from '../utils/logger';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { RTLMaterialIcon } from './RTLIcon';
import Avatar from './Avatar';
import { AnimatedTouchable } from './ui/PressableScale';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_W * 0.88);
const ROW_STAGGER_MS = 30;

const buildRowAnim = (fade: Animated.Value, index: number, isRTL: boolean) => {
  const delay = index * ROW_STAGGER_MS;
  const start = Math.min(1, 0.4 + delay / 1000);
  return {
    opacity: fade.interpolate({
      inputRange: [0, start, 1],
      outputRange: [0, 0, 1],
    }),
    transform: [
      {
        translateX: fade.interpolate({
          inputRange: [0, start, 1],
          outputRange: [isRTL ? 12 : -12, isRTL ? 12 : -12, 0],
        }),
      },
    ],
  };
};

type RowAnim = ReturnType<typeof buildRowAnim>;

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface Row {
  icon: string;
  label: string;
  route: string;
  color: string;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const router = useRouter();
  const { language, setLanguage, isDark, toggleTheme } = useApp();
  const { user, userProfile, signOut, refreshUser } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const t = translations[language];
  const { isAdmin } = useIsAdmin();

  // Mirror the same email-as-name detection used on the customer profile so
  // the drawer never reads "muhammedatef998" as the user's display name.
  // Anything that looks like an email (contains @) or matches the email's
  // local part is treated as a placeholder and we fall back to the greeting.
  const rawName = userProfile?.name?.trim() ?? '';
  const authEmail = (user?.email ?? '').trim();
  const emailLocalPart = authEmail.split('@')[0]?.trim() ?? '';
  const isPlaceholderName =
    !rawName
    || rawName.includes('@')
    || (!!emailLocalPart && rawName.toLowerCase() === emailLocalPart.toLowerCase());
  const displayName = isPlaceholderName
    ? (isRTL ? 'أهلاً بك' : 'Welcome')
    : rawName;
  // Email and phone are intentionally not rendered in the drawer — the
  // hero card only shows the user's name (plus the verified check) so
  // contact details stay tucked inside the profile screen.
  const isVerified = !!(userProfile as { is_verified?: boolean } | null)?.is_verified;

  // Keep the modal mounted long enough to play the exit animation.
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(visible ? 0 : 1)).current; // 0=open, 1=closed
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Pull a fresh userProfile every time the drawer opens so changes made
  // in Edit Profile (name, phone, avatar) are reflected without forcing a
  // full app reload.
  useEffect(() => {
    if (visible && typeof refreshUser === 'function') {
      refreshUser().catch(() => undefined);
    }
  }, [visible, refreshUser]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slide, {
          toValue: 0,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, fade, slide]);

  const goto = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as never), 220);
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

  const main: Row[] = [
    { icon: 'home-outline',       label: isRTL ? 'الرئيسية' : 'Home',       route: '/(customer)',         color: '#10b981' },
    { icon: 'receipt-outline',    label: isRTL ? 'طلباتي'  : 'My orders',   route: '/(customer)/orders',  color: '#3b82f6' },
    { icon: 'storefront-outline', label: isRTL ? 'السوق'   : 'Marketplace', route: '/market',             color: '#f59e0b' },
    { icon: 'person-outline',     label: isRTL ? 'حسابي'   : 'Profile',     route: '/(customer)/profile', color: '#8b5cf6' },
  ];

  const account: Row[] = [
    { icon: 'location-outline',      label: isRTL ? 'عناويني' : 'Addresses',     route: '/addresses',              color: '#f59e0b' },
    { icon: 'wallet-outline',        label: isRTL ? 'محفظتي'  : 'Wallet',        route: '/wallet',                 color: '#10b981' },
    { icon: 'notifications-outline', label: isRTL ? 'إشعاراتي' : 'Notifications', route: '/notifications-settings', color: '#3b82f6' },
    { icon: 'settings-outline',      label: isRTL ? 'الإعدادات' : 'Settings',    route: '/settings',               color: '#64748b' },
    { icon: 'help-circle-outline',   label: isRTL ? 'الدعم'   : 'Help & support', route: '/contact',                color: '#8b5cf6' },
  ];

  if (!mounted) return null;

  const drawerTranslateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH],
  });

  const s = styles(COLORS, isRTL);

  // Each row gets a small delay so they cascade in. Values derive from
  // the global `fade` so we don't manage N separate Animated.Values —
  // cheap and synchronised with the master open/close.
  const rowAnim = (index: number) => buildRowAnim(fade, index, isRTL);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={staticStyles.overlay}>
        <Animated.View
          style={[
            staticStyles.backdrop,
            { opacity: fade, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.drawer,
            { transform: [{ translateX: drawerTranslateX }] },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 0, paddingBottom: SPACING.xl }}
          >
            {/* Hero user card with primary-tinted background and a curved
                bottom that bleeds the drawer's flat radius into the rest
                of the menu. */}
            <Animated.View
              style={[
                s.heroCard,
                { backgroundColor: COLORS.primary, opacity: fade },
              ]}
            >
              {/* Soft decorative orbs for depth */}
              <View pointerEvents="none" style={[s.orb, s.orb1]} />
              <View pointerEvents="none" style={[s.orb, s.orb2]} />

              <View style={s.heroTop}>
                <View style={s.heroAvatarWrap}>
                  <Avatar
                    name={displayName}
                    uri={(userProfile as { avatar_url?: string } | null)?.avatar_url}
                    size={56}
                  />
                  <View style={s.heroAvatarDot} />
                </View>
                <AnimatedTouchable onPress={onClose} style={s.heroClose} accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}>
                  <Ionicons name="close" size={20} color="#fff" />
                </AnimatedTouchable>
              </View>

              {/* The badge must sit on the name's optical centre line. The row —
                  not the <Text> — carries the top margin: a margin on the text
                  alone pushed it down inside a taller row, leaving the icon
                  floating above the letters. flexShrink lets a long name
                  ellipsize instead of shoving the badge off the card. */}
              <View style={s.heroNameRow}>
                <Text style={s.heroName} numberOfLines={1}>{displayName}</Text>
                {isVerified ? (
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={16}
                    color="#fff"
                    style={s.heroVerified}
                  />
                ) : null}
              </View>

              {isAdmin && (
                <View style={s.heroAdminPill}>
                  <MaterialCommunityIcons name="shield-star" size={11} color="#fff" />
                  <Text style={s.heroAdminText}>
                    {isRTL ? 'مسؤول النظام' : 'System Admin'}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Admin shortcut */}
            {isAdmin && (
              <Animated.View style={[{ paddingHorizontal: SPACING.md, marginTop: 14 }, rowAnim(0)]}>
                <AnimatedTouchable
                  onPress={() => goto('/admin')}
                  style={[s.adminBtn, { backgroundColor: COLORS.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? 'لوحة الإدارة' : 'Admin panel'}
                >
                  <View style={s.adminIconBubble}>
                    <MaterialCommunityIcons name="shield-star" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.adminTitle}>
                      {isRTL ? 'لوحة الإدارة' : 'Admin panel'}
                    </Text>
                    <Text style={s.adminSubtitle}>
                      {isRTL ? 'فنيين، دعم، إحصائيات' : 'Verifications, support, stats'}
                    </Text>
                  </View>
                  <RTLMaterialIcon name="chevron-right" size={20} color="#fff" />
                </AnimatedTouchable>
              </Animated.View>
            )}

            <SidebarSection
              title={isRTL ? 'القائمة الرئيسية' : 'MAIN'}
              COLORS={COLORS}
              isRTL={isRTL}
              startIndex={isAdmin ? 1 : 0}
              rowAnim={rowAnim}
              rows={main}
              onPress={goto}
            />

            <SidebarSection
              title={isRTL ? 'حسابي' : 'ACCOUNT'}
              COLORS={COLORS}
              isRTL={isRTL}
              startIndex={isAdmin ? 1 + main.length : main.length}
              rowAnim={rowAnim}
              rows={account}
              onPress={goto}
            />

            {/* Preferences */}
            <Animated.View
              style={[
                { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
                rowAnim(main.length + account.length + (isAdmin ? 1 : 0)),
              ]}
            >
              <Text style={s.sectionLabel}>
                {isRTL ? 'التفضيلات' : 'PREFERENCES'}
              </Text>
              <View style={[s.prefCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={s.prefRow}>
                  <View style={s.prefLeft}>
                    <View style={[s.prefIcon, { backgroundColor: (isDark ? '#7c3aed' : '#f59e0b') + '18' }]}>
                      <MaterialCommunityIcons
                        name={isDark ? 'moon-waning-crescent' : 'white-balance-sunny'}
                        size={18}
                        color={isDark ? '#7c3aed' : '#f59e0b'}
                      />
                    </View>
                    <Text style={s.prefLabel}>
                      {isRTL ? 'الوضع الداكن' : 'Dark mode'}
                    </Text>
                  </View>
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={[s.prefDivider, { backgroundColor: COLORS.border }]} />
                <Pressable
                  style={s.prefRow}
                  onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                  accessibilityRole="button"
                >
                  <View style={s.prefLeft}>
                    <View style={[s.prefIcon, { backgroundColor: COLORS.primary + '18' }]}>
                      <Ionicons name="language" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={s.prefLabel}>
                      {isRTL ? 'اللغة' : 'Language'}
                    </Text>
                  </View>
                  <View style={[s.langPill, { backgroundColor: COLORS.primary + '15' }]}>
                    <Text style={[s.langPillText, { color: COLORS.primary }]}>
                      {language === 'ar' ? 'EN' : 'عربي'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>

            {/* Logout */}
            <Animated.View
              style={[
                { paddingHorizontal: SPACING.md, marginTop: 4 },
                rowAnim(main.length + account.length + (isAdmin ? 2 : 1)),
              ]}
            >
              <AnimatedTouchable
                style={s.logoutBtn}
                onPress={handleLogout}
                accessibilityRole="button"
              >
                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                <Text style={s.logoutText}>
                  {isRTL ? 'تسجيل الخروج' : 'Sign out'}
                </Text>
              </AnimatedTouchable>
            </Animated.View>

            <Text style={[s.footer, { color: COLORS.textSecondary }]}>
              Fixate · v1.0.0
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface SidebarSectionProps {
  title: string;
  COLORS: ReturnType<typeof getColors>;
  isRTL: boolean;
  startIndex: number;
  rowAnim: (i: number) => RowAnim;
  rows: Row[];
  onPress: (route: string) => void;
}

function SidebarSection({ title, COLORS, isRTL, startIndex, rowAnim, rows, onPress }: SidebarSectionProps) {
  const s = styles(COLORS, isRTL);
  return (
    <View style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.md }}>
      <Animated.Text style={[s.sectionLabel, rowAnim(startIndex)]}>{title}</Animated.Text>
      <View style={[s.sectionCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        {rows.map((row, i) => (
          <Animated.View key={row.route} style={rowAnim(startIndex + i)}>
            <SidebarRow
              row={row}
              isLast={i === rows.length - 1}
              onPress={() => onPress(row.route)}
              COLORS={COLORS}
              isRTL={isRTL}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

interface SidebarRowProps {
  row: Row;
  isLast: boolean;
  onPress: () => void;
  COLORS: ReturnType<typeof getColors>;
  isRTL: boolean;
}

function SidebarRow({ row, isLast, onPress, COLORS, isRTL }: SidebarRowProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: COLORS.primary + '15' }}
      style={({ pressed }) => ({
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        gap: 12,
        backgroundColor: pressed ? COLORS.primary + '08' : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={row.label}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          backgroundColor: row.color + '18',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={row.icon as never} size={18} color={row.color} />
      </View>
      <Text style={{ flex: 1, color: COLORS.text, fontSize: 14.5, fontWeight: '700' }}>
        {row.label}
      </Text>
      <RTLMaterialIcon name="chevron-right" size={16} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const staticStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
});

const styles = (COLORS: ReturnType<typeof getColors>, isRTL: boolean) =>
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
      shadowColor: '#000',
      shadowOffset: { width: isRTL ? -8 : 8, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 16,
    },

    heroCard: {
      paddingTop: 50,
      paddingBottom: 22,
      paddingHorizontal: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: 'hidden',
      position: 'relative',
    },
    orb: {
      position: 'absolute',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    orb1: {
      width: 140,
      height: 140,
      top: -50,
      [isRTL ? 'left' : 'right']: -40,
    },
    orb2: {
      width: 90,
      height: 90,
      bottom: -30,
      [isRTL ? 'right' : 'left']: -20,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    heroTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    heroAvatarWrap: { position: 'relative' },
    heroAvatarDot: {
      position: 'absolute',
      [isRTL ? 'left' : 'right']: 2,
      bottom: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#22c55e',
      borderWidth: 3,
      borderColor: COLORS.primary,
    },
    heroClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroNameRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      maxWidth: '100%',
    },
    heroName: {
      color: '#fff',
      fontSize: 19,
      fontWeight: '900',
      flexShrink: 1,
      // No negative tracking on Arabic — it pulls joined glyphs into each other.
      letterSpacing: isRTL ? 0 : -0.3,
      textAlign: isRTL ? 'right' : 'left',
    },
    // Nudge the check onto the cap-height centre of a 19pt name — vertical
    // centring alone leaves it looking a hair high next to a bold line.
    heroVerified: { marginTop: 1 },
    heroEmail: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 12.5,
      marginTop: 2,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    heroAdminPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 12,
    },
    heroAdminText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: isRTL ? 0 : 0.3 },

    adminBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.lg,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 3,
    },
    adminIconBubble: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    adminTitle: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 14.5,
      textAlign: isRTL ? 'right' : 'left',
    },
    adminSubtitle: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11.5,
      marginTop: 1,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },

    sectionLabel: {
      color: COLORS.textSecondary,
      fontSize: isRTL ? 12 : 10.5,
      fontWeight: '800',
      // Arabic is cursive — positive letter-spacing forces gaps between joined
      // letters and makes headings like "القائمة الرئيسية" look broken. Tracking
      // is a Latin-uppercase device only; drop it (and nudge the size up) for AR.
      letterSpacing: isRTL ? 0 : 1.3,
      marginBottom: 8,
      marginTop: 14,
      paddingHorizontal: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionCard: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      borderWidth: 1,
    },

    prefCard: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    prefRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    prefLeft: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
    },
    prefIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prefLabel: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '700',
    },
    prefDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
    langPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    langPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

    logoutBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: BORDER_RADIUS.lg,
      gap: 8,
      backgroundColor: '#ef444412',
      borderWidth: 1,
      borderColor: '#ef444433',
    },
    logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

    footer: {
      textAlign: 'center',
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.6,
      marginTop: SPACING.lg,
      opacity: 0.6,
    },
  });
