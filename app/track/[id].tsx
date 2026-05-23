import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { getColors } from '../../constants/theme';

export default function TrackOrderScreen() {
  const { id } = useLocalSearchParams();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
  const styles = makeStyles(isRTL, COLORS);

  const orderStatus = [
    { status: isRTL ? 'تم استلام الطلب' : 'Order received', completed: true, time: isRTL ? '10:30 صباحاً' : '10:30 AM' },
    { status: isRTL ? 'جاري التجهيز' : 'Preparing', completed: true, time: isRTL ? '11:00 صباحاً' : '11:00 AM' },
    { status: isRTL ? 'في الطريق' : 'On the way', completed: false, time: '' },
    { status: isRTL ? 'تم التسليم' : 'Delivered', completed: false, time: '' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.orderId}>
          {isRTL ? `طلب رقم: #${id}` : `Order #${id}`}
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {isRTL ? 'جاري التجهيز' : 'Preparing'}
          </Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {orderStatus.map((item, index) => (
          <View key={index} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View
                style={[
                  styles.timelineDot,
                  item.completed && styles.timelineDotCompleted,
                ]}
              >
                {item.completed && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              {index < orderStatus.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    item.completed && styles.timelineLineCompleted,
                  ]}
                />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text
                style={[
                  styles.timelineStatus,
                  item.completed && styles.timelineStatusCompleted,
                ]}
              >
                {item.status}
              </Text>
              {item.time && (
                <Text style={styles.timelineTime}>{item.time}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.details}>
        <Text style={styles.detailsTitle}>
          {isRTL ? 'تفاصيل الطلب' : 'Order details'}
        </Text>
        <DetailRow styles={styles} COLORS={COLORS} icon="phone-portrait" label={isRTL ? 'الجهاز' : 'Device'} value="iPhone 13 Pro" />
        <DetailRow styles={styles} COLORS={COLORS} icon="construct" label={isRTL ? 'المشكلة' : 'Issue'} value={isRTL ? 'تغيير الشاشة' : 'Screen replacement'} />
        <DetailRow styles={styles} COLORS={COLORS} icon="location" label={isRTL ? 'العنوان' : 'Address'} value={isRTL ? 'الرياض، حي النخيل' : 'Riyadh, Al Nakheel'} />
        <DetailRow styles={styles} COLORS={COLORS} icon="cash" label={isRTL ? 'السعر' : 'Price'} value={isRTL ? '300 ريال' : '300 SAR'} />
      </View>
    </ScrollView>
  );
}

function DetailRow({ styles, COLORS, icon, label, value }: any) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (isRTL: boolean, C: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    backgroundColor: C.card,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  orderId: {
    fontSize: 24,
    fontWeight: 'bold',
    color: C.text,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  statusBadge: {
    backgroundColor: C.warningSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
  },
  statusText: {
    color: C.warning,
    fontWeight: '600',
  },
  timeline: {
    backgroundColor: C.card,
    padding: 24,
    marginTop: 16,
  },
  timelineItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    minHeight: 80,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: isRTL ? 0 : 16,
    marginLeft: isRTL ? 16 : 0,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: C.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: C.border,
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: C.primary,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineStatus: {
    fontSize: 16,
    color: C.textSecondary,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  timelineStatusCompleted: {
    color: C.text,
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 14,
    color: C.textLight,
    textAlign: isRTL ? 'right' : 'left',
  },
  details: {
    backgroundColor: C.card,
    padding: 24,
    marginTop: 16,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: C.text,
    marginBottom: 16,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  detailRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  detailLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: C.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
  },
});
