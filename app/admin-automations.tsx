import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import {
  listAutomations,
  setAutomationActive,
  updateAutomation,
  type NotificationAutomation,
} from '../services/automationsService';
import { getFriendlyError } from '../utils/errorMessages';
import GearLoader from '../components/GearLoader';

const EVENT_LABEL: Record<string, { ar: string; en: string; descAr: string; descEn: string }> = {
  welcome_discount: {
    ar: 'خصم ترحيبي للعملاء الجدد',
    en: 'Welcome discount for new customers',
    descAr: 'يُرسَل تلقائياً عند تسجيل عميل جديد',
    descEn: 'Sent automatically when a new customer signs up',
  },
};

export default function AdminAutomationsScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();
  const styles = makeStyles(COLORS, isRTL);

  const [items, setItems] = useState<NotificationAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await listAutomations();
    setItems(data);
    setDrafts(Object.fromEntries(data.map((a) => [a.id, { title: a.title, body: a.body }])));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const onToggle = async (a: NotificationAutomation) => {
    const next = !a.is_active;
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)));
    try {
      await setAutomationActive(a.id, next);
    } catch (e) {
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: a.is_active } : x)));
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    }
  };

  const onSave = async (a: NotificationAutomation) => {
    const d = drafts[a.id];
    if (!d?.title.trim() || !d?.body.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'العنوان والنص مطلوبان' : 'Title and body are required');
      return;
    }
    setSavingId(a.id);
    try {
      const saved = await updateAutomation(a.id, d);
      setItems((prev) => prev.map((x) => (x.id === a.id ? saved : x)));
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'قواعد الأتمتة' : 'Automation rules'} />
        <AdminEmptyState variant="error" icon="shield-alert-outline" title={isRTL ? 'غير مصرّح' : 'Unauthorized'} body={isRTL ? 'للأدمن فقط' : 'Admins only'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader title={isRTL ? 'قواعد الأتمتة' : 'Automation rules'} subtitle={isRTL ? 'إشعارات تلقائية' : 'Trigger-based notifications'} />

      {loading ? (
        <GearLoader size={48} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 14 }}>
          {items.map((a) => {
            const meta = EVENT_LABEL[a.trigger_event];
            const d = drafts[a.id] ?? { title: a.title, body: a.body };
            return (
              <View key={a.id} style={styles.card}>
                <View style={styles.headRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{meta ? (isRTL ? meta.ar : meta.en) : a.trigger_event}</Text>
                    <Text style={styles.cardDesc}>{meta ? (isRTL ? meta.descAr : meta.descEn) : ''}</Text>
                  </View>
                  <Switch
                    value={a.is_active}
                    onValueChange={() => onToggle(a)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                </View>

                <Text style={styles.label}>{isRTL ? 'العنوان' : 'Title'}</Text>
                <TextInput
                  style={styles.input}
                  value={d.title}
                  onChangeText={(t) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, title: t } }))}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'النص (يشمل الخصم)' : 'Body (incl. discount text)'}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={d.body}
                  onChangeText={(t) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, body: t } }))}
                  multiline
                  placeholderTextColor={COLORS.textSecondary}
                />

                <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(a)} disabled={savingId === a.id}>
                  {savingId === a.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="content-save-outline" size={17} color="#fff" />
                      <Text style={styles.saveBtnText}>{isRTL ? 'حفظ' : 'Save'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
          <Text style={styles.hint}>
            {isRTL ? 'سيتم إضافة قواعد أتمتة أخرى لاحقاً.' : 'More automation rules can be added later.'}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    card: { backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: SPACING.lg },
    headRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    cardTitle: { color: C.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    cardDesc: { color: C.textSecondary, fontSize: 12, marginTop: 3, textAlign: isRTL ? 'right' : 'left' },
    label: { color: C.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    input: { borderWidth: 1, borderColor: C.border, borderRadius: BORDER_RADIUS.md, backgroundColor: C.background, padding: 12, fontSize: 14, color: C.text, textAlign: isRTL ? 'right' : 'left' },
    saveBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, paddingVertical: 13, borderRadius: BORDER_RADIUS.md, marginTop: 16 },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    hint: { color: C.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4 },
  });
