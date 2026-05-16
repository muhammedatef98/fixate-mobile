import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';

type GateState =
  | { kind: 'loading' }
  | { kind: 'allowed' }
  | { kind: 'pending'; status: string }
  | { kind: 'rejected'; notes?: string }
  | { kind: 'no-profile' };

export default function TechnicianLayout() {
  const { language, isDark } = useApp();
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [gate, setGate] = useState<GateState>({ kind: 'loading' });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/role-selection');
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('technicians')
        .select('verification_status, verification_notes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!data) {
        setGate({ kind: 'no-profile' });
        return;
      }
      const status = (data.verification_status || 'pending').toLowerCase();
      if (status === 'verified' || status === 'approved') {
        setGate({ kind: 'allowed' });
      } else if (status === 'rejected') {
        setGate({ kind: 'rejected', notes: data.verification_notes });
      } else {
        setGate({ kind: 'pending', status });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || gate.kind === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (gate.kind === 'no-profile') {
    return (
      <GateScreen
        COLORS={COLORS}
        icon="account-plus"
        iconColor={COLORS.primary}
        title={isRTL ? 'لم يتم تسجيلك كفني بعد' : 'Not registered as a technician'}
        body={
          isRTL
            ? 'لتبدأ استلام طلبات الصيانة، أكمل بياناتك الشخصية والمستندات المطلوبة. عملية التسجيل تستغرق دقيقتين.'
            : 'To start receiving repair jobs, complete your profile and required documents. Takes about 2 minutes.'
        }
        primaryLabel={isRTL ? 'بدء التسجيل' : 'Start registration'}
        onPrimary={() => router.replace('/technician-onboarding')}
        secondaryLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
        onSecondary={async () => {
          await signOut();
          router.replace('/role-selection');
        }}
      />
    );
  }

  if (gate.kind === 'pending') {
    return (
      <GateScreen
        COLORS={COLORS}
        icon="clock-outline"
        iconColor={'#f59e0b'}
        title={isRTL ? 'طلبك قيد المراجعة' : 'Application under review'}
        body={
          isRTL
            ? 'استلمنا طلبك بنجاح. فريق التحقق يراجع البيانات والمستندات خلال 1-2 يوم عمل، وستصلك رسالة بمجرد الموافقة.'
            : "We received your application. Our verification team is reviewing your details within 1-2 business days. You'll get a notification once approved."
        }
        primaryLabel={isRTL ? 'تعديل البيانات' : 'Edit application'}
        onPrimary={() => router.replace('/technician-onboarding')}
        secondaryLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
        onSecondary={async () => {
          await signOut();
          router.replace('/role-selection');
        }}
      />
    );
  }

  if (gate.kind === 'rejected') {
    return (
      <GateScreen
        COLORS={COLORS}
        icon="alert-circle-outline"
        iconColor={'#ef4444'}
        title={isRTL ? 'تم رفض الطلب' : 'Application rejected'}
        body={
          (isRTL ? 'سبب الرفض: ' : 'Reason: ') +
          (gate.notes || (isRTL ? 'لم يتم توضيح السبب' : 'no reason provided'))
        }
        primaryLabel={isRTL ? 'إعادة التقديم' : 'Reapply'}
        onPrimary={() => router.replace('/technician-onboarding')}
        secondaryLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
        onSecondary={async () => {
          await signOut();
          router.replace('/role-selection');
        }}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        headerStyle: { backgroundColor: '#10b981' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerBackTitle: isRTL ? 'رجوع' : 'Back',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="my-orders" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="available-orders" />
      <Stack.Screen name="manage-order" options={{ headerShown: false }} />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="service-availability" options={{ headerShown: false }} />
    </Stack>
  );
}

function GateScreen({
  COLORS,
  icon,
  iconColor,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: any) {
  return (
    <View style={[styles.gate, { backgroundColor: COLORS.background }]}>
      <View style={[styles.gateCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
        <MaterialCommunityIcons name={icon} size={56} color={iconColor} />
        <Text style={[styles.gateTitle, { color: COLORS.text }]}>{title}</Text>
        <Text style={[styles.gateBody, { color: COLORS.textSecondary }]}>{body}</Text>
        <TouchableOpacity
          onPress={onPrimary}
          style={[styles.gatePrimary, { backgroundColor: COLORS.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.gatePrimaryText}>{primaryLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSecondary} style={{ marginTop: 12 }} accessibilityRole="button">
          <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>{secondaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: 12,
  },
  gateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  gateBody: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 12 },
  gatePrimary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  gatePrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
