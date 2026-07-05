import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { getMyCourierProfile, type CourierProfile } from '../../services/courierService';
import { COURIER_NAV_HEIGHT } from '../../components/BottomNavCourier';
import { logger } from '../../utils/logger';

const VEHICLE_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
  car: { ar: 'سيارة', en: 'Car', icon: 'car' },
  motorcycle: { ar: 'دراجة نارية', en: 'Motorcycle', icon: 'motorbike' },
  van: { ar: 'فان', en: 'Van', icon: 'van-utility' },
};

/**
 * Courier account tab: identity (from the users row), work profile (city,
 * vehicle, verification state, total deliveries) and session actions.
 * Mirrors the technician profile's role in the tab bar — the courier portal
 * shouldn't feel like a stripped-down afterthought.
 */
export default function CourierProfileScreen() {
  const router = useRouter();
  const { language, isDark, setLanguage } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [courier, setCourier] = useState<CourierProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setCourier(await getMyCourierProfile(user.id));
    } catch (e) {
      logger.warn('courier profile load failed', e);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const displayName = userProfile?.name || (isRTL ? 'مندوب توصيل' : 'Courier');
  const vehicle = courier?.vehicle_type ? VEHICLE_LABELS[courier.vehicle_type] : null;
  const isApproved = ['approved', 'verified'].includes(courier?.verification_status ?? '');

  const confirmSignOut = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Sign out',
      isRTL ? 'هل تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'تسجيل الخروج' : 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/role-selection');
          },
        },
      ]
    );
  };

  const Row = ({
    icon,
    label,
    value,
    color,
  }: {
    icon: string;
    label: string;
    value: string;
    color?: string;
  }) => (
    <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.rowIcon, { backgroundColor: COLORS.primary + '14' }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
          {label}
        </Text>
        <Text
          style={{
            color: color ?? COLORS.text,
            fontSize: 15,
            fontWeight: '700',
            marginTop: 1,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: COURIER_NAV_HEIGHT + SPACING.lg,
          gap: SPACING.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Identity card */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
          <View style={[styles.identity, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.avatar, { backgroundColor: COLORS.primary + '18' }]}>
              <MaterialCommunityIcons name="moped" size={30} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' }}>
                {displayName}
              </Text>
              {!!userProfile?.email && (
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
                  {userProfile.email}
                </Text>
              )}
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isApproved ? '#10b98118' : '#f59e0b18',
                    alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isApproved ? 'check-decagram' : 'clock-outline'}
                  size={13}
                  color={isApproved ? '#10b981' : '#f59e0b'}
                />
                <Text style={{ color: isApproved ? '#10b981' : '#f59e0b', fontSize: 12, fontWeight: '700' }}>
                  {isApproved
                    ? isRTL ? 'مندوب معتمد' : 'Approved courier'
                    : isRTL ? 'قيد المراجعة' : 'Under review'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Work profile */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'بيانات العمل' : 'Work profile'}
          </Text>
          <Row
            icon="map-marker-outline"
            label={isRTL ? 'المدينة' : 'City'}
            value={courier?.city || (isRTL ? 'غير محددة' : 'Not set')}
          />
          <Row
            icon={vehicle?.icon ?? 'car'}
            label={isRTL ? 'وسيلة التوصيل' : 'Vehicle'}
            value={vehicle ? (isRTL ? vehicle.ar : vehicle.en) : isRTL ? 'غير محددة' : 'Not set'}
          />
          <Row
            icon="package-variant-closed"
            label={isRTL ? 'التوصيلات المكتملة' : 'Completed deliveries'}
            value={String(courier?.total_deliveries ?? 0)}
          />
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: COLORS.primary }]}
            onPress={() => router.push('/courier-onboarding' as any)}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.primary} />
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
              {isRTL ? 'تعديل بيانات العمل' : 'Edit work details'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings & session */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }, SHADOWS.small]}>
          <TouchableOpacity
            style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={() => setLanguage(isRTL ? 'en' : 'ar')}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="translate" size={20} color={COLORS.text} />
            <Text style={[styles.actionText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'English' : 'العربية'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={() => router.replace('/role-selection')}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="swap-horizontal" size={20} color={COLORS.text} />
            <Text style={[styles.actionText, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'تبديل الدور' : 'Switch role'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={confirmSignOut}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
            <Text style={[styles.actionText, { color: COLORS.error, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'تسجيل الخروج' : 'Sign out'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  identity: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  row: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 11,
    marginTop: 10,
  },
  actionRow: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionText: { fontSize: 15, fontWeight: '600', flex: 1 },
});
