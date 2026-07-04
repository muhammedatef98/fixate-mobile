/**
 * admin-user-verifications.tsx — admin review queue for end-user
 * Saudi ID / Iqama applications. Mirrors the look-and-feel of
 * admin-verifications (technicians) but reads from the
 * user_verifications table.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING } from '../constants/theme';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { AdminEmptyState, AdminStatusPill } from '../components/admin/AdminUI';
import { fmtAdminDate } from '../utils/dateFormat';
import {
  adminListVerifications,
  adminApproveVerification,
  adminRejectVerification,
  getSignedDocumentUrl,
  type UserVerificationRow,
  type VerificationStatus,
} from '../services/userVerificationService';

type Tab = 'pending' | 'approved' | 'rejected';

const TAB_META: Record<Tab, { ar: string; en: string }> = {
  pending:  { ar: 'قيد المراجعة', en: 'Pending'  },
  approved: { ar: 'مقبولة',       en: 'Approved' },
  rejected: { ar: 'مرفوضة',       en: 'Rejected' },
};

export default function AdminUserVerificationsScreen() {
  const { isDark, language } = useApp();
  const { user } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<UserVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<UserVerificationRow | null>(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminListVerifications(tab);
      setRows(data);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, isRTL]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const onApprove = async (row: UserVerificationRow) => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await adminApproveVerification(row.id, user.id);
      setActive(null);
      await load();
      Alert.alert(isRTL ? 'تم القبول' : 'Approved', isRTL ? 'تم توثيق المستخدم.' : 'User has been verified.');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  const onReject = async () => {
    if (!user?.id || !active) return;
    if (!rejectReason.trim()) {
      Alert.alert(isRTL ? 'سبب مطلوب' : 'Reason required', isRTL ? 'يرجى كتابة سبب الرفض.' : 'Please enter a rejection reason.');
      return;
    }
    setSubmitting(true);
    try {
      await adminRejectVerification(active.id, user.id, rejectReason);
      setRejectVisible(false);
      setRejectReason('');
      setActive(null);
      await load();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'توثيق المستخدمين' : 'User Verifications'} />
        <AdminEmptyState
          variant="error"
          icon="shield-alert-outline"
          title={isRTL ? 'غير مصرّح' : 'Unauthorized'}
          body={isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header
        isRTL={isRTL}
        COLORS={COLORS}
        title={isRTL ? 'توثيق المستخدمين' : 'User Verifications'}
        subtitle={isRTL ? `${rows.length} ${TAB_META[tab].ar}` : `${rows.length} ${TAB_META[tab].en}`}
      />

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(Object.keys(TAB_META) as Tab[]).map((t) => {
          const active = t === tab;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => { setLoading(true); setTab(t); }}
              style={[
                styles.tab,
                { backgroundColor: active ? COLORS.primary : COLORS.card, borderColor: active ? COLORS.primary : COLORS.border },
              ]}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, { color: active ? '#fff' : COLORS.text }]} numberOfLines={1}>
                {isRTL ? TAB_META[t].ar : TAB_META[t].en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <AdminEmptyState
            icon="card-account-details-outline"
            title={isRTL ? 'لا توجد طلبات' : 'No applications'}
            body={isRTL ? 'ستظهر الطلبات هنا.' : 'Submitted applications will appear here.'}
          />
        ) : (
          rows.map((r) => (
            <RowCard key={r.id} row={r} onPress={() => setActive(r)} COLORS={COLORS} isRTL={isRTL} />
          ))
        )}
      </ScrollView>

      {/* Detail / review modal */}
      <Modal visible={!!active} animationType="slide" transparent onRequestClose={() => setActive(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.background }]}>
            {active && (
              <ReviewBody
                row={active}
                COLORS={COLORS}
                isRTL={isRTL}
                onClose={() => setActive(null)}
                onApprove={() => onApprove(active)}
                onReject={() => setRejectVisible(true)}
                submitting={submitting}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Reject reason modal */}
      <Modal visible={rejectVisible} animationType="fade" transparent onRequestClose={() => setRejectVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card, maxHeight: '60%' }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>
              {isRTL ? 'سبب الرفض' : 'Rejection reason'}
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              placeholder={isRTL ? 'اشرح للمستخدم سبب الرفض…' : 'Explain why this is being rejected…'}
              placeholderTextColor={COLORS.textSecondary}
              style={[
                styles.input,
                { color: COLORS.text, backgroundColor: COLORS.background, textAlignVertical: 'top', height: 110 },
              ]}
            />
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => { setRejectVisible(false); setRejectReason(''); }}
                style={[styles.modalBtn, { backgroundColor: COLORS.border }]}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.text }]}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={submitting}
                onPress={onReject}
                style={[styles.modalBtn, { backgroundColor: '#DC2626', opacity: submitting ? 0.6 : 1 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {isRTL ? 'تأكيد الرفض' : 'Confirm reject'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ isRTL, COLORS, title, subtitle }: { isRTL: boolean; COLORS: any; title: string; subtitle?: string }) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: COLORS.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    }}>
      <AnimatedBackButton
        onPress={() => safeBack('/admin')}
        color={COLORS.text}
        backgroundColor={COLORS.surface ?? COLORS.background}
        size={42}
        iconSize={22}
        rtl
        accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
      />
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
        {!!subtitle && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={{ width: 42 }} />
    </View>
  );
}

