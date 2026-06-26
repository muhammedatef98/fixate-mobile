import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { AnimatedBackButton } from '../../components/AnimatedBackButton';
import { formatAppDateOnly } from '../../lib/formatDate';
import { logger } from '../../utils/logger';
import { listActiveOffers, type Offer } from '../../services/offersService';

export default function OffersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOffers(await listActiveOffers());
    } catch (e) {
      logger.warn('offers load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderOffer = ({ item }: { item: Offer }) => (
    <View style={styles.card}>
      {!!item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.cardBanner} resizeMode="cover" />
      )}
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: COLORS.primary + '18' }]}>
          <MaterialCommunityIcons name="sale" size={24} color={COLORS.primary} />
        </View>
        {item.discount_pct != null && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              {isRTL ? `خصم ${item.discount_pct}%` : `${item.discount_pct}% OFF`}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      {!!item.description && (
        <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
      )}
      {!!item.valid_until && (
        <View style={styles.validityRow}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.validityText}>
            {isRTL ? `ساري حتى ${formatAppDateOnly(item.valid_until, isRTL)}` : `Valid until ${formatAppDateOnly(item.valid_until, isRTL)}`}
          </Text>
        </View>
      )}
    </View>
  );

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
        <Text style={styles.headerTitle}>{isRTL ? 'عروض وخصومات' : 'Offers & Discounts'}</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          renderItem={renderOffer}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <MaterialCommunityIcons name="tag-heart-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyText}>
                {isRTL ? 'لا توجد عروض حالياً، تابعنا قريباً! 🎉' : 'No offers right now — check back soon! 🎉'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    cardTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    discountBadge: {
      backgroundColor: C.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    discountText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    cardBanner: { width: '100%', height: 150, borderRadius: BORDER_RADIUS.md, marginBottom: 12, backgroundColor: C.border + '40' },
    cardTitle: { color: C.text, fontWeight: '800', fontSize: 16, textAlign: isRTL ? 'right' : 'left' },
    cardDesc: { color: C.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
    validityRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    validityText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
    emptyWrap: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32, gap: 16 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: C.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  });
