import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { useAdminGuard } from '../hooks/useAdminGuard';
import { supabase } from '../services/supabaseClient';
import { notifyUsers } from '../services/notifyService';
import { DELIVERY_STATUS_LABELS, getCourierDocUrl, type DeliveryTask } from '../services/courierService';
import {
  setCourierStatus,
  setCourierNotes,
  listModerationLogs,
  type CourierStatus,
  type ModerationLog,
} from '../services/moderationService';
import { fmtAdminDate } from '../utils/dateFormat';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

interface AdminCourierRow {
  id: string;
  user_id: string;
  city: string | null;
  vehicle_type: string | null;
  id_number: string | null;
  driver_license_number?: string | null;
  vehicle_registration_number?: string | null;
  license_image_url?: string | null;
  registration_image_url?: string | null;
  id_image_url?: string | null;
  selfie_url?: string | null;
  challenge_text?: string | null;
  verification_status: string;
  verification_notes: string | null;
  courier_status: string;
  admin_notes?: string | null;
  available?: boolean;
  total_deliveries: number;
  verified_at?: string | null;
  created_at: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

type TabKey = 'applications' | 'couriers' | 'tasks';

const VERIFICATION_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  submitted: { ar: 'بانتظار المراجعة', en: 'Awaiting review', color: '#F59E0B' },
  pending: { ar: 'بانتظار المراجعة', en: 'Awaiting review', color: '#F59E0B' },
  approved: { ar: 'معتمد', en: 'Approved', color: '#10B981' },
  rejected: { ar: 'مرفوض', en: 'Rejected', color: '#EF4444' },
  changes_requested: { ar: 'مطلوب تعديل', en: 'Changes requested', color: '#3B82F6' },
};

// Lifecycle mirrors the technician screen minus 'under_review' — the couriers
// table doesn't allow it.
const LIFECYCLE: { id: CourierStatus; ar: string; en: string; color: string }[] = [
  { id: 'active', ar: 'نشط', en: 'Active', color: '#16A34A' },
  { id: 'suspended', ar: 'موقوف', en: 'Suspended', color: '#F59E0B' },
  { id: 'excluded', ar: 'مستبعد', en: 'Excluded', color: '#DC2626' },
];

const VEHICLE_LABELS: Record<string, { ar: string; en: string }> = {
  car: { ar: 'سيارة', en: 'Car' },
  motorcycle: { ar: 'دراجة نارية', en: 'Motorcycle' },
  van: { ar: 'فان', en: 'Van' },
};

/**
 * Admin: courier onboarding review + live delivery-task monitor. Mirrors the
 * technician verification workflow (approve / request changes / reject) so
 * ops manage both provider roles the same way.
 */
