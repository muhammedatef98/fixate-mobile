import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { saveLastRole } from '../../utils/rolePreference';

export default function CustomerLayout() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  // Defense-in-depth: even if a technician slips past the login screen
  // (cached session from a prior build, deep link, etc.), this guard
  // bounces them straight to the technician portal so they can never
  // operate inside the customer app surface.
  useEffect(() => {
    if (!user) return;
    const role =
      (userProfile as any)?.role ??
      (user.user_metadata as any)?.role ??
      null;
    if (role === 'technician') {
      router.replace('/(technician)');
      return;
    }
    // User is legitimately in the customer flow — remember it so the next
    // cold launch lands here directly and skips role-selection.
    void saveLastRole('customer');
  }, [user, userProfile, router]);

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none', // Instant navigation
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      />
    </View>
  );
}
