import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors } from '../constants/theme';

/**
 * Full-screen lockout shown when a user's account_status is suspended or
 * blocked. Rendered by the root layout in place of the whole app so a
 * suspended/blocked user cannot use any feature.
 */
export default function BlockedScreen({
  status,
}: {
  status: 'suspended' | 'blocked';
}) {
  const { language, isDark } = useApp();
  const { signOut } = useAuth();
  const router = useRouter();
  const isRTL = language === 'ar';
  const C = getColors(isDark);

  const title =
    status === 'blocked'
      ? isRTL ? 'تم حظر حسابك' : 'Your account is blocked'
      : isRTL ? 'تم إيقاف حسابك مؤقتاً' : 'Your account is suspended';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: '#ef444418' }]}>
        <MaterialCommunityIcons name="account-lock" size={56} color="#ef4444" />
      </View>
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      <Text style={[styles.body, { color: C.textSecondary }]}>
        {isRTL
          ? 'لا يمكنك استخدام التطبيق حالياً. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع فريق الدعم.'
          : 'You cannot use the app at this time. If you believe this is a mistake, please contact our support team.'}
      </Text>
      <TouchableOpacity
        style={[styles.btn, { borderColor: C.border }]}
        onPress={async () => {
          try {
            await signOut();
          } catch {}
          router.replace('/role-selection');
        }}
        accessibilityRole="button"
      >
        <Text style={[styles.btnText, { color: C.text }]}>
          {isRTL ? 'تسجيل الخروج' : 'Sign out'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  body: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  btn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
