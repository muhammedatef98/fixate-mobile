import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  adminListAll,
  updateListingStatus,
  type MarketListing,
  type ListingStatus,
} from '../services/marketService';

const STATUS_FILTERS: ListingStatus[] = ['pending', 'active', 'rejected', 'archived'];

export default function AdminMarketScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const isAdmin = (userProfile as any)?.is_admin === true;

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ListingStatus>('pending');

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

  const updateStatus = async (l: MarketListing, status: ListingStatus) => {
    try {
      const next = await updateListingStatus(l.id, status);
      setListings((prev) => prev.map((x) => (x.id === l.id ? next : x)));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    }
  };

  const styles = createStyles(COLORS, isRTL);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert" size={48} color={COLORS.error} />
          <Text style={{ color: COLORS.textSecondary }}>
            {isRTL ? 'هذه الصفحة للمسؤولين فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const filtered = listings.filter((l) => l.status === filter);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'مراجعة السوق' : 'Market moderation'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8 }}
        style={{ maxHeight: 56 }}
      >
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setFilter(s)}
            style={[
              styles.chip,
              filter === s && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
            ]}
          >
            <Text style={[styles.chipText, filter === s && { color: '#fff' }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
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
            <Text style={{ color: COLORS.textSecondary }}>
              {isRTL ? 'لا توجد إعلانات في هذه الحالة' : 'No listings in this state'}
            </Text>
          </View>
        ) : (
          filtered.map((l) => (
            <View key={l.id} style={styles.card}>
              {l.images?.[0] && <Image source={{ uri: l.images[0] }} style={styles.thumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>{l.description ?? ''}</Text>
                <Text style={styles.price}>{l.price} {l.currency}{l.city ? `  •  ${l.city}` : ''}</Text>
                <View style={styles.actions}>
                  {l.status !== 'active' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                      onPress={() => updateStatus(l, 'active')}
                    >
                      <Text style={styles.actionText}>{isRTL ? 'موافقة' : 'Approve'}</Text>
                    </TouchableOpacity>
                  )}
                  {l.status !== 'rejected' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
                      onPress={() => updateStatus(l, 'rejected')}
                    >
                      <Text style={styles.actionText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                    </TouchableOpacity>
                  )}
                  {l.status !== 'archived' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.textSecondary }]}
                      onPress={() => updateStatus(l, 'archived')}
                    >
                      <Text style={styles.actionText}>{isRTL ? 'أرشفة' : 'Archive'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  chipText: { color: C.text, fontWeight: '600', textTransform: 'capitalize' },
  card: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  thumb: { width: 72, height: 72, borderRadius: BORDER_RADIUS.md, backgroundColor: C.background },
  cardTitle: { color: C.text, fontWeight: '700', fontSize: 15 },
  cardSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  price: { color: C.primary, fontWeight: '700', marginTop: 6 },
  actions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BORDER_RADIUS.md },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
