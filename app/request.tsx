import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions, TextInput, Animated, Alert, KeyboardAvoidingView, Platform, Modal, I18nManager, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRequests } from '../contexts/RequestContext';
import { requests, storage, auth } from '../lib/supabase-api';
import { BRANDS, searchBrands, searchModels, searchIssues, Brand, Issue } from '../constants/repairData';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const SERVICE_TYPES = [
  { 
    id: 'mobile', 
    name: 'فني متنقل', 
    nameEn: 'Mobile Technician',
    description: 'يأتي الفني إلى موقعك ويصلح الجهاز في المكان',
    descriptionEn: 'Technician comes to your location and fixes on-site',
    icon: 'account-wrench'
  },
  { 
    id: 'pickup', 
    name: 'استلام وتوصيل', 
    nameEn: 'Pickup & Delivery',
    description: 'نستلم جهازك ونوصله لمحل متعاقد ونرجعه بعد الإصلاح',
    descriptionEn: 'We pickup your device, deliver to partner shop, and return after repair',
    icon: 'truck-delivery'
  },
];

const DEVICE_TYPES = [
  { id: 'phone', name: 'جوال', nameEn: 'Phone', icon: 'cellphone', available: true },
  { id: 'tablet', name: 'تابلت', nameEn: 'Tablet', icon: 'tablet', available: true },
  { id: 'laptop', name: 'لابتوب', nameEn: 'Laptop', icon: 'laptop', available: true },
  { id: 'watch', name: 'ساعة ذكية', nameEn: 'Smart Watch', icon: 'watch', available: true },
  { id: 'printer', name: 'طابعة', nameEn: 'Printer', icon: 'printer', available: false },
  { id: 'headphones', name: 'سماعات', nameEn: 'Headphones', icon: 'headphones', available: false },
  { id: 'tv', name: 'شاشة/تلفاز', nameEn: 'TV/Monitor', icon: 'television', available: false },
  { id: 'appliance', name: 'أجهزة منزلية', nameEn: 'Home Appliances', icon: 'home-outline', available: false },
];

interface OrderItem {
  deviceType: string;
  brand: Brand;
  model: string;
  issue: Issue;
  description: string;
  mediaFiles: string[];
}

