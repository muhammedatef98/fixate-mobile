import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200, // Fast and smooth (200ms)
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    />
  );
}
