import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { saveLastRole } from '../../utils/rolePreference';

export default function CustomerLayout() {
  const { user } = useAuth();

  // Multi-role: one account may hold several roles, and ANY logged-in user
  // may use the customer flow (requesting repairs is open to everyone —
  // technicians and couriers included). Remember the flow so the next cold
  // launch lands here directly and skips role-selection.
  useEffect(() => {
    if (!user) return;
    void saveLastRole('customer');
  }, [user]);

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
