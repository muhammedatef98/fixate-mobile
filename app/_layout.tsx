import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, View, ActivityIndicator } from 'react-native';
import { RequestProvider } from '../contexts/RequestContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppProvider, useApp } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { OrdersProvider } from '../contexts/OrdersContext';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import ErrorBoundary from '../components/ErrorBoundary';
import OfflineBanner from '../components/OfflineBanner';
import {
  useFonts,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from '@expo-google-fonts/tajawal';
import { applyTajawalToText } from '../utils/applyTajawal';
import '../i18n';

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
    const REDIRECT_AWAY_IF_LOGGED_IN = new Set([
      'login', 'signup', 'auth', 'technician-auth',
      'login-otp', 'forgot-password', 'onboarding',
    ]);
    const PROTECTED_GROUPS = new Set(['(customer)', '(technician)', 'request']);

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
      // technician-auth is the technician's signup/login screen. If a logged-in
      // user lands there explicitly, respect the intent and route to
      // /(technician). Admins (is_admin=true) are sent straight to the admin
      // dashboard. Otherwise route by stored role.
      const wantsTechnician = first === 'technician-auth';
      const isAdmin = (userProfile as any)?.is_admin === true;
      const target = isAdmin
        ? '/admin'
        : wantsTechnician || (userProfile as any)?.role === 'technician'
        ? '/(technician)'
        : '/(customer)';
      router.replace(target as any);
      return;
    }

    if (!user && isProtectedRoute) {
      router.replace('/role-selection');
    }
  }, [user, userProfile, segments, loading]);

  useEffect(() => {
    const isRTL = language === 'ar';
    // Force RTL for Arabic
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
      I18nManager.allowRTL(isRTL);
      // Note: App needs to be reloaded for RTL changes to take effect
      // For development: reload the app after changing language
    }
  }, [language]);

  return (
    <>
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
          animation: 'none',
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
          name="login" 
          options={{ 
            title: 'تسجيل الدخول',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="signup" 
          options={{ 
            title: 'إنشاء حساب',
            headerShown: false 
          }} 
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
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="admin-verifications" options={{ headerShown: false }} />
        <Stack.Screen name="admin-discount-codes" options={{ headerShown: false }} />
        <Stack.Screen name="admin-market" options={{ headerShown: false }} />
        <Stack.Screen name="market" options={{ headerShown: false }} />
        <Stack.Screen name="market-new" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // Tajawal globally — but on iOS/Android, custom fonts don't auto-map
  // fontWeight: 'bold' to a bold variant; you must name the family
  // explicitly. Without this override every "bold" Text on screen would
  // render in the regular weight, which is exactly the "the font isn't
  // really applied" symptom users report.
  //
  // We intercept Text/TextInput's render once and rewrite the resolved
  // style so the right Tajawal variant is picked based on fontWeight.
  applyTajawalToText();

  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthProvider>
          <OrdersProvider>
            <ThemeProvider>
              <RequestProvider>
                <RootLayoutContent />
              </RequestProvider>
            </ThemeProvider>
          </OrdersProvider>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
