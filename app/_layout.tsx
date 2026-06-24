import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RequestProvider } from '../contexts/RequestContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppProvider, useApp } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../constants/admin';
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
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import { initSentry } from '../services/sentryService';
import { configureGoogleSignIn } from '../services/googleAuthService';
import { useOtaUpdates } from '../hooks/useOtaUpdates';
import '../i18n';

initSentry();
configureGoogleSignIn();

function RootLayoutContent() {
  const { language } = useApp();
  const { user, userProfile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const REDIRECT_AWAY_IF_LOGGED_IN = new Set([
      'login', 'signup', 'auth', 'technician-auth',
      'login-otp', 'email-auth', 'onboarding',
    ]);
    const PROTECTED_GROUPS = new Set(['(customer)', '(technician)', 'request']);

    const TECHNICIAN_AUTH_SOURCES = new Set(['technician-auth']);
    const CUSTOMER_AUTH_SOURCES = new Set([
      'login', 'signup', 'auth', 'login-otp', 'email-auth',
    ]);

    const first = segments[0] as string | undefined;
    const inAuthFlow = !!first && REDIRECT_AWAY_IF_LOGGED_IN.has(first);
    const isProtectedRoute = !!first && PROTECTED_GROUPS.has(first);

    if (user && inAuthFlow) {
      if (userProfile === null) return;
      const wantsTechnician = !!first && TECHNICIAN_AUTH_SOURCES.has(first);
      const wantsCustomer = !!first && CUSTOMER_AUTH_SOURCES.has(first);
      const adminByPhone = isAdminUser(user);

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

    const isAdminSegment =
      !!first && (first === 'admin' || first.startsWith('admin-'));
    if (isAdminSegment) {
      if (!user) {
        router.replace('/role-selection');
        return;
      }
      if (userProfile === null) return;
      if (!isAdminUser(user)) {
        router.replace('/(customer)');
      }
    }
  }, [user, userProfile, segments, loading]);

  // Hand FCM messages off to expo-notifications on Android. RNFirebase
  // messaging otherwise registers its own listeners that intercept incoming
  // pushes BEFORE expo-notifications sees them — foreground pushes get drawn
  // by Firebase (bypassing our handler) and background pushes are swallowed by
  // Firebase's headless JS service so expo-notifications never fires. By
  // installing no-op handlers here we let expo-notifications' own FCM
  // integration own display (it shows banners via the handler set in
  // lib/notifications.ts). iOS uses APNs through expo-notifications directly and
  // is intentionally untouched. Runs once.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Background / quit-state messages: expo-notifications handles display.
    // This handler exists only so RNFirebase doesn't complain about a missing
    // background handler; keep it a no-op (log only) to avoid double display.
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[FCM Background]', remoteMessage?.notification?.title);
    });

    // Foreground messages: let expo-notifications show the banner via its
    // configured notification handler (shouldShowBanner: true).
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('[FCM Foreground]', remoteMessage?.notification?.title);
    });

    return unsubscribe;
  }, []);

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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="role-selection" options={{ headerShown: false }} />
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="(technician)" options={{ headerShown: false }} />
        <Stack.Screen name="request" options={{ headerShown: false }} />
        <Stack.Screen name="calculator" options={{ headerShown: false }} />
        <Stack.Screen name="contact" options={{ headerShown: false }} />
        <Stack.Screen name="chatbot" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="track/[id]" options={{ title: 'تتبع الطلب' }} />
        <Stack.Screen name="profile" options={{ title: 'الملف الشخصي' }} />
        <Stack.Screen
          name="technician-auth"
          options={{
            title: language === 'ar' ? 'تسجيل دخول الفني' : 'Technician Login',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="order-details"
          options={{
            title: language === 'ar' ? 'تفاصيل الطلب' : 'Order Details',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{
            title: language === 'ar' ? 'المحادثة' : 'Chat',
            headerShown: true,
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
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="support-chat" options={{ headerShown: false }} />
        <Stack.Screen name="admin-support" options={{ headerShown: false }} />
        <Stack.Screen name="admin-orders" options={{ headerShown: false }} />
        <Stack.Screen name="admin-ratings" options={{ headerShown: false }} />
        <Stack.Screen name="admin-users" options={{ headerShown: false }} />
        <Stack.Screen name="admin-platform-settings" options={{ headerShown: false }} />
        <Stack.Screen name="admin-community" options={{ headerShown: false }} />
        <Stack.Screen name="admin-offers" options={{ headerShown: false }} />
        <Stack.Screen name="admin-billing" options={{ headerShown: false }} />
        <Stack.Screen name="admin-team" options={{ headerShown: false }} />
        <Stack.Screen name="admin-accounting" options={{ headerShown: false }} />
        <Stack.Screen name="admin-service-areas" options={{ headerShown: false }} />
        <Stack.Screen name="admin-user-verifications" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
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

  // Create the Android 'default' notification channel at app startup, before
  // (and independent of) login. Android 8+ silently drops any push whose
  // channel doesn't exist, and `push-dispatch` sends every message with
  // channelId: 'default' — so the channel must exist as early as possible,
  // not only after the post-login token registration runs. No-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      void ensureAndroidNotificationChannel();
      return;
    }
    void (async () => {
      await ensureAndroidNotificationChannel();
      // Debug only: dump the registered Android channels so we can confirm
      // 'default' exists with the expected importance, and detect pushes being
      // routed to fallback channels (fcm_fallback_notification_channel /
      // expo_notifications_fallback_notification_channel).
      try {
        const channels = await Notifications.getNotificationChannelsAsync();
        console.log(
          '[PushChannel] Android channels:',
          channels.map((c) => ({ id: c.id, importance: c.importance }))
        );
      } catch (e) {
        console.warn('[PushChannel] getNotificationChannelsAsync failed', e);
      }
    })();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  applyAppFontToText();

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
