import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { adminListRatings } from '../services/reviewService';
import { formatAppDateOnly } from '../lib/formatDate';
import GearLoader from '../components/GearLoader';

interface AdminRatingRow {
  id: string;
  order_id: string;
  technician_id: string | null;
  customer_id: string | null;
  rating: number;
  comment?: string | null;
  created_at?: string;
  device_brand?: string | null;
  device_model?: string | null;
  final_price?: number | null;
  estimated_price?: number | null;
}

// Admin-only screen for browsing all technician ratings. Access is enforced
// by RLS — non-admins get an empty result back. We additionally gate
// rendering on `userProfile.is_admin` so the menu link is meaningful.
export default function AdminRatingsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();

  const [rows, setRows] = useState<AdminRatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'commented'>('all');

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = (await adminListRatings(300)) as AdminRatingRow[];
      setRows(data);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (filter === 'low') return r.rating <= 3;
    if (filter === 'commented') return !!r.comment && r.comment.trim().length > 0;
    return true;
  });

  const styles = makeStyles(COLORS, isRTL);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock-outline" size={48} color={COLORS.textSecondary} />
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            {isRTL ? 'هذه الصفحة للمشرفين فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <AnimatedBackButton
          onPress={() => router.back()}
          color={COLORS.text}
          backgroundColor={COLORS.surface ?? COLORS.background}
          size={42}
          iconSize={22}
          rtl
        />
        <Text style={styles.headerTitle}>
          {isRTL ? 'التقييمات والتعليقات' : 'Ratings & Reviews'}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'low', 'commented'] as const).map((k) => {
          const label =
            k === 'all'
              ? isRTL ? 'الكل' : 'All'
              : k === 'low'
                ? isRTL ? 'تقييم منخفض' : 'Low (≤3)'
                : isRTL ? 'مع تعليق' : 'With comment';
          const active = filter === k;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setFilter(k)}
              style={[
                styles.filterChip,
                active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
              ]}
            >
              <Text style={[styles.filterChipText, active && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <GearLoader size={48} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons name="star-off-outline" size={48} color={COLORS.textSecondary} />
              <Text style={[styles.bodyText, { marginTop: 8 }]}>
                {isRTL ? 'لا توجد تقييمات بعد' : 'No ratings yet'}
              </Text>
            </View>
          ) : (
            filtered.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <MaterialCommunityIcons
                        key={s}
                        name={s <= r.rating ? 'star' : 'star-outline'}
                        size={16}
                        color={s <= r.rating ? '#f59e0b' : COLORS.border}
                      />
                    ))}
                  </View>
                  <Text style={styles.metaText}>
                    {r.created_at ? formatAppDateOnly(r.created_at, isRTL) : ''}
                  </Text>
                </View>
                {r.comment ? (
                  <Text style={styles.commentText}>{`“${r.comment}”`}</Text>
                ) : (
                  <Text style={styles.noCommentText}>
                    {isRTL ? 'بدون تعليق' : 'No comment'}
                  </Text>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    {isRTL ? 'الفني: ' : 'Technician: '}
                    <Text style={styles.metaId}>{r.technician_id ? r.technician_id.slice(0, 8) : '—'}</Text>
                  </Text>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    {isRTL ? 'الجهاز: ' : 'Device: '}
                    <Text style={styles.metaId}>
                      {[r.device_brand, r.device_model].filter(Boolean).join(' ') || '—'}
                    </Text>
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.m,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
    filterRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: SPACING.m,
      paddingTop: SPACING.m,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    filterChipText: { color: C.text, fontSize: 12, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.l },
    bodyText: { color: C.textSecondary, fontSize: 14 },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    starsRow: { flexDirection: 'row', gap: 2 },
    metaText: { color: C.textSecondary, fontSize: 11 },
    commentText: {
      color: C.text,
      fontSize: 13,
      lineHeight: 19,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    noCommentText: {
      color: C.textSecondary,
      fontSize: 12,
      fontStyle: 'italic',
      textAlign: isRTL ? 'right' : 'left',
    },
    metaRow: { marginTop: 10, gap: 4 },
    metaLine: {
      color: C.textSecondary,
      fontSize: 11,
      textAlign: isRTL ? 'right' : 'left',
    },
    metaId: { color: C.text, fontWeight: '700' },
  });
