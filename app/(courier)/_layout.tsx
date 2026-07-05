import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { saveLastRole } from '../../utils/rolePreference';
import { mapCourierGate, type CourierGate } from '../../utils/courierVerification';
import { getMyCourierProfile } from '../../services/courierService';
import BottomNavCourier from '../../components/BottomNavCourier';

type GateState = { kind: 'loading' } | { kind: 'no-profile' } | CourierGate;

// Child segments where the floating tab bar stays visible — the three
// BottomNavCourier destinations. Task detail (task/[id]) hides the bar so
// the courier focuses on the single enforced next action.
const PERSISTENT_TAB_SEGMENTS = new Set<string>(['', 'index', 'my-tasks', 'profile']);

/**
 * Courier portal gate + stack. Mirrors the (technician) layout contract:
 * no couriers row → "start registration"; submitted → under review;
 * changes_requested / rejected → fix & resubmit; approved → the portal.
 * Route protection is real (auth + couriers verification), not cosmetic —
 * the DB additionally enforces task access via RLS + RPCs.
 */
export default function CourierLayout() {
  const { language, isDark } = useApp();
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const segments = useSegments();
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
      const profile = await getMyCourierProfile(user.id);
      if (cancelled) return;
      if (!profile) {
        setGate({ kind: 'no-profile' });
        return;
      }
      setGate(mapCourierGate(profile.verification_status, profile.verification_notes));
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Remember the courier flow for cold launch — but only for genuine
  // couriers (any application on file). A customer who tapped "courier"
  // once shouldn't get locked out of role-selection on future launches.
  useEffect(() => {
    if (!user) return;
    if (gate.kind !== 'loading' && gate.kind !== 'no-profile') {
      void saveLastRole('courier');
    }
  }, [user, gate.kind]);

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
        icon="moped"
        iconColor={COLORS.primary}
        title={isRTL ? 'لم يتم تسجيلك كمندوب بعد' : 'Not registered as a courier'}
        body={
          isRTL
            ? 'لتبدأ استلام مهمات التوصيل، أكمل بياناتك ليراجعها الفريق. التسجيل يستغرق دقيقة.'
            : 'To start receiving delivery tasks, complete your details for review. Takes about a minute.'
        }
        primaryLabel={isRTL ? 'بدء التسجيل' : 'Start registration'}
        onPrimary={() => router.replace('/courier-onboarding' as any)}
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
            ? 'استلمنا طلبك بنجاح. فريق التحقق يراجع البيانات خلال 1-2 يوم عمل، وستصلك رسالة بمجرد الموافقة.'
            : "We received your application. Our verification team is reviewing it within 1-2 business days. You'll get a notification once approved."
        }
        primaryLabel={isRTL ? 'تعديل البيانات' : 'Edit application'}
        onPrimary={() => router.replace('/courier-onboarding' as any)}
        secondaryLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
        onSecondary={async () => {
          await signOut();
          router.replace('/role-selection');
        }}
      />
    );
  }

  if (gate.kind === 'changes_requested') {
    return (
      <GateScreen
        COLORS={COLORS}
        icon="pencil-outline"
        iconColor={'#2563eb'}
        title={isRTL ? 'مطلوب تعديل طلبك' : 'Changes requested'}
        body={
          (isRTL ? 'طلب الفريق تعديل التالي: ' : 'The team asked you to update: ') +
          (gate.notes || (isRTL ? 'يرجى مراجعة بياناتك' : 'please review your details'))
        }
        primaryLabel={isRTL ? 'تعديل وإعادة الإرسال' : 'Fix & resubmit'}
        onPrimary={() => router.replace('/courier-onboarding' as any)}
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
        onPrimary={() => router.replace('/courier-onboarding' as any)}
        secondaryLabel={isRTL ? 'تسجيل الخروج' : 'Sign out'}
        onSecondary={async () => {
          await signOut();
          router.replace('/role-selection');
        }}
      />
    );
  }

  const inCourierGroup = (segments as string[])[0] === '(courier)';
  const childSegment = ((segments as string[])[1] ?? '') as string;
  const showBottomNav = inCourierGroup && PERSISTENT_TAB_SEGMENTS.has(childSegment);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
    <Stack
      screenOptions={{
        headerShown: false,
        // Soft crossfade between tabs — same treatment as the technician
        // group, so replace()-based tab switches feel smooth, not like cuts.
        animation: 'fade',
        animationDuration: 150,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        ...(Platform.OS === 'ios'
          ? {
              headerTransparent: true,
              headerBlurEffect: 'systemChromeMaterial' as const,
              headerStyle: { backgroundColor: 'transparent' },
              headerTintColor: '#10b981',
              headerBackButtonDisplayMode: 'default' as const,
            }
          : {
              headerStyle: { backgroundColor: '#10b981' },
              headerTintColor: '#fff',
            }),
        headerTitleStyle: { fontWeight: 'bold' },
        headerBackTitle: isRTL ? 'رجوع' : 'Back',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="my-tasks" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="task/[id]" />
    </Stack>
    {showBottomNav && <BottomNavCourier />}
    </View>
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
