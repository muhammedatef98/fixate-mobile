import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useApp } from '../../../contexts/AppContext';
import { requests } from '../../../lib/supabase-api';
import { logger } from '../../../utils/logger';
import { RTLMaterialIcon } from '../../../components/RTLIcon';

const JOB_STEPS = [
  { id: 'arrive', label: 'الوصول لموقع العميل', labelEn: 'Arrive at location', icon: 'location-arrow' },
  { id: 'diagnose', label: 'فحص الجهاز وتشخيص العطل', labelEn: 'Diagnose device', icon: 'microscope' },
  { id: 'repair', label: 'إتمام عملية الإصلاح', labelEn: 'Complete repair', icon: 'tools' },
  { id: 'test', label: 'اختبار الجهاز مع العميل', labelEn: 'Test with customer', icon: 'clipboard-check' },
  { id: 'payment', label: 'استلام المبلغ', labelEn: 'Collect payment', icon: 'money-bill-wave' },
];

export default function ActiveJobScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);

  const [status, setStatus] = useState('en_route'); // en_route, working, completed
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [order, setOrder] = useState<any>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    loadOrder();
  }, []);

  const loadOrder = async () => {
    try {
      const data = await requests.getById(id as string);
      setOrder(data);
      if (data?.status) {
        if (data.status === 'accepted' || data.status === 'picking_up') setStatus('en_route');
        else if (data.status === 'diagnosing' || data.status === 'repairing' || data.status === 'delivering') setStatus('working');
        else if (data.status === 'completed') setStatus('completed');
      }
    } catch (error) {
      logger.error('Error loading order:', error);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    try {
      await requests.updateStatus(id as string, newStatus as any);
      // Local state update is handled by the logic below
    } catch (error) {
      logger.error('Error updating status:', error);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل تحديث الحالة' : 'Failed to update status');
    }
  };

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    if (status !== 'en_route') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCall = () => {
    if (order?.customer_phone) {
      Linking.openURL(`tel:${order.customer_phone}`);
    }
  };

  const handleNavigate = () => {
    // Use actual coordinates if available, otherwise fallback
    const lat = order?.latitude || '24.7136';
    const lng = order?.longitude || '46.6753';
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const label = isRTL ? 'موقع العميل' : 'Customer Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${lat},${lng}`,
      android: `${scheme}${lat},${lng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  const toggleStep = (stepId: string) => {
    if (completedSteps.includes(stepId)) {
      setCompletedSteps(prev => prev.filter(id => id !== stepId));
    } else {
      setCompletedSteps(prev => [...prev, stepId]);
    }
  };

  const handleMainAction = async () => {
    if (status === 'en_route') {
      setStatus('working');
      setIsTimerRunning(true);
      await updateOrderStatus('in_progress');
    } else if (status === 'working') {
      if (completedSteps.length < JOB_STEPS.length) {
        Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'يرجى إكمال جميع خطوات القائمة أولاً' : 'Please complete all checklist items first');
        return;
      }
      setIsTimerRunning(false);
      setStatus('completed');
      await updateOrderStatus('completed');
      Alert.alert(isRTL ? 'مبروك!' : 'Congratulations!', isRTL ? 'تم إكمال المهمة بنجاح' : 'Job completed successfully', [
        { text: isRTL ? 'العودة للرئيسية' : 'Back to Home', onPress: () => router.back() }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} onPress={() => router.back()} style={styles.backBtn}>
          <RTLMaterialIcon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'طلب #' : 'Order #'}{id?.slice(0, 4)}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {status === 'en_route' 
              ? (isRTL ? 'في الطريق' : 'En Route') 
              : status === 'working' 
                ? (isRTL ? 'جاري العمل' : 'Working') 
                : (isRTL ? 'مكتمل' : 'Completed')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Customer Card */}
        <View style={[styles.card, SHADOWS.small]}>
          <View style={[styles.customerHeader, isRTL && styles.rowReverse]}>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerName, isRTL && styles.textRight]}>{order?.customer_name || (isRTL ? 'عميل' : 'Customer')}</Text>
              <Text style={[styles.customerAddress, isRTL && styles.textRight]}>{order?.address || (isRTL ? 'العنوان غير متوفر' : 'Address not available')}</Text>
            </View>
            <View style={[styles.customerActions, isRTL && styles.rowReverse]}>
              <TouchableOpacity style={styles.actionIcon} onPress={() => router.push(`/chat/${id}`)}>
                <MaterialIcons name="chat" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              {/* Call hidden on terminal orders (completed/rejected/cancelled) — Fix 2. */}
              {!['rejected', 'cancelled', 'completed'].includes(order?.status) && (
                <TouchableOpacity style={styles.actionIcon} onPress={handleCall}>
                  <Ionicons name="call" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionIcon} onPress={handleNavigate}>
                <FontAwesome5 name="directions" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Device Info */}
        <View style={[styles.card, SHADOWS.small]}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{isRTL ? 'تفاصيل الجهاز' : 'Device Details'}</Text>
          <View style={[styles.deviceRow, isRTL && styles.rowReverse]}>
            <MaterialIcons name="phone-iphone" size={24} color={COLORS.textSecondary} />
            <Text style={styles.deviceText}>{order?.device_brand} {order?.device_model}</Text>
          </View>
          <View style={[styles.deviceRow, isRTL && styles.rowReverse]}>
            <MaterialIcons name="broken-image" size={24} color={COLORS.error} />
            <Text style={[styles.deviceText, { color: COLORS.error }]}>{order?.issue_type}</Text>
          </View>
        </View>

        {/* Timer Section */}
        {status !== 'en_route' && (
          <Animated.View style={[styles.timerCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.timerLabel}>{isRTL ? 'وقت العمل' : 'Work Timer'}</Text>
            <Text style={styles.timerValue}>{formatTime(timer)}</Text>
            <TouchableOpacity 
              onPress={() => setIsTimerRunning(!isTimerRunning)}
              style={styles.timerBtn}
            >
              <MaterialIcons 
                name={isTimerRunning ? "pause" : "play-arrow"} 
                size={24} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Checklist */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{isRTL ? 'قائمة المهام' : 'Checklist'}</Text>
          {JOB_STEPS.map((step, index) => (
            <TouchableOpacity
              key={step.id}
              style={[
                styles.checklistItem,
                completedSteps.includes(step.id) && styles.checkedItem,
                isRTL && styles.rowReverse
              ]}
              onPress={() => toggleStep(step.id)}
              disabled={status === 'en_route'}
            >
              <View style={[
                styles.checkbox,
                completedSteps.includes(step.id) && styles.checkedBox,
                isRTL ? { marginLeft: 12 } : { marginRight: 12 }
              ]}>
                {completedSteps.includes(step.id) && (
                  <MaterialIcons name="check" size={16} color="#FFF" />
                )}
              </View>
              <View style={styles.stepContent}>
                <Text style={[
                  styles.stepLabel,
                  completedSteps.includes(step.id) && styles.checkedLabel,
                  isRTL && styles.textRight
                ]}>{isRTL ? step.label : step.labelEn}</Text>
              </View>
              <FontAwesome5 
                name={step.icon as any} 
                size={16} 
                color={completedSteps.includes(step.id) ? COLORS.primary : COLORS.textSecondary} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.footer, SHADOWS.medium]}>
        <TouchableOpacity 
          style={[
            styles.mainBtn,
            status === 'working' && completedSteps.length < JOB_STEPS.length && styles.disabledBtn,
            isRTL && styles.rowReverse
          ]}
          onPress={handleMainAction}
        >
          <Text style={styles.mainBtnText}>
            {status === 'en_route' 
              ? (isRTL ? 'وصلت للموقع / ابدأ العمل' : 'Arrived / Start Work') 
              : (isRTL ? 'إنهاء المهمة' : 'Complete Job')}
          </Text>
          <MaterialIcons 
            name={status === 'en_route' ? "play-circle-filled" : "check-circle"} 
            size={24} 
            color="#FFF" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.l,
    paddingTop: 50,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  content: {
    padding: SPACING.l,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  customerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.m,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  deviceText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  timerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  timerLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  timerBtn: {
    marginTop: 8,
    padding: 8,
  },
  section: {
    marginTop: SPACING.m,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.l,
    borderRadius: 12,
    marginBottom: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkedItem: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}05`,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  checkedLabel: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    padding: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  mainBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.7,
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
