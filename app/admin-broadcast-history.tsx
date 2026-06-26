import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import { fmtAdminDate } from '../utils/dateFormat';
import { listBroadcasts, clearBroadcastHistory, type Broadcast } from '../services/broadcastService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

const audienceLabel = (a: string, isRTL: boolean) =>
  a === 'all' ? (isRTL ? 'الجميع' : 'All') : a === 'customers' ? (isRTL ? 'العملاء' : 'Customers') : (isRTL ? 'الفنيون' : 'Technicians');

export default function AdminBroadcastHistoryScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();
  const styles = makeStyles(COLORS, isRTL);

  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setItems(await listBroadcasts());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const onClear = () => {
    if (items.length === 0) return;
    Alert.alert(
      isRTL ? 'مسح السجل' : 'Clear history',
      isRTL
        ? 'سيتم حذف كل سجل الإشعارات السابقة نهائياً. لا يمكن التراجع.'
        : 'This permanently deletes all past broadcast history. This cannot be undone.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'مسح الكل' : 'Clear all',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearBroadcastHistory();
              setItems([]);
            } catch (e) {
              logger.warn('clearBroadcastHistory failed', e);
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'الإشعارات السابقة' : 'Previous notifications'} />
        <AdminEmptyState variant="error" icon="shield-alert-outline" title={isRTL ? 'غير مصرّح' : 'Unauthorized'} body={isRTL ? 'للأدمن فقط' : 'Admins only'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'الإشعارات السابقة' : 'Previous notifications'}
        subtitle={isRTL ? `${items.length} إشعار` : `${items.length} sent`}
        rightIcon={items.length > 0 ? 'trash-can-outline' : undefined}
        rightLabel={isRTL ? 'مسح السجل' : 'Clear'}
        onRightPress={items.length > 0 ? onClear : undefined}
      />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <AdminEmptyState
          icon="bullhorn-outline"
          title={isRTL ? 'لا يوجد سجل' : 'No history'}
          body={isRTL ? 'الإشعارات المرسلة ستظهر هنا.' : 'Sent broadcasts will appear here.'}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        >
          {clearing && <ActivityIndicator color={COLORS.primary} />}
          {items.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle} numberOfLines={1}>{b.title}</Text>
                <Text style={styles.itemDate}>{fmtAdminDate(b.sent_at ?? b.created_at, isRTL)}</Text>
              </View>
              <Text style={styles.itemBody} numberOfLines={3}>{b.body}</Text>
              <View style={styles.pillRow}>
                <Pill text={audienceLabel(b.audience, isRTL)} COLORS={COLORS} />
                <Pill text={isRTL ? `أُرسل: ${b.sent_count}` : `Sent: ${b.sent_count}`} COLORS={COLORS} />
                {b.failed_count > 0 && (
                  <Pill text={isRTL ? `فشل: ${b.failed_count}` : `Failed: ${b.failed_count}`} COLORS={COLORS} tone="error" />
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Pill({ text, COLORS, tone }: { text: string; COLORS: any; tone?: 'error' }) {
  const c = tone === 'error' ? '#ef4444' : COLORS.primary;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c + '15' }}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    card: { backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: SPACING.lg },
    rowBetween: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    itemTitle: { color: C.text, fontWeight: '800', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    itemDate: { color: C.textSecondary, fontSize: 11 },
    itemBody: { color: C.text, fontSize: 13, marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
    pillRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  });
