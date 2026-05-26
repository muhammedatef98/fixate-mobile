import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import appConfig from '../app.json';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { safeBack } from '../utils/navigation';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { tapLight } from '../utils/haptics';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { RTLIonicon } from '../components/RTLIcon';
import { sendPasswordReset } from '../services/authService';
import { getFriendlyError } from '../utils/errorMessages';
import { supabase } from '../services/supabaseClient';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage, isDark, toggleTheme } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  // Admin entry is reserved for the single ADMIN_PHONE account (see
  // constants/admin.ts). useIsAdmin resolves the phone from the live
  // session/profile and reports a single boolean.
  const { isAdmin } = useIsAdmin();

  const appVersion = (appConfig as any).expo?.version ?? '1.0.0';

  const handleResetPassword = () => {
    // Use the in-app OTP-based reset flow (forgot-password screen).
    // The email-link flow needed Supabase project SMTP, which isn't
    // configured. The OTP flow uses our send-otp Edge Function and works.
    router.push({
      pathname: '/forgot-password',
      params: { email: user?.email ?? '' },
    } as any);
  };

  const handleDeleteAccount = () => {
    router.push('/(customer)/delete-account');
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack('/(customer)')}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'الإعدادات' : 'Settings'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        {/* Admin shortcut at the very top — bright, hard to miss. Only renders
            for users with users.is_admin = true. */}
        {isAdmin && (
          <TouchableOpacity
            onPress={() => { tapLight(); router.push('/admin'); }}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              backgroundColor: COLORS.primary,
              padding: 14,
              borderRadius: BORDER_RADIUS.lg,
              marginBottom: SPACING.lg,
              gap: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'لوحة الإدارة' : 'Admin panel'}
          >
            <MaterialCommunityIcons name="shield-star" size={24} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                {isRTL ? 'لوحة الإدارة' : 'Admin panel'}
              </Text>
              <Text style={{ color: '#ffffffcc', fontSize: 12, marginTop: 2 }}>
                {isRTL ? 'فنيين، دعم، إحصائيات وأكثر' : 'Verifications, support inbox, stats'}
              </Text>
            </View>
            <RTLIonicon name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        )}

        <Text style={styles.section}>{isRTL ? 'العامة' : 'General'}</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="language" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'اللغة' : 'Language'}</Text>
          </View>
          <View style={styles.langPicker}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'ar' && { backgroundColor: COLORS.primary }]}
              onPress={() => setLanguage('ar')}
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'ar' }}
            >
              <Text style={[styles.langText, language === 'ar' && { color: '#fff' }]}>العربية</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && { backgroundColor: COLORS.primary }]}
              onPress={() => setLanguage('en')}
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'en' }}
            >
              <Text style={[styles.langText, language === 'en' && { color: '#fff' }]}>EN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'الوضع الداكن' : 'Dark mode'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            accessibilityLabel={isRTL ? 'تبديل الوضع الداكن' : 'Toggle dark mode'}
          />
        </View>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/notifications-settings')}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="notifications" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'إعدادات الإشعارات' : 'Notification preferences'}</Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.section}>{isRTL ? 'الحساب' : 'Account'}</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="person" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'تعديل الملف الشخصي' : 'Edit profile'}</Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={handleResetPassword}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="lock-closed" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={handleDeleteAccount}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <MaterialCommunityIcons name="account-remove" size={22} color={COLORS.error} />
            <Text style={[styles.rowText, { color: COLORS.error }]}>
              {isRTL ? 'حذف الحساب' : 'Delete account'}
            </Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.section}>{isRTL ? 'حول التطبيق' : 'About'}</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/terms')}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="document-text" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'الشروط والأحكام' : 'Terms of service'}</Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/privacy')}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'سياسة الخصوصية' : 'Privacy policy'}</Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/contact')}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Ionicons name="help-circle" size={22} color={COLORS.primary} />
            <Text style={styles.rowText}>{isRTL ? 'تواصل معنا' : 'Contact us'}</Text>
          </View>
          <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {isAdmin && (
          <>
            <Text style={styles.section}>{isRTL ? 'الإدارة' : 'Admin'}</Text>
            <TouchableOpacity
              style={styles.row}
              onPress={() => { tapLight(); router.push('/admin-verifications'); }}
              accessibilityRole="button"
            >
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
                <Text style={styles.rowText}>{isRTL ? 'مراجعة طلبات الفنيين' : 'Technician verifications'}</Text>
              </View>
              <RTLIonicon name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.versionRow}>
          <Text style={styles.versionText}>
            {isRTL ? 'إصدار التطبيق' : 'App version'}: {appVersion}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: C.text },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textSecondary,
      textTransform: 'uppercase',
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      textAlign: isRTL ? 'right' : 'left',
    },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.card,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.sm,
      minHeight: 56,
    },
    rowLeft: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: SPACING.md },
    rowText: { color: C.text, fontSize: 15, fontWeight: '500' },
    langPicker: { flexDirection: 'row', backgroundColor: C.background, borderRadius: BORDER_RADIUS.md, padding: 2 },
    langBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: BORDER_RADIUS.md - 2, minHeight: 32, justifyContent: 'center' },
    langText: { color: C.text, fontWeight: '600', fontSize: 13 },
    versionRow: { alignItems: 'center', marginTop: SPACING.xl, paddingBottom: SPACING.lg },
    versionText: { color: C.textSecondary, fontSize: 12 },
  });
