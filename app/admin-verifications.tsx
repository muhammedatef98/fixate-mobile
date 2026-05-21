import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { supabase } from '../services/supabaseClient';
import { getFriendlyError } from '../utils/errorMessages';
import { success, warning } from '../utils/haptics';
import { safeBack } from '../utils/navigation';
import {
  setTechnicianStatus,
  setTechnicianNotes,
  type TechnicianStatus,
} from '../services/moderationService';

interface Technician {
  id: string;
  user_id: string;
  national_id?: string;
  iban?: string;
  city?: string;
  specialty?: string;
  specialization?: string[];
  years_of_experience: number;
  bio?: string;
  verification_status: string;
  technician_status?: string;
  admin_notes?: string;
  is_mobile?: boolean;
  created_at?: string;
  full_name?: string;
  phone?: string;
}

type FilterKey = 'pending' | 'approved' | 'all';

const LIFECYCLE: { id: TechnicianStatus; ar: string; en: string; color: string }[] = [
  { id: 'active', ar: 'نشط', en: 'Active', color: '#16A34A' },
  { id: 'under_review', ar: 'قيد المراجعة', en: 'Under review', color: '#3B82F6' },
  { id: 'suspended', ar: 'موقوف', en: 'Suspended', color: '#F59E0B' },
  { id: 'excluded', ar: 'مستبعد', en: 'Excluded', color: '#DC2626' },
];

const STATUS_META = (s: string, isRTL: boolean) => {
  switch (s) {
    case 'submitted':
      return { label: isRTL ? 'بانتظار المراجعة' : 'Pending review', color: '#F59E0B' };
    case 'approved':
      return { label: isRTL ? 'معتمد' : 'Approved', color: '#16A34A' };
    case 'rejected':
      return { label: isRTL ? 'مرفوض' : 'Rejected', color: '#DC2626' };
    default:
      return { label: isRTL ? 'مسودة' : 'Draft', color: '#8A94A3' };
  }
};

