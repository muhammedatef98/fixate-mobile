import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../../components/RTLIcon';
import { SERVICE_CATALOG } from '../../constants/serviceCatalog';
import * as availabilityService from '../../services/serviceAvailabilityService';
import type { AvailabilityMap } from '../../services/serviceAvailabilityService';

export default function ServiceAvailabilityScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = makeStyles(C, isRTL, SHADOWS);

  const [map, setMap] = useState<AvailabilityMap>(availabilityService.getDefaultAvailability());
  const [loading, setLoading] = useState(true);
  const [pendingBackend, setPendingBackend] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const res = await availabilityService.getAvailability(user.id);
      setMap(res.map);
      setPendingBackend(res.pendingBackend);
      setLoading(false);
    })();
  }, [user?.id]);

  const toggle = async (serviceId: string, next: boolean) => {
    if (!user) return;
    setMap((m) => ({ ...m, [serviceId]: next })); // optimistic
    setSavingId(serviceId);
    const res = await availabilityService.setServiceEnabled(user.id, serviceId, next);
    setPendingBackend(res.pendingBackend);
    setSavingId(null);
  };

  const enabledCount = Object.values(map).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'الخدمات المتاحة' : 'Service Availability'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}>
          <Text style={styles.intro}>
            {isRTL
              ? 'فعّل أو أوقف الخدمات حسب توفرك الحالي. الخدمات الموقوفة لن تظهر للعملاء الجدد.'
              : 'Enable or disable services based on your current availability. Disabled services won’t be offered to new customers.'}
          </Text>

          <View style={styles.summaryPill}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={C.primary} />
            <Text style={styles.summaryPillText}>
              {isRTL
                ? `${enabledCount} من ${SERVICE_CATALOG.length} خدمة مفعّلة`
                : `${enabledCount} of ${SERVICE_CATALOG.length} services active`}
            </Text>
          </View>

          {SERVICE_CATALOG.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={s.icon as any} size={22} color={C.primary} />
              </View>
              <Text style={styles.rowLabel}>{isRTL ? s.nameAr : s.nameEn}</Text>
              {savingId === s.id ? (
                <ActivityIndicator color={C.primary} size="small" />
              ) : (
                <Switch
                  value={!!map[s.id]}
                  onValueChange={(v) => toggle(s.id, v)}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                />
              )}
            </View>
          ))}

          {pendingBackend && (
            <View style={styles.noteBox}>
              <MaterialCommunityIcons name="information-outline" size={16} color={C.textSecondary} />
              <Text style={styles.noteText}>
                {isRTL
                  ? 'يتم حفظ هذه الإعدادات محليًا حاليًا. سيتم ربطها بالكامل بلوحة الإدارة لاحقًا.'
                  : 'Settings are stored locally for now and will be fully wired to the admin backend later.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    intro: { color: C.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
    summaryPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      gap: 6,
      backgroundColor: C.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginBottom: 16,
    },
    summaryPillText: { color: C.primary, fontSize: 12, fontWeight: '700' },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 10,
      ...SHADOWS.small,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: C.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' },
    noteBox: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      backgroundColor: C.cardAlt,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
      marginTop: 16,
      alignItems: 'flex-start',
    },
    noteText: { flex: 1, color: C.textSecondary, fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  });
