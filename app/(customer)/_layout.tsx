import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 150, // Ultra fast and smooth
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    />
  );
}
