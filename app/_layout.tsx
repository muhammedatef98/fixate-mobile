import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { RequestProvider } from '../contexts/RequestContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppProvider, useApp } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import ErrorBoundary from '../components/ErrorBoundary';
import '../i18n';

function RootLayoutContent() {
  const { language } = useApp();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isAuthPage = segments[0] === 'login' || segments[0] === 'signup' || segments[0] === 'technician-auth';
    const isPublicPage = segments[0] === 'onboarding' || segments[0] === 'role-selection' || segments[0] === 'index' || segments[0] === undefined;

    if (user) {
      // If user is logged in and on a public/auth page, they can stay on role-selection or go to their home
      // But we don't force redirect away from role-selection anymore to allow choice
      if (isAuthPage) {
        router.replace('/role-selection');
      }
    } else {
      // If user is NOT logged in and trying to access protected pages (customer/technician)
      const isProtectedRoute = segments[0] === '(customer)' || segments[0] === '(technician)' || segments[0] === 'request';
      if (isProtectedRoute) {
        router.replace('/role-selection');
      }
    }
  }, [user, segments, loading]);
  
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
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#10b981',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
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
            title: 'تسجيل دخول الفني',
            headerShown: false 
          }} 
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthProvider>
          <ThemeProvider>
            <RequestProvider>
              <RootLayoutContent />
            </RequestProvider>
          </ThemeProvider>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