export default function AdminCouriersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { isAdmin, checking } = useAdminGuard();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [tab, setTab] = useState<TabKey>('applications');
  const [couriers, setCouriers] = useState<AdminCourierRow[]>([]);
  const [docsFor, setDocsFor] = useState<AdminCourierRow | null>(null);
  const [docUrls, setDocUrls] = useState<{ label: string; url: string }[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const openDocs = async (c: AdminCourierRow) => {
    setDocsFor(c);
    setDocUrls([]);
    setDocsLoading(true);
    const items: { label: string; path?: string | null }[] = [
      { label: isRTL ? 'رخصة القيادة' : 'Driver license', path: c.license_image_url },
      { label: isRTL ? 'استمارة/تسجيل المركبة' : 'Vehicle registration', path: c.registration_image_url },
      { label: isRTL ? 'الهوية/الإقامة' : 'National ID / Iqama', path: c.id_image_url },
      { label: isRTL ? 'الصورة الشخصية (التحدي)' : 'Selfie (challenge)', path: c.selfie_url },
    ];
    try {
      const resolved = await Promise.all(
        items.map(async (it) => ({ label: it.label, url: it.path ? await getCourierDocUrl(it.path) : null }))
      );
      setDocUrls(resolved.filter((r): r is { label: string; url: string } => !!r.url));
    } catch (e) {
      logger.warn('courier docs load failed', e);
    } finally {
      setDocsLoading(false);
    }
  };
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  // Full courier file (details, lifecycle, notes, moderation history).
  const [detailFor, setDetailFor] = useState<AdminCourierRow | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [logs, setLogs] = useState<ModerationLog[]>([]);

  const load = useCallback(async () => {
    try {
      const [{ data: courierRows, error: cErr }, { data: taskRows, error: tErr }] =
        await Promise.all([
          supabase.from('couriers').select('*').order('created_at', { ascending: false }),
          supabase
            .from('delivery_tasks')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
        ]);
      if (cErr) throw cErr;
      if (tErr) logger.warn('admin delivery tasks load failed', tErr);

      const rows = (courierRows ?? []) as AdminCourierRow[];
      // Contact details come from users (admins can read it); the public card
      // view is the fallback because it carries no phone/email.
      const ids = rows.map((r) => r.user_id);
      if (ids.length > 0) {
        const { data: users, error: uErr } = await supabase
          .from('users')
          .select('id, name, phone, email')
          .in('id', ids);
        if (uErr) logger.warn('admin courier users load failed', uErr);
        const byId = new Map((users ?? []).map((u: any) => [u.id, u]));
        for (const r of rows) {
          const u = byId.get(r.user_id);
          r.name = u?.name ?? null;
          r.phone = u?.phone ?? null;
          r.email = u?.email ?? null;
        }
      }
      setCouriers(rows);
      setTasks((taskRows ?? []) as DeliveryTask[]);
    } catch (e) {
      logger.warn('admin couriers load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const openDetail = async (c: AdminCourierRow) => {
    setDetailFor(c);
    setNotesDraft(c.admin_notes ?? '');
    setLogs(await listModerationLogs('courier', c.id));
  };

  /** Lifecycle change — optimistic, rolled back on failure. */
  const changeLifecycle = async (c: AdminCourierRow, status: CourierStatus) => {
    if ((c.courier_status ?? 'active') === status) return;
    const prev = c.courier_status;
    const apply = (s: string) => {
      setCouriers((p) => p.map((x) => (x.id === c.id ? { ...x, courier_status: s } : x)));
      setDetailFor((d) => (d && d.id === c.id ? { ...d, courier_status: s } : d));
    };
    apply(status);
    setActingOn(c.id);
    try {
      await setCourierStatus(c.id, status);
      // A suspended/excluded courier must know why they stopped getting tasks.
      if (status !== 'active') {
        void notifyUsers(c.user_id, {
          title: status === 'suspended' ? 'تم إيقاف حسابك مؤقتاً' : 'تم استبعادك من المنصة',
          body:
            status === 'suspended'
              ? 'لن تصلك مهمات توصيل جديدة حتى إعادة التفعيل. تواصل مع الدعم لمزيد من التفاصيل.'
              : 'لم يعد بإمكانك استلام مهمات التوصيل. تواصل مع الدعم لمزيد من التفاصيل.',
          data: { screen: 'courier' },
        });
      }
      setLogs(await listModerationLogs('courier', c.id));
    } catch (e) {
      apply(prev);
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setActingOn(null);
    }
  };

  const saveNotes = async (c: AdminCourierRow) => {
    setSavingNotes(true);
    try {
      await setCourierNotes(c.id, notesDraft.trim());
      setCouriers((p) => p.map((x) => (x.id === c.id ? { ...x, admin_notes: notesDraft.trim() } : x)));
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    if (!checking && isAdmin) void load();
  }, [checking, isAdmin, load]);

  const decide = async (
    courier: AdminCourierRow,
    decision: 'approved' | 'rejected' | 'changes_requested',
    note?: string
  ) => {
    setActingOn(courier.id);
    try {
      const { error } = await supabase
        .from('couriers')
        .update({
          verification_status: decision,
          verification_notes: decision === 'approved' ? null : note ?? null,
          verified_at: decision === 'approved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courier.id);
      if (error) throw error;

      // Notify the applicant (best-effort).
      void notifyUsers(courier.user_id, {
        title:
          decision === 'approved'
            ? 'تمت الموافقة على طلبك 🎉'
            : decision === 'rejected'
              ? 'تم رفض طلب التسجيل'
              : 'مطلوب تعديل على طلبك',
        body:
          decision === 'approved'
            ? 'أصبحت مندوب توصيل معتمد في Fixate. افتح التطبيق لاستلام المهمات.'
            : note || 'افتح التطبيق لمراجعة التفاصيل.',
        data: { screen: 'courier' },
      });

      await load();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setActingOn(null);
    }
  };

  const promptNoteAnd = (
    courier: AdminCourierRow,
    decision: 'rejected' | 'changes_requested'
  ) => {
    const title =
      decision === 'rejected'
        ? isRTL ? 'سبب الرفض' : 'Rejection reason'
        : isRTL ? 'المطلوب تعديله' : 'What needs changing?';
    if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
      Alert.prompt(title, undefined, (text) =>
        void decide(courier, decision, text?.trim() || undefined)
      );
    } else {
      // Android has no Alert.prompt — decide without a note.
      void decide(courier, decision);
    }
  };

  if (checking || !isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const pendingApps = couriers.filter((c) =>
    ['submitted', 'pending'].includes(c.verification_status)
  );
  const decidedApps = couriers.filter(
    (c) => !['submitted', 'pending'].includes(c.verification_status)
  );
  // The roster tab is the approved fleet — the people ops actually manage.
  const roster = couriers.filter((c) => c.verification_status === 'approved');
  const activeTasks = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const doneTasks = tasks.filter((t) => ['completed', 'cancelled'].includes(t.status));

  /** Live task counts per courier, derived from the tasks already loaded. */
  const taskStats = useMemo(() => {
    const m = new Map<string, { active: number; completed: number }>();
    for (const t of tasks) {
      if (!t.courier_id) continue;
      const s = m.get(t.courier_id) ?? { active: 0, completed: 0 };
      if (t.status === 'completed') s.completed += 1;
      else if (t.status !== 'cancelled') s.active += 1;
      m.set(t.courier_id, s);
    }
    return m;
  }, [tasks]);

  const renderCourier = (c: AdminCourierRow) => {
    const v = VERIFICATION_LABELS[c.verification_status] ?? VERIFICATION_LABELS.pending;
    const life = LIFECYCLE.find((l) => l.id === (c.courier_status as CourierStatus)) ?? LIFECYCLE[0];
    const stats = taskStats.get(c.user_id) ?? { active: 0, completed: 0 };
    const busy = actingOn === c.id;
    return (
      <View key={c.id} style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={1}>
            {c.name || (isRTL ? 'مندوب' : 'Courier')}
          </Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 6 }}>
            {c.verification_status === 'approved' && (
              <View style={{ backgroundColor: life.color + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: life.color, fontWeight: '700', fontSize: 11 }}>{isRTL ? life.ar : life.en}</Text>
              </View>
            )}
            <View style={{ backgroundColor: v.color + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ color: v.color, fontWeight: '700', fontSize: 11 }}>
                {isRTL ? v.ar : v.en}
              </Text>
            </View>
          </View>
        </View>
        <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
          {(c.city || '—') +
            ' · ' +
            (c.vehicle_type ? (isRTL ? VEHICLE_LABELS[c.vehicle_type]?.ar : VEHICLE_LABELS[c.vehicle_type]?.en) ?? c.vehicle_type : '—') +
            ` · ${isRTL ? 'توصيلات' : 'deliveries'}: ${c.total_deliveries}` +
            (stats.active > 0 ? ` · ${isRTL ? 'مهمات جارية' : 'active tasks'}: ${stats.active}` : '')}
        </Text>
        {!!c.verification_notes && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4, fontStyle: 'italic', textAlign: isRTL ? 'right' : 'left' }}>
            {c.verification_notes}
          </Text>
        )}
        <TouchableOpacity
          onPress={() => void openDetail(c)}
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 10 }}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="account-details-outline" size={18} color={COLORS.primary} />
          <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
            {isRTL ? 'ملف المندوب الكامل' : 'Full courier file'}
          </Text>
        </TouchableOpacity>
        {['submitted', 'pending', 'changes_requested'].includes(c.verification_status) && (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.decisionBtn, { backgroundColor: '#10B981', opacity: busy ? 0.5 : 1 }]}
              onPress={() => void decide(c, 'approved')}
              disabled={busy}
            >
              <Text style={styles.decisionText}>{isRTL ? 'اعتماد' : 'Approve'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.decisionBtn, { backgroundColor: '#3B82F6', opacity: busy ? 0.5 : 1 }]}
              onPress={() => promptNoteAnd(c, 'changes_requested')}
              disabled={busy}
            >
              <Text style={styles.decisionText}>{isRTL ? 'طلب تعديل' : 'Request changes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.decisionBtn, { backgroundColor: '#EF4444', opacity: busy ? 0.5 : 1 }]}
              onPress={() => promptNoteAnd(c, 'rejected')}
              disabled={busy}
            >
              <Text style={styles.decisionText}>{isRTL ? 'رفض' : 'Reject'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderTask = (t: DeliveryTask) => (
    <View key={t.id} style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14 }}>
          {t.task_type === 'pickup'
            ? isRTL ? 'استلام من العميل' : 'Pickup leg'
            : isRTL ? 'إعادة للعميل' : 'Return leg'}
        </Text>
        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>
          {DELIVERY_STATUS_LABELS[t.status]?.[isRTL ? 'ar' : 'en'] ?? t.status}
        </Text>
      </View>
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={2}>
        {(t.pickup_address || '—') + ' → ' + (t.dropoff_address || '—')}
      </Text>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/admin-order-detail', params: { id: t.order_id } } as any)}
        accessibilityRole="button"
        style={{ marginTop: 8, alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
      >
        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>
          {isRTL ? 'فتح الطلب المرتبط ←' : 'Open linked order →'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: COLORS.border }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as any))}
          accessibilityRole="button"
        >
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.text }}>
          {isRTL ? 'المناديب والتوصيل' : 'Couriers & Dispatch'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        {(
          [
            { id: 'applications', ar: 'الطلبات', en: 'Applications' },
            { id: 'couriers', ar: 'الأسطول', en: 'Fleet' },
            { id: 'tasks', ar: 'المهمات', en: 'Tasks' },
          ] as { id: TabKey; ar: string; en: string }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && { backgroundColor: COLORS.primary }]}
            onPress={() => setTab(t.id)}
          >
            <Text style={{ color: tab === t.id ? '#fff' : COLORS.textSecondary, fontWeight: '700', fontSize: 12.5 }}>
              {isRTL ? t.ar : t.en}
              {t.id === 'applications' && pendingApps.length > 0 ? ` (${pendingApps.length})` : ''}
              {t.id === 'couriers' && roster.length > 0 ? ` (${roster.length})` : ''}
              {t.id === 'tasks' && activeTasks.length > 0 ? ` (${activeTasks.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={COLORS.primary}
            />
          }
        >
          {tab === 'applications' && (
            <>
              {couriers.length === 0 && (
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="moped" size={56} color={COLORS.textSecondary} />
                  <Text style={{ color: COLORS.textSecondary, marginTop: 10, textAlign: 'center' }}>
                    {isRTL ? 'لا توجد طلبات تسجيل مناديب بعد.' : 'No courier applications yet.'}
                  </Text>
                </View>
              )}
              {pendingApps.map(renderCourier)}
              {decidedApps.length > 0 && pendingApps.length > 0 && (
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'تمت مراجعتها' : 'Reviewed'}
                </Text>
              )}
              {decidedApps.map(renderCourier)}
            </>
          )}

          {tab === 'couriers' && (
            <>
              {roster.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="account-group-outline" size={56} color={COLORS.textSecondary} />
                  <Text style={{ color: COLORS.textSecondary, marginTop: 10, textAlign: 'center' }}>
                    {isRTL
                      ? 'لا يوجد مناديب معتمدون بعد. اعتمد طلباً من تبويب الطلبات ليظهر هنا.'
                      : 'No approved couriers yet. Approve an application and it will appear here.'}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Fleet health at a glance, so ops don't count cards. */}
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.sm }}>
                    {LIFECYCLE.map((l) => {
                      const n = roster.filter((c) => (c.courier_status ?? 'active') === l.id).length;
                      return (
                        <View
                          key={l.id}
                          style={[styles.statTile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                        >
                          <Text style={{ color: l.color, fontWeight: '900', fontSize: 20 }}>{n}</Text>
                          <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' }}>
                            {isRTL ? l.ar : l.en}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {roster.map(renderCourier)}
                </>
              )}
            </>
          )}

          {tab === 'tasks' && (
            <>
              {tasks.length === 0 && (
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={56} color={COLORS.textSecondary} />
                  <Text style={{ color: COLORS.textSecondary, marginTop: 10, textAlign: 'center' }}>
                    {isRTL
                      ? 'لا توجد مهمات توصيل بعد. تُنشأ مهمة الاستلام تلقائياً عند قبول عرض على طلب «استلام وتوصيل».'
                      : 'No delivery tasks yet. A pickup task is created automatically when an offer is accepted on a pickup & delivery order.'}
                  </Text>
                </View>
              )}
              {activeTasks.map(renderTask)}
              {doneTasks.length > 0 && activeTasks.length > 0 && (
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'المنتهية' : 'Finished'}
                </Text>
              )}
              {doneTasks.map(renderTask)}
            </>
          )}
        </ScrollView>
      )}

      {/* Full courier file: identity, vehicle, stats, lifecycle, notes, history */}
      <Modal visible={!!detailFor} transparent animationType="slide" onRequestClose={() => setDetailFor(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', paddingBottom: 24 }}>
            <View style={[styles.sheetHead, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: COLORS.border }]}>
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800' }}>
                {detailFor?.name || (isRTL ? 'ملف المندوب' : 'Courier file')}
              </Text>
              <TouchableOpacity onPress={() => setDetailFor(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {detailFor && (
              <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 40 }}>
                {/* Identity + vehicle */}
                <View style={[styles.section, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                  <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? 'البيانات' : 'Details'}
                  </Text>
                  {(
                    [
                      [isRTL ? 'الجوال' : 'Phone', detailFor.phone],
                      [isRTL ? 'البريد' : 'Email', detailFor.email],
                      [isRTL ? 'المدينة' : 'City', detailFor.city],
                      [
                        isRTL ? 'المركبة' : 'Vehicle',
                        detailFor.vehicle_type
                          ? (isRTL ? VEHICLE_LABELS[detailFor.vehicle_type]?.ar : VEHICLE_LABELS[detailFor.vehicle_type]?.en) ?? detailFor.vehicle_type
                          : null,
                      ],
                      [isRTL ? 'رقم الهوية' : 'ID number', detailFor.id_number],
                      [isRTL ? 'رقم الرخصة' : 'License no.', detailFor.driver_license_number],
                      [isRTL ? 'رقم الاستمارة' : 'Registration no.', detailFor.vehicle_registration_number],
                      [isRTL ? 'انضم في' : 'Joined', fmtAdminDate(detailFor.created_at, isRTL)],
                      [
                        isRTL ? 'تاريخ الاعتماد' : 'Approved on',
                        detailFor.verified_at ? fmtAdminDate(detailFor.verified_at, isRTL) : null,
                      ],
                    ] as [string, string | null | undefined][]
                  ).map(([label, value]) => (
                    <View key={label} style={[styles.kv, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12.5 }}>{label}</Text>
                      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                        {value || '—'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Delivery performance */}
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.sm }}>
                  {(() => {
                    const s = taskStats.get(detailFor.user_id) ?? { active: 0, completed: 0 };
                    return (
                      [
                        [String(detailFor.total_deliveries), isRTL ? 'إجمالي التوصيلات' : 'Total deliveries'],
                        [String(s.active), isRTL ? 'مهمات جارية' : 'Active tasks'],
                        [
                          detailFor.available ? (isRTL ? 'متاح' : 'Online') : (isRTL ? 'غير متاح' : 'Offline'),
                          isRTL ? 'الحالة الآن' : 'Availability',
                        ],
                      ] as [string, string][]
                    ).map(([v, l]) => (
                      <View key={l} style={[styles.statTile, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                        <Text style={{ color: COLORS.text, fontWeight: '900', fontSize: 17 }}>{v}</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 10.5, fontWeight: '700', textAlign: 'center' }}>{l}</Text>
                      </View>
                    ));
                  })()}
                </View>

                {/* Documents */}
                {(detailFor.license_image_url || detailFor.registration_image_url || detailFor.selfie_url || detailFor.id_image_url) && (
                  <TouchableOpacity
                    onPress={() => void openDocs(detailFor)}
                    accessibilityRole="button"
                    style={[styles.section, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }]}
                  >
                    <MaterialCommunityIcons name="file-image-outline" size={20} color={COLORS.primary} />
                    <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13.5 }}>
                      {isRTL ? 'عرض مستندات التحقق' : 'View verification documents'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Lifecycle — the suspend / exclude control */}
                {detailFor.verification_status === 'approved' && (
                  <View style={[styles.section, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                    <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
                      {isRTL ? 'حالة المندوب' : 'Courier status'}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>
                      {isRTL
                        ? 'المندوب الموقوف أو المستبعد لا تُعرض عليه مهمات توصيل جديدة.'
                        : 'Suspended or excluded couriers are no longer offered delivery tasks.'}
                    </Text>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                      {LIFECYCLE.map((l) => {
                        const on = (detailFor.courier_status ?? 'active') === l.id;
                        return (
                          <TouchableOpacity
                            key={l.id}
                            onPress={() => void changeLifecycle(detailFor, l.id)}
                            disabled={actingOn === detailFor.id}
                            style={[
                              styles.lifecycleBtn,
                              {
                                backgroundColor: on ? l.color : 'transparent',
                                borderColor: on ? l.color : COLORS.border,
                                opacity: actingOn === detailFor.id ? 0.6 : 1,
                              },
                            ]}
                          >
                            <Text style={{ color: on ? '#fff' : COLORS.textSecondary, fontWeight: '800', fontSize: 12 }}>
                              {isRTL ? l.ar : l.en}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Internal notes */}
                <View style={[styles.section, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                  <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? 'ملاحظات داخلية' : 'Internal notes'}
                  </Text>
                  <TextInput
                    value={notesDraft}
                    onChangeText={setNotesDraft}
                    multiline
                    placeholder={isRTL ? 'لا يراها المندوب…' : 'Never shown to the courier…'}
                    placeholderTextColor={COLORS.textLight}
                    style={{
                      minHeight: 70,
                      color: COLORS.text,
                      backgroundColor: COLORS.background,
                      borderRadius: BORDER_RADIUS.sm,
                      padding: 10,
                      fontSize: 13,
                      textAlign: isRTL ? 'right' : 'left',
                      textAlignVertical: 'top',
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => void saveNotes(detailFor)}
                    disabled={savingNotes || notesDraft.trim() === (detailFor.admin_notes ?? '')}
                    style={[
                      styles.saveNotes,
                      {
                        backgroundColor: COLORS.primary,
                        opacity: savingNotes || notesDraft.trim() === (detailFor.admin_notes ?? '') ? 0.5 : 1,
                      },
                    ]}
                  >
                    {savingNotes ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>
                        {isRTL ? 'حفظ الملاحظات' : 'Save notes'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Decision history */}
                <View style={[styles.section, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                  <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? 'سجل القرارات' : 'Decision history'}
                  </Text>
                  {logs.length === 0 ? (
                    <Text style={{ color: COLORS.textLight, fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}>
                      {isRTL ? 'لا توجد قرارات مسجلة.' : 'No recorded decisions.'}
                    </Text>
                  ) : (
                    logs.map((l) => (
                      <View key={l.id} style={[styles.kv, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text style={{ color: COLORS.text, fontSize: 12.5, fontWeight: '700' }}>{l.action}</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11.5 }}>
                          {fmtAdminDate(l.created_at, isRTL)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* §7 — courier verification document review */}
      <Modal visible={!!docsFor} transparent animationType="slide" onRequestClose={() => setDocsFor(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingBottom: 24 }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800' }}>
                {isRTL ? 'مستندات التحقق' : 'Verification documents'}
              </Text>
              <TouchableOpacity onPress={() => setDocsFor(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {docsFor?.challenge_text ? (
              <View style={{ paddingHorizontal: SPACING.md, paddingTop: 12 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{isRTL ? 'نص التحدي المطلوب في الصورة الشخصية:' : 'Challenge the selfie must show:'}</Text>
                <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>{docsFor.challenge_text}</Text>
              </View>
            ) : null}
            {docsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 16 }}>
                {docUrls.length === 0 ? (
                  <Text style={{ color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 30 }}>
                    {isRTL ? 'لا توجد صور متاحة' : 'No images available'}
                  </Text>
                ) : (
                  docUrls.map((d) => (
                    <View key={d.label}>
                      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>{d.label}</Text>
                      <Image source={{ uri: d.url }} style={{ width: '100%', height: 220, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card }} resizeMode="contain" />
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  tabs: {
    margin: SPACING.lg,
    marginBottom: 0,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BORDER_RADIUS.sm },
  card: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  decisionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: BORDER_RADIUS.sm,
  },
  decisionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30 },
  sheetHead: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  section: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  kv: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  lifecycleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  saveNotes: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: 10,
  },
});
