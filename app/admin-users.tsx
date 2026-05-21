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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';
import Avatar from '../components/Avatar';

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  created_at: string | null;
}

type FilterKey = 'all' | 'customer' | 'technician' | 'admin';

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

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role, avatar_url, is_admin, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(300);
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
    return users.filter((u) => {
      if (filter === 'admin' && !u.is_admin) return false;
      if (filter === 'customer' && (u.role !== 'customer' || u.is_admin)) return false;
      if (filter === 'technician' && u.role !== 'technician') return false;
      if (!q) return true;
      return (
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, query, filter]);

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
        <Text style={[styles.title, { fontSize: 14, color: COLORS.primary }]}>{users.length}</Text>
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
            <MaterialCommunityIcons name="account-search-outline" size={56} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12 }}>
              {isRTL ? 'لا يوجد مستخدمون' : 'No users found'}
            </Text>
          </View>
        ) : (
          visible.map((u) => (
            <View key={u.id} style={styles.card}>
              <Avatar name={u.name} uri={u.avatar_url} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {u.name || (isRTL ? 'بدون اسم' : 'No name')}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {u.email || u.phone || '—'}
                </Text>
              </View>
              <View style={[styles.rolePill, { backgroundColor: roleColor(u) + '20' }]}>
                <Text style={[styles.rolePillText, { color: roleColor(u) }]}>{roleLabel(u)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
    rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    rolePillText: { fontSize: 11, fontWeight: '800' },
    empty: { alignItems: 'center', paddingVertical: 60 },
  });
