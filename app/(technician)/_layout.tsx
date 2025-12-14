import { Stack } from 'expo-router';

export default function TechnicianLayout() {
  return (
    <Stack screenOptions={{ 
      headerShown: false,
      animation: 'none',
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="my-orders" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="available-orders" />
      <Stack.Screen name="job/[id]" />
    </Stack>
  );
}
