import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getColors, SPACING } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { RTLMaterialIcon } from '../components/RTLIcon';
import { useApp } from '../contexts/AppContext';
import { markOnboardingSeen } from '../utils/onboardingPreference';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'فيكساتي\nصيانة أجهزتك في خطوتين',
    titleEn: 'Fixate\nDevice repair in two steps',
    subtitle: 'اطلب فني محترف لإصلاح جوالك أو لابتوبك\nأو أي جهاز إلكتروني — يصلك أينما كنت.',
    subtitleEn: 'Book a professional technician for your phone,\nlaptop or any electronic device — they come to you.',
    icon: 'home-repair-service'
  },
  {
    id: '2',
    title: 'كيف يعمل التطبيق؟',
    titleEn: 'How does it work?',
    subtitle: '1. اختر جهازك واشرح المشكلة\n2. تصلك عروض أسعار من الفنيين القريبين\n3. تقبل العرض الأنسب وتؤكد الدفع ليبدأ الإصلاح',
    subtitleEn: '1. Pick your device and describe the issue\n2. Nearby technicians send you their offers\n3. Accept the best one, confirm payment, and the repair begins',
    icon: 'play-circle-outline'
  },
  {
    id: '3',
    title: 'تتبع الفني\nلحظة بلحظة',
    titleEn: 'Track your technician\nin real time',
    subtitle: 'شاهد موقع الفني على الخريطة\nواستلم إشعارات فورية عند كل تحديث.',
    subtitleEn: 'See the technician on the map\nand get instant updates at every step.',
    icon: 'location-on'
  },
  {
    id: '4',
    title: 'ضمان وأسعار شفافة',
    titleEn: 'Warranty & transparent pricing',
    subtitle: 'سعر مُتفق عليه قبل الإصلاح\nوضمان على قطع الغيار الأصلية.',
    subtitleEn: 'An agreed price before any repair\nand a warranty on genuine parts.',
    icon: 'verified'
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
  const styles = makeStyles(COLORS, isRTL);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Reset animations when slide changes
    fadeAnim.setValue(0);
    slideAnim.setValue(50);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  // Persist the "seen" flag before leaving so onboarding never shows again,
  // then hand off to role-selection. markOnboardingSeen never throws; we
  // proceed regardless (worst case the intro reappears next cold launch).
  const finishOnboarding = async () => {
    await markOnboardingSeen();
    router.replace('/role-selection');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      void finishOnboarding();
    }
  };

  const handleSkip = () => {
    void finishOnboarding();
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <View style={styles.iconCircle}>
          <MaterialIcons name={item.icon} size={64} color={COLORS.primary} />
        </View>
      </View>

      <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.title}>{isRTL ? item.title : item.titleEn}</Text>
        <Text style={styles.subtitle}>{isRTL ? item.subtitle : item.subtitleEn}</Text>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} accessibilityRole="button">
          <Text style={styles.skipText}>{isRTL ? 'تخطي' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (index !== currentIndex) {
            setCurrentIndex(index);
          }
        }}
        keyExtractor={(item) => item.id}
        style={{ direction: 'rtl' }}
      />

      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index && styles.activeDot,
              ]}
            />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity style={styles.button} onPress={handleNext} accessibilityRole="button">
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1
              ? (isRTL ? 'ابدأ الآن' : 'Get started')
              : (isRTL ? 'التالي' : 'Next')}
          </Text>
          {currentIndex === SLIDES.length - 1 ? (
            <MaterialIcons name="check" size={24} color="#FFF" />
          ) : (
            <RTLMaterialIcon name="arrow-forward" size={24} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.l,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  slide: {
    width,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  imageContainer: {
    height: height * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: `${COLORS.primary}30`,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.m,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  pagination: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
