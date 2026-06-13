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
  Modal,
  Pressable,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import {
  AdminScreenHeader,
  AdminSearchBar,
  AdminEmptyState,
  AdminSectionLabel,
  ADMIN_CARD_SHADOW,
  adminTimeAgo,
} from '../components/admin/AdminUI';
import { useRequirePermission, invalidatePermissionsCache } from '../hooks/usePermissions';
import {
  listStaff,
  listRoles,
  listPermissionCatalog,
  getRolePermissions,
  searchPromotableUsers,
  assignStaff,
  setStaffActive,
  removeStaff,
  setPermissionOverride,
  computeEffective,
  listAudit,
  type StaffMember,
  type AdminRole,
  type AdminPermissionRow,
  type AuditEntry,
} from '../services/adminTeamService';
import { PERMISSION_GROUPS, type PermissionKey } from '../constants/permissions';
import { getFriendlyError } from '../utils/errorMessages';

type Tab = 'staff' | 'audit';

export default function AdminTeamScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const { loading: permLoading, can } = useRequirePermission('staff_management');

  const [tab, setTab] = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [catalog, setCatalog] = useState<AdminPermissionRow[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const load = useCallback(async () => {
    const [s, r, c, a] = await Promise.all([
      listStaff(),
      listRoles(),
      listPermissionCatalog(),
      listAudit(60),
    ]);
    setStaff(s);
    setRoles(r);
    setCatalog(c);
    setAudit(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!permLoading) load();
  }, [permLoading, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const roleName = (s: StaffMember) => (isRTL ? s.role_name_ar : s.role_name_en) || s.role_key;

  if (permLoading || loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.card} />
      <AdminScreenHeader
        title={isRTL ? 'الفريق والصلاحيات' : 'Admin Team & Roles'}
        subtitle={isRTL ? `${staff.length} عضو` : `${staff.length} members`}
        rightIcon="person-add-outline"
        rightLabel={isRTL ? 'إضافة' : 'Add'}
        onRightPress={() => setAddOpen(true)}
      />

      {/* Tabs */}
      <View style={[styles.tabsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(['staff', 'audit'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && { borderBottomColor: COLORS.primary }]}
          >
            <Text style={[styles.tabText, { color: tab === t ? COLORS.primary : COLORS.textSecondary }]}>
              {t === 'staff' ? (isRTL ? 'الأعضاء' : 'Members') : (isRTL ? 'السجل' : 'Audit log')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {tab === 'staff' ? (
          staff.length === 0 ? (
            <AdminEmptyState
              icon="account-group-outline"
              title={isRTL ? 'لا يوجد أعضاء فريق بعد' : 'No team members yet'}
              body={isRTL ? 'أضف مستخدماً حالياً ومنحه دوراً إدارياً.' : 'Promote an existing user to an admin role.'}
              ctaLabel={isRTL ? 'إضافة عضو' : 'Add member'}
              onCtaPress={() => setAddOpen(true)}
            />
          ) : (
            staff.map((s) => (
              <View key={s.id} style={[styles.card, ADMIN_CARD_SHADOW]}>
                <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {s.user_name || s.user_email || s.user_id.slice(0, 8)}
                    </Text>
                    {!!s.user_email && <Text style={styles.sub} numberOfLines={1}>{s.user_email}</Text>}
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: COLORS.primary + '18' }]}>
                    <Text style={[styles.rolePillText, { color: COLORS.primary }]}>{roleName(s)}</Text>
                  </View>
                </View>

                <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.statusDot, { backgroundColor: s.is_active ? '#16A34A' : '#9CA3AF' }]} />
                  <Text style={styles.metaText}>
                    {s.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معطّل' : 'Disabled')}
                  </Text>
                  {!!(s.overrides && s.overrides.length) && (
                    <Text style={[styles.metaText, { color: COLORS.primary }]}>
                      {' · '}
                      {isRTL ? `${s.overrides.length} تخصيص` : `${s.overrides.length} override(s)`}
                    </Text>
                  )}
                  <Text style={[styles.metaText, { opacity: 0.7 }]}>
                    {' · '}
                    {adminTimeAgo(s.updated_at, isRTL)}
                  </Text>
                </View>

                <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setEditing(s)}>
                    <Ionicons name="options-outline" size={16} color={COLORS.primary} />
                    <Text style={[styles.actionText, { color: COLORS.primary }]}>
                      {isRTL ? 'الصلاحيات' : 'Permissions'}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <Switch
                    value={s.is_active}
                    onValueChange={async (v) => {
                      try {
                        await setStaffActive(s.user_id, v);
                        invalidatePermissionsCache();
                        await load();
                      } catch (e) {
                        Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
                      }
                    }}
                    trackColor={{ true: COLORS.primary }}
                  />
                </View>
              </View>
            ))
          )
        ) : (
          <AuditList audit={audit} isRTL={isRTL} styles={styles} COLORS={COLORS} />
        )}
      </ScrollView>

      {addOpen && (
        <AddStaffModal
          roles={roles}
          isRTL={isRTL}
          COLORS={COLORS}
          styles={styles}
          onClose={() => setAddOpen(false)}
          onDone={async () => {
            setAddOpen(false);
            invalidatePermissionsCache();
            await load();
          }}
        />
      )}

      {editing && (
        <EditStaffModal
          member={editing}
          roles={roles}
          catalog={catalog}
          isRTL={isRTL}
          COLORS={COLORS}
          styles={styles}
          onClose={() => setEditing(null)}
          onChanged={async () => {
            invalidatePermissionsCache();
            await load();
          }}
          onRemoved={async () => {
            setEditing(null);
            invalidatePermissionsCache();
            await load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Audit list ───────────────────────────────────────────────────────────
function AuditList({ audit, isRTL, styles, COLORS }: any) {
  if (!audit.length) {
    return (
      <AdminEmptyState
        icon="history"
        title={isRTL ? 'لا يوجد سجل بعد' : 'No audit entries yet'}
      />
    );
  }
  const actionLabel = (a: string) => {
    const map: Record<string, [string, string]> = {
      'staff.assign': ['تعيين دور', 'Assigned role'],
      'staff.enable': ['تفعيل عضو', 'Enabled member'],
      'staff.disable': ['تعطيل عضو', 'Disabled member'],
      'staff.remove': ['إزالة عضو', 'Removed member'],
      'staff.override': ['تعديل صلاحية', 'Permission override'],
    };
    const m = map[a];
    return m ? (isRTL ? m[0] : m[1]) : a;
  };
  return (
    <View>
      {audit.map((e: AuditEntry) => (
        <View key={e.id} style={[styles.auditRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.auditDot, { backgroundColor: COLORS.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.auditTitle}>{actionLabel(e.action)}</Text>
            <Text style={styles.auditMeta}>
              {(e.actor_name || (isRTL ? 'النظام' : 'System'))}
              {e.details?.role ? ` · ${e.details.role}` : ''}
              {e.details?.permission ? ` · ${e.details.permission} (${e.details.effect ?? 'clear'})` : ''}
              {' · '}
              {adminTimeAgo(e.created_at, isRTL)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Add staff modal ──────────────────────────────────────────────────────
function AddStaffModal({ roles, isRTL, COLORS, styles, onClose, onDone }: any) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [roleKey, setRoleKey] = useState<string>('support_agent');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      const r = await searchPromotableUsers(query);
      if (active) setResults(r);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await assignStaff(picked.id, roleKey);
      await onDone();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{isRTL ? 'إضافة عضو فريق' : 'Add team member'}</Text>
        <Text style={styles.sheetHint}>
          {isRTL ? 'ابحث عن مستخدم حالي لترقيته.' : 'Search an existing user to promote.'}
        </Text>

        {!picked ? (
          <>
            <AdminSearchBar value={query} onChangeText={setQuery} placeholder={isRTL ? 'الاسم أو البريد أو الجوال' : 'Name, email or phone'} />
            <ScrollView style={{ maxHeight: 280, marginTop: 8 }}>
              {results.map((u) => (
                <TouchableOpacity key={u.id} style={styles.userRow} onPress={() => setPicked(u)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.name || u.email || u.id.slice(0, 8)}</Text>
                    {!!u.email && <Text style={styles.sub}>{u.email}</Text>}
                  </View>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))}
              {!results.length && <Text style={styles.sub}>{isRTL ? 'لا نتائج' : 'No results'}</Text>}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={[styles.userRow, { backgroundColor: COLORS.primary + '10' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{picked.name || picked.email}</Text>
                {!!picked.email && <Text style={styles.sub}>{picked.email}</Text>}
              </View>
              <TouchableOpacity onPress={() => setPicked(null)}>
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{isRTL ? 'تغيير' : 'Change'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetHint, { marginTop: 14 }]}>{isRTL ? 'اختر الدور' : 'Choose role'}</Text>
            <View style={styles.roleGrid}>
              {roles.map((r: AdminRole) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setRoleKey(r.key)}
                  style={[styles.roleChip, roleKey === r.key && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '14' }]}
                >
                  <Text style={[styles.roleChipText, roleKey === r.key && { color: COLORS.primary, fontWeight: '800' }]}>
                    {isRTL ? r.name_ar : r.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{isRTL ? 'منح الوصول' : 'Grant access'}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Edit staff modal (role + per-permission overrides) ────────────────────
function EditStaffModal({ member, roles, catalog, isRTL, COLORS, styles, onClose, onChanged, onRemoved }: any) {
  const [roleKey, setRoleKey] = useState<string>(member.role_key);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [overrides, setOverrides] = useState(member.overrides ?? []);
  const [busy, setBusy] = useState(false);

  const currentRole: AdminRole | undefined = roles.find((r: AdminRole) => r.key === roleKey);
  const isSuper = roleKey === 'super_admin';

  useEffect(() => {
    (async () => {
      if (currentRole) setRolePerms(await getRolePermissions(currentRole.id));
    })();
  }, [currentRole?.id]);

  const effective = useMemo(
    () => computeEffective(rolePerms, overrides),
    [rolePerms, overrides]
  );

  const changeRole = async (newKey: string) => {
    setBusy(true);
    try {
      await assignStaff(member.user_id, newKey);
      setRoleKey(newKey);
      await onChanged();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBusy(false);
    }
  };

  const cycleOverride = async (permKey: PermissionKey) => {
    if (isSuper) return; // Super Admin is always full — no per-perm tuning.
    const inRole = rolePerms.includes(permKey);
    const existing = overrides.find((o: any) => o.permission_key === permKey);
    // Cycle: default → (grant if not in role / revoke if in role) → cleared
    let next: 'grant' | 'revoke' | null;
    if (!existing) next = inRole ? 'revoke' : 'grant';
    else next = null;
    try {
      await setPermissionOverride(member.user_id, permKey, next);
      setOverrides((prev: any[]) => {
        const rest = prev.filter((o) => o.permission_key !== permKey);
        return next ? [...rest, { permission_key: permKey, effect: next }] : rest;
      });
      await onChanged();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      isRTL ? 'إزالة العضو' : 'Remove member',
      isRTL ? 'سيتم سحب كل الصلاحيات الإدارية.' : 'This revokes all admin access for this user.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إزالة' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStaff(member.user_id);
              await onRemoved();
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
            }
          },
        },
      ]
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: '88%' }]}>
        <Text style={styles.sheetTitle}>{member.user_name || member.user_email}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.sheetHint, { marginTop: 4 }]}>{isRTL ? 'الدور' : 'Role'}</Text>
          <View style={styles.roleGrid}>
            {roles.map((r: AdminRole) => (
              <TouchableOpacity
                key={r.id}
                disabled={busy}
                onPress={() => changeRole(r.key)}
                style={[styles.roleChip, roleKey === r.key && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '14' }]}
              >
                <Text style={[styles.roleChipText, roleKey === r.key && { color: COLORS.primary, fontWeight: '800' }]}>
                  {isRTL ? r.name_ar : r.name_en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isSuper ? (
            <View style={[styles.superNote, { backgroundColor: COLORS.primary + '12' }]}>
              <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
              <Text style={[styles.superNoteText, { color: COLORS.primary }]}>
                {isRTL ? 'المدير العام يملك صلاحية كاملة دائماً.' : 'Super Admin always has full access.'}
              </Text>
            </View>
          ) : (
            <>
              <AdminSectionLabel
                icon="key-outline"
                text={isRTL ? 'الصلاحيات' : 'Permissions'}
                hint={isRTL ? 'اضغط للتبديل بين الافتراضي/منح/سحب' : 'Tap to toggle default / grant / revoke'}
              />
              {PERMISSION_GROUPS.map((g) => {
                const perms = catalog.filter((c: AdminPermissionRow) => c.group_key === g.key && c.key !== 'full_admin_access');
                if (!perms.length) return null;
                return (
                  <View key={g.key} style={{ marginBottom: 10 }}>
                    <Text style={styles.groupLabel}>{isRTL ? g.labelAr : g.labelEn}</Text>
                    {perms.map((p: AdminPermissionRow) => {
                      const inRole = rolePerms.includes(p.key);
                      const ov = overrides.find((o: any) => o.permission_key === p.key);
                      const on = effective.has(p.key);
                      let badge = inRole ? (isRTL ? 'من الدور' : 'from role') : (isRTL ? 'افتراضي' : 'default');
                      if (ov) badge = ov.effect === 'grant' ? (isRTL ? 'ممنوح' : 'granted') : (isRTL ? 'مسحوب' : 'revoked');
                      const badgeColor = ov ? (ov.effect === 'grant' ? '#16A34A' : '#DC2626') : COLORS.textSecondary;
                      return (
                        <TouchableOpacity
                          key={p.key}
                          style={[styles.permRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                          onPress={() => cycleOverride(p.key as PermissionKey)}
                        >
                          <View style={[styles.permCheck, { borderColor: on ? COLORS.primary : COLORS.border, backgroundColor: on ? COLORS.primary : 'transparent' }]}>
                            {on && <Ionicons name="checkmark" size={13} color="#fff" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.permLabel}>{isRTL ? p.label_ar : p.label_en}</Text>
                          </View>
                          <Text style={[styles.permBadge, { color: badgeColor }]}>{badge}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}

          <TouchableOpacity style={styles.removeBtn} onPress={confirmRemove}>
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
            <Text style={styles.removeText}>{isRTL ? 'إزالة من الفريق' : 'Remove from team'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    tabsRow: { borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: 14, fontWeight: '700' },
    card: { backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg ?? 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
    cardTop: { alignItems: 'center', gap: 10 },
    name: { color: C.text, fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    sub: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    rolePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    rolePillText: { fontSize: 12, fontWeight: '800' },
    metaRow: { alignItems: 'center', gap: 6, marginTop: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    metaText: { color: C.textSecondary, fontSize: 12 },
    actions: { alignItems: 'center', marginTop: 12, gap: 10 },
    actionBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.primary + '12' },
    actionText: { fontSize: 13, fontWeight: '700' },
    // modals
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, paddingBottom: 36 },
    sheetTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    sheetHint: { color: C.textSecondary, fontSize: 13, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    userRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginTop: 8 },
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    roleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card },
    roleChipText: { fontSize: 13, fontWeight: '600', color: C.text },
    primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    groupLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '800', marginTop: 6, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' },
    permRow: { alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    permCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    permLabel: { color: C.text, fontSize: 14, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' },
    permBadge: { fontSize: 11, fontWeight: '700' },
    superNote: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginTop: 14 },
    superNoteText: { fontSize: 13, fontWeight: '700', flex: 1, textAlign: isRTL ? 'right' : 'left' },
    removeBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DC2626' },
    removeText: { color: '#DC2626', fontSize: 14, fontWeight: '800' },
    auditRow: { alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    auditTitle: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    auditMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  });
