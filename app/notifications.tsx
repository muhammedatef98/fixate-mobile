import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';

export default function NotificationsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  const NOTIFICATIONS = [
    {
      id: 1,
      titleEn: 'Order Confirmed',
      titleAr: 'تم تأكيد الطلب',
      descEn: 'Your repair request #1234 has been confirmed.',
      descAr: 'تم تأكيد طلب الإصلاح الخاص بك رقم #1234.',
      timeEn: '2 hours ago',
      timeAr: 'منذ ساعتين',
      icon: 'check-circle',
      color: COLORS.success,
    },
    {
      id: 2,
      titleEn: 'Technician Assigned',
      titleAr: 'تم تعيين فني',
      descEn: 'Ahmed has been assigned to your request.',
      descAr: 'تم تعيين أحمد للقيام بطلبك.',
      timeEn: '1 hour ago',
      timeAr: 'منذ ساعة',
      icon: 'account-check',
      color: COLORS.info,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          onPress={() => safeBack()}
          style={styles.backButton}
        >
          <RTLIonicon name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'الإشعارات' : 'Notifications'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {NOTIFICATIONS.length > 0 ? (
          NOTIFICATIONS.map((item) => (
            <PressableScale key={item.id} to={0.985} style={styles.notificationCard}>
              <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationTitle}>{isRTL ? item.titleAr : item.titleEn}</Text>
                <Text style={styles.notificationDesc}>{isRTL ? item.descAr : item.descEn}</Text>
                <Text style={styles.notificationTime}>{isRTL ? item.timeAr : item.timeEn}</Text>
              </View>
            </PressableScale>
          ))
        ) : (
          <View style={{ marginTop: 60 }}>
            <EmptyState
              icon="bell-off-outline"
              title={isRTL ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
              description={
                isRTL
                  ? 'سنخبرك هنا بكل تحديثات طلباتك أولاً بأول.'
                  : "We'll let you know here as soon as your orders update."
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
    notificationCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      gap: 14,
      ...SHADOWS.small,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationInfo: { flex: 1 },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    notificationDesc: {
      fontSize: 14,
      marginBottom: 4,
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
    },
    notificationTime: { fontSize: 12, color: C.textLight, textAlign: isRTL ? 'right' : 'left' },
  });
