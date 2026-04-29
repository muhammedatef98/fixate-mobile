import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { RTLMaterialIcon } from '../components/RTLIcon';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'فيكساتي\nصيانة أجهزتك في خطوتين',
    subtitle: 'اطلب فني محترف لإصلاح جوالك أو لابتوبك\nأو أي جهاز إلكتروني — يصلك أينما كنت.',
    icon: 'home-repair-service'
  },
  {
    id: '2',
    title: 'كيف يعمل التطبيق؟',
    subtitle: '١. اختر جهازك واشرح المشكلة\n٢. يقبل الفني الأقرب طلبك\n٣. يصل لمكانك ويصلح الجهاز',
    icon: 'play-circle-outline'
  },
  {
    id: '3',
    title: 'تتبع الفني\nلحظة بلحظة',
    subtitle: 'شاهد موقع الفني على الخريطة\nواستلم إشعارات فورية عند كل تحديث.',
    icon: 'location-on'
  },
  {
    id: '4',
    title: 'ضمان وأسعار شفافة',
    subtitle: 'سعر مُتفق عليه قبل الإصلاح\nوضمان على قطع الغيار الأصلية.',
    icon: 'verified'
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
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

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/role-selection');
    }
  };

  const handleSkip = () => {
    router.replace('/role-selection');
  };

  const renderItem = ({ item, index }: any) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <View style={styles.iconCircle}>
          <MaterialIcons name={item.icon} size={64} color={COLORS.primary} />
        </View>
      </View>
      
      <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>تخطي</Text>
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
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? 'ابدأ الآن' : 'التالي'}
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

const styles = StyleSheet.create({
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
