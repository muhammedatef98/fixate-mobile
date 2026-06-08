/**
 * Technician ratings & reviews — dedicated screen.
 *
 * Moved out of the profile screen so the profile feels short and
 * action-oriented. Tapping the "Ratings & Reviews" menu row in profile
 * pushes here. Read-only by design.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, SPACING } from '../../constants/theme';
import { safeBack } from '../../utils/navigation';
import { AnimatedBackButton } from '../../components/AnimatedBackButton';
import {
  getTechnicianRating,
  listTechnicianReviews,
  type TechnicianReview,
} from '../../services/reviewService';

export default function TechnicianRatingsScreen() {
  const { isDark, language } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [reviews, setReviews] = useState<TechnicianReview[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [summary, recent] = await Promise.all([
        getTechnicianRating(user.id),
        listTechnicianReviews(user.id, 50),
      ]);
      setAverage(Number((summary as any)?.average_rating ?? 0));
      setCount(Number((summary as any)?.rating_count ?? 0));
      setReviews(recent ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <AnimatedBackButton
          onPress={() => safeBack('/(technician)/profile')}
          color={COLORS.text}
          backgroundColor={COLORS.surface ?? COLORS.background}
          size={42}
          iconSize={22}
          rtl
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        />
        <Text style={styles.headerTitle}>
          {isRTL ? 'التقييمات والمراجعات' : 'Ratings & Reviews'}
        </Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Hero rating card */}
        <View style={styles.hero}>
          <Text style={styles.bigNumber}>
            {average > 0 ? average.toFixed(1) : '—'}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= Math.round(average);
              return (
                <Ionicons
                  key={n}
                  name={filled ? 'star' : 'star-outline'}
                  size={20}
                  color={filled ? '#F59E0B' : COLORS.border}
                  style={{ marginHorizontal: 2 }}
                />
              );
            })}
          </View>
          <Text style={styles.countText}>
            {count > 0
              ? (isRTL
                  ? `بناءً على ${count} تقييم`
                  : `Based on ${count} review${count === 1 ? '' : 's'}`)
              : (isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet')}
          </Text>
        </View>

        {/* Review list */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : reviews.length > 0 ? (
          <View style={{ gap: 12 }}>
            {reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewName} numberOfLines={1}>
                    {r.customer_name || (isRTL ? 'عميل' : 'Customer')}
                  </Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= r.rating ? 'star' : 'star-outline'}
                        size={12}
                        color={n <= r.rating ? '#F59E0B' : COLORS.border}
                      />
                    ))}
                  </View>
                </View>
                {r.comment ? (
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                ) : (
                  <Text style={[styles.reviewComment, { fontStyle: 'italic', color: COLORS.textSecondary }]}>
                    {isRTL ? 'لم يترك العميل تعليقاً' : 'No written comment'}
                  </Text>
                )}
                {r.created_at ? (
                  <Text style={styles.reviewDate}>
                    {new Date(r.created_at).toLocaleDateString(
                      isRTL ? 'ar-SA-u-ca-gregory' : 'en-GB',
                      { year: 'numeric', month: 'short', day: '2-digit' },
                    )}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="star-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>
              {isRTL
                ? 'ستظهر تقييمات العملاء هنا بعد إتمام أول طلب'
                : 'Customer reviews appear here after you complete your first job'}
            </Text>
          </View>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  hero: {
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bigNumber: {
    color: C.text,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  starsRow: { flexDirection: 'row', marginTop: 8 },
  countText: { color: C.textSecondary, fontSize: 12, marginTop: 10, fontWeight: '600' },
  reviewCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  reviewTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewName: { color: C.text, fontWeight: '700', fontSize: 13, flex: 1 },
  reviewStars: { flexDirection: 'row' },
  reviewComment: {
    color: C.text,
    fontSize: 13,
    lineHeight: 19,
    textAlign: isRTL ? 'right' : 'left',
  },
  reviewDate: {
    color: C.textSecondary,
    fontSize: 11,
    marginTop: 8,
    textAlign: isRTL ? 'right' : 'left',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 30,
  },
});
