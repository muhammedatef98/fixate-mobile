import React from 'react';
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
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { tapLight } from '../utils/haptics';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { sendPasswordReset } from '../services/authService';
import { getFriendlyError } from '../utils/errorMessages';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage, isDark, toggleTheme } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const isAdmin = (userProfile as any)?.is_admin === true;

  const appVersion = (appConfig as any).expo?.version ?? '1.0.0';

  const handleResetPassword = async () => {
    if (!user?.email) return;
    Alert.alert(
      isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset password',
      isRTL ? `سيتم إرسال رابط إعادة التعيين إلى ${user.email}` : `A reset link will be sent to ${user.email}`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إرسال' : 'Send',
          onPress: async () => {
            try {
              await sendPasswordReset(user.email!);
              Alert.alert(isRTL ? 'تم' : 'Sent', isRTL ? 'تحقّق من بريدك' : 'Check your inbox');
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
            }
          },
        },
      ]
    );
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
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'الإعدادات' : 'Settings'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
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
