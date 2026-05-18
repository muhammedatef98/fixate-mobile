import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { supabase } from '../services/supabaseClient';
import { getFriendlyError } from '../utils/errorMessages';
import { success, warning } from '../utils/haptics';
import { safeBack } from '../utils/navigation';

interface Submission {
  id: string;
  user_id: string;
  national_id?: string;
  iban?: string;
  city?: string;
  specialty: string;
  years_of_experience: number;
  bio?: string;
  id_document_url?: string;
  certificate_url?: string;
  verification_status: string;
  created_at?: string;
  user_name?: string;
  user_phone?: string;
}

export default function AdminVerificationsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Don't embed users:user_id(name, phone) — RLS on the users table only
      // lets each user see their own row, so the embed would either return
      // null fields or block the whole query for admins. The technicians row
      // already carries full_name and phone after onboarding, so use those.
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('verification_status', 'submitted')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(
        (data ?? []).map((d: any) => ({
          ...d,
          user_name: d.full_name,
          user_phone: d.phone,
        }))
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language, isRTL]);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  const decide = async (item: Submission, decision: 'approved' | 'rejected') => {
    setBusyId(item.id);
    try {
      const { error } = await supabase
        .from('technicians')
        .update({
          verification_status: decision,
          verified_at: decision === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', item.id);
      if (error) throw error;
      decision === 'approved' ? success() : warning();
      await load();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setBusyId(null);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  if (!profileLoaded) {
    // userProfile is still loading; show a spinner so admins don't briefly
    // flash through the "Admins only" screen before the role check resolves.
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => safeBack()}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          >
            <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isRTL ? 'الإدارة' : 'Admin'}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.unauthorized}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={[styles.unauthText, { color: COLORS.text }]}>
            {isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 }}>
            {isRTL
              ? 'لتفعيل صلاحية الأدمن: حدّث users.is_admin = true لحسابك من Supabase'
              : 'To enable admin access: set users.is_admin = true for your row in Supabase'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack()}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'مراجعة الفنيين' : 'Verify technicians'}</Text>
        <Text style={[styles.title, { color: COLORS.primary, fontSize: 14 }]}>{items.length}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-decagram" size={64} color={COLORS.success} />
            <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
              {isRTL ? 'لا توجد طلبات معلّقة' : 'No pending submissions'}
            </Text>
          </View>
        ) : (
          items.map((it) => (
            <View key={it.id} style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Text style={[styles.name, { color: COLORS.text }]}>{it.user_name || '—'}</Text>
              <Text style={{ color: COLORS.textSecondary }}>{it.user_phone || '—'}</Text>

              <View style={styles.row}>
                <Field label={isRTL ? 'التخصّص' : 'Specialty'} value={it.specialty} C={COLORS} />
                <Field label={isRTL ? 'الخبرة' : 'Experience'} value={`${it.years_of_experience} ${isRTL ? 'سنة' : 'yr'}`} C={COLORS} />
              </View>
              <View style={styles.row}>
                <Field label={isRTL ? 'المدينة' : 'City'} value={it.city ?? '—'} C={COLORS} />
                <Field label={isRTL ? 'الهوية' : 'Nat. ID'} value={it.national_id ?? '—'} C={COLORS} />
              </View>
              <Field label="IBAN" value={it.iban ?? '—'} C={COLORS} />
              {it.bio ? (
                <Text style={{ color: COLORS.text, marginTop: 8, fontSize: 13, lineHeight: 20 }}>{it.bio}</Text>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => decide(it, 'rejected')}
                  disabled={busyId === it.id}
                  style={[styles.btn, { backgroundColor: COLORS.error + '20' }]}
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? 'رفض' : 'Reject'}
                >
                  <Ionicons name="close" size={18} color={COLORS.error} />
                  <Text style={{ color: COLORS.error, fontWeight: '700' }}>{isRTL ? 'رفض' : 'Reject'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => decide(it, 'approved')}
                  disabled={busyId === it.id}
                  style={[styles.btn, { backgroundColor: COLORS.success }]}
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? 'اعتماد' : 'Approve'}
                >
                  {busyId === it.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{isRTL ? 'اعتماد' : 'Approve'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, C }: { label: string; value: string; C: any }) {
  return (
    <View style={{ flex: 1, marginTop: 8 }}>
      <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.m,
      backgroundColor: C.background,
    },
    title: { fontSize: 22, fontWeight: '800', color: C.text },
    card: {
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.l,
      marginBottom: SPACING.md,
      backgroundColor: C.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    name: { fontSize: 16, fontWeight: '800' },
    row: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 },
    actions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginTop: SPACING.md },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: BORDER_RADIUS.sm,
      minHeight: 48,
    },
    empty: { alignItems: 'center', paddingVertical: 60 },
    unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    unauthText: { fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  });
