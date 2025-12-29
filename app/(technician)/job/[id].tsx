import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Linking, Platform, Alert, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const JOB_STEPS = [
  { id: 'arrive', label: 'الوصول لموقع العميل', icon: 'location-arrow' },
  { id: 'diagnose', label: 'فحص الجهاز وتشخيص العطل', icon: 'microscope' },
  { id: 'repair', label: 'إتمام عملية الإصلاح', icon: 'tools' },
  { id: 'test', label: 'اختبار الجهاز مع العميل', icon: 'clipboard-check' },
  { id: 'payment', label: 'استلام المبلغ', icon: 'money-bill-wave' },
];

export default function ActiveJobScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [status, setStatus] = useState('en_route'); // en_route, working, completed
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
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
          duration: 500,
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
    Linking.openURL('tel:0501234567');
  };

  const handleNavigate = () => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = '24.7136,46.6753';
    const label = 'موقع العميل';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
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

  const handleMainAction = () => {
    if (status === 'en_route') {
      setStatus('working');
      setIsTimerRunning(true);
    } else if (status === 'working') {
      if (completedSteps.length < JOB_STEPS.length) {
        Alert.alert('تنبيه', 'يرجى إكمال جميع خطوات القائمة أولاً');
        return;
      }
      setIsTimerRunning(false);
      setStatus('completed');
      Alert.alert('مبروك!', 'تم إكمال المهمة بنجاح', [
        { text: 'العودة للرئيسية', onPress: () => router.back() }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-forward" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طلب #{id}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {status === 'en_route' ? 'في الطريق' : status === 'working' ? 'جاري العمل' : 'مكتمل'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Customer Card */}
        <View style={[styles.card, SHADOWS.small]}>
          <View style={styles.customerHeader}>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>عبدالله محمد</Text>
              <Text style={styles.customerAddress}>الرياض، حي الملقا، شارع أنس بن مالك</Text>
            </View>
            <View style={styles.customerActions}>
              <TouchableOpacity style={styles.actionIcon} onPress={() => router.push(`/chat/${id}`)}>
                <MaterialIcons name="chat" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionIcon} onPress={handleCall}>
                <Ionicons name="call" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionIcon} onPress={handleNavigate}>
                <FontAwesome5 name="directions" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Device Info */}
        <View style={[styles.card, SHADOWS.small]}>
          <Text style={styles.sectionTitle}>تفاصيل الجهاز</Text>
          <View style={styles.deviceRow}>
            <MaterialIcons name="phone-iphone" size={24} color={COLORS.textSecondary} />
            <Text style={styles.deviceText}>iPhone 14 Pro Max</Text>
          </View>
          <View style={styles.deviceRow}>
            <MaterialIcons name="broken-image" size={24} color={COLORS.error} />
            <Text style={[styles.deviceText, { color: COLORS.error }]}>كسر في الشاشة</Text>
          </View>
        </View>

        {/* Timer Section */}
        {status !== 'en_route' && (
          <Animated.View style={[styles.timerCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.timerLabel}>وقت العمل</Text>
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
          <Text style={styles.sectionTitle}>قائمة المهام</Text>
          {JOB_STEPS.map((step, index) => (
            <TouchableOpacity
              key={step.id}
              style={[
                styles.checklistItem,
                completedSteps.includes(step.id) && styles.checkedItem
              ]}
              onPress={() => toggleStep(step.id)}
              disabled={status === 'en_route'}
            >
              <View style={[
                styles.checkbox,
                completedSteps.includes(step.id) && styles.checkedBox
              ]}>
                {completedSteps.includes(step.id) && (
                  <MaterialIcons name="check" size={16} color="#FFF" />
                )}
              </View>
              <View style={styles.stepContent}>
                <Text style={[
                  styles.stepLabel,
                  completedSteps.includes(step.id) && styles.checkedLabel
                ]}>{step.label}</Text>
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
            status === 'working' && completedSteps.length < JOB_STEPS.length && styles.disabledBtn
          ]}
          onPress={handleMainAction}
        >
          <Text style={styles.mainBtnText}>
            {status === 'en_route' ? 'وصلت للموقع / ابدأ العمل' : 'إنهاء المهمة'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.l,
    paddingTop: 50,
    flexDirection: 'row',
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
    marginLeft: 12,
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
