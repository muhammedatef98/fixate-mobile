import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  adminListAll,
  adminApprove,
  adminReject,
  adminArchive,
  adminRestore,
  adminHardDelete,
  adminSetNotes,
  type MarketListing,
  type ListingStatus,
} from '../services/marketService';

const STATUS_META: Record<ListingStatus, { ar: string; en: string; color: string; icon: string }> = {
  draft:             { ar: 'مسودة',          en: 'Draft',          color: '#94A3B8', icon: 'file-document-outline' },
  pending:           { ar: 'قيد المراجعة',   en: 'Pending',        color: '#F59E0B', icon: 'clock-outline' },
  live:              { ar: 'منشورة',         en: 'Live',           color: '#16A34A', icon: 'check-circle-outline' },
  sold:              { ar: 'مباعة',          en: 'Sold',           color: '#3B82F6', icon: 'tag-check-outline' },
  hidden_by_owner:   { ar: 'مخفية',          en: 'Hidden',         color: '#64748B', icon: 'eye-off-outline' },
  delete_requested:  { ar: 'طلب حذف',        en: 'Delete request', color: '#B45309', icon: 'delete-clock-outline' },
  rejected:          { ar: 'مرفوضة',         en: 'Rejected',       color: '#DC2626', icon: 'close-circle-outline' },
  archived_by_admin: { ar: 'مؤرشفة',         en: 'Archived',       color: '#8A94A3', icon: 'archive-outline' },
};

const STATUS_FILTERS: ListingStatus[] = [
  'pending',
  'delete_requested',
  'live',
  'hidden_by_owner',
  'rejected',
  'archived_by_admin',
  'sold',
  'draft',
];

type PromptKind = 'reject' | 'archive' | 'notes' | 'hard-delete';

