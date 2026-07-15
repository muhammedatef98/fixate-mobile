import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { View, Platform } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { getColors } from '../constants/theme';
import { RequestProvider } from '../contexts/RequestContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppProvider, useApp } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { canAccessAdmin } from '../constants/admin';
import { decideAuthFlowTarget } from '../utils/routeDecision';
import { OrdersProvider } from '../contexts/OrdersContext';
import { LoyaltyProvider } from '../contexts/LoyaltyContext';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import ErrorBoundary from '../components/ErrorBoundary';
import OfflineBanner from '../components/OfflineBanner';
import BlockedScreen from '../components/BlockedScreen';
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { applyAppFontToText } from '../utils/applyFont';
import { RIYAL_FONT_REGULAR, RIYAL_FONT_BOLD } from '../components/Riyal';
import { initSentry } from '../services/sentryService';
import { useOtaUpdates } from '../hooks/useOtaUpdates';
// NOTE: @react-native-firebase/messaging is required lazily inside an
// Android-only effect below — a static top-level import runs on every platform
// at module-eval and throws "RNFBAppModule not found" on any binary that lacks
// the Firebase native module (e.g. iOS / a dev client), which would crash the
// entire root layout (and AppProvider, → "useApp must be used within
// AppProvider"). iOS uses APNs via expo-notifications and never needs it.
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import GearLoader from '../components/GearLoader';
import AnimatedSplash from '../components/AnimatedSplash';
import '../i18n';

initSentry();

/**
 * Root safe-area frame.
 *
 * Android (Expo SDK 54) always draws edge-to-edge: the system status bar and
 * navigation bar float ON TOP of the app, and `androidStatusBar.translucent`
 * / `<StatusBar translucent={false}>` are no-ops there. React Native's own
 * `SafeAreaView` is iOS-only, so without this frame every screen's header
 * (notifications bell, language switch, titles) sits underneath the wifi /
 * signal / clock strip.
 *
 * Insetting once at the root fixes all screens at once. It's Android-only:
 * on iOS each screen already uses its own SafeAreaView and a second inset
 * here would double the top padding.
 */
function ScreenFrame({ children }: { children: ReactNode }) {
  const { isDark } = useApp();
  if (Platform.OS !== 'android') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }
  const COLORS = getColors(isDark);
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      {children}
    </SafeAreaView>
  );
}

