import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { RequestProvider } from '../contexts/RequestContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppProvider, useApp } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { isAdminPhone } from '../constants/admin';
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
import { initSentry } from '../services/sentryService';
import { useOtaUpdates } from '../hooks/useOtaUpdates';
import messaging from '@react-native-firebase/messaging';
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import '../i18n';

initSentry();

function RootLayoutContent() {
  const { language } = useApp();
  const { user, userProfile, loading } = useAuth();
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
      'login', 'signup', 'auth', 'technician-auth',
      'login-otp', 'email-auth', 'onboarding',
    ]);
    const PROTECTED_GROUPS = new Set(['(customer)', '(technician)', 'request']);

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
    // /technician-auth is the only explicit technician entry point in the
    // app today; every other auth surface (login-otp, email-auth, auth,
    // signup, login) is a customer-side entry point.
    const TECHNICIAN_AUTH_SOURCES = new Set(['technician-auth']);
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
      const wantsTechnician = !!first && TECHNICIAN_AUTH_SOURCES.has(first);
      const wantsCustomer = !!first && CUSTOMER_AUTH_SOURCES.has(first);
      const phone =
        (user as any)?.phone ?? (userProfile as any)?.phone ?? null;
      const adminByPhone = isAdminPhone(phone);

      // Resolution order:
      //   1. Admin phone → /admin (system-level, always wins).
      //   2. Explicit customer auth source → /(customer) — honours the
      //      user's choice even if their profile role is technician.
      //   3. Explicit technician auth source → /(technician).
      //   4. Fallback to profile-stored role for routes like /onboarding
      //      where there's no role-binding auth source.
      const target = adminByPhone
        ? '/admin'
        : wantsCustomer
          ? '/(customer)'
          : wantsTechnician
            ? '/(technician)'
            : (userProfile as any)?.role === 'technician'
              ? '/(technician)'
              : '/(customer)';
      router.replace(target as any);
      return;
    }

    if (!user && isProtectedRoute) {
      router.replace('/role-selection');
    }

    // Route-level admin gate — applies to every admin segment (the bare
    // /admin hub plus all admin-* detail screens). Only the account whose
    // phone matches ADMIN_PHONE may render any admin surface. Anyone else
    // is bounced back to the customer home before the screen mounts.
    // This is defence-in-depth on top of useAdminGuard inside each
    // admin-* screen.
    const isAdminSegment =
      !!first && (first === 'admin' || first.startsWith('admin-'));
    if (isAdminSegment) {
      if (!user) {
        router.replace('/role-selection');
        return;
      }
      // Wait for the profile to land so we can read the phone without
      // a false negative on first paint.
      if (userProfile === null) return;
      const phone =
        (user as any)?.phone ?? (userProfile as any)?.phone ?? null;
      if (!isAdminPhone(phone)) {
        router.replace('/(customer)');
      }
    }
  }, [user, userProfile, segments, loading]);

  // Register a no-op FCM background handler on Android.
  // RNFirebase REQUIRES setBackgroundMessageHandler to be called or it
  // logs a warning in production. We register it as a pure no-op so
  // expo-notifications remains the sole owner of push display logic.
  // iOS uses APNs via expo-notifications directly — intentionally untouched.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    messaging().setBackgroundMessageHandler(async () => {
      // No-op: expo-notifications handles all display.
    });
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

  return (
    <View style={{ flex: 1 }}>
      <StatusBar hidden={true} />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#10b981',
          },
          headerTintColor: '#fff',
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
          name="track/[id]" 
          options={{ title: 'تتبع الطلب' }} 
        />
        <Stack.Screen
          name="profile"
          options={{ title: 'الملف الشخصي' }}
        />
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
          options={{
            title: language === 'ar' ? 'المحادثة' : 'Chat',
            headerShown: true
          }}
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
        <Stack.Screen name="market" options={{ headerShown: false }} />
        <Stack.Screen name="market-new" options={{ headerShown: false }} />
        <Stack.Screen name="market-detail" options={{ headerShown: false }} />
        <Stack.Screen name="market-chat" options={{ headerShown: false }} />
        <Stack.Screen name="market-messages" options={{ headerShown: false }} />
        <Stack.Screen name="my-listings" options={{ headerShown: false }} />
        <Stack.Screen name="admin-broadcasts" options={{ headerShown: false }} />
        <Stack.Screen name="admin-reports" options={{ headerShown: false }} />
        <Stack.Screen name="admin-order-detail" options={{ headerShown: false }} />
        <Stack.Screen name="admin-payment-gateway" options={{ headerShown: false }} />
        <Stack.Screen name="admin-otp-provider" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ headerShown: false }} />
        {/* Screens with custom in-screen headers — hide the default green
            navigator header so it doesn't appear duplicated above the
            custom one. */}
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
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
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useOtaUpdates();
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10B981" />
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
      <AppProvider>
        <AuthProvider>
          <OrdersProvider>
            <LoyaltyProvider>
              <ThemeProvider>
                <RequestProvider>
                  <RootLayoutContent />
                </RequestProvider>
              </ThemeProvider>
            </LoyaltyProvider>
          </OrdersProvider>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