export default function AdminMarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ListingStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inline prompt sheet (reject reason / archive reason / notes editor /
  // double-confirm hard delete). One state covers all four — keeps the JSX
  // surface tight while still allowing per-action labels.
  const [prompt, setPrompt] = useState<{
    kind: PromptKind;
    listing: MarketListing;
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await adminListAll());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const replaceInList = (next: MarketListing) =>
    setListings((prev) => prev.map((x) => (x.id === next.id ? next : x)));

  const removeFromList = (id: string) =>
    setListings((prev) => prev.filter((x) => x.id !== id));

  const runApprove = async (l: MarketListing) => {
    setBusyId(l.id);
    try {
      replaceInList(await adminApprove(l.id));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const runRestore = async (l: MarketListing) => {
    setBusyId(l.id);
    try {
      replaceInList(await adminRestore(l.id));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const submitPrompt = async () => {
    if (!prompt) return;
    const { kind, listing, text } = prompt;
    if ((kind === 'reject') && !text.trim()) {
      Alert.alert(
        isRTL ? 'سبب الرفض مطلوب' : 'Reason required',
        isRTL
          ? 'يرى البائع هذا السبب — اكتب سطراً موجزاً يوضّح المشكلة.'
          : 'The seller will see this reason — write a short, clear line.'
      );
      return;
    }
    if (kind === 'hard-delete' && text.trim().toLowerCase() !== 'delete') {
      Alert.alert(
        isRTL ? 'تأكيد مطلوب' : 'Confirmation required',
        isRTL ? 'اكتب كلمة DELETE للتأكيد' : 'Type DELETE to confirm'
      );
      return;
    }
    setBusyId(listing.id);
    try {
      if (kind === 'reject') {
        replaceInList(await adminReject(listing.id, text.trim()));
      } else if (kind === 'archive') {
        replaceInList(await adminArchive(listing.id, text.trim() || undefined));
      } else if (kind === 'notes') {
        replaceInList(await adminSetNotes(listing.id, text));
      } else if (kind === 'hard-delete') {
        await adminHardDelete(listing.id);
        removeFromList(listing.id);
      }
      setPrompt(null);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={48} color={COLORS.error} />
          <Text style={{ color: COLORS.textSecondary }}>
            {isRTL ? 'هذه الصفحة للمسؤولين فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const counts: Record<ListingStatus, number> = {
    draft: 0,
    pending: 0,
    live: 0,
    sold: 0,
    hidden_by_owner: 0,
    delete_requested: 0,
    rejected: 0,
    archived_by_admin: 0,
  };
  for (const l of listings) {
    if (counts[l.status as ListingStatus] != null) counts[l.status as ListingStatus] += 1;
  }
  const filtered = listings.filter((l) => l.status === filter);
  const fmtDate = (v?: string | null) =>
    v ? new Date(v).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB') : '';

  const promptLabels = (() => {
    if (!prompt) return null;
    switch (prompt.kind) {
      case 'reject':
        return {
          title: isRTL ? 'رفض الإعلان' : 'Reject listing',
          hint: isRTL
            ? 'اكتب سبباً يراه البائع (مثلاً: صور غير واضحة، سعر غير منطقي…)'
            : 'Reason the seller will see (e.g. blurry photos, unreasonable price…)',
          placeholder: isRTL ? 'سبب الرفض' : 'Rejection reason',
          confirm: isRTL ? 'رفض' : 'Reject',
        };
      case 'archive':
        return {
          title: isRTL ? 'أرشفة الإعلان' : 'Archive listing',
          hint: isRTL
            ? 'الأرشفة إجراء إداري؛ لن يستطيع البائع استعادتها.'
            : 'Archiving is an admin action; the seller cannot restore it.',
          placeholder: isRTL ? 'سبب الأرشفة (اختياري)' : 'Reason (optional)',
          confirm: isRTL ? 'أرشفة' : 'Archive',
        };
      case 'notes':
        return {
          title: isRTL ? 'ملاحظات داخلية' : 'Internal notes',
          hint: isRTL
            ? 'هذه الملاحظات للمسؤولين فقط ولا يراها البائع.'
            : 'Visible only to admins. The seller cannot see these notes.',
          placeholder: isRTL ? 'اكتب ملاحظة…' : 'Add a note…',
          confirm: isRTL ? 'حفظ' : 'Save',
        };
      case 'hard-delete':
        return {
          title: isRTL ? 'حذف نهائي' : 'Permanently delete',
          hint: isRTL
            ? 'هذا الإجراء لا يمكن التراجع عنه. اكتب DELETE للتأكيد.'
            : 'This cannot be undone. Type DELETE to confirm.',
          placeholder: 'DELETE',
          confirm: isRTL ? 'حذف نهائي' : 'Delete forever',
        };
    }
  })();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إدارة السوق' : 'Marketplace'}</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }}>
          <MaterialCommunityIcons name="refresh" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Status filter strip — eight states, horizontally scrollable so the
          tiles stay legible on every device width. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 84 }}
        contentContainerStyle={styles.statsRow}
      >
        {STATUS_FILTERS.map((s) => {
          const meta = STATUS_META[s];
          const active = filter === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.statTile,
                active && { borderColor: meta.color, backgroundColor: meta.color + '12' },
              ]}
              onPress={() => setFilter(s)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={meta.icon as any} size={16} color={meta.color} />
              <Text style={[styles.statValue, { color: meta.color }]}>{counts[s]}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {isRTL ? meta.ar : meta.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading && filtered.length === 0 ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name={STATUS_META[filter].icon as any}
              size={48}
              color={COLORS.textSecondary}
            />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>
              {isRTL ? 'لا توجد إعلانات في هذه الحالة' : 'No listings in this state'}
            </Text>
          </View>
        ) : (
          filtered.map((l) => {
            const meta = STATUS_META[l.status as ListingStatus] ?? STATUS_META.pending;
            const busy = busyId === l.id;
            return (
              <View key={l.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardTop}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/market-detail', params: { id: l.id } })}
                >
                  {l.images?.[0] ? (
                    <Image source={{ uri: l.images[0] }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <MaterialCommunityIcons name="image-off-outline" size={22} color={COLORS.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
                      <View style={[styles.statusPill, { backgroundColor: meta.color + '20' }]}>
                        <Text style={[styles.statusPillText, { color: meta.color }]}>
                          {isRTL ? meta.ar : meta.en}
                        </Text>
                      </View>
                    </View>
                    {!!l.description && (
                      <Text style={styles.cardSub} numberOfLines={2}>{l.description}</Text>
                    )}
                    <View style={styles.metaRow}>
                      <Text style={styles.price}>
                        {Number(l.price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {l.currency}
                      </Text>
                      {!!l.city && <Text style={styles.metaDim}>· {l.city}</Text>}
                      {!!l.created_at && <Text style={styles.metaDim}>· {fmtDate(l.created_at)}</Text>}
                    </View>
                    {!!l.moderation_reason && (
                      <View style={[styles.reasonBlock, { backgroundColor: meta.color + '10' }]}>
                        <Ionicons name="information-circle-outline" size={13} color={meta.color} />
                        <Text style={[styles.reasonText, { color: meta.color }]} numberOfLines={3}>
                          {l.moderation_reason}
                        </Text>
                      </View>
                    )}
                    {!!l.admin_notes && (
                      <View style={[styles.reasonBlock, { backgroundColor: COLORS.cardAlt }]}>
                        <MaterialCommunityIcons name="note-text-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={[styles.reasonText, { color: COLORS.textSecondary }]} numberOfLines={3}>
                          {l.admin_notes}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                  {/* Primary actions per state */}
                  {(l.status === 'pending' || l.status === 'rejected' || l.status === 'hidden_by_owner' || l.status === 'draft') && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_META.live.color }]}
                      onPress={() => runApprove(l)}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      <Text style={styles.actionText}>{isRTL ? 'نشر' : 'Approve'}</Text>
                    </TouchableOpacity>
                  )}

                  {l.status !== 'rejected' && l.status !== 'archived_by_admin' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_META.rejected.color }]}
                      onPress={() => setPrompt({ kind: 'reject', listing: l, text: l.moderation_reason ?? '' })}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#fff" />
                      <Text style={styles.actionText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                    </TouchableOpacity>
                  )}

                  {l.status !== 'archived_by_admin' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_META.archived_by_admin.color }]}
                      onPress={() => setPrompt({ kind: 'archive', listing: l, text: '' })}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="archive-outline" size={14} color="#fff" />
                      <Text style={styles.actionText}>{isRTL ? 'أرشفة' : 'Archive'}</Text>
                    </TouchableOpacity>
                  )}

                  {(l.status === 'archived_by_admin' || l.status === 'rejected' || l.status === 'hidden_by_owner' || l.status === 'delete_requested') && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionGhost, { borderColor: COLORS.primary }]}
                      onPress={() => runRestore(l)}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons name="restore" size={14} color={COLORS.primary} />
                      <Text style={[styles.actionText, { color: COLORS.primary }]}>
                        {isRTL ? 'استعادة' : 'Restore'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionGhost, { borderColor: COLORS.border }]}
                    onPress={() => setPrompt({ kind: 'notes', listing: l, text: l.admin_notes ?? '' })}
                    disabled={busy}
                  >
                    <MaterialCommunityIcons name="note-edit-outline" size={14} color={COLORS.text} />
                    <Text style={[styles.actionText, { color: COLORS.text }]}>
                      {isRTL ? 'ملاحظات' : 'Notes'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionGhost, { borderColor: '#DC2626' }]}
                    onPress={() => setPrompt({ kind: 'hard-delete', listing: l, text: '' })}
                    disabled={busy}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={14} color="#DC2626" />
                    <Text style={[styles.actionText, { color: '#DC2626' }]}>
                      {isRTL ? 'حذف نهائي' : 'Delete'}
                    </Text>
                  </TouchableOpacity>

                  {busy && <ActivityIndicator size="small" color={COLORS.primary} />}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Reason / notes / hard-delete prompt */}
      <Modal
        visible={!!prompt}
        animationType="slide"
        transparent
        onRequestClose={() => setPrompt(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPrompt(null)} />
          <View style={[styles.sheet, { backgroundColor: COLORS.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: COLORS.border }]} />
            <Text style={styles.sheetTitle}>{promptLabels?.title}</Text>
            <Text style={styles.sheetHint}>{promptLabels?.hint}</Text>
            <TextInput
              value={prompt?.text ?? ''}
              onChangeText={(t) => setPrompt(prompt ? { ...prompt, text: t } : null)}
              placeholder={promptLabels?.placeholder}
              placeholderTextColor={COLORS.textSecondary}
              multiline={prompt?.kind !== 'hard-delete'}
              autoCapitalize={prompt?.kind === 'hard-delete' ? 'characters' : 'sentences'}
              style={[
                styles.sheetInput,
                {
                  color: COLORS.text,
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.background,
                  textAlign: isRTL ? 'right' : 'left',
                  minHeight: prompt?.kind === 'hard-delete' ? 48 : 88,
                },
              ]}
            />
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.sheetSecondary, { borderColor: COLORS.border }]}
                onPress={() => setPrompt(null)}
              >
                <Text style={[styles.sheetSecondaryText, { color: COLORS.text }]}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sheetPrimary,
                  { backgroundColor: prompt?.kind === 'hard-delete' ? '#DC2626' : COLORS.primary },
                ]}
                onPress={submitPrompt}
              >
                <Text style={styles.sheetPrimaryText}>{promptLabels?.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 50, gap: 6 },
  statsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  statTile: {
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
    minWidth: 86,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, color: C.textSecondary, fontWeight: '700' },
  card: {
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.md },
  thumb: { width: 76, height: 76, borderRadius: BORDER_RADIUS.md, backgroundColor: C.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { color: C.text, fontWeight: '800', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  cardSub: { color: C.textSecondary, fontSize: 12, marginTop: 3, textAlign: isRTL ? 'right' : 'left' },
  metaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  price: { color: C.primary, fontWeight: '800', fontSize: 14 },
  metaDim: { color: C.textSecondary, fontSize: 11 },
  reasonBlock: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  reasonText: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 16, textAlign: isRTL ? 'right' : 'left' },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingTop: SPACING.sm,
  },
  actionBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.md,
  },
  actionGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 28,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: C.text, fontWeight: '800', fontSize: 17, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
  sheetHint: { color: C.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' },
  sheetInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  sheetSecondary: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  sheetSecondaryText: { fontWeight: '700' },
  sheetPrimary: {
    flex: 2,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  sheetPrimaryText: { color: '#fff', fontWeight: '800' },
});
