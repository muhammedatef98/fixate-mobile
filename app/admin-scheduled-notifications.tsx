import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import { fmtAdminDate } from '../utils/dateFormat';
import {
  listUpcomingScheduled,
  createScheduled,
  scheduleNextMonth,
  deleteScheduled,
  type ScheduledNotification,
  type ScheduledAudience,
  type Recurrence,
} from '../services/scheduledNotificationsService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

const AUDIENCES: { key: ScheduledAudience; ar: string; en: string }[] = [
  { key: 'all', ar: 'الجميع', en: 'All' },
  { key: 'customers', ar: 'العملاء', en: 'Customers' },
  { key: 'technicians', ar: 'الفنيون', en: 'Technicians' },
];
const RECURRENCES: { key: Recurrence; ar: string; en: string }[] = [
  { key: 'none', ar: 'مرة واحدة', en: 'One-time' },
  { key: 'daily', ar: 'يومي', en: 'Daily' },
  { key: 'weekly', ar: 'أسبوعي', en: 'Weekly' },
];

// Compose a local date (YYYY-MM-DD) + time (HH:MM) into an ISO timestamp.
function toIso(dateStr: string, timeStr: string): string | null {
  const d = dateStr.trim();
  const t = (timeStr.trim() || '09:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const dt = new Date(`${d}T${t.padStart(5, '0')}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export default function AdminScheduledScreen() {
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();
  const styles = makeStyles(COLORS, isRTL);

  const [items, setItems] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<ScheduledAudience>('all');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');

  const load = useCallback(async () => {
    setItems(await listUpcomingScheduled());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const resetForm = () => {
    setTitle('');
    setBody('');
    setDate('');
    setTime('09:00');
    setRecurrence('none');
  };

  const validateBase = (): boolean => {
    if (!title.trim() || !body.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'العنوان والنص مطلوبان' : 'Title and body are required');
      return false;
    }
    return true;
  };

  const onCreate = async () => {
    if (!validateBase()) return;
    const iso = toIso(date, time);
    if (!iso) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'صيغة التاريخ/الوقت غير صحيحة' : 'Invalid date/time format');
      return;
    }
    setSaving(true);
    try {
      await createScheduled({ title, body, audience, scheduled_at: iso, recurrence, created_by: user?.id });
      resetForm();
      await load();
    } catch (e) {
      logger.warn('createScheduled failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setSaving(false);
    }
  };

  const onScheduleMonth = async () => {
    if (!validateBase()) return;
    const t = time.trim() || '09:00';
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'صيغة الوقت غير صحيحة (HH:MM)' : 'Invalid time (HH:MM)');
      return;
    }
    const [h, m] = t.split(':').map((n) => parseInt(n, 10));
    setSaving(true);
    try {
      const n = await scheduleNextMonth({ title, body, audience }, h, m);
      resetForm();
      await load();
      Alert.alert(isRTL ? 'تم' : 'Done', isRTL ? `تمت جدولة ${n} إشعاراً يومياً` : `Scheduled ${n} daily notifications`);
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (s: ScheduledNotification) => {
    Alert.alert(
      isRTL ? 'حذف' : 'Delete',
      isRTL ? 'إلغاء هذا الإشعار المجدوَل؟' : 'Cancel this scheduled notification?',
      [
        { text: isRTL ? 'تراجع' : 'Back', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScheduled(s.id);
              setItems((prev) => prev.filter((x) => x.id !== s.id));
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'إشعارات مجدولة' : 'Scheduled notifications'} />
        <AdminEmptyState variant="error" icon="shield-alert-outline" title={isRTL ? 'غير مصرّح' : 'Unauthorized'} body={isRTL ? 'للأدمن فقط' : 'Admins only'} />
      </SafeAreaView>
    );
  }

  const recurrenceLabel = (r: Recurrence) =>
    r === 'daily' ? (isRTL ? 'يومي' : 'Daily') : r === 'weekly' ? (isRTL ? 'أسبوعي' : 'Weekly') : (isRTL ? 'مرة واحدة' : 'One-time');
  const audienceLabel = (a: ScheduledAudience) => AUDIENCES.find((x) => x.key === a)?.[isRTL ? 'ar' : 'en'] ?? a;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader title={isRTL ? 'إشعارات مجدولة' : 'Scheduled notifications'} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 16 }}>
          {/* Schedule form */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{isRTL ? 'جدولة إشعار' : 'Schedule a notification'}</Text>

            <Text style={styles.label}>{isRTL ? 'العنوان' : 'Title'}</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={80} placeholderTextColor={COLORS.textSecondary} />

            <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'النص' : 'Body'}</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={body} onChangeText={setBody} multiline maxLength={500} placeholderTextColor={COLORS.textSecondary} />

            <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'الجمهور' : 'Audience'}</Text>
            <View style={styles.chipsRow}>
              {AUDIENCES.map((a) => (
                <Chip key={a.key} active={audience === a.key} label={isRTL ? a.ar : a.en} onPress={() => setAudience(a.key)} COLORS={COLORS} />
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'التكرار' : 'Recurrence'}</Text>
            <View style={styles.chipsRow}>
              {RECURRENCES.map((r) => (
                <Chip key={r.key} active={recurrence === r.key} label={isRTL ? r.ar : r.en} onPress={() => setRecurrence(r.key)} COLORS={COLORS} />
              ))}
            </View>

            <View style={[styles.row2, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'التاريخ (YYYY-MM-DD)' : 'Date (YYYY-MM-DD)'}</Text>
                <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-07-01" placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" />
              </View>
              <View style={{ width: 110 }}>
                <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'الوقت' : 'Time'}</Text>
                <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="09:00" placeholderTextColor={COLORS.textSecondary} />
              </View>
            </View>
            {recurrence !== 'none' && (
              <Text style={styles.note}>
                {isRTL ? 'سيبدأ التكرار من التاريخ المحدد.' : 'Recurrence starts from the chosen date.'}
              </Text>
            )}

            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={onCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>{isRTL ? 'جدولة' : 'Schedule'}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryBtn, saving && { opacity: 0.6 }]} onPress={onScheduleMonth} disabled={saving}>
              <MaterialCommunityIcons name="calendar-month-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>{isRTL ? 'جدولة 30 يوماً (يومياً بالوقت أعلاه)' : 'Schedule next month (30 daily at the time above)'}</Text>
            </TouchableOpacity>
          </View>

          {/* Upcoming */}
          <Text style={styles.sectionTitleOutside}>{isRTL ? 'القادمة' : 'Upcoming'}</Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : items.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
              <MaterialCommunityIcons name="clock-outline" size={36} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'لا توجد إشعارات مجدولة' : 'Nothing scheduled'}</Text>
            </View>
          ) : (
            items.map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={[styles.rowBetween, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{s.title}</Text>
                  <TouchableOpacity onPress={() => onDelete(s)} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemBody} numberOfLines={2}>{s.body}</Text>
                <View style={styles.pillRow}>
                  <Pill text={fmtAdminDate(s.scheduled_at, isRTL)} COLORS={COLORS} />
                  <Pill text={audienceLabel(s.audience)} COLORS={COLORS} />
                  {s.recurrence !== 'none' && <Pill text={recurrenceLabel(s.recurrence)} COLORS={COLORS} />}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ active, label, onPress, COLORS }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? COLORS.primary : COLORS.card, borderWidth: 1, borderColor: active ? COLORS.primary : COLORS.border }}
    >
      <Text style={{ color: active ? '#fff' : COLORS.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pill({ text, COLORS }: { text: string; COLORS: any }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.primary + '15' }}>
      <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    card: { backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: SPACING.lg },
    sectionTitle: { color: C.text, fontWeight: '800', fontSize: 15, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' },
    sectionTitleOutside: { color: C.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    label: { color: C.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    input: { borderWidth: 1, borderColor: C.border, borderRadius: BORDER_RADIUS.md, backgroundColor: C.background, padding: 12, fontSize: 14, color: C.text, textAlign: isRTL ? 'right' : 'left' },
    chipsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },
    row2: { gap: 10 },
    note: { color: C.textSecondary, fontSize: 11.5, marginTop: 8, textAlign: isRTL ? 'right' : 'left' },
    primaryBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, paddingVertical: 14, borderRadius: BORDER_RADIUS.md, marginTop: 16 },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    secondaryBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary + '14', borderWidth: 1, borderColor: C.primary, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, marginTop: 10 },
    secondaryBtnText: { color: C.primary, fontWeight: '800', fontSize: 13, flexShrink: 1 },
    rowBetween: { justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    itemTitle: { color: C.text, fontWeight: '800', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    itemBody: { color: C.text, fontSize: 13, marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
    pillRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  });
