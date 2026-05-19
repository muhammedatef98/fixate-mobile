import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions, TextInput, Animated, Alert, KeyboardAvoidingView, Platform, Modal, I18nManager, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useOrders } from '../contexts/OrdersContext';
import { notificationManager } from '../lib/notifications';
import { BRANDS, searchBrands, searchModels, searchIssues, Brand, Issue } from '../constants/repairData';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { RTLIonicon } from '../components/RTLIcon';
import { BrandLogo } from '../components/BrandLogo';
import { uploadOrderMedia } from '../services/storageService';
import { getFriendlyError } from '../utils/errorMessages';
import { tapLight } from '../utils/haptics';
import { formatPrice } from '../utils/pricing';
import { DELIVERY_REGIONS, resolveDeliveryFee, isWithinSupportedArea, type DeliveryRegion } from '../constants/deliveryPricing';
import { pointsForSpend } from '../constants/loyalty';
import * as loyaltyService from '../services/loyaltyService';
import { useLoyalty } from '../contexts/LoyaltyContext';
import { supabase } from '../services/supabaseClient';
import { PressableScale } from '../components/ui/PressableScale';
import {
  SPARE_PART_LABELS,
  SPARE_PART_DESCRIPTIONS,
  SPARE_PART_MULTIPLIERS,
  PAYMENT_METHODS,
  PROTECTION_ADDONS,
  getAccessorySuggestions,
  type SparePartQuality,
  type PaymentMethod,
  type AddonItem,
} from '../types/order';
import {
  validateDiscountCode,
  recordDiscountRedemption,
  type DiscountCode,
} from '../services/discountService';

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
  { id: 'gaming', name: 'أجهزة الألعاب', nameEn: 'Gaming Devices', icon: 'gamepad-variant', available: true },
  { id: 'other', name: 'أجهزة أخرى', nameEn: 'Other Devices', icon: 'devices', available: true },
  { id: 'printer', name: 'طابعة', nameEn: 'Printer', icon: 'printer', available: false },
  { id: 'headphones', name: 'سماعات', nameEn: 'Headphones', icon: 'headphones', available: false },
  { id: 'tv', name: 'شاشة/تلفاز', nameEn: 'TV/Monitor', icon: 'television', available: false },
  { id: 'appliance', name: 'أجهزة منزلية', nameEn: 'Home Appliances', icon: 'home-outline', available: false },
];

