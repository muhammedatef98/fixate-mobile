import { Stack } from 'expo-router';
import { useApp } from '../../contexts/AppContext';

export default function TechnicianLayout() {
  const { language } = useApp();
  const isRTL = language === 'ar';

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      animation: 'none',
      gestureEnabled: true,
      gestureDirection: 'horizontal',
      headerStyle: {
        backgroundColor: '#10b981',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerBackTitle: isRTL ? 'رجوع' : 'Back',
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="my-orders" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="available-orders" />
      <Stack.Screen 
        name="manage-order" 
        options={{ 
          headerShown: true,
          title: isRTL ? 'إدارة الطلب' : 'Manage Order'
        }} 
      />
      <Stack.Screen name="job/[id]" />
    </Stack>
  );
}