export default function AdminTechniciansScreen() {
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [items, setItems] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(
        (data ?? []).map((d: any) => ({
          ...d,
          specialty: d.specialty ?? (Array.isArray(d.specialization) ? d.specialization.join(', ') : ''),
        }))
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language, isRTL]);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  const decide = async (item: Technician, decision: 'approved' | 'rejected') => {
    setBusyId(item.id);
    try {
      const { error } = await supabase
        .from('technicians')
        .update({
          verification_status: decision,
          verified_at: decision === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', item.id);
      if (error) throw error;
      decision === 'approved' ? success() : warning();
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, verification_status: decision } : x))
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setBusyId(null);
    }
  };

  const toggleMobile = async (item: Technician, next: boolean) => {
    // Optimistic flip — revert if the DB write fails.
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_mobile: next } : x)));
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ is_mobile: next })
        .eq('id', item.id);
      if (error) throw error;
    } catch (e: any) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_mobile: !next } : x)));
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    }
  };

  const setLifecycle = async (item: Technician, status: TechnicianStatus) => {
    if (status === (item.technician_status ?? 'active')) return;
    const prev = item.technician_status;
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, technician_status: status } : x)));
    try {
      await setTechnicianStatus(item.id, status);
      success();
    } catch (e: any) {
      setItems((p) => p.map((x) => (x.id === item.id ? { ...x, technician_status: prev } : x)));
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    }
  };

  const saveNotes = async (item: Technician) => {
    const draft = (notesDrafts[item.id] ?? item.admin_notes ?? '').trim();
    try {
      await setTechnicianNotes(item.id, draft);
      setItems((p) => p.map((x) => (x.id === item.id ? { ...x, admin_notes: draft } : x)));
      Alert.alert(isRTL ? 'تم' : 'Saved', isRTL ? 'تم حفظ الملاحظات' : 'Notes saved');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    }
  };

  const styles = createStyles(COLORS, isRTL);

  const visible = items.filter((it) => {
    if (filter === 'pending') return it.verification_status === 'submitted';
    if (filter === 'approved') return it.verification_status === 'approved';
    return true;
  });
  const pendingCount = items.filter((i) => i.verification_status === 'submitted').length;

  if (!profileLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack()} accessibilityRole="button">
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isRTL ? 'الإدارة' : 'Admin'}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.unauthorized}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={[styles.unauthText, { color: COLORS.text }]}>
            {isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/admin')} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إدارة الفنيين' : 'Technician Management'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['pending', 'approved', 'all'] as FilterKey[]).map((f) => {
          const active = filter === f;
          const label =
            f === 'pending'
              ? isRTL ? 'قيد المراجعة' : 'Pending'
              : f === 'approved'
              ? isRTL ? 'المعتمدون' : 'Approved'
              : isRTL ? 'الكل' : 'All';
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            >
              <Text style={[styles.filterChipText, active && { color: '#fff' }]}>{label}</Text>
              {f === 'pending' && pendingCount > 0 && (
                <View style={[styles.filterBadge, active && { backgroundColor: '#fff' }]}>
                  <Text style={[styles.filterBadgeText, active && { color: COLORS.primary }]}>
                    {pendingCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-wrench-outline" size={64} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
              {isRTL ? 'لا يوجد فنيون هنا' : 'No technicians here'}
            </Text>
          </View>
        ) : (
          visible.map((it) => {
            const status = STATUS_META(it.verification_status, isRTL);
            const isSubmitted = it.verification_status === 'submitted';
            return (
              <View key={it.id} style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: COLORS.text }]} numberOfLines={1}>
                      {it.full_name || '—'}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>{it.phone || '—'}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Field label={isRTL ? 'التخصّص' : 'Specialty'} value={it.specialty || '—'} C={COLORS} />
                  <Field label={isRTL ? 'الخبرة' : 'Experience'} value={`${it.years_of_experience ?? 0} ${isRTL ? 'سنة' : 'yr'}`} C={COLORS} />
                </View>
                <View style={styles.row}>
                  <Field label={isRTL ? 'المدينة' : 'City'} value={it.city ?? '—'} C={COLORS} />
                  <Field label={isRTL ? 'الهوية' : 'Nat. ID'} value={it.national_id ?? '—'} C={COLORS} />
                </View>
                {it.bio ? (
                  <Text style={{ color: COLORS.text, marginTop: 8, fontSize: 13, lineHeight: 20 }}>{it.bio}</Text>
                ) : null}

                {/* Mobile-technician toggle */}
                <View style={[styles.mobileRow, { borderTopColor: COLORS.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mobileLabel, { color: COLORS.text }]}>
                      {isRTL ? 'فني متنقل' : 'Mobile technician'}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                      {isRTL ? 'يصل إلى موقع العميل لتقديم الخدمة' : 'Travels to the customer location'}
                    </Text>
                  </View>
                  <Switch
                    value={!!it.is_mobile}
                    onValueChange={(v) => toggleMobile(it, v)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Lifecycle status — drives assignment eligibility */}
                <View style={[styles.block, { borderTopColor: COLORS.border }]}>
                  <Text style={[styles.blockLabel, { color: COLORS.text }]}>
                    {isRTL ? 'حالة الفني' : 'Technician status'}
                  </Text>
                  <Text style={styles.blockHint}>
                    {isRTL
                      ? 'الفني «المستبعد» لا يظهر في توزيع الطلبات الجديدة.'
                      : 'An "excluded" technician is removed from new job assignment.'}
                  </Text>
                  <View style={styles.lcRow}>
                    {LIFECYCLE.map((s) => {
                      const active = (it.technician_status ?? 'active') === s.id;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => setLifecycle(it, s.id)}
                          style={[
                            styles.lcChip,
                            { borderColor: s.color },
                            active && { backgroundColor: s.color },
                          ]}
                        >
                          <Text style={[styles.lcChipText, { color: active ? '#fff' : s.color }]}>
                            {isRTL ? s.ar : s.en}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Admin notes */}
                <View style={[styles.block, { borderTopColor: COLORS.border }]}>
                  <Text style={[styles.blockLabel, { color: COLORS.text }]}>
                    {isRTL ? 'ملاحظات إدارية' : 'Admin notes'}
                  </Text>
                  <TextInput
                    value={notesDrafts[it.id] ?? it.admin_notes ?? ''}
                    onChangeText={(v) => setNotesDrafts((d) => ({ ...d, [it.id]: v }))}
                    placeholder={isRTL ? 'ملاحظة داخلية' : 'Internal note'}
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    style={[styles.notesInput, { color: COLORS.text, borderColor: COLORS.border, backgroundColor: COLORS.background }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                  <TouchableOpacity
                    onPress={() => saveNotes(it)}
                    style={[styles.notesSave, { backgroundColor: COLORS.primary }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                      {isRTL ? 'حفظ الملاحظات' : 'Save notes'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isSubmitted && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => decide(it, 'rejected')}
                      disabled={busyId === it.id}
                      style={[styles.btn, { backgroundColor: COLORS.error + '20' }]}
                    >
                      <Ionicons name="close" size={18} color={COLORS.error} />
                      <Text style={{ color: COLORS.error, fontWeight: '700' }}>{isRTL ? 'رفض' : 'Reject'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => decide(it, 'approved')}
                      disabled={busyId === it.id}
                      style={[styles.btn, { backgroundColor: COLORS.success }]}
                    >
                      {busyId === it.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700' }}>{isRTL ? 'اعتماد' : 'Approve'}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, C }: { label: string; value: string; C: any }) {
  return (
    <View style={{ flex: 1, marginTop: 8 }}>
      <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 14 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.m,
      backgroundColor: C.background,
    },
    title: { fontSize: 20, fontWeight: '800', color: C.text },
    filterRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.s,
    },
    filterChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    filterChipText: { color: C.text, fontWeight: '700', fontSize: 13 },
    filterBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    card: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.l,
      marginBottom: SPACING.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
    },
    name: { fontSize: 16, fontWeight: '800' },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statusPillText: { fontSize: 11, fontWeight: '800' },
    row: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 },
    mobileRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    mobileLabel: { fontWeight: '700', fontSize: 14 },
    block: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    blockLabel: { fontWeight: '800', fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
    blockHint: {
      color: C.textSecondary,
      fontSize: 11,
      marginTop: 2,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    lcRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 },
    lcChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1.5,
    },
    lcChipText: { fontWeight: '800', fontSize: 12 },
    notesInput: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      padding: 10,
      minHeight: 60,
      fontSize: 13,
      textAlignVertical: 'top',
    },
    notesSave: {
      alignSelf: isRTL ? 'flex-start' : 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.sm,
      marginTop: 8,
    },
    actions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginTop: SPACING.md },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: BORDER_RADIUS.sm,
      minHeight: 48,
    },
    empty: { alignItems: 'center', paddingVertical: 60 },
    unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    unauthText: { fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  });
