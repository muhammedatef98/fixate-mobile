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

export default function TrackOrderScreen() {
  const { id } = useLocalSearchParams();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);

  const orderStatus = [
    { status: 'تم استلام الطلب', completed: true, time: '10:30 صباحاً' },
    { status: 'جاري التجهيز', completed: true, time: '11:00 صباحاً' },
    { status: 'في الطريق', completed: false, time: '' },
    { status: 'تم التسليم', completed: false, time: '' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.orderId}>طلب رقم: #{id}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>جاري التجهيز</Text>
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
        <Text style={styles.detailsTitle}>تفاصيل الطلب</Text>
        <DetailRow styles={styles} icon="phone-portrait" label="الجهاز" value="iPhone 13 Pro" />
        <DetailRow styles={styles} icon="construct" label="المشكلة" value="تغيير الشاشة" />
        <DetailRow styles={styles} icon="location" label="العنوان" value="الرياض، حي النخيل" />
        <DetailRow styles={styles} icon="cash" label="السعر" value="300 ريال" />
      </View>
    </ScrollView>
  );
}

function DetailRow({ styles, icon, label, value }: any) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={20} color="#10b981" />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  orderId: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#92400e',
    fontWeight: '600',
  },
  timeline: {
    backgroundColor: '#fff',
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
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: '#10b981',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#10b981',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineStatus: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  timelineStatusCompleted: {
    color: '#111827',
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 14,
    color: '#9ca3af',
  },
  details: {
    backgroundColor: '#fff',
    padding: 24,
    marginTop: 16,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
