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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import * as preferencesService from '../services/preferencesService';
import { getFriendlyError } from '../utils/errorMessages';
import { safeBack } from '../utils/navigation';

type Prefs = preferencesService.NotificationPreferences;

const ROWS: Array<{ key: keyof Prefs; ar: string; en: string; descAr: string; descEn: string }> = [
  { key: 'push_enabled', ar: 'إشعارات الهاتف', en: 'Push notifications', descAr: 'تلقي إشعارات داخل التطبيق', descEn: 'Receive in-app push alerts' },
  { key: 'email_enabled', ar: 'البريد الإلكتروني', en: 'Email', descAr: 'الفواتير وملخصات الطلبات', descEn: 'Receipts and order summaries' },
  { key: 'sms_enabled', ar: 'الرسائل النصية', en: 'SMS', descAr: 'تأكيدات الطلب وتحديثات الفني', descEn: 'Order confirmations and technician updates' },
  { key: 'order_updates', ar: 'تحديثات الطلبات', en: 'Order updates', descAr: 'حالة الإصلاح من القبول للتسليم', descEn: 'Repair status from accept to delivery' },
  { key: 'technician_messages', ar: 'رسائل الفني', en: 'Technician messages', descAr: 'إشعارات المحادثة', descEn: 'Chat alerts' },
  { key: 'promotions', ar: 'العروض والتخفيضات', en: 'Promotions', descAr: 'كوبونات وعروض موسمية', descEn: 'Coupons and seasonal offers' },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const data = await preferencesService.getMyPreferences(user.id);
        setPrefs(data);
      } catch (e: any) {
        Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const toggle = async (key: keyof Prefs) => {
    if (!prefs || !user?.id) return;
    const next = { ...prefs, [key]: !prefs[key] } as Prefs;
    setPrefs(next);
    setSaving(true);
    try {
      await preferencesService.upsertPreferences({ ...next, user_id: user.id });
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack()}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إعدادات الإشعارات' : 'Notifications'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading || !prefs ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          {ROWS.map((r) => (
            <View key={r.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{isRTL ? r.ar : r.en}</Text>
                <Text style={styles.rowDesc}>{isRTL ? r.descAr : r.descEn}</Text>
              </View>
              <Switch
                value={Boolean(prefs[r.key])}
                onValueChange={() => toggle(r.key)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                accessibilityLabel={isRTL ? r.ar : r.en}
                accessibilityState={{ checked: Boolean(prefs[r.key]) }}
              />
            </View>
          ))}
          {saving && (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md, fontSize: 12 }}>
              {isRTL ? 'جاري الحفظ...' : 'Saving...'}
            </Text>
          )}
        </ScrollView>
      )}
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
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: C.card,
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.sm,
      minHeight: 72,
    },
    rowTitle: { color: C.text, fontWeight: '600', fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    rowDesc: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  });
