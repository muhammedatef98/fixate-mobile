import { Stack } from 'expo-router';

export default function TechnicianLayout() {
  return (
    <Stack screenOptions={{ 
      headerShown: false,
      animation: 'fade',
      animationDuration: 150,
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="job/[id]" />
    </Stack>
  );
}