export default function RequestScreen() {
  const router = useRouter();
  const { createOrder } = useOrders();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const { refresh: refreshLoyalty } = useLoyalty();
  const isRTL = language === 'ar';

  // First enabled delivery region is auto-selected (Al Qatif during rollout).
  const defaultRegion: DeliveryRegion | null =
    DELIVERY_REGIONS.find((r) => r.enabled) ?? null;
  const [selectedRegionId] = useState<string | null>(defaultRegion?.id ?? null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const selectedRegion = DELIVERY_REGIONS.find((r) => r.id === selectedRegionId) ?? null;
  const deliveryFee = resolveDeliveryFee(selectedRegionId, selectedAreaId);
  const [address, setAddress] = useState('');
  // Only flag (don't block) when the resolved address is clearly outside the
  // currently-supported Al Qatif / nearby service area.
  const outsideServiceArea = !!address && !isWithinSupportedArea(address);
  
  const tc = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const COLORS = {
    primary: tc.primary,
    background: tc.background,
    card: tc.card,
    cardAlt: tc.cardAlt,
    text: tc.text,
    gray: tc.textSecondary,
    border: tc.border,
    lightGreen: tc.primarySoft,
    error: tc.error,
  };

  const styles = createStyles(COLORS, isRTL, SHADOWS);
  const [currentStep, setCurrentStep] = useState(0);
  const stepperScrollRef = useRef<ScrollView>(null);
  
  const [selectedServiceType, setSelectedServiceType] = useState<string>('mobile');
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [sparePartQuality, setSparePartQuality] = useState<SparePartQuality>('original');

  // "Other Devices" free-text entry (used when selectedDeviceType === 'other').
  const [otherDeviceName, setOtherDeviceName] = useState('');
  const [otherDeviceModel, setOtherDeviceModel] = useState('');

  // Payment + optional upsells captured in the Details step.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedAccessories, setSelectedAccessories] = useState<AddonItem[]>([]);
  const [selectedProtection, setSelectedProtection] = useState<AddonItem[]>([]);

  // Card form (UI-only — no real gateway). Used for a masked review summary.
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const cardLast4 = cardNumber.replace(/\D/g, '').slice(-4);
  const maskedCard = cardLast4 ? `•••• •••• •••• ${cardLast4}` : '';

  const isOtherDevice = selectedDeviceType === 'other';

  // Discount code state — applied lazily on the details step.
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: DiscountCode;
    amount: number;
  } | null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [filteredModels, setFilteredModels] = useState<string[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  
  const [location, setLocation] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  const STEPS = isRTL 
    ? ['الخدمة', 'الجهاز', 'الماركة', 'الموديل', 'العطل', 'التفاصيل', 'الموقع']
    : ['Service', 'Device', 'Brand', 'Model', 'Issue', 'Details', 'Location'];

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    if (!user) {
      Alert.alert(
        isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required',
        isRTL ? 'يجب عليك تسجيل الدخول لرفع طلب صيانة' : 'You must login to submit a repair request',
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', onPress: () => router.replace('/(customer)'), style: 'cancel' },
          { text: isRTL ? 'تسجيل الدخول' : 'Login', onPress: () => router.replace('/login-otp') }
        ]
      );
    }
  };

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();

    if (stepperScrollRef.current) {
      const stepWidth = 100;
      const scrollX = currentStep * stepWidth;
      
      stepperScrollRef.current.scrollTo({
        x: scrollX,
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

  // Auto-fetch location when the user lands on the location step (saves a tap)
  useEffect(() => {
    if (currentStep === STEPS.length - 1 && !location && !isLocating) {
      handleLocationRequest();
    }
  }, [currentStep]);

  const handleLocationRequest = async () => {
    setIsLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'يجب السماح بالوصول للموقع' : 'Location permission is required');
        setIsLocating(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      if (loc && loc.coords) {
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }
      
      let reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      
      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        setAddress(`${addr.street || ''} ${addr.district || ''}, ${addr.city || ''}`);
      }
    } catch (error) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل تحديد الموقع' : 'Failed to get location');
    } finally {
      setIsLocating(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'نحتاج إذن الوصول للصور' : 'Permission to access gallery is required');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setMediaFiles([...mediaFiles, ...uris]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'نحتاج إذن الوصول للكاميرا' : 'Permission to access camera is required');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setMediaFiles([...mediaFiles, ...uris]);
    }
  };

  // Simple, mobile-friendly chooser: camera vs gallery.
  const pickImage = () => {
    Alert.alert(
      isRTL ? 'إضافة صورة' : 'Add photo',
      isRTL ? 'اختر طريقة إضافة الصورة' : 'Choose how to add the photo',
      [
        { text: isRTL ? 'التقاط صورة' : 'Take Photo', onPress: takePhoto },
        { text: isRTL ? 'اختيار من المعرض' : 'Choose from Gallery', onPress: pickFromGallery },
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ]
    );
  };

  const toggleAddon = (
    list: AddonItem[],
    setList: (v: AddonItem[]) => void,
    item: AddonItem
  ) => {
    if (list.some((x) => x.id === item.id)) {
      setList(list.filter((x) => x.id !== item.id));
    } else {
      setList([...list, item]);
    }
  };

  const [submitStage, setSubmitStage] = useState<'idle' | 'uploading' | 'creating'>('idle');

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert(isRTL ? 'تنبيه' : 'Login Required', isRTL ? 'يجب تسجيل الدخول أولاً' : 'Please login first');
      router.replace('/login-otp');
      return;
    }
    const deviceBrandValue = isOtherDevice ? otherDeviceName.trim() : selectedBrand?.name;
    const deviceModelValue = isOtherDevice ? otherDeviceModel.trim() : selectedModel;
    if (!deviceBrandValue || !deviceModelValue || !selectedIssue) {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'الرجاء استكمال جميع الخطوات' : 'Please complete all steps');
      return;
    }
    if (!location) {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'الرجاء تحديد الموقع' : 'Please select location');
      return;
    }

    setIsSubmitting(true);
    tapLight();
    try {
      // 1. Upload media first so the URLs end up in the order row
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setSubmitStage('uploading');
        mediaUrls = await uploadOrderMedia(user.id, mediaFiles);
      }

      // 2. Compose description: prefer Arabic name in Arabic UI, fall back to English
      setSubmitStage('creating');
      const issueName = isRTL ? selectedIssue.nameAr : selectedIssue.name;
      const composedDescription = issueDescription
        ? `${issueName}: ${issueDescription}`
        : issueName;

      const baseEstimate = selectedIssue.estimatedPrice ?? 0;
      const adjustedEstimate = Math.round(baseEstimate * SPARE_PART_MULTIPLIERS[sparePartQuality]);
      const finalEstimate = Math.max(0, adjustedEstimate - (appliedDiscount?.amount ?? 0));

      const orderData = {
        device_brand: deviceBrandValue,
        device_model: deviceModelValue,
        issue_description: composedDescription,
        service_type: selectedServiceType as 'mobile' | 'pickup',
        service_id: selectedIssue.id,
        address: address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
        latitude: location.latitude,
        longitude: location.longitude,
        notes: issueDescription || undefined,
        media_urls: mediaUrls,
        estimated_price: finalEstimate,
        customer_phone: (userProfile as any)?.phone,
        spare_part_quality: sparePartQuality,
        discount_code: appliedDiscount?.code.code,
        discount_amount: appliedDiscount?.amount ?? 0,
        payment_method: paymentMethod,
        accessories: selectedAccessories,
        protection_addons: selectedProtection,
      };

      const result = await createOrder(orderData);

      if (!result) throw new Error('Failed to create request');

      const pointsEarned = pointsForSpend((selectedIssue.estimatedPrice || 0) + deliveryFee);

      // Best-effort persistence of delivery + loyalty snapshot. These columns
      // arrive with a pending migration; until then this update silently
      // no-ops so the (already-created) order is never affected.
      supabase
        .from('orders')
        .update({
          delivery_region: selectedRegionId,
          delivery_area: selectedAreaId,
          delivery_fee: deliveryFee,
          loyalty_points_earned: pointsEarned,
        })
        .eq('id', result.id)
        .then(({ error }) => {
          if (error) logger.warn('delivery/loyalty columns not ready (expected during rollout)', error);
        });

      // Best-effort loyalty earn — never blocks success. Placeholder balance
      // already reflects completed-order spend if the ledger isn't ready yet.
      loyaltyService
        .recordEarn(
          user.id,
          (selectedIssue.estimatedPrice || 0) + deliveryFee,
          `${orderData.device_brand} ${orderData.device_model}`
        )
        .then(() => refreshLoyalty())
        .catch((e) => logger.warn('loyalty earn failed', e));

      if (appliedDiscount && user) {
        // Best-effort: record the redemption for admin reporting & per-user
        // limit enforcement on subsequent attempts. Failure here doesn't
        // unwind the order — the customer already got the discounted price.
        recordDiscountRedemption(
          appliedDiscount.code.id,
          user.id,
          result.id,
          appliedDiscount.amount
        ).catch((e) => logger.warn('record redemption failed', e));
      }


      // 3. Best-effort technician notification — never blocks success
      const cityMatch = address?.match(/,\s*([^,]+)$/);
      const targetCity = cityMatch ? cityMatch[1].trim() : 'Riyadh';
      notificationManager
        .notifyTechniciansInCity(targetCity, {
          id: result.id,
          device_brand: orderData.device_brand,
          device_model: orderData.device_model,
        })
        .catch((e) => logger.warn('notify technicians failed', e));

      setIsSubmitting(false);
      setSubmitStage('idle');
      Alert.alert(
        isRTL ? 'تم بنجاح ✓' : 'Success ✓',
        isRTL ? 'تم إرسال طلبك. سيتواصل معك أحد الفنيين قريباً.' : 'Your request was submitted. A technician will contact you soon.',
        [{ text: isRTL ? 'تتبع الطلب' : 'Track Order', onPress: () => router.replace('/(customer)/orders') }]
      );
    } catch (error: any) {
      logger.error('Submit error', error);
      setIsSubmitting(false);
      setSubmitStage('idle');
      // Show the raw error message so we can actually diagnose what failed
      // (timeouts, RLS rejections, validation, etc.) rather than a generic
      // "something went wrong".
      const rawMsg = error?.message || error?.error_description || String(error);
      Alert.alert(
        isRTL ? 'فشل الإرسال' : 'Submission failed',
        `${getFriendlyError(error, language)}\n\n${rawMsg}`
      );
    }
  };

  const renderEmptyState = (text: string) => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="magnify-close" size={48} color={COLORS.gray} />
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );

  const canGoNext = () => {
    if (currentStep === 0) return !!selectedServiceType;
    if (currentStep === 1) return !!selectedDeviceType;
    if (currentStep === 2) return isOtherDevice ? !!otherDeviceName.trim() : !!selectedBrand;
    if (currentStep === 3) return isOtherDevice ? !!otherDeviceModel.trim() : !!selectedModel;
    if (currentStep === 4) return !!selectedIssue;
    if (currentStep === 5) return true; // Details are optional
    if (currentStep === 6) return !!location;
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} onPress={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back()} style={styles.backButton}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
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
              <PressableScale
                key={type.id}
                to={0.985}
                style={[styles.serviceCard, selectedServiceType === type.id && styles.selectedCard]}
                onPress={() => setSelectedServiceType(type.id)}
              >
                <MaterialCommunityIcons name={type.icon as any} size={32} color={selectedServiceType === type.id ? COLORS.primary : COLORS.gray} />
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{isRTL ? type.name : type.nameEn}</Text>
                  <Text style={styles.serviceDesc}>{isRTL ? type.description : type.descriptionEn}</Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        )}

        {currentStep === 1 && (
          <ScrollView>
            <Text style={styles.sectionTitle}>{isRTL ? 'اختر نوع الجهاز' : 'Select Device Type'}</Text>
            <View style={styles.deviceGrid}>
              {DEVICE_TYPES.map((device) => (
                <PressableScale
                  key={device.id}
                  to={0.97}
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
                </PressableScale>
              ))}
            </View>
          </ScrollView>
        )}

        {currentStep === 2 && isOtherDevice && (
          <ScrollView>
            <Text style={styles.sectionTitle}>{isRTL ? 'اسم الجهاز' : 'Device name'}</Text>
            <TextInput
              style={[styles.textArea, { height: 52, padding: 14 }]}
              placeholder={isRTL ? 'مثال: مكنسة روبوت، راوتر، كاميرا...' : 'e.g. Robot vacuum, Router, Camera...'}
              placeholderTextColor={COLORS.gray}
              value={otherDeviceName}
              onChangeText={setOtherDeviceName}
            />
          </ScrollView>
        )}

        {currentStep === 3 && isOtherDevice && (
          <ScrollView>
            <Text style={styles.sectionTitle}>{isRTL ? 'الموديل' : 'Device model'}</Text>
            <TextInput
              style={[styles.textArea, { height: 52, padding: 14 }]}
              placeholder={isRTL ? 'الموديل أو رقم الطراز' : 'Model or part number'}
              placeholderTextColor={COLORS.gray}
              value={otherDeviceModel}
              onChangeText={setOtherDeviceModel}
            />
          </ScrollView>
        )}

        {currentStep === 2 && !isOtherDevice && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput
                placeholder={isRTL ? 'ابحث عن الماركة...' : 'Search brand...'}
                style={styles.searchInput}
                placeholderTextColor={COLORS.gray}
                value={brandSearch}
                onChangeText={setBrandSearch}
              />
            </View>
            <ScrollView contentContainerStyle={styles.brandGrid}>
              {filteredBrands.length > 0 ? filteredBrands.map((brand) => (
                <PressableScale
                  key={brand.id}
                  to={0.97}
                  style={[styles.brandCard, selectedBrand?.id === brand.id && styles.selectedCard]}
                  onPress={() => setSelectedBrand(brand)}
                >
                  {selectedBrand?.id === brand.id && (
                    <View style={styles.brandCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={styles.brandLogoContainer}>
                    <BrandLogo brandId={brand.id} name={brand.name} size={48} />
                  </View>
                  <Text style={styles.brandNameText} numberOfLines={1}>{brand.name}</Text>
                </PressableScale>
              )) : renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        )}

        {currentStep === 3 && !isOtherDevice && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput
                placeholder={isRTL ? 'ابحث عن الموديل...' : 'Search model...'}
                style={styles.searchInput}
                placeholderTextColor={COLORS.gray}
                value={modelSearch}
                onChangeText={setModelSearch}
              />
            </View>
            <ScrollView>
              {filteredModels.length > 0 ? filteredModels.map((model, index) => (
                <PressableScale
                  key={index}
                  to={0.985}
                  style={[styles.listItem, selectedModel === model && styles.selectedListItem]}
                  onPress={() => setSelectedModel(model)}
                >
                  <Text style={[styles.listItemText, selectedModel === model && styles.selectedListItemText]}>{model}</Text>
                  {selectedModel === model && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                </PressableScale>
              )) : renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        )}

        {currentStep === 4 && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput 
                placeholder={isRTL ? 'ابحث عن العطل...' : 'Search issue...'}
                style={styles.searchInput}
                placeholderTextColor={COLORS.gray}
                value={issueSearch}
                onChangeText={setIssueSearch}
              />
            </View>
            <ScrollView>
              {filteredIssues.length > 0 ? filteredIssues.map((issue) => (
                <PressableScale
                  key={issue.id}
                  to={0.985}
                  style={[styles.issueCard, selectedIssue?.id === issue.id && styles.selectedCard]}
                  onPress={() => setSelectedIssue(issue)}
                >
                  <View style={styles.issueInfo}>
                    <Text style={styles.issueName}>{isRTL ? issue.nameAr : issue.name}</Text>
                    <Text style={styles.issuePrice}>
                      {formatPrice(
                        { estimatedPrice: issue.estimatedPrice, range: issue.priceRange },
                        isRTL ? 'ar' : 'en'
                      )}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name={issue.icon as any} size={24} color={selectedIssue?.id === issue.id ? COLORS.primary : COLORS.gray} />
                </PressableScale>
              )) : renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        )}

        {currentStep === 5 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView>
              <Text style={styles.sectionTitle}>{isRTL ? 'تفاصيل إضافية' : 'Additional Details'}</Text>
              <TextInput
                style={[styles.textArea, { minHeight: 150 }]}
                placeholder={isRTL ? 'اشرح العطل بالتفصيل (اختياري)...' : 'Describe the issue in detail (optional)...'}
                placeholderTextColor={COLORS.gray}
                multiline
                numberOfLines={8}
                value={issueDescription}
                onChangeText={setIssueDescription}
                textAlignVertical="top"
              />

              {/* Spare-part quality selector — applies a multiplier to the
                  base estimate so customers can see the price difference. */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {isRTL ? 'جودة قطعة الغيار' : 'Spare-part quality'}
              </Text>
              <View style={{ gap: 8 }}>
                {(['original', 'high_quality', 'economy'] as SparePartQuality[]).map((q) => {
                  const selected = sparePartQuality === q;
                  const multiplier = SPARE_PART_MULTIPLIERS[q];
                  const base = selectedIssue?.estimatedPrice ?? 0;
                  const price = Math.round(base * multiplier);
                  return (
                    <TouchableOpacity
                      key={q}
                      onPress={() => setSparePartQuality(q)}
                      style={{
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.lightGreen : COLORS.card,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: 15 }}>
                          {isRTL ? SPARE_PART_LABELS[q].ar : SPARE_PART_LABELS[q].en}
                        </Text>
                        {base > 0 && (
                          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                            {isRTL ? `تبدأ من ${price} ر.س` : `Starts from ${price} SAR`}
                          </Text>
                        )}
                      </View>
                      <Text style={{ color: COLORS.gray, fontSize: 12, marginTop: 4 }}>
                        {isRTL ? SPARE_PART_DESCRIPTIONS[q].ar : SPARE_PART_DESCRIPTIONS[q].en}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Discount code: customer types & taps Apply; resolved against
                  the active estimated price. */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {isRTL ? 'كود الخصم' : 'Discount code'}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                <TextInput
                  style={[styles.textArea, { flex: 1, height: 48, padding: 12 }]}
                  placeholder={isRTL ? 'ادخل كود الخصم' : 'Enter discount code'}
                  placeholderTextColor={COLORS.gray}
                  value={discountInput}
                  autoCapitalize="characters"
                  editable={!appliedDiscount}
                  onChangeText={(v) => { setDiscountInput(v.toUpperCase()); setDiscountError(null); }}
                />
                <TouchableOpacity
                  disabled={discountChecking || (!discountInput && !appliedDiscount)}
                  onPress={async () => {
                    if (appliedDiscount) {
                      setAppliedDiscount(null);
                      setDiscountInput('');
                      setDiscountError(null);
                      return;
                    }
                    if (!user) return;
                    setDiscountChecking(true);
                    setDiscountError(null);
                    try {
                      const base = selectedIssue?.estimatedPrice ?? 0;
                      const total = Math.round(base * SPARE_PART_MULTIPLIERS[sparePartQuality]);
                      const result = await validateDiscountCode(discountInput, total, user.id, language);
                      if (!result.valid || !result.code) {
                        setDiscountError(result.reason ?? (isRTL ? 'كود غير صالح' : 'Invalid code'));
                      } else {
                        setAppliedDiscount({ code: result.code, amount: result.amount_saved ?? 0 });
                      }
                    } catch (e: any) {
                      setDiscountError(e?.message ?? String(e));
                    } finally {
                      setDiscountChecking(false);
                    }
                  }}
                  style={{
                    backgroundColor: appliedDiscount ? COLORS.error : COLORS.primary,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {discountChecking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {appliedDiscount
                        ? (isRTL ? 'إزالة' : 'Remove')
                        : (isRTL ? 'تطبيق' : 'Apply')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {appliedDiscount && (
                <View style={{ marginTop: 8, padding: 10, backgroundColor: COLORS.lightGreen, borderRadius: 10 }}>
                  <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                    {appliedDiscount.code.code} — {isRTL ? 'وفّرت' : 'You save'} {appliedDiscount.amount} SAR
                  </Text>
                </View>
              )}
              {discountError && (
                <Text style={{ color: COLORS.error, marginTop: 6, fontSize: 13 }}>{discountError}</Text>
              )}

              {/* Payment method — Cash / Card / Online (online is UI-ready
                  only for now; the choice is stored with the request). */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {isRTL ? 'طريقة الدفع' : 'Payment method'}
              </Text>
              <View style={{ gap: 8 }}>
                {PAYMENT_METHODS.map((pm) => {
                  const selected = paymentMethod === pm.id;
                  return (
                    <TouchableOpacity
                      key={pm.id}
                      onPress={() => setPaymentMethod(pm.id)}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 12,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.lightGreen : COLORS.card,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={pm.icon as any}
                        size={24}
                        color={selected ? COLORS.primary : COLORS.gray}
                      />
                      <Text style={{ flex: 1, fontWeight: '700', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }}>
                        {isRTL ? pm.labelAr : pm.labelEn}
                      </Text>
                      {pm.comingSoon && (
                        <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                          <Text style={{ fontSize: 10, color: COLORS.gray, fontWeight: '700' }}>
                            {isRTL ? 'قريبًا' : 'Coming Soon'}
                          </Text>
                        </View>
                      )}
                      {selected && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Card / Visa form — UI only, no real gateway. Captured just
                  for a masked review summary before submission. */}
              {paymentMethod === 'card' && (
                <View style={{ marginTop: 12, gap: 10, padding: 14, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border }}>
                  <TextInput
                    style={[styles.textArea, { height: 48, padding: 12 }]}
                    placeholder={isRTL ? 'اسم حامل البطاقة' : 'Cardholder name'}
                    placeholderTextColor={COLORS.gray}
                    value={cardName}
                    onChangeText={setCardName}
                  />
                  <TextInput
                    style={[styles.textArea, { height: 48, padding: 12 }]}
                    placeholder={isRTL ? 'رقم البطاقة' : 'Card number'}
                    placeholderTextColor={COLORS.gray}
                    keyboardType="number-pad"
                    maxLength={19}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                  />
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
                    <TextInput
                      style={[styles.textArea, { flex: 1, height: 48, padding: 12 }]}
                      placeholder={isRTL ? 'تاريخ الانتهاء (MM/YY)' : 'Expiry (MM/YY)'}
                      placeholderTextColor={COLORS.gray}
                      maxLength={5}
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                    />
                    <TextInput
                      style={[styles.textArea, { flex: 1, height: 48, padding: 12 }]}
                      placeholder={isRTL ? 'CVV' : 'CVV'}
                      placeholderTextColor={COLORS.gray}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                      value={cardCvv}
                      onChangeText={setCardCvv}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: COLORS.gray, textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL
                      ? 'لن يتم الخصم الآن — تفاصيل البطاقة للعرض فقط حتى تفعيل بوابة الدفع.'
                      : 'No charge now — card details are display-only until the payment gateway is enabled.'}
                  </Text>
                </View>
              )}

              {/* Accessory suggestions — context-aware by device type. */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {isRTL ? 'إكسسوارات مقترحة (اختياري)' : 'Suggested accessories (optional)'}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                {getAccessorySuggestions(selectedDeviceType).map((acc) => {
                  const selected = selectedAccessories.some((x) => x.id === acc.id);
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => toggleAddon(selectedAccessories, setSelectedAccessories, acc)}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.lightGreen : COLORS.card,
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                      }}
                    >
                      {selected && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
                      <Text style={{ color: selected ? COLORS.primary : COLORS.text, fontWeight: '600', fontSize: 13 }}>
                        {isRTL ? acc.name_ar : acc.name_en} · {isRTL ? `تبدأ من ${acc.price} ر.س` : `Starts from ${acc.price} SAR`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Protection add-ons / packages — optional upsell. */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {isRTL ? 'حماية إضافية (اختياري)' : 'Protection add-ons (optional)'}
              </Text>
              <View style={{ gap: 8 }}>
                {PROTECTION_ADDONS.map((p) => {
                  const selected = selectedProtection.some((x) => x.id === p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => toggleAddon(selectedProtection, setSelectedProtection, p)}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.lightGreen : COLORS.card,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={22}
                          color={selected ? COLORS.primary : COLORS.gray}
                        />
                        <Text style={{ color: COLORS.text, fontWeight: '700', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                          {isRTL ? p.name_ar : p.name_en}
                        </Text>
                      </View>
                      <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                        {isRTL ? `تبدأ من ${p.price} ر.س` : `Starts from ${p.price} SAR`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{isRTL ? 'صور أو فيديو' : 'Photos or Video'}</Text>
              <View style={styles.mediaContainer}>
                <TouchableOpacity style={styles.addMediaButton} onPress={pickImage}>
                  <Ionicons name="camera" size={32} color={COLORS.gray} />
                  <Text style={styles.addMediaText}>{isRTL ? 'إضافة' : 'Add'}</Text>
                </TouchableOpacity>
                {mediaFiles.map((uri, index) => (
                  <View key={index} style={styles.mediaWrapper}>
                    <Image source={{ uri }} style={styles.mediaThumb} />
                    <TouchableOpacity 
                      style={styles.removeMediaBtn} 
                      onPress={() => setMediaFiles(mediaFiles.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {currentStep === 6 && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>{isRTL ? 'حدد موقعك' : 'Set Your Location'}</Text>
            <View style={[styles.mapContainer, { height: 280 }]}>
              {location && location.latitude && location.longitude ? (
                <MapView
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  style={[styles.map, { opacity: mapReady ? 1 : 0 }]}
                  initialRegion={location}
                  onRegionChangeComplete={async (region) => {
                    if (region && region.latitude) {
                      setLocation(region);
                      try {
                        const places = await Location.reverseGeocodeAsync({
                          latitude: region.latitude,
                          longitude: region.longitude,
                        });
                        const p = places?.[0];
                        if (p) {
                          const street = (p.street ?? '').trim();
                          const district = (p.district ?? '').trim();
                          const city = (p.city ?? '').trim();
                          const composed = [street, district, city].filter(Boolean).join(', ');
                          if (composed) setAddress(composed);
                        }
                      } catch {
                        // reverse geocode is best-effort
                      }
                    }
                  }}
                  onMapReady={() => setMapReady(true)}
                />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <MaterialCommunityIcons name="map-marker-radius" size={64} color={COLORS.gray} />
                  <Text style={styles.mapPlaceholderText}>{isRTL ? 'الخريطة ستظهر هنا' : 'Map will appear here'}</Text>
                </View>
              )}

              {/* Centered pin + drag hint — outside the ternary so they
                  overlay the map without breaking JSX structure. */}
              {mapReady && location && (
                <>
                  <View pointerEvents="none" style={styles.centerPinWrap}>
                    <MaterialCommunityIcons name="map-marker" size={44} color={COLORS.primary} />
                    <View style={styles.centerPinShadow} />
                  </View>
                  <View pointerEvents="none" style={styles.dragHint}>
                    <Ionicons name="hand-left-outline" size={14} color="#fff" />
                    <Text style={styles.dragHintText}>
                      {isRTL ? 'اسحب الخريطة لتغيير الموقع' : 'Drag the map to set location'}
                    </Text>
                  </View>
                </>
              )}

              {!mapReady && location && (
                <View style={[styles.mapPlaceholder, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              )}

              <TouchableOpacity 
                style={styles.locationButton} 
                onPress={handleLocationRequest}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="locate" size={24} color="#fff" />
                    <Text style={styles.locationButtonText}>{isRTL ? 'تحديد موقعي الحالي' : 'Use My Current Location'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {address ? (
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={styles.addressText}>{address}</Text>
              </View>
            ) : null}

            {/* Service-area notice — flagged, not blocked. */}
            {outsideServiceArea && (
              <View style={styles.serviceAreaNotice}>
                <MaterialCommunityIcons name="map-marker-alert-outline" size={22} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceAreaTitle}>
                    {isRTL
                      ? 'الخدمة حالياً في القطيف والمناطق القريبة فقط'
                      : 'Service is currently in Al Qatif & nearby areas only'}
                  </Text>
                  <Text style={styles.serviceAreaBody}>
                    {isRTL
                      ? 'يبدو أن موقعك خارج نطاق الخدمة الحالي. قريباً سنتوسّع لتغطية كامل المنطقة الشرقية ثم جميع مناطق المملكة. يمكنك متابعة الطلب وسنتواصل معك إن لزم.'
                      : 'Your location seems outside the current service area. Soon we will expand across the entire Eastern Province, then all of Saudi Arabia. You can still continue and we will reach out if needed.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Delivery area — pricing by region (config-driven, scalable) */}
            {selectedRegion && (
              <View style={styles.deliveryCard}>
                <View style={styles.deliveryHeader}>
                  <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.deliveryTitle}>
                    {isRTL ? 'منطقة التوصيل' : 'Delivery area'}
                  </Text>
                </View>
                <Text style={styles.deliveryRegionName}>
                  {isRTL ? selectedRegion.nameAr : selectedRegion.nameEn}
                </Text>
                <View style={styles.areaChips}>
                  {selectedRegion.areas.map((area) => {
                    const active = selectedAreaId === area.id;
                    return (
                      <TouchableOpacity
                        key={area.id}
                        style={[styles.areaChip, active && styles.areaChipActive]}
                        onPress={() => setSelectedAreaId(active ? null : area.id)}
                      >
                        <Text style={[styles.areaChipText, active && styles.areaChipTextActive]}>
                          {isRTL ? area.nameAr : area.nameEn} · {area.fee} {isRTL ? 'ر.س' : 'SAR'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.deliveryFeeRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'رسوم التوصيل' : 'Delivery fee'}</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.primary, fontWeight: '700' }]}>
                    {deliveryFee} {isRTL ? 'ر.س' : 'SAR'}
                  </Text>
                </View>
              </View>
            )}

            {/* Pre-submit review summary so user can double-check before sending */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{isRTL ? 'مراجعة الطلب' : 'Review Request'}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'الجهاز' : 'Device'}</Text>
                <Text style={styles.summaryValue}>
                  {isOtherDevice
                    ? `${otherDeviceName} ${otherDeviceModel}`
                    : `${selectedBrand?.name ?? ''} ${selectedModel ?? ''}`}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'طريقة الدفع' : 'Payment'}</Text>
                <Text style={styles.summaryValue}>
                  {(() => {
                    const pm = PAYMENT_METHODS.find((p) => p.id === paymentMethod);
                    return pm ? (isRTL ? pm.labelAr : pm.labelEn) : '';
                  })()}
                </Text>
              </View>
              {paymentMethod === 'card' && maskedCard ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'البطاقة' : 'Card'}</Text>
                  <Text style={styles.summaryValue}>
                    {maskedCard}{cardName ? ` · ${cardName}` : ''}
                  </Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'قطعة الغيار' : 'Spare part'}</Text>
                <Text style={styles.summaryValue}>
                  {isRTL ? SPARE_PART_LABELS[sparePartQuality].ar : SPARE_PART_LABELS[sparePartQuality].en}
                </Text>
              </View>
              {selectedAccessories.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'إكسسوارات' : 'Accessories'}</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {selectedAccessories.map((a) => (isRTL ? a.name_ar : a.name_en)).join('، ')}
                  </Text>
                </View>
              )}
              {selectedProtection.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'حماية' : 'Protection'}</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {selectedProtection.map((a) => (isRTL ? a.name_ar : a.name_en)).join('، ')}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'العطل' : 'Issue'}</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {isRTL ? selectedIssue?.nameAr : selectedIssue?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'الخدمة' : 'Service'}</Text>
                <Text style={styles.summaryValue}>
                  {SERVICE_TYPES.find(s => s.id === selectedServiceType) ? (isRTL ? SERVICE_TYPES.find(s => s.id === selectedServiceType)!.name : SERVICE_TYPES.find(s => s.id === selectedServiceType)!.nameEn) : ''}
                </Text>
              </View>
              {selectedIssue && selectedIssue.estimatedPrice > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'السعر التقديري' : 'Estimated price'}</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.primary, fontWeight: '700' }]}>
                    {formatPrice(
                      { estimatedPrice: selectedIssue.estimatedPrice, range: selectedIssue.priceRange },
                      isRTL ? 'ar' : 'en'
                    )}
                  </Text>
                </View>
              )}
              {mediaFiles.length > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{isRTL ? 'الصور' : 'Photos'}</Text>
                    <Text style={styles.summaryValue}>{mediaFiles.length}</Text>
                  </View>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {mediaFiles.slice(0, 6).map((uri, i) => (
                      <Image key={i} source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                    ))}
                  </View>
                </>
              )}
              {deliveryFee > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'رسوم التوصيل' : 'Delivery fee'}</Text>
                  <Text style={styles.summaryValue}>{deliveryFee} {isRTL ? 'ر.س' : 'SAR'}</Text>
                </View>
              )}
              {selectedIssue && selectedIssue.estimatedPrice > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'نقاط الولاء المتوقعة' : 'Loyalty points earned'}</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.primary, fontWeight: '700' }]}>
                    +{pointsForSpend((selectedIssue.estimatedPrice || 0) + deliveryFee)}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!canGoNext() || isSubmitting) && { opacity: 0.5 }]}
          onPress={() => {
            tapLight();
            if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
            else handleSubmit();
          }}
          disabled={!canGoNext() || isSubmitting}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.nextButtonText}>
                {submitStage === 'uploading'
                  ? (isRTL ? 'جاري رفع الصور...' : 'Uploading photos...')
                  : (isRTL ? 'جاري الإرسال...' : 'Submitting...')}
              </Text>
            </View>
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

const createStyles = (COLORS: any, isRTL: boolean, SHADOWS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.card },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  backButton: { padding: 8 },
  stepperContainer: { backgroundColor: COLORS.card, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepperContent: { paddingHorizontal: 16 },
  stepItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginHorizontal: 8 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  activeStepCircle: { backgroundColor: COLORS.primary },
  stepNumber: { fontSize: 12, color: COLORS.gray, fontWeight: 'bold' },
  activeStepNumber: { color: '#fff' },
  stepLabel: { fontSize: 12, color: COLORS.gray, marginHorizontal: 4 },
  activeStepLabel: { color: COLORS.primary, fontWeight: 'bold' },
  stepLine: { width: 20, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4 },
  activeStepLine: { backgroundColor: COLORS.primary },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
  serviceCard: { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', ...SHADOWS.small },
  selectedCard: { borderColor: COLORS.primary, backgroundColor: COLORS.lightGreen },
  serviceInfo: { flex: 1, marginHorizontal: 12 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  serviceDesc: { fontSize: 12, color: COLORS.gray, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  deviceGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 },
  deviceCard: { width: (width - 44) / 2, backgroundColor: COLORS.card, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
  deviceName: { marginTop: 8, fontSize: 14, fontWeight: '600', color: COLORS.text },
  comingSoonBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: COLORS.cardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  comingSoonText: { fontSize: 10, color: COLORS.gray },
  searchBar: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  searchInput: { flex: 1, marginHorizontal: 8, textAlign: isRTL ? 'right' : 'left' },
  brandGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
  brandCard: { width: (width - 56) / 3, backgroundColor: COLORS.card, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
  brandCheck: { position: 'absolute', top: 6, ...(isRTL ? { left: 6 } : { right: 6 }) },
  brandLogoContainer: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  brandLogo: { width: 40, height: 40 },
  brandNameText: { fontSize: 12, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  listItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
  selectedListItem: { borderColor: COLORS.primary, backgroundColor: COLORS.lightGreen },
  listItemText: { fontSize: 16, color: COLORS.text },
  selectedListItemText: { fontWeight: 'bold', color: COLORS.primary },
  issueCard: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
  issueInfo: { flex: 1 },
  issueName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  issuePrice: { fontSize: 14, color: COLORS.primary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  textArea: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, fontSize: 16, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  mediaContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  addMediaButton: { width: 80, height: 80, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  addMediaText: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  mediaWrapper: { position: 'relative' },
  mediaThumb: { width: 80, height: 80, borderRadius: 12 },
  removeMediaBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: COLORS.card, borderRadius: 10 },
  mapContainer: { flex: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' },
  mapPlaceholderText: { marginTop: 12, fontSize: 16, color: COLORS.gray },
  locationButton: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: COLORS.primary, height: 48, borderRadius: 24, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44, // pin tip lands on the actual centre
    alignItems: 'center',
  },
  centerPinShadow: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: -2,
  },
  dragHint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  dragHintText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  locationButtonText: { color: '#fff', fontWeight: 'bold' },
  addressContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', padding: 12, backgroundColor: COLORS.lightGreen, borderRadius: 12, gap: 8 },
  addressText: { flex: 1, fontSize: 14, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  serviceAreaNotice: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginTop: 12,
    backgroundColor: '#F59E0B15',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
  },
  serviceAreaTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  serviceAreaBody: { fontSize: 12, color: COLORS.gray, marginTop: 4, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { marginTop: 12, fontSize: 16, color: COLORS.gray },
  deliveryCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 12, ...SHADOWS.small },
  deliveryHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
  deliveryTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  deliveryRegionName: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginTop: 8, textAlign: isRTL ? 'right' : 'left' },
  areaChips: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  areaChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardAlt },
  areaChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.lightGreen },
  areaChipText: { fontSize: 12, color: COLORS.gray },
  areaChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  deliveryFeeRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 12, ...SHADOWS.small },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' },
  summaryRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  summaryLabel: { fontSize: 14, color: COLORS.gray },
  summaryValue: { fontSize: 14, color: COLORS.text, fontWeight: '600', flex: 1, textAlign: isRTL ? 'left' : 'right' },
  footer: { padding: 16, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextButton: { backgroundColor: COLORS.primary, height: 54, borderRadius: BORDER_RADIUS.sm, justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
