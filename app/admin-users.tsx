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
  TextInput,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';
import Avatar from '../components/Avatar';
import {
  setUserStatus,
  setUserNotes,
  listModerationLogs,
  type UserAccountStatus,
  type ModerationLog,
} from '../services/moderationService';
import { getFriendlyError } from '../utils/errorMessages';

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: UserAccountStatus | null;
  admin_notes: string | null;
  created_at: string | null;
}

type FilterKey = 'all' | 'customer' | 'technician' | 'admin' | 'suspended';
type SortKey = 'newest' | 'name';

const STATUS_META = (s: string | null, isRTL: boolean) => {
  switch (s) {
    case 'suspended':
      return { label: isRTL ? 'موقوف' : 'Suspended', color: '#F59E0B' };
    case 'blocked':
      return { label: isRTL ? 'محظور' : 'Blocked', color: '#DC2626' };
    default:
      return { label: isRTL ? 'نشط' : 'Active', color: '#16A34A' };
  }
};

export default function AdminUsersScreen() {
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role, avatar_url, is_admin, account_status, admin_notes, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      setUsers((data ?? []) as AdminUser[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  const styles = createStyles(COLORS, isRTL);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((u) => {
      if (filter === 'admin' && !u.is_admin) return false;
      if (filter === 'customer' && (u.role !== 'customer' || u.is_admin)) return false;
      if (filter === 'technician' && u.role !== 'technician') return false;
      if (filter === 'suspended' && u.account_status === 'active') return false;
      if (filter === 'suspended' && !u.account_status) return false;
      if (!q) return true;
      return (
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) =>
      sort === 'name'
        ? (a.name ?? '').localeCompare(b.name ?? '')
        : (b.created_at ?? '').localeCompare(a.created_at ?? '')
    );
  }, [users, query, filter, sort]);

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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack('/admin')}>
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isRTL ? 'المستخدمون' : 'Users'}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12 }}>
            {isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const FILTERS: { key: FilterKey; ar: string; en: string }[] = [
    { key: 'all', ar: 'الكل', en: 'All' },
    { key: 'customer', ar: 'عملاء', en: 'Customers' },
    { key: 'technician', ar: 'فنيون', en: 'Technicians' },
    { key: 'admin', ar: 'مدراء', en: 'Admins' },
    { key: 'suspended', ar: 'موقوفون', en: 'Restricted' },
  ];

  const roleLabel = (u: AdminUser) => {
    if (u.is_admin) return isRTL ? 'مدير' : 'Admin';
    if (u.role === 'technician') return isRTL ? 'فني' : 'Technician';
    return isRTL ? 'عميل' : 'Customer';
  };
  const roleColor = (u: AdminUser) =>
    u.is_admin ? '#8B5CF6' : u.role === 'technician' ? '#3B82F6' : '#16A34A';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/admin')} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إدارة المستخدمين' : 'User Management'}</Text>
        <TouchableOpacity onPress={() => setSort(sort === 'newest' ? 'name' : 'newest')}>
          <Ionicons name="swap-vertical" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={isRTL ? 'ابحث بالاسم أو البريد أو الجوال' : 'Search name, email or phone'}
          placeholderTextColor={COLORS.textSecondary}
          style={[styles.searchInput, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            >
              <Text style={[styles.filterChipText, active && { color: '#fff' }]}>
                {isRTL ? f.ar : f.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-search-outline" size={56} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12 }}>
              {isRTL ? 'لا يوجد مستخدمون' : 'No users found'}
            </Text>
          </View>
        ) : (
          visible.map((u) => {
            const st = STATUS_META(u.account_status, isRTL);
            return (
              <TouchableOpacity
                key={u.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setSelected(u)}
              >
                <Avatar name={u.name} uri={u.avatar_url} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {u.name || (isRTL ? 'بدون اسم' : 'No name')}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>{u.email || u.phone || '—'}</Text>
                </View>
                {u.account_status && u.account_status !== 'active' && (
                  <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                )}
                <View style={[styles.rolePill, { backgroundColor: roleColor(u) + '20' }]}>
                  <Text style={[styles.rolePillText, { color: roleColor(u) }]}>{roleLabel(u)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <UserDetailModal
        user={selected}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          setSelected(updated);
        }}
        COLORS={COLORS}
        isRTL={isRTL}
        language={language}
      />
    </SafeAreaView>
  );
}

function UserDetailModal({
  user,
  onClose,
  onChanged,
  COLORS,
  isRTL,
  language,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onChanged: (u: AdminUser) => void;
  COLORS: any;
  isRTL: boolean;
  language: 'ar' | 'en';
}) {
  const [notes, setNotes] = useState('');
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [busy, setBusy] = useState(false);
  const styles = createStyles(COLORS, isRTL);

  useEffect(() => {
    if (!user) return;
    setNotes(user.admin_notes ?? '');
    listModerationLogs('user', user.id).then(setLogs).catch(() => setLogs([]));
  }, [user?.id]);

  if (!user) return null;

  const applyStatus = async (status: UserAccountStatus) => {
    if (status === user.account_status) return;
    setBusy(true);
    try {
      await setUserStatus(user.id, status);
      onChanged({ ...user, account_status: status });
      listModerationLogs('user', user.id).then(setLogs).catch(() => undefined);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setBusy(true);
    try {
      await setUserNotes(user.id, notes.trim());
      onChanged({ ...user, admin_notes: notes.trim() });
      Alert.alert(isRTL ? 'تم' : 'Saved', isRTL ? 'تم حفظ الملاحظات' : 'Notes saved');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setBusy(false);
    }
  };

  const STATUSES: { id: UserAccountStatus; ar: string; en: string; color: string }[] = [
    { id: 'active', ar: 'نشط', en: 'Active', color: '#16A34A' },
    { id: 'suspended', ar: 'إيقاف مؤقت', en: 'Suspend', color: '#F59E0B' },
    { id: 'blocked', ar: 'حظر', en: 'Block', color: '#DC2626' },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.sheetUserRow}>
              <Avatar name={user.name} uri={user.avatar_url} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName} numberOfLines={1}>
                  {user.name || (isRTL ? 'بدون اسم' : 'No name')}
                </Text>
                <Text style={styles.sheetSub} numberOfLines={1}>{user.email || user.phone || '—'}</Text>
              </View>
            </View>

            <Text style={styles.sheetLabel}>{isRTL ? 'حالة الحساب' : 'Account status'}</Text>
            <Text style={styles.sheetHint}>
              {isRTL
                ? 'الإيقاف أو الحظر يمنع المستخدم من استخدام التطبيق نهائياً.'
                : 'Suspending or blocking locks the user out of the entire app.'}
            </Text>
            <View style={styles.statusRow}>
              {STATUSES.map((s) => {
                const active = (user.account_status ?? 'active') === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    disabled={busy}
                    onPress={() => applyStatus(s.id)}
                    style={[
                      styles.statusBtn,
                      { borderColor: s.color },
                      active && { backgroundColor: s.color },
                    ]}
                  >
                    <Text style={[styles.statusBtnText, { color: active ? '#fff' : s.color }]}>
                      {isRTL ? s.ar : s.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>{isRTL ? 'ملاحظات إدارية' : 'Admin notes'}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={isRTL ? 'ملاحظة داخلية (لا تظهر للمستخدم)' : 'Internal note (not visible to the user)'}
              placeholderTextColor={COLORS.textSecondary}
              style={styles.notesInput}
              textAlign={isRTL ? 'right' : 'left'}
            />
            <TouchableOpacity
              style={[styles.saveNotesBtn, busy && { opacity: 0.6 }]}
              onPress={saveNotes}
              disabled={busy}
            >
              <Text style={styles.saveNotesText}>{isRTL ? 'حفظ الملاحظات' : 'Save notes'}</Text>
            </TouchableOpacity>

            {logs.length > 0 && (
              <>
                <Text style={styles.sheetLabel}>{isRTL ? 'سجل الإجراءات' : 'Action history'}</Text>
                {logs.map((l) => (
                  <View key={l.id} style={styles.logRow}>
                    <Ionicons name="ellipse" size={7} color={COLORS.primary} />
                    <Text style={styles.logText}>
                      {l.action}
                      {'  ·  '}
                      {new Date(l.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')}
                    </Text>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    },
    title: { fontSize: 20, fontWeight: '800', color: C.text },
    searchBox: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: SPACING.lg,
      marginBottom: 8,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchInput: { flex: 1, fontSize: 14 },
    filterRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: SPACING.lg,
      paddingBottom: 8,
      flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    filterChipText: { color: C.text, fontWeight: '700', fontSize: 12 },
    card: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
      marginBottom: 10,
    },
    name: { color: C.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    sub: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    rolePillText: { fontSize: 11, fontWeight: '800' },
    empty: { alignItems: 'center', paddingVertical: 60 },

    backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      paddingHorizontal: SPACING.lg,
      paddingTop: 8,
      paddingBottom: 24,
      maxHeight: '88%',
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.borderStrong, alignSelf: 'center', marginBottom: 14,
    },
    sheetUserRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    sheetName: { color: C.text, fontSize: 16, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    sheetSub: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    sheetLabel: {
      color: C.text, fontWeight: '800', fontSize: 13,
      marginTop: 16, marginBottom: 4, textAlign: isRTL ? 'right' : 'left',
    },
    sheetHint: { color: C.textSecondary, fontSize: 11, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
    statusRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 },
    statusBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1.5,
      alignItems: 'center',
    },
    statusBtnText: { fontWeight: '800', fontSize: 13 },
    notesInput: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      minHeight: 80,
      color: C.text,
      backgroundColor: C.background,
      textAlignVertical: 'top',
      fontSize: 14,
    },
    saveNotesBtn: {
      marginTop: 8,
      backgroundColor: C.primary,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 11,
      alignItems: 'center',
    },
    saveNotesText: { color: '#fff', fontWeight: '800' },
    logRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 5,
    },
    logText: { color: C.textSecondary, fontSize: 12 },
    closeBtn: {
      marginTop: 18,
      paddingVertical: 13,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.cardAlt,
      alignItems: 'center',
    },
    closeBtnText: { color: C.text, fontWeight: '700' },
  });
