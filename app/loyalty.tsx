import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useLoyalty } from '../contexts/LoyaltyContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { LOYALTY_CONFIG } from '../constants/loyalty';
import * as loyaltyService from '../services/loyaltyService';

export default function LoyaltyScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const { summary, loading, refresh, enabled: loyaltyEnabled, settings } = useLoyalty();
  const isRTL = language === 'ar';
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = makeStyles(C, isRTL, SHADOWS);

  const [redeeming, setRedeeming] = useState<string | null>(null);

  // Feature flag — if the loyalty programme is disabled in platform
  // settings, bounce back to the previous screen. We only redirect once
  // settings have actually loaded (settings !== null) to avoid a flash
  // during the initial mount.
  useEffect(() => {
    if (settings !== null && !loyaltyEnabled) {
      router.replace('/(customer)' as any);
    }
  }, [settings, loyaltyEnabled, router]);

  if (settings !== null && !loyaltyEnabled) {
    return null;
  }

  const handleRedeem = async (tierId: string) => {
    const tier = LOYALTY_CONFIG.tiers.find((t) => t.id === tierId);
    if (!tier || !user) return;
    if (summary.balance < tier.points) {
      Alert.alert(
        isRTL ? 'نقاط غير كافية' : 'Not enough points',
        isRTL
          ? `تحتاج ${tier.points} نقطة لاستبدال هذه المكافأة.`
          : `You need ${tier.points} points to redeem this reward.`
      );
      return;
    }
    Alert.alert(
      isRTL ? 'تأكيد الاستبدال' : 'Confirm redemption',
      isRTL
        ? `استبدال ${tier.points} نقطة مقابل: ${tier.titleAr}؟`
        : `Redeem ${tier.points} points for: ${tier.titleEn}?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'استبدال' : 'Redeem',
          onPress: async () => {
            setRedeeming(tierId);
            try {
              const res = await loyaltyService.redeemTier(user.id, tier, summary.balance);
              if (!res.ok) {
                Alert.alert(
                  isRTL ? 'تعذر الاستبدال' : 'Could not redeem',
                  isRTL ? 'نقاط غير كافية' : 'Insufficient points'
                );
                return;
              }
              await refresh();
              Alert.alert(
                // Don't claim completion ("Redeemed ✓") on the pending-backend
                // path — the reward isn't live yet and no points were deducted.
                res.pendingBackend
                  ? (isRTL ? 'تم استلام طلب الاستبدال' : 'Redemption requested')
                  : (isRTL ? 'تم الاستبدال ✓' : 'Redeemed ✓'),
                res.pendingBackend
                  ? isRTL
                    ? 'تم تسجيل طلب الاستبدال. سيتم تفعيل المكافأة بعد ربط النظام بالكامل. سيتواصل معك فريقنا.'
                    : 'Your redemption was recorded. The reward will be activated once the backend is fully connected. Our team will contact you.'
                  : isRTL
                  ? 'تم خصم النقاط بنجاح.'
                  : 'Points deducted successfully.'
              );
            } finally {
              setRedeeming(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'نقاط الولاء' : 'Loyalty Points'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}>
        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: C.primary }]}>
          <MaterialCommunityIcons name="star-circle" size={40} color="#fff" />
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
          ) : (
            <Text style={styles.balanceValue}>{summary.balance}</Text>
          )}
          <Text style={styles.balanceLabel}>{isRTL ? 'نقطة متاحة' : 'points available'}</Text>
          <Text style={styles.balanceSub}>
            {isRTL
              ? `إجمالي ما جمعته: ${summary.lifetimeEarned} نقطة`
              : `Lifetime earned: ${summary.lifetimeEarned} points`}
          </Text>
        </View>

        {summary.isPlaceholder && (
          <View style={styles.noteBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.textSecondary} />
            <Text style={styles.noteText}>
              {isRTL
                ? 'هذه النقاط تقديرية بناءً على طلباتك المكتملة. سيتم تفعيل سجل النقاط الكامل بعد ربط النظام.'
                : 'These points are estimated from your completed orders. The full points ledger activates once the backend is connected.'}
            </Text>
          </View>
        )}

        {/* Earn rule */}
        <Text style={styles.sectionLabel}>{isRTL ? 'كيف تكسب النقاط' : 'HOW YOU EARN'}</Text>
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="cash-multiple" size={22} color={C.primary} />
          <Text style={styles.infoText}>
            {isRTL
              ? `كل 1 ريال تنفقه = ${LOYALTY_CONFIG.pointsPerSAR} نقطة`
              : `Every 1 SAR spent = ${LOYALTY_CONFIG.pointsPerSAR} point`}
          </Text>
        </View>

        {/* Redeem tiers */}
        <Text style={styles.sectionLabel}>{isRTL ? 'استبدل نقاطك' : 'REDEEM YOUR POINTS'}</Text>
        {LOYALTY_CONFIG.tiers.map((tier) => {
          const affordable = summary.balance >= tier.points;
          return (
            <View key={tier.id} style={styles.tierCard}>
              <View style={styles.tierIcon}>
                <MaterialCommunityIcons
                  name={tier.category === 'accessory' ? 'headphones' : 'wrench'}
                  size={22}
                  color={C.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierTitle}>{isRTL ? tier.titleAr : tier.titleEn}</Text>
                <Text style={styles.tierDesc}>{isRTL ? tier.descAr : tier.descEn}</Text>
                <Text style={styles.tierPoints}>
                  {tier.points} {isRTL ? 'نقطة' : 'points'}
                </Text>
              </View>
              <TouchableOpacity
                disabled={!affordable || redeeming === tier.id}
                onPress={() => handleRedeem(tier.id)}
                style={[styles.redeemBtn, (!affordable || redeeming === tier.id) && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                {redeeming === tier.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.redeemBtnText}>{isRTL ? 'استبدال' : 'Redeem'}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
    balanceCard: {
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      marginBottom: 16,
      ...SHADOWS.medium,
    },
    balanceValue: { color: '#fff', fontSize: 44, fontWeight: '800', marginTop: 6 },
    balanceLabel: { color: '#ffffffdd', fontSize: 14, marginTop: 2 },
    balanceSub: { color: '#ffffffbb', fontSize: 12, marginTop: 10 },
    noteBox: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      backgroundColor: C.cardAlt,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
      marginBottom: 20,
      alignItems: 'flex-start',
    },
    noteText: { flex: 1, color: C.textSecondary, fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: C.textSecondary,
      letterSpacing: 1.2,
      marginBottom: 10,
      marginTop: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    infoCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 24,
      ...SHADOWS.small,
    },
    infoText: { color: C.text, fontSize: 15, fontWeight: '700' },
    tierCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 12,
      ...SHADOWS.small,
    },
    tierIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierTitle: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    tierDesc: { color: C.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    tierPoints: { color: C.primary, fontSize: 13, fontWeight: '800', marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
    redeemBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: 18,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      minWidth: 84,
      alignItems: 'center',
    },
    redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  });
