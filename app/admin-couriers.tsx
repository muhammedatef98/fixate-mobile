import React, { useCallback, useEffect, useState } from 'react';
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
import { DELIVERY_STATUS_LABELS, type DeliveryTask } from '../services/courierService';
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
  verification_status: string;
  verification_notes: string | null;
  courier_status: string;
  total_deliveries: number;
  created_at: string;
  name?: string | null;
  phone?: string | null;
}

type TabKey = 'applications' | 'tasks';

const VERIFICATION_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  submitted: { ar: 'بانتظار المراجعة', en: 'Awaiting review', color: '#F59E0B' },
  pending: { ar: 'بانتظار المراجعة', en: 'Awaiting review', color: '#F59E0B' },
  approved: { ar: 'معتمد', en: 'Approved', color: '#10B981' },
  rejected: { ar: 'مرفوض', en: 'Rejected', color: '#EF4444' },
  changes_requested: { ar: 'مطلوب تعديل', en: 'Changes requested', color: '#3B82F6' },
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
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ data: courierRows, error: cErr }, { data: taskRows, error: tErr }] =
        await Promise.all([
          supabase.from('couriers').select('*').order('created_at', { ascending: false }),
          supabase
            .from('delivery_tasks')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
        ]);
      if (cErr) throw cErr;
      if (tErr) logger.warn('admin delivery tasks load failed', tErr);

      const rows = (courierRows ?? []) as AdminCourierRow[];
      // Names/phones via the public card view (users table is RLS-locked).
      const ids = rows.map((r) => r.user_id);
      if (ids.length > 0) {
        const { data: cards } = await supabase
          .from('public_user_cards')
          .select('id, name')
          .in('id', ids);
        const byId = new Map((cards ?? []).map((c: any) => [c.id, c]));
        for (const r of rows) r.name = byId.get(r.user_id)?.name ?? null;
      }
      setCouriers(rows);
      setTasks((taskRows ?? []) as DeliveryTask[]);
    } catch (e) {
      logger.warn('admin couriers load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

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
  const activeTasks = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const doneTasks = tasks.filter((t) => ['completed', 'cancelled'].includes(t.status));

  const renderCourier = (c: AdminCourierRow) => {
    const v = VERIFICATION_LABELS[c.verification_status] ?? VERIFICATION_LABELS.pending;
    const busy = actingOn === c.id;
    return (
      <View key={c.id} style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15 }}>
            {c.name || (isRTL ? 'مندوب' : 'Courier')}
          </Text>
          <View style={{ backgroundColor: v.color + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ color: v.color, fontWeight: '700', fontSize: 11 }}>
              {isRTL ? v.ar : v.en}
            </Text>
          </View>
        </View>
        <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
          {(c.city || '—') +
            ' · ' +
            (c.vehicle_type || '—') +
            (c.id_number ? ` · ${isRTL ? 'هوية' : 'ID'}: ${c.id_number}` : '') +
            ` · ${isRTL ? 'توصيلات' : 'deliveries'}: ${c.total_deliveries}` +
            (c.driver_license_number ? ` · ${isRTL ? 'رخصة' : 'License'}: ${c.driver_license_number}` : '') +
            (c.vehicle_registration_number ? ` · ${isRTL ? 'استمارة' : 'Reg'}: ${c.vehicle_registration_number}` : '')}
        </Text>
        {!!c.verification_notes && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4, fontStyle: 'italic', textAlign: isRTL ? 'right' : 'left' }}>
            {c.verification_notes}
          </Text>
        )}
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
            { id: 'applications', ar: 'طلبات التسجيل', en: 'Applications' },
            { id: 'tasks', ar: 'مهمات التوصيل', en: 'Delivery tasks' },
          ] as { id: TabKey; ar: string; en: string }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && { backgroundColor: COLORS.primary }]}
            onPress={() => setTab(t.id)}
          >
            <Text style={{ color: tab === t.id ? '#fff' : COLORS.textSecondary, fontWeight: '700', fontSize: 13 }}>
              {isRTL ? t.ar : t.en}
              {t.id === 'applications' && pendingApps.length > 0 ? ` (${pendingApps.length})` : ''}
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
});
