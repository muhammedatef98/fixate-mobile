import { Stack } from 'expo-router';

export default function TechnicianLayout() {
  return (
    <Stack screenOptions={{ 
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 200,
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="job/[id]" />
    </Stack>
  );
}