function RootLayoutContent() {
  const { language, isDark } = useApp();
  const { user, userProfile, loading, adminPermissions, adminPermissionsLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Auth screens that should auto-redirect logged-in users away
    // (login forms shouldn't show if you're already logged in). role-selection
    // is intentionally NOT in this set — a logged-in user landing there can
    // pick which side of the app they want to enter, which is critical for
    // testing both flows from one account.
    //
    // forgot-password is also intentionally NOT in this set. The recovery
    // flow calls supabase.auth.verifyOtp({ type: 'recovery' }), which
    // establishes a *real* session before the user has set a new password.
    // If we redirected away on that session, the new-password step would
    // flash for a moment then disappear and the technician would land on
    // /(technician) without ever updating their password.
    const REDIRECT_AWAY_IF_LOGGED_IN = new Set([
      'login', 'signup', 'auth', 'technician-auth', 'courier-auth',
      'login-otp', 'email-auth', 'onboarding',
    ]);
    const PROTECTED_GROUPS = new Set(['(customer)', '(technician)', '(courier)', 'request']);

    // The user's CHOICE on role-selection determines which auth screen they
    // landed on. That choice is the authoritative routing intent — it
    // overrides the role stored on their profile from a previous session.
    //
    // Without this, a user who once signed up as a technician would always
    // be funnelled back into /(technician) on subsequent customer logins,
    // because `userProfile.role === 'technician'` would force the
    // technician branch even when they explicitly tapped "Login as
    // customer" and arrived via /login-otp.
    //
    // /technician-auth and /courier-auth are the explicit provider entry
    // points; every other auth surface (login-otp, email-auth, auth,
    // signup, login) is a customer-side entry point.
    const TECHNICIAN_AUTH_SOURCES = new Set(['technician-auth']);
    const COURIER_AUTH_SOURCES = new Set(['courier-auth']);
    const CUSTOMER_AUTH_SOURCES = new Set([
      'login', 'signup', 'auth', 'login-otp', 'email-auth',
    ]);

    const first = segments[0] as string | undefined;
    const inAuthFlow = !!first && REDIRECT_AWAY_IF_LOGGED_IN.has(first);
    const isProtectedRoute = !!first && PROTECTED_GROUPS.has(first);

    if (user && inAuthFlow) {
      // CRITICAL: don't auto-redirect until we know the role. userProfile loads
      // asynchronously after the session is established; if we routed on a
      // null profile we'd dump every user into /(customer) regardless of
      // whether they were a technician — that's the "I tap technician portal,
      // it sends me to customer portal" bug.
      if (userProfile === null) return;
      // Wait for the admin permission set too, so a freshly-promoted staff
      // member isn't mis-routed to the customer app before RBAC resolves.
      if (!adminPermissionsLoaded) return;
      const wantsTechnician = !!first && TECHNICIAN_AUTH_SOURCES.has(first);
      const wantsCourier = !!first && COURIER_AUTH_SOURCES.has(first);
      const wantsCustomer = !!first && CUSTOMER_AUTH_SOURCES.has(first);
      // "Admin" for routing = legacy JWT claim OR active RBAC staff, so managers
      // assigned from the Team page land in /admin. See constants/admin.ts.
      const adminAccess = canAccessAdmin(user, adminPermissions);

      // Resolution order (admin > explicit customer > explicit technician >
      // profile-role fallback) lives in one tested place — see
      // utils/routeDecision.ts + routeDecision.test.
      const target = decideAuthFlowTarget({
        isAdmin: adminAccess,
        wantsCustomer,
        wantsTechnician,
        wantsCourier,
        profileRole: (userProfile as any)?.role,
      });
      router.replace(target as any);
      return;
    }

    if (!user && isProtectedRoute) {
      router.replace('/role-selection');
    }

    // Route-level admin gate — applies to every admin segment (the bare
    // /admin hub plus all admin-* detail screens). Access = legacy JWT claim
    // (server-set app_metadata, never client-writable) OR active RBAC staff
    // (server-computed my_admin_permissions). We wait for the permission set to
    // resolve before bouncing, so a legitimate staff member isn't ejected
    // during the async load. Defence-in-depth on top of useAdminGuard /
    // useRequirePermission inside each admin-* screen, and RLS on the server.
    const isAdminSegment =
      !!first && (first === 'admin' || first.startsWith('admin-'));
    if (isAdminSegment) {
      if (!user) {
        router.replace('/role-selection');
        return;
      }
      if (adminPermissionsLoaded && !canAccessAdmin(user, adminPermissions)) {
        router.replace('/(customer)');
      }
    }
  }, [user, userProfile, segments, loading, adminPermissions, adminPermissionsLoaded]);

  // Register a no-op FCM background handler on Android.
  // RNFirebase REQUIRES setBackgroundMessageHandler to be called or it
  // logs a warning in production. We register it as a pure no-op so
  // expo-notifications remains the sole owner of push display logic.
  // iOS uses APNs via expo-notifications directly — intentionally untouched.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      // Lazy require so a binary without the Firebase native module degrades
      // gracefully instead of crashing at module-eval. expo-notifications stays
      // the sole owner of push display either way.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const messaging = require('@react-native-firebase/messaging').default;
      messaging().setBackgroundMessageHandler(async () => {
        // No-op: expo-notifications handles all display.
      });
    } catch {
      // Firebase messaging native module not present in this binary — skip.
    }
  }, []);

  // Create the Android default notification channel at app startup,
  // before and independent of login. Android 8+ silently drops any push
  // whose channel doesn't exist. No-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void ensureAndroidNotificationChannel();
  }, []);

  // RTL is handled per-screen via manual `isRTL ? 'row-reverse' : 'row'`
  // conditionals and `textAlign: isRTL ? 'right' : 'left'`. We deliberately
  // do NOT call I18nManager.forceRTL here — that would double-flip every
  // `row-reverse` back into LTR — and we don't apply `direction: 'rtl'`
  // on the root container for the same reason.

  // App-wide lockout: a suspended/blocked user cannot use any feature.
  // We only gate once the profile has actually loaded (null = still loading)
  // so we never flash the lockout screen during a normal session start.
  const accountStatus = (userProfile as any)?.account_status;
  if (
    !loading &&
    !!user &&
    (accountStatus === 'suspended' || accountStatus === 'blocked')
  ) {
    return <BlockedScreen status={accountStatus} />;
  }

  // Unified transition for the whole market module. Every market-* screen is
  // registered at the root, so without a shared style they silently inherit
  // whatever the navigator default is — and any future per-screen tweak would
  // make one market screen slide differently from the next. Pinning one fast,
  // light, RTL-aware slide here keeps the market flow feeling consistent and
  // snappy (200ms) end to end. headerShown stays false — market screens draw
  // their own in-screen headers.
  const marketScreenOptions = {
    headerShown: false,
    animation: (language === 'ar' ? 'slide_from_left' : 'slide_from_right') as
      | 'slide_from_left'
      | 'slide_from_right',
    animationDuration: 200,
  };

  return (
    <ScreenFrame>
      {/* Status-bar icon colour only. `backgroundColor` / `translucent` are
          deliberately NOT set: they are ignored under Android edge-to-edge
          (SDK 54+) and only produce a runtime warning. The strip behind the
          icons is painted by ScreenFrame's themed background instead. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack
        screenOptions={{
          // iOS: App Store–style glass header — a translucent system blur with
          // the app's tint showing through, rather than a flat colour fill.
          // Android: keep the original solid green header completely unchanged.
          // headerBackTitleVisible was removed in native-stack v7; the
          // equivalent today is headerBackButtonDisplayMode: 'default', which
          // keeps the chevron + previous-screen back title visible.
          ...(Platform.OS === 'ios'
            ? {
                headerTransparent: true,
                headerBlurEffect: 'systemChromeMaterial' as const,
                headerStyle: { backgroundColor: 'transparent' },
                // Green primary so the title + back chevron stay readable over
                // the light glass (white tint would vanish on the blur).
                headerTintColor: '#10b981',
                headerBackButtonDisplayMode: 'default' as const,
              }
            : {
                headerStyle: {
                  backgroundColor: '#10b981',
                },
                headerTintColor: '#fff',
              }),
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerBackTitle: language === 'ar' ? 'رجوع' : 'Back',
          animation: language === 'ar' ? 'slide_from_left' : 'slide_from_right',
          animationDuration: 250,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="role-selection" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="(customer)" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen
          name="(technician)"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name="(courier)"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen name="courier-auth" options={{ headerShown: false }} />
        <Stack.Screen name="courier-onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="order-offers" options={{ headerShown: false }} />
        <Stack.Screen name="admin-couriers" options={{ headerShown: false }} />
        <Stack.Screen 
          name="request" 
          options={{ 
            headerShown: false // Hide default header to use custom one
          }} 
        />
        <Stack.Screen 
          name="calculator" 
          options={{ 
            headerShown: false // Hide default header to use custom one
          }} 
        />
        <Stack.Screen 
          name="contact" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="chatbot" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen
          name="auth"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name="auth/callback"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name="track/[id]"
          options={{ title: 'تتبع الطلب' }}
        />
        {/* The customer profile lives at app/(customer)/profile.tsx (the richer
            profile with wallet/loyalty/stats). The old root-level app/profile.tsx
            was removed because it collided on the same "/profile" URL, making
            resolution non-deterministic. Nothing is registered here for it. */}
        <Stack.Screen
          name="technician-auth"
          options={{ 
            title: language === 'ar' ? 'تسجيل دخول الفني' : 'Technician Login',
            headerShown: false 
          }} 
        />
        <Stack.Screen
          name="order-details"
          options={{
            title: language === 'ar' ? 'تفاصيل الطلب' : 'Order Details',
            headerShown: false 
          }} 
        />
        <Stack.Screen
          name="chat/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="courier-chat/[taskId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="addresses" options={{ headerShown: false }} />
        <Stack.Screen name="wallet" options={{ headerShown: false }} />
        <Stack.Screen name="notifications-settings" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="technician-onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login-otp" options={{ headerShown: false }} />
        <Stack.Screen name="email-auth" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="admin-verifications" options={{ headerShown: false }} />
        <Stack.Screen name="loyalty" options={{ headerShown: false }} />
        <Stack.Screen name="admin-discount-codes" options={{ headerShown: false }} />
        <Stack.Screen name="admin-market" options={{ headerShown: false }} />
        <Stack.Screen name="market" options={marketScreenOptions} />
        <Stack.Screen name="market-new" options={marketScreenOptions} />
        <Stack.Screen name="market-detail" options={marketScreenOptions} />
        <Stack.Screen name="market-seller" options={marketScreenOptions} />
        <Stack.Screen name="market-chat" options={marketScreenOptions} />
        <Stack.Screen name="market-messages" options={marketScreenOptions} />
        <Stack.Screen name="my-listings" options={marketScreenOptions} />
        <Stack.Screen name="admin-broadcasts" options={{ headerShown: false }} />
        <Stack.Screen name="admin-reports" options={{ headerShown: false }} />
        <Stack.Screen name="admin-order-detail" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ headerShown: false }} />
        {/* Screens with custom in-screen headers — hide the default green
            navigator header so it doesn't appear duplicated above the
            custom one. */}
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="warranty" options={{ headerShown: false }} />
        <Stack.Screen name="admin-warranties" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="support-chat" options={{ headerShown: false }} />
        <Stack.Screen name="admin-support" options={{ headerShown: false }} />
        {/* These admin screens have their own in-screen headers; hiding the
            native green Stack header eliminates the duplicated bar that
            appeared above the custom one. */}
        <Stack.Screen name="admin-orders" options={{ headerShown: false }} />
        <Stack.Screen name="admin-ratings" options={{ headerShown: false }} />
        <Stack.Screen name="admin-users" options={{ headerShown: false }} />
        <Stack.Screen name="admin-platform-settings" options={{ headerShown: false }} />
        <Stack.Screen name="admin-user-verifications" options={{ headerShown: false }} />
        {/* Customer identity verification screen renders its own in-screen
            header; hide the native Stack header so it isn't duplicated. */}
        <Stack.Screen name="verify-identity" options={{ headerShown: false }} />
        <Stack.Screen name="admin-accounting" options={{ headerShown: false }} />
        <Stack.Screen name="admin-suppliers" options={{ headerShown: false }} />
        <Stack.Screen name="admin-service-areas" options={{ headerShown: false }} />
        <Stack.Screen name="admin-pricing-rules" options={{ headerShown: false }} />
        <Stack.Screen name="admin-pricing-addons" options={{ headerShown: false }} />
        <Stack.Screen name="track-courier/[taskId]" options={{ headerShown: false }} />
        <Stack.Screen name="admin-offers" options={{ headerShown: false }} />
        <Stack.Screen name="admin-community" options={{ headerShown: false }} />
        <Stack.Screen name="admin-billing" options={{ headerShown: false }} />
        <Stack.Screen name="admin-team" options={{ headerShown: false }} />
        <Stack.Screen name="admin-activity" options={{ headerShown: false }} />
        <Stack.Screen name="admin-automations" options={{ headerShown: false }} />
        <Stack.Screen name="admin-broadcast-history" options={{ headerShown: false }} />
        <Stack.Screen name="admin-scheduled-notifications" options={{ headerShown: false }} />
      </Stack>
    </ScreenFrame>
  );
}

