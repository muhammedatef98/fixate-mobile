import { Stack } from 'expo-router';
import { View } from 'react-native';
import FloatingOrderStatus from '../../components/FloatingOrderStatus';

export default function CustomerLayout() {
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
      <FloatingOrderStatus />
    </View>
  );
}
