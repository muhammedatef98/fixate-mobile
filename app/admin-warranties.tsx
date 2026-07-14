import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { fmtAdminDate } from '../utils/dateFormat';
import {
  AdminScreenHeader,
  AdminSearchBar,
  AdminFilterChips,
  AdminStatusPill,
  AdminEmptyState,
  type AdminFilterChip,
} from '../components/admin/AdminUI';
import { deriveWarranty, deviceLabel, WARRANTY_MONTHS, type WarrantyInfo } from '../utils/warranty';
import GearLoader from '../components/GearLoader';

interface WarrantyOrder {
  id: string;
  order_number?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string | null;
  user_id?: string | null;
  customer?: { name?: string | null } | { name?: string | null }[] | null;
}

interface WarrantyRow extends WarrantyOrder {
  warranty: WarrantyInfo;
}

type FilterKey = 'all' | 'active' | 'expired';

const customerName = (o: WarrantyOrder, isRTL: boolean): string => {
  const c = Array.isArray(o.customer) ? o.customer[0] : o.customer;
  return c?.name?.trim() || (isRTL ? 'عميل' : 'Customer');
};

const orderRef = (o: WarrantyOrder) => o.order_number ?? `#${o.id.slice(0, 8).toUpperCase()}`;

export default function AdminWarrantiesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);
  const { isAdmin, checking: adminChecking } = useIsAdmin();

  const [rows, setRows] = useState<WarrantyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select(
          'id, order_number, device_brand, device_model, status, created_at, updated_at, user_id, customer:users!user_id(name)'
        )
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(500);

      const mapped: WarrantyRow[] = (data ?? [])
        .map((o: any) => {
          const warranty = deriveWarranty(o);
          return warranty ? ({ ...o, warranty } as WarrantyRow) : null;
        })
        .filter(Boolean) as WarrantyRow[];
      setRows(mapped);
    } catch (e) {
      logger.warn('admin warranties load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminChecking && isAdmin) load();
  }, [adminChecking, isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const counts = useMemo(() => {
    let active = 0;
    for (const r of rows) if (r.warranty.isActive) active += 1;
    return { all: rows.length, active, expired: rows.length - active };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'active' && !r.warranty.isActive) return false;
      if (filter === 'expired' && r.warranty.isActive) return false;
      if (!q) return true;
      return (
        deviceLabel(r, isRTL).toLowerCase().includes(q) ||
        customerName(r, isRTL).toLowerCase().includes(q) ||
        orderRef(r).toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter, isRTL]);

  const chips: AdminFilterChip<FilterKey>[] = [
    { key: 'all', ar: 'الكل', en: 'All', count: counts.all },
    { key: 'active', ar: 'ساري', en: 'Active', count: counts.active },
    { key: 'expired', ar: 'منتهٍ', en: 'Expired', count: counts.expired },
  ];

  if (!adminChecking && !isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'الضمانات' : 'Warranties'} />
        <AdminEmptyState
          icon="lock-outline"
          title={isRTL ? 'غير مصرّح' : 'Not authorized'}
          body={isRTL ? 'هذه الصفحة للمشرفين فقط.' : 'This page is for admins only.'}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      <AdminScreenHeader
        title={isRTL ? 'ضمانات الإصلاح' : 'Repair warranties'}
        subtitle={
          isRTL
            ? `${counts.active} ساري · ${counts.expired} منتهٍ`
            : `${counts.active} active · ${counts.expired} expired`
        }
      />

      <View style={styles.controls}>
        <AdminSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={isRTL ? 'بحث بالجهاز أو العميل أو رقم الطلب…' : 'Search device, customer or order…'}
        />
        <AdminFilterChips filters={chips} value={filter} onChange={setFilter} />
      </View>

      {loading || adminChecking ? (
        <View style={styles.loader}>
          <GearLoader size={48} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48, gap: SPACING.sm, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={{ marginTop: 40 }}>
              <AdminEmptyState
                icon="shield-outline"
                title={isRTL ? 'لا توجد ضمانات' : 'No warranties'}
                body={
                  isRTL
                    ? `تظهر هنا كل الطلبات المكتملة، وكل منها مشمول بضمان ${WARRANTY_MONTHS} شهراً من تاريخ الإكمال.`
                    : `Every completed order appears here, each covered for ${WARRANTY_MONTHS} months from completion.`
                }
              />
            </View>
          ) : (
            filtered.map((r) => {
              const w = r.warranty;
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/admin-order-detail?id=${r.id}`)}
                  style={styles.card}
                >
                  <View style={[styles.leftBar, { backgroundColor: w.isActive ? COLORS.primary : COLORS.border }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.device} numberOfLines={1}>
                        {deviceLabel(r, isRTL)}
                      </Text>
                      <AdminStatusPill
                        label={w.isActive ? (isRTL ? 'ساري' : 'Active') : (isRTL ? 'منتهٍ' : 'Expired')}
                        tone={w.isActive ? 'success' : 'neutral'}
                        icon={w.isActive ? 'shield-checkmark' : 'shield-outline'}
                      />
                    </View>

                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="account-outline" size={13} color={COLORS.textLight} />
                      <Text style={styles.meta} numberOfLines={1}>
                        {customerName(r, isRTL)}
                      </Text>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {orderRef(r)}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="calendar-check-outline" size={13} color={COLORS.textLight} />
                      <Text style={styles.meta}>
                        {(isRTL ? 'من ' : 'From ') + fmtAdminDate(w.startDate.toISOString(), isRTL)}
                      </Text>
                      <Text style={styles.dot}>·</Text>
                      <Text style={[styles.meta, w.isActive && { color: COLORS.primary, fontWeight: '700' }]}>
                        {(w.isActive ? (isRTL ? 'حتى ' : 'until ') : (isRTL ? 'انتهى ' : 'ended ')) +
                          fmtAdminDate(w.endDate.toISOString(), isRTL)}
                      </Text>
                    </View>

                    {w.isActive && (
                      <Text style={styles.remaining}>
                        {isRTL ? `متبقٍّ ${w.daysRemaining} يوماً` : `${w.daysRemaining} days remaining`}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    controls: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm },
    card: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: 14,
      overflow: 'hidden',
    },
    leftBar: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 2,
      marginVertical: -14,
      marginStart: -14,
    },
    rowTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    device: { flex: 1, fontSize: 15, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    metaRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      flexWrap: 'wrap',
    },
    meta: { fontSize: 12, color: C.textSecondary },
    dot: { fontSize: 12, color: C.textLight },
    remaining: { fontSize: 11.5, fontWeight: '700', color: C.primary, textAlign: isRTL ? 'right' : 'left' },
  });
