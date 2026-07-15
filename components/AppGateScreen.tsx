import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';

type GateMode = 'maintenance' | 'update';

/**
 * Full-screen app gate — the maintenance / force-update counterpart to
 * BlockedScreen. Rendered by the root layout in place of the whole app when
 * the admin has switched on maintenance mode, or when the running build is
 * older than the admin-set minimum version. No dismiss: it IS the screen.
 */
export default function AppGateScreen({ mode }: { mode: GateMode }) {
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const C = getColors(isDark);

  const isUpdate = mode === 'update';

  const openStore = () => {
    // Store deep links; the plain web URL is a safe fallback if the id/package
    // isn't wired yet. Admins can update these when the listings go live.
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/'
        : 'https://play.google.com/store/apps/';
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: (isUpdate ? C.primary : '#f59e0b') + '18' }]}>
        <MaterialCommunityIcons
          name={isUpdate ? 'cellphone-arrow-down' : 'wrench-clock'}
          size={56}
          color={isUpdate ? C.primary : '#f59e0b'}
        />
      </View>
      <Text style={[styles.title, { color: C.text }]}>
        {isUpdate
          ? (isRTL ? 'يتوفر تحديث مطلوب' : 'Update required')
          : (isRTL ? 'التطبيق تحت الصيانة' : 'Under maintenance')}
      </Text>
      <Text style={[styles.body, { color: C.textSecondary }]}>
        {isUpdate
          ? (isRTL
              ? 'إصدارك الحالي لم يعد مدعوماً. يرجى تحديث التطبيق لآخر إصدار للمتابعة.'
              : 'Your current version is no longer supported. Please update to the latest version to continue.')
          : (isRTL
              ? 'نجري بعض التحسينات على فيكسات الآن. الخدمة ستعود قريباً — شكراً لصبرك.'
              : 'We’re making some improvements to Fixate right now. Service will be back shortly — thanks for your patience.')}
      </Text>
      {isUpdate && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: C.primary }]}
          onPress={openStore}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>
            {isRTL ? 'تحديث التطبيق' : 'Update the app'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  iconWrap: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  body: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  btn: { marginTop: 12, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  btnText: { fontSize: 15, fontWeight: '700' },
});
