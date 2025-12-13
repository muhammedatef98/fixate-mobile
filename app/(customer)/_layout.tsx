import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none', // Instant navigation
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    />
  );
}