export default function RequestScreen() {
  const router = useRouter();
  const { addRequest } = useRequests();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    gray: '#6b7280',
    border: '#e5e7eb',
    lightGreen: '#ecfdf5',
    error: '#ef4444',
  };
  
  const styles = createStyles(COLORS, isRTL);
  const [currentStep, setCurrentStep] = useState(0);
  const stepperScrollRef = useRef<ScrollView>(null);
  
  const [selectedServiceType, setSelectedServiceType] = useState<string>('mobile');
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [filteredModels, setFilteredModels] = useState<string[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  
  const [location, setLocation] = useState<any>(null);
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  const STEPS = isRTL 
    ? ['الخدمة', 'الجهاز', 'الماركة', 'الموديل', 'العطل', 'التفاصيل', 'الموقع']
    : ['Service', 'Device', 'Brand', 'Model', 'Issue', 'Details', 'Location'];

  useEffect(() => {
    if (!user) {
      Alert.alert(
        isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required',
        isRTL ? 'يجب عليك تسجيل الدخول لرفع طلب صيانة' : 'You must login to submit a repair request',
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', onPress: () => router.replace('/role-selection'), style: 'cancel' },
          { text: isRTL ? 'تسجيل الدخول' : 'Login', onPress: () => router.replace('/login') }
        ]
      );
    }
  }, [user]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();

    if (stepperScrollRef.current) {
      const stepWidth = 100;
      stepperScrollRef.current.scrollTo({
        x: isRTL ? (STEPS.length - 1 - currentStep) * stepWidth : currentStep * stepWidth,
        animated: true
      });
    }
  }, [currentStep]);

  useEffect(() => {
    if (selectedDeviceType) {
      setFilteredBrands(searchBrands(brandSearch, selectedDeviceType));
    }
  }, [brandSearch, selectedDeviceType]);

  useEffect(() => {
    if (selectedBrand) {
      setFilteredModels(searchModels(selectedBrand.id, modelSearch));
    }
  }, [modelSearch, selectedBrand]);

  useEffect(() => {
    if (selectedDeviceType) {
      setFilteredIssues(searchIssues(selectedDeviceType, issueSearch));
    }
  }, [issueSearch, selectedDeviceType]);

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'الرجاء تحديد الموقع' : 'Please select location');
      return;
    }
    setIsSubmitting(true);
    try {
      // Logic for submission...
      setTimeout(() => {
        setIsSubmitting(false);
        Alert.alert(isRTL ? 'نجح' : 'Success', isRTL ? 'تم إرسال طلبك بنجاح' : 'Request submitted successfully');
        router.replace('/(customer)');
      }, 2000);
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إرسال الطلب' : 'Failed to submit request');
    }
  };

  const renderEmptyState = (text: string) => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="magnify-close" size={48} color={COLORS.gray} />
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'طلب صيانة' : 'Repair Request'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepperContainer}>
        <ScrollView 
          ref={stepperScrollRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepperContent}
        >
          {STEPS.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={[styles.stepCircle, currentStep >= index && styles.activeStepCircle]}>
                {currentStep > index ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, currentStep >= index && styles.activeStepNumber]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, currentStep >= index && styles.activeStepLabel]}>{step}</Text>
              {index < STEPS.length - 1 && <View style={[styles.stepLine, currentStep > index && styles.activeStepLine]} />}
            </View>
          ))}
        </ScrollView>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {currentStep === 0 && (
          <ScrollView>
            <Text style={styles.sectionTitle}>{isRTL ? 'اختر نوع الخدمة' : 'Select Service Type'}</Text>
            {SERVICE_TYPES.map((type) => (
              <TouchableOpacity 
                key={type.id} 
                style={[styles.serviceCard, selectedServiceType === type.id && styles.selectedCard]}
                onPress={() => setSelectedServiceType(type.id)}
              >
                <MaterialCommunityIcons name={type.icon as any} size={32} color={selectedServiceType === type.id ? COLORS.primary : COLORS.gray} />
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{isRTL ? type.name : type.nameEn}</Text>
                  <Text style={styles.serviceDesc}>{isRTL ? type.description : type.descriptionEn}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {currentStep === 1 && (
          <ScrollView>
            <Text style={styles.sectionTitle}>{isRTL ? 'اختر نوع الجهاز' : 'Select Device Type'}</Text>
            <View style={styles.deviceGrid}>
              {DEVICE_TYPES.map((device) => (
                <TouchableOpacity 
                  key={device.id} 
                  style={[styles.deviceCard, selectedDeviceType === device.id && styles.selectedCard]}
                  onPress={() => {
                    if (device.available) {
                      setSelectedDeviceType(device.id);
                    } else {
                      Alert.alert(isRTL ? 'قريباً' : 'Coming Soon', isRTL ? 'هذه الخدمة ستتوفر قريباً' : 'This service will be available soon');
                    }
                  }}
                >
                  <MaterialCommunityIcons name={device.icon as any} size={32} color={selectedDeviceType === device.id ? COLORS.primary : COLORS.gray} />
                  <Text style={styles.deviceName}>{isRTL ? device.name : device.nameEn}</Text>
                  {!device.available && <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>{isRTL ? 'قريباً' : 'Soon'}</Text></View>}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {currentStep === 2 && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput 
                placeholder={isRTL ? 'ابحث عن الماركة...' : 'Search brand...'}
                style={styles.searchInput}
                value={brandSearch}
                onChangeText={setBrandSearch}
              />
            </View>
            <ScrollView contentContainerStyle={styles.brandGrid}>
              {filteredBrands.length > 0 ? filteredBrands.map((brand) => (
                <TouchableOpacity 
                  key={brand.id} 
                  style={[styles.brandCard, selectedBrand?.id === brand.id && styles.selectedCard]}
                  onPress={() => setSelectedBrand(brand)}
                >
                  <View style={styles.brandLogoContainer}>
                    <Image source={brand.logo} style={styles.brandLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.brandNameText}>{brand.name}</Text>
                </TouchableOpacity>
              )) : renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        )}
        
        {/* Remaining steps logic... */}
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, isSubmitting && { opacity: 0.7 }]} 
          onPress={() => {
            if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
            else handleSubmit();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === STEPS.length - 1 ? (isRTL ? 'إرسال الطلب' : 'Submit Request') : (isRTL ? 'التالي' : 'Next')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  backButton: { padding: 8 },
  stepperContainer: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepperContent: { paddingHorizontal: 16 },
  stepItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  activeStepCircle: { backgroundColor: COLORS.primary },
  stepNumber: { fontSize: 12, color: COLORS.gray, fontWeight: 'bold' },
  activeStepNumber: { color: '#fff' },
  stepLabel: { fontSize: 12, color: COLORS.gray },
  activeStepLabel: { color: COLORS.primary, fontWeight: 'bold' },
  stepLine: { width: 20, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 8 },
  activeStepLine: { backgroundColor: COLORS.primary },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
  serviceCard: { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  selectedCard: { borderColor: COLORS.primary, backgroundColor: '#ecfdf5' },
  serviceInfo: { flex: 1, marginHorizontal: 12 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  serviceDesc: { fontSize: 12, color: COLORS.gray, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  deviceCard: { width: (width - 44) / 2, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  deviceName: { marginTop: 8, fontSize: 14, fontWeight: '600', color: COLORS.text },
  comingSoonBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  comingSoonText: { fontSize: 10, color: '#9ca3af' },
  searchBar: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  searchInput: { flex: 1, marginHorizontal: 8, textAlign: isRTL ? 'right' : 'left' },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  brandCard: { width: (width - 56) / 3, backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  brandLogoContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandLogo: { width: 40, height: 40 },
  brandNameText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { marginTop: 12, fontSize: 16, color: COLORS.gray },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border },
  nextButton: { backgroundColor: COLORS.primary, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
