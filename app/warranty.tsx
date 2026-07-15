import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { RTLIonicon } from '../components/RTLIcon';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { formatAppDateOnly } from '../lib/formatDate';
import GearLoader from '../components/GearLoader';
import {
  deriveWarranty,
  deviceLabel,
  WARRANTY_MONTHS,
  type WarrantyInfo,
  type WarrantyOrderLike,
} from '../utils/warranty';
import { certificateNumber } from '../services/warrantyPdf';
import WarrantyViewerModal from '../components/WarrantyViewerModal';

interface WarrantyRow extends WarrantyOrderLike {
  order_number?: string | null;
  warranty: WarrantyInfo;
}

const orderRef = (o: { order_number?: string | null; id: string }) =>
  o.order_number ?? `#${o.id.slice(0, 8).toUpperCase()}`;

export default function WarrantyScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);

  const [rows, setRows] = useState<WarrantyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Which certificate the in-app viewer is showing (null = closed). Tapping a
  // card opens the viewer (preview inside the app + Download/Share) instead of
  // jumping straight to the OS share sheet — same UX as invoices.
  const [viewerRow, setViewerRow] = useState<WarrantyRow | null>(null);

  const holderName =
    userProfile?.name?.trim() || user?.email || (isRTL ? 'عميل فيكسات' : 'Fixate customer');

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('orders')
        .select(
          'id, order_number, status, device_brand, device_model, issue_description, estimated_price, created_at, updated_at'
        )
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      const mapped: WarrantyRow[] = (data ?? [])
        .map((o: any) => {
          const warranty = deriveWarranty(o);
          return warranty ? { ...o, warranty } : null;
        })
        .filter(Boolean) as WarrantyRow[];
      setRows(mapped);
    } catch (e) {
      logger.warn('warranty load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Active warranties sit up top as certificates; expired ones drop into a
  // clearly-secondary "past coverage" list so they never read as still active.
  const { active, expired } = useMemo(() => {
    const active: WarrantyRow[] = [];
    const expired: WarrantyRow[] = [];
    for (const r of rows) (r.warranty.isActive ? active : expired).push(r);
    return { active, expired };
  }, [rows]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.background}
      />

      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(customer)'))}
          style={styles.backButton}
        >
          <RTLIonicon name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'ضمان الإصلاح' : 'Repair warranty'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <GearLoader size={48} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48, flexGrow: 1, gap: SPACING.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {/* Reassurance banner — sets the expectation before any card. */}
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <MaterialCommunityIcons name="shield-check" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.introText}>
              {isRTL
                ? `كل إصلاح مكتمل مشمول بضمان ${WARRANTY_MONTHS} شهراً. اعرض شهادة الضمان الخاصة بأجهزتك هنا في أي وقت.`
                : `Every completed repair is covered for ${WARRANTY_MONTHS} months. View your devices' warranty certificates here anytime.`}
            </Text>
          </View>

          {rows.length === 0 ? (
            <View style={{ marginTop: 40 }}>
              <EmptyState
                icon="shield-outline"
                title={isRTL ? 'لا يوجد ضمان بعد' : 'No warranties yet'}
                description={
                  isRTL
                    ? 'بمجرد اكتمال أول إصلاح، ستظهر شهادة الضمان الخاصة به هنا تلقائياً.'
                    : 'Once your first repair is completed, its warranty certificate will appear here automatically.'
                }
              />
            </View>
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>
                    {isRTL ? 'ضمان ساري' : 'Active coverage'}
                  </Text>
                  {active.map((r) => (
                    <WarrantyCertificate
                      key={r.id}
                      row={r}
                      COLORS={COLORS}
                      isRTL={isRTL}
                      onView={() => setViewerRow(r)}
                      onPress={() => router.push(`/order-details?id=${r.id}`)}
                    />
                  ))}
                </>
              )}

              {expired.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
                    {isRTL ? 'ضمان منتهٍ' : 'Past coverage'}
                  </Text>
                  {expired.map((r) => (
                    <ExpiredWarrantyRow
                      key={r.id}
                      row={r}
                      COLORS={COLORS}
                      isRTL={isRTL}
                      onView={() => setViewerRow(r)}
                      onPress={() => router.push(`/order-details?id=${r.id}`)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {viewerRow && (
        <WarrantyViewerModal
          order={viewerRow}
          holderName={holderName}
          isRTL={isRTL}
          COLORS={COLORS}
          visible={!!viewerRow}
          onClose={() => setViewerRow(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Active certificate ────────────────────────────────────────────────────
function WarrantyCertificate({
  row,
  COLORS,
  isRTL,
  onView,
  onPress,
}: {
  row: WarrantyRow;
  COLORS: any;
  isRTL: boolean;
  onView: () => void;
  onPress: () => void;
}) {
  const styles = makeStyles(COLORS, isRTL);
  const w = row.warranty;
  return (
    <PressableScale to={0.99} onPress={onPress} style={styles.cert}>
      {/* Brand banner */}
      <View style={styles.certBanner}>
        <View style={styles.certBannerLeft}>
          <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
          <Text style={styles.certBannerTitle}>
            {isRTL ? 'شهادة ضمان' : 'Warranty certificate'}
          </Text>
        </View>
        <View style={styles.activePill}>
          <View style={styles.activeDot} />
          <Text style={styles.activePillText}>{isRTL ? 'ساري' : 'Active'}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.certBody}>
        <Text style={styles.certDevice} numberOfLines={1}>
          {deviceLabel(row, isRTL)}
        </Text>
        <Text style={styles.certRef} numberOfLines={1}>
          {(isRTL ? 'طلب ' : 'Order ') + orderRef(row) + '  ·  ' + certificateNumber(row)}
        </Text>

        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>{isRTL ? 'تاريخ الإصدار' : 'Issued'}</Text>
            <Text style={styles.dateValue}>{formatAppDateOnly(w.startDate, isRTL)}</Text>
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>{isRTL ? 'ساري حتى' : 'Valid until'}</Text>
            <Text style={[styles.dateValue, { color: COLORS.primary }]}>
              {formatAppDateOnly(w.endDate, isRTL)}
            </Text>
          </View>
        </View>

        {/* Coverage progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(w.elapsed * 100)}%` }]} />
        </View>
        <Text style={styles.remaining}>
          {isRTL
            ? `متبقٍّ ${w.daysRemaining} يوماً على انتهاء الضمان`
            : `${w.daysRemaining} days of coverage remaining`}
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'عرض شهادة الضمان' : 'View warranty certificate'}
          onPress={onView}
          style={styles.certAction}
        >
          <MaterialCommunityIcons name="shield-search" size={18} color="#fff" />
          <Text style={styles.certActionText}>
            {isRTL ? 'عرض شهادة الضمان' : 'View warranty certificate'}
          </Text>
        </TouchableOpacity>
      </View>
    </PressableScale>
  );
}

// ── Expired row (clearly out of active state) ──────────────────────────────
function ExpiredWarrantyRow({
  row,
  COLORS,
  isRTL,
  onView,
  onPress,
}: {
  row: WarrantyRow;
  COLORS: any;
  isRTL: boolean;
  onView: () => void;
  onPress: () => void;
}) {
  const styles = makeStyles(COLORS, isRTL);
  const w = row.warranty;
  return (
    <PressableScale to={0.99} onPress={onPress} style={styles.expiredRow}>
      <View style={styles.expiredIcon}>
        <MaterialCommunityIcons name="shield-off-outline" size={18} color={COLORS.textLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.expiredDevice} numberOfLines={1}>
          {deviceLabel(row, isRTL)}
        </Text>
        <Text style={styles.expiredMeta} numberOfLines={1}>
          {(isRTL ? 'انتهى في ' : 'Expired ') + formatAppDateOnly(w.endDate, isRTL)}
          {'  ·  ' + orderRef(row)}
        </Text>
      </View>
      {/* An expired certificate is still a record worth keeping — let them view it. */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'عرض الشهادة' : 'View certificate'}
        onPress={onView}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.expiredPdfBtn}
      >
        <MaterialCommunityIcons name="shield-search" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <RTLIonicon name="chevron-forward" size={18} color={COLORS.textLight} />
    </PressableScale>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
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
    backButton: { padding: 8 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    introCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.primarySoft,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
    },
    introIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },

    sectionHeader: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: C.textLight,
      textAlign: isRTL ? 'right' : 'left',
      marginHorizontal: 2,
    },

    // Certificate
    cert: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.primary + '33',
      overflow: 'hidden',
    },
    certBanner: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.primary,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    certBannerLeft: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    certBannerTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
    activePill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
    activePillText: { color: '#fff', fontWeight: '800', fontSize: 11 },

    certBody: { padding: 16, gap: 4 },
    certDevice: {
      fontSize: 18,
      fontWeight: '800',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    certRef: {
      fontSize: 12.5,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 8,
    },
    datesRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: C.background,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 2,
      marginBottom: 12,
    },
    dateCol: { flex: 1, gap: 3 },
    dateLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.textLight,
      textAlign: isRTL ? 'right' : 'left',
    },
    dateValue: {
      fontSize: 14,
      fontWeight: '800',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    dateDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: C.border, marginHorizontal: 12 },

    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: C.border,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: C.primary },
    remaining: {
      fontSize: 12,
      fontWeight: '700',
      color: C.primary,
      marginTop: 8,
      textAlign: isRTL ? 'right' : 'left',
    },

    certAction: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 44,
      marginTop: 14,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.primary,
    },
    certActionText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },

    // Expired
    expiredPdfBtn: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    expiredRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    expiredIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    expiredDevice: {
      fontSize: 14,
      fontWeight: '700',
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
    },
    expiredMeta: {
      fontSize: 11.5,
      color: C.textLight,
      textAlign: isRTL ? 'right' : 'left',
      marginTop: 2,
    },
  });
