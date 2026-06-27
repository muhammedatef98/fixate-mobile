import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

  // Date picker state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => new Date());

  // Time picker state (12-hour)
  const [selectedHour, setSelectedHour] = useState(9);   // 1–12
  const [selectedMinute, setSelectedMinute] = useState(0); // 0–59
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>('AM');
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // Derived values for the existing toIso/submit logic
  const date = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : '';
  const time = (() => {
    let h = selectedHour % 12;
    if (selectedAmPm === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
  })();

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
    setSelectedDate(null);
    setSelectedHour(9);
    setSelectedMinute(0);
    setSelectedAmPm('AM');
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
                <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'التاريخ' : 'Date'}</Text>
                <TouchableOpacity
                  onPress={() => { setPickerMonth(selectedDate ?? new Date()); setDatePickerOpen(true); }}
                  style={[styles.input, { justifyContent: 'center' }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: selectedDate ? COLORS.text : COLORS.textSecondary, fontSize: 14 }}>
                    {selectedDate
                      ? selectedDate.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory' : 'en-US', { calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric' })
                      : (isRTL ? 'اختر التاريخ' : 'Pick a date')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: 130 }}>
                <Text style={[styles.label, { marginTop: 10 }]}>{isRTL ? 'الوقت' : 'Time'}</Text>
                <TouchableOpacity
                  onPress={() => setTimePickerOpen(true)}
                  style={[styles.input, { justifyContent: 'center' }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: COLORS.text, fontSize: 14 }}>
                    {`${selectedHour}:${String(selectedMinute).padStart(2, '0')} ${isRTL ? (selectedAmPm === 'AM' ? 'ص' : 'م') : selectedAmPm}`}
                  </Text>
                </TouchableOpacity>
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

      {/* ── Date picker modal ── */}
      <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setDatePickerOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ width: 320, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg }}>
            {/* Month navigation */}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => setPickerMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{ padding: 6 }}>
                <MaterialCommunityIcons name={isRTL ? 'chevron-right' : 'chevron-left'} size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15 }}>
                {pickerMonth.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory' : 'en-US', { calendar: 'gregory', month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => setPickerMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ padding: 6 }}>
                <MaterialCommunityIcons name={isRTL ? 'chevron-left' : 'chevron-right'} size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {/* Day-of-week headers */}
            {(() => {
              const dayNames = isRTL
                ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
                : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
              return (
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 4 }}>
                  {dayNames.map((d) => (
                    <Text key={d} style={{ flex: 1, textAlign: 'center', color: COLORS.textSecondary, fontWeight: '700', fontSize: 11 }}>{d}</Text>
                  ))}
                </View>
              );
            })()}
            {/* Calendar grid */}
            {(() => {
              const year = pickerMonth.getFullYear();
              const month = pickerMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
              const weeks: (number | null)[][] = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7).concat(Array(7).fill(null)).slice(0, 7));
              return weeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 2 }}>
                  {week.map((day, di) => {
                    const isSelected = !!day && !!selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
                    const isToday = !!day && (() => { const t = new Date(); return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day; })();
                    return (
                      <TouchableOpacity
                        key={di}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 999, backgroundColor: isSelected ? COLORS.primary : 'transparent' }}
                        onPress={() => { if (day) { setSelectedDate(new Date(year, month, day)); setDatePickerOpen(false); } }}
                        disabled={!day}
                      >
                        <Text style={{ color: isSelected ? '#fff' : isToday ? COLORS.primary : day ? COLORS.text : 'transparent', fontWeight: isSelected || isToday ? '800' : '500', fontSize: 13 }}>
                          {day ?? '·'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Time picker modal ── */}
      <Modal visible={timePickerOpen} transparent animationType="fade" onRequestClose={() => setTimePickerOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setTimePickerOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ width: 280, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg }}>
            <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15, textAlign: 'center', marginBottom: 16 }}>
              {isRTL ? 'اختر الوقت' : 'Pick a time'}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, justifyContent: 'center' }}>
              {/* Hours 1-12 */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 11, marginBottom: 6 }}>{isRTL ? 'ساعة' : 'Hour'}</Text>
                <FlatList
                  data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                  keyExtractor={(item) => String(item)}
                  style={{ maxHeight: 200 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setSelectedHour(item)}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: selectedHour === item ? COLORS.primary : 'transparent', marginBottom: 2 }}
                    >
                      <Text style={{ color: selectedHour === item ? '#fff' : COLORS.text, fontWeight: '700', textAlign: 'center', fontSize: 16 }}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
              {/* Minutes */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 11, marginBottom: 6 }}>{isRTL ? 'دقيقة' : 'Min'}</Text>
                <FlatList
                  data={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
                  keyExtractor={(item) => String(item)}
                  style={{ maxHeight: 200 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setSelectedMinute(item)}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: selectedMinute === item ? COLORS.primary : 'transparent', marginBottom: 2 }}
                    >
                      <Text style={{ color: selectedMinute === item ? '#fff' : COLORS.text, fontWeight: '700', textAlign: 'center', fontSize: 16 }}>{String(item).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
              {/* AM/PM */}
              <View style={{ alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 11, marginBottom: 6 }}>ص/م</Text>
                {(['AM', 'PM'] as const).map((ampm) => (
                  <TouchableOpacity
                    key={ampm}
                    onPress={() => setSelectedAmPm(ampm)}
                    style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: BORDER_RADIUS.md, backgroundColor: selectedAmPm === ampm ? COLORS.primary : COLORS.background, borderWidth: 1, borderColor: selectedAmPm === ampm ? COLORS.primary : COLORS.border }}
                  >
                    <Text style={{ color: selectedAmPm === ampm ? '#fff' : COLORS.text, fontWeight: '800', fontSize: 15 }}>
                      {isRTL ? (ampm === 'AM' ? 'ص' : 'م') : ampm}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setTimePickerOpen(false)}
              style={{ marginTop: 16, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{isRTL ? 'تأكيد' : 'Confirm'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
