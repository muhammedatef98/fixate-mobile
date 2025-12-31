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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

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
      color: '#10B981',
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
      color: '#3B82F6',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'الإشعارات' : 'Notifications'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {NOTIFICATIONS.length > 0 ? (
          NOTIFICATIONS.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.notificationCard, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.notificationInfo}>
                <Text style={[styles.notificationTitle, { color: COLORS.text }]}>
                  {isRTL ? item.titleAr : item.titleEn}
                </Text>
                <Text style={[styles.notificationDesc, { color: COLORS.textSecondary }]}>
                  {isRTL ? item.descAr : item.descEn}
                </Text>
                <Text style={[styles.notificationTime, { color: COLORS.textSecondary }]}>
                  {isRTL ? item.timeAr : item.timeEn}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-off-outline" size={80} color={COLORS.border} />
            <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
              {isRTL ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1 },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationInfo: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  notificationDesc: { fontSize: 14, marginBottom: 4 },
  notificationTime: { fontSize: 12 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: { fontSize: 16, marginTop: 16 },
});