function RowCard({ row, onPress, COLORS, isRTL }: {
  row: UserVerificationRow; onPress: () => void; COLORS: any; isRTL: boolean;
}) {
  const tone: VerificationStatus = row.status;
  const toneLabel = tone === 'approved'
    ? (isRTL ? 'مقبول' : 'Approved')
    : tone === 'rejected'
      ? (isRTL ? 'مرفوض' : 'Rejected')
      : (isRTL ? 'قيد المراجعة' : 'Pending');
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 12,
        ...(isRTL
          ? { borderRightWidth: 4, borderRightColor: COLORS.primary }
          : { borderLeftWidth: 4, borderLeftColor: COLORS.primary }),
      }}
    >
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800', flex: 1, textAlign: isRTL ? 'right' : 'left' }} numberOfLines={1}>
          {row.full_name}
        </Text>
        <AdminStatusPill
          tone={tone === 'approved' ? 'success' : tone === 'rejected' ? 'danger' : 'warning'}
          label={toneLabel}
        />
      </View>
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          {row.document_type === 'saudi_id'
            ? (isRTL ? 'هوية وطنية' : 'Saudi ID')
            : (isRTL ? 'إقامة' : 'Iqama')}
          {'  ·  '}{row.document_number}
        </Text>
        <Text style={{ color: COLORS.textLight ?? COLORS.textSecondary, fontSize: 11 }}>
          {fmtAdminDate(row.created_at, isRTL)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ReviewBody({ row, COLORS, isRTL, onClose, onApprove, onReject, submitting }: {
  row: UserVerificationRow;
  COLORS: any;
  isRTL: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  submitting: boolean;
}) {
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  // Full-screen in-app preview target. A tapped document opens here instead of
  // being handed to the OS browser (a private signed URL opened externally just
  // showed a blank page).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    getSignedDocumentUrl(row.document_front_url).then(setFrontUrl);
    if (row.document_back_url) getSignedDocumentUrl(row.document_back_url).then(setBackUrl);
    if ((row as any).selfie_url) getSignedDocumentUrl((row as any).selfie_url).then(setSelfieUrl);
  }, [row.id]);

  const isPending = row.status === 'pending';

  return (
    <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 30 }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800' }}>
          {isRTL ? 'مراجعة الطلب' : 'Review application'}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <FieldRow label={isRTL ? 'الاسم الكامل' : 'Full name'} value={row.full_name} COLORS={COLORS} isRTL={isRTL} />
      <FieldRow
        label={isRTL ? 'نوع المستند' : 'Document type'}
        value={row.document_type === 'saudi_id' ? (isRTL ? 'هوية وطنية' : 'Saudi ID') : (isRTL ? 'إقامة' : 'Iqama')}
        COLORS={COLORS}
        isRTL={isRTL}
      />
      <FieldRow label={isRTL ? 'رقم المستند' : 'Document number'} value={row.document_number} COLORS={COLORS} isRTL={isRTL} />
      <FieldRow label={isRTL ? 'تاريخ التقديم' : 'Submitted'} value={fmtAdminDate(row.created_at, isRTL)} COLORS={COLORS} isRTL={isRTL} />

      <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 18, marginBottom: 8, fontWeight: '700' }}>
        {isRTL ? 'صورة الوجه الأمامي' : 'Front image'}
      </Text>
      <DocImage url={frontUrl} COLORS={COLORS} onPreview={setPreviewUrl} isRTL={isRTL} />

      {row.document_back_url ? (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 16, marginBottom: 8, fontWeight: '700' }}>
            {isRTL ? 'صورة الوجه الخلفي' : 'Back image'}
          </Text>
          <DocImage url={backUrl} COLORS={COLORS} onPreview={setPreviewUrl} isRTL={isRTL} />
        </>
      ) : null}

      {/* FEATURE-1 — selfie + the challenge that must match it */}
      {(row as any).selfie_url ? (
        <>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 16, marginBottom: 8, fontWeight: '700' }}>
            {isRTL ? 'الصورة الشخصية مع التحدي' : 'Selfie with challenge'}
          </Text>
          {(row as any).challenge_text ? (
            <View style={{ backgroundColor: COLORS.primary + '12', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.primary + '44' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                {isRTL ? 'التحدي المطلوب' : 'Required challenge'}
              </Text>
              <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' }}>
                {(row as any).challenge_text}
              </Text>
            </View>
          ) : null}
          <DocImage url={selfieUrl} COLORS={COLORS} onPreview={setPreviewUrl} isRTL={isRTL} />
        </>
      ) : null}

      {row.status === 'rejected' && row.rejection_reason ? (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#FCA5A5' }}>
          <Text style={{ color: '#991B1B', fontSize: 12, fontWeight: '800', marginBottom: 4 }}>
            {isRTL ? 'سبب الرفض' : 'Rejection reason'}
          </Text>
          <Text style={{ color: '#7F1D1D', fontSize: 12, lineHeight: 18 }}>{row.rejection_reason}</Text>
        </View>
      ) : null}

      {isPending ? (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 24 }}>
          <TouchableOpacity
            disabled={submitting}
            onPress={onReject}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center' }}
          >
            <Text style={{ color: '#991B1B', fontWeight: '800' }}>{isRTL ? 'رفض' : 'Reject'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={submitting}
            onPress={onApprove}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '800' }}>{isRTL ? 'قبول وتوثيق' : 'Approve & verify'}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} isRTL={isRTL} />
    </ScrollView>
  );
}

