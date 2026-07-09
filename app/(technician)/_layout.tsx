import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import BottomNavTech from '../../components/BottomNavTech';
import { saveLastRole } from '../../utils/rolePreference';
import { mapTechnicianGate } from '../../utils/technicianVerification';

// Child route segments where the bottom tab bar stays persistently visible.
// These map 1:1 to the four BottomNavTech entries (Home / Requests / Jobs /
// Profile). Detail/flow screens (manage-order, job, service-availability,
// earnings, notifications, delete-account) intentionally hide the bar so the
// technician can focus on the task.
//
// IMPORTANT: we match the *child segment* (via useSegments), NOT pathname.
// In expo-router 6, usePathname() strips the `(technician)` group prefix,
// so a `pathname === '/(technician)/profile'` check NEVER matched and the
// tab bar was silently never rendered. useSegments returns the raw segment
// array including the group, which is unambiguous.
const PERSISTENT_TAB_SEGMENTS = new Set<string>([
  '',                  // /(technician)            → group root, i.e. index
  'index',             // /(technician)/index      → some routers emit 'index'
  'my-orders',         // reachable sub-route (Jobs list) — keep bar visible
  'chats',             // Customer Chats tab
  'community',         // Community tab
  'profile',           // My Account tab
  // available-orders is no longer a tab but still reachable as a sub-route;
  // we keep the bar visible there so the technician can return to Home/Jobs
  // without a manual back navigation.
  'available-orders',
]);

type GateState =
  | { kind: 'loading' }
  | { kind: 'allowed' }
  | { kind: 'pending'; status: string }
  | { kind: 'changes_requested'; notes?: string }
  | { kind: 'rejected'; notes?: string }
  | { kind: 'no-profile' };

export default function TechnicianLayout() {
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
      setGate(mapTechnicianGate(data.verification_status, data.verification_notes));
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Remember the technician flow so the next cold launch lands here directly
  // and skips role-selection — but only for genuine technicians (verified,
  // pending, or rejected applicants). We deliberately skip 'no-profile': a
  // pure customer who tapped "technician" once shouldn't get locked out of
  // role-selection on every future launch.
  useEffect(() => {
    if (!user) return;
    if (
      gate.kind === 'allowed' ||
      gate.kind === 'pending' ||
      gate.kind === 'changes_requested' ||
      gate.kind === 'rejected'
    ) {
      void saveLastRole('technician');
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

  // segments[0] is the group ('(technician)'), segments[1] is the child
  // route name or undefined for the group's index. Show the tab bar only
  // when we're inside the technician group AND on one of the four tab
  // destinations — never on detail screens like manage-order or job/[id].
  const inTechGroup = (segments as string[])[0] === '(technician)';
  const childSegment = ((segments as string[])[1] ?? '') as string;
  const showBottomNav = inTechGroup && PERSISTENT_TAB_SEGMENTS.has(childSegment);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          // Default for detail pushes (manage-order, job, earnings, ratings,
          // service-availability, notifications…): a light, fast directional
          // slide so opening a screen reads as forward motion — matching the
          // rest of the app while staying snappy (170ms — content lands almost
          // immediately, the slide only frames the motion). RTL flips the slide
          // direction so "forward" always enters from the trailing edge. The
          // persistent tab destinations override this with an instant crossfade
          // below, so switching tabs never slides.
          animation: isRTL ? 'slide_from_left' : 'slide_from_right',
          animationDuration: 170,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          // iOS glass header to match the root navigator (only visible if a
          // technician screen ever flips headerShown: true). Android keeps the
          // original solid green header unchanged.
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
        {/* Tab destinations — soft, instant crossfade so switching between the
            four persistent tabs (Home / Jobs / Chats / Community / Profile)
            never reads as a directional page slide. */}
        <Stack.Screen name="index" options={{ animation: 'fade', animationDuration: 120 }} />
        <Stack.Screen name="my-orders" options={{ animation: 'fade', animationDuration: 120 }} />
        <Stack.Screen name="chats" options={{ animation: 'fade', animationDuration: 120 }} />
        <Stack.Screen name="available-orders" options={{ animation: 'fade', animationDuration: 120 }} />
        {/* Explicit registration — without this expo-router can fall through
            to the root-level app/profile.tsx because both files compile to
            the same /profile URL. Declaring it here pins resolution to the
            technician group's profile screen. */}
        <Stack.Screen name="profile" options={{ animation: 'fade', animationDuration: 120 }} />
        <Stack.Screen name="community" options={{ headerShown: false, animation: 'fade', animationDuration: 120 }} />
        {/* Detail / flow screens — inherit the light directional slide. */}
        <Stack.Screen name="earnings" />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ headerShown: false }} />
        <Stack.Screen name="manage-order" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="service-availability" options={{ headerShown: false }} />
        <Stack.Screen name="ratings" options={{ headerShown: false }} />
      </Stack>
      {showBottomNav && <BottomNavTech />}
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