export default function RootLayout() {
  useOtaUpdates();
  // Branded intro overlay, shown once per cold start on top of the app tree.
  const [splashDone, setSplashDone] = useState(false);
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    // Official Saudi Riyal symbol (SIL OFL). It carries a single glyph, so it
    // can only be used through <Riyal /> — never as a text family.
    [RIYAL_FONT_REGULAR]: require('../assets/fonts/SaudiRiyal-Regular.ttf'),
    [RIYAL_FONT_BOLD]: require('../assets/fonts/SaudiRiyal-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <GearLoader size={48} />
      </View>
    );
  }

  // IBM Plex Sans Arabic globally — but on iOS/Android, custom fonts
  // don't auto-map fontWeight: 'bold' to a bold variant; you must name
  // the family explicitly. Without this override every "bold" Text on
  // screen would render in the regular weight, which is exactly the
  // "the font isn't really applied" symptom users report.
  //
  // We intercept Text/TextInput's render once and rewrite the resolved
  // style so the right IBM Plex Sans Arabic variant is picked based
  // on fontWeight.
  applyAppFontToText();

  return (
    <ErrorBoundary>
      {/* SafeAreaProvider must wrap the whole tree: every screen's
          <SafeAreaView> / useSafeAreaInsets() reads insets from this context.
          Without it, insets default to 0 and the top padding silently never
          applies on Android (the status-bar overlap). initialWindowMetrics
          gives correct insets on first paint, avoiding a layout flash. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppProvider>
          <AuthProvider>
            <OrdersProvider>
              <LoyaltyProvider>
                <ThemeProvider>
                  <RequestProvider>
                    <RootLayoutContent />
                    {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
                  </RequestProvider>
                </ThemeProvider>
              </LoyaltyProvider>
            </OrdersProvider>
          </AuthProvider>
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