/** Full-screen in-app image preview. Renders the signed image over a dark
 *  scrim with a close button — never routes to an external browser. */
function ImagePreviewModal({ url, onClose, isRTL }: { url: string | null; onClose: () => void; isRTL: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}
          style={{ position: 'absolute', top: 48, right: 20, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialIcons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        {url && !failed ? (
          <Image
            source={{ uri: url }}
            style={{ width: '100%', height: '80%' }}
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 10, padding: 24 }}>
            <MaterialCommunityIcons name="image-off-outline" size={48} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
              {isRTL ? 'تعذّر تحميل الصورة' : 'Could not load this image'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

function FieldRow({ label, value, COLORS, isRTL }: { label: string; value: string; COLORS: any; isRTL: boolean }) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    }}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700', maxWidth: '60%', textAlign: isRTL ? 'left' : 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DocImage({ url, COLORS, onPreview, isRTL }: {
  url: string | null;
  COLORS: any;
  onPreview: (url: string) => void;
  isRTL: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);

  // Still resolving the signed URL.
  if (!url) {
    return (
      <View style={{ height: 200, backgroundColor: COLORS.card, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  // URL resolved but the image itself failed to load (missing / broken upload).
  if (failed) {
    return (
      <View style={{ height: 200, backgroundColor: COLORS.card, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
        <MaterialCommunityIcons name="image-broken-variant" size={40} color={COLORS.textSecondary} />
        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          {isRTL ? 'تعذّر تحميل الصورة' : 'Image unavailable'}
        </Text>
      </View>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPreview(url)}>
      <Image
        source={{ uri: url }}
        style={{ width: '100%', height: 220, borderRadius: 14, resizeMode: 'cover' }}
        onError={() => setFailed(true)}
      />
    </TouchableOpacity>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  tabsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, padding: 14, paddingBottom: 0 },
  input: { borderWidth: 1, borderColor: '#33333322', borderRadius: 12, padding: 12, marginHorizontal: 14, marginTop: 6 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginHorizontal: 14 },
  modalBtnText: { fontSize: 14, fontWeight: '800' },
});
