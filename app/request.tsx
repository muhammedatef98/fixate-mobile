import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, TextInput, Animated, Alert, Keyboard, KeyboardAvoidingView, Platform, Modal, I18nManager, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import OsmMap, { type OsmMapHandle } from '../components/OsmMap';
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
import { searchPlaces, isGooglePlacesEnabled, type PlaceResult } from '../services/placesService';
import { getFriendlyError } from '../utils/errorMessages';
import { tapLight } from '../utils/haptics';
import { formatPrice } from '../utils/pricing';
import {
  getRegionTree,
  resolveDeliveryFee,
  type RegionWithCities,
} from '../services/serviceAreasService';
import {
  computeDeliveryFee,
  getCityCentroid,
  haversineKm,
  type ComputedDeliveryFee,
} from '../utils/deliveryPricing';
import { pointsForSpend } from '../constants/loyalty';
import * as loyaltyService from '../services/loyaltyService';
import { useLoyalty } from '../contexts/LoyaltyContext';
import { supabase } from '../services/supabaseClient';
import { PressableScale, AnimatedTouchable } from '../components/ui/PressableScale';
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
import { getPlatformSettings, type PlatformSettings } from '../services/platformSettingsService';
import ServiceCenterCard from '../components/ServiceCenterCard';
import {
  getRequestStepMethods,
  type PaymentMethod as AdminPaymentMethod,
} from '../services/paymentMethodsService';

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
  {
    id: 'personal_handoff',
    name: 'تسليم واستلام شخصي',
    nameEn: 'Personal hand-off',
    description: 'تسلّم الجهاز شخصياً للفني في نقطة لقاء، وتستلمه شخصياً بعد الإصلاح — بدون رسوم توصيل',
    descriptionEn: 'You hand the device to the technician in person at a meet-up point and pick it up after the repair — no delivery fee',
    icon: 'account-switch-outline'
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

  // Repair service areas — Saudi-wide, admin-controlled (service_area_*
  // tables). Only enabled regions and cities are offered to the customer.
  const [regionTree, setRegionTree] = useState<RegionWithCities[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  useEffect(() => {
    // Only currently-available regions/cities are offered. Coverage is
    // admin-controlled — disabled areas simply do not appear.
    getRegionTree(true)
      .then((tree) => setRegionTree(tree))
      .catch(() => undefined);
  }, []);
  const [address, setAddress] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  
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
  // Personal hand-off has no delivery leg, so the delivery fee is dropped
  // to zero. Other service types still resolve from the region/area config.
  const selectedCity =
    regionTree.flatMap((r) => r.cities).find((c) => c.id === selectedCityId) ?? null;
  const selectedCityRegion =
    regionTree.find((r) => r.cities.some((c) => c.id === selectedCityId)) ?? null;
  // A city is bookable only when both its region and the city itself are on.
  const selectedCityAvailable =
    !!selectedCity &&
    !!selectedCityRegion &&
    selectedCityRegion.enabled !== false &&
    selectedCity.enabled !== false;

  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  // Seed from the calculator's quality selection when arriving via
  // "Book Now"; an absent/invalid param falls back to the old default.
  const { quality: qualityParam } = useLocalSearchParams<{ quality?: string }>();
  const [sparePartQuality, setSparePartQuality] = useState<SparePartQuality>(
    (['original', 'high_quality', 'economy'] as const).includes(qualityParam as SparePartQuality)
      ? (qualityParam as SparePartQuality)
      : 'original'
  );

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
  
  // Platform settings drive commitment fee + loyalty earn rate. We start
  // with optimistic defaults so the UI renders something sane on first
  // paint, then refresh from the DB when available.
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    getPlatformSettings().then(setPlatformSettings).catch(() => {});
  }, []);

  // Admin-managed methods shown in the illustrative payment step. The real
  // payment happens later, on the payment page after quote approval.
  const [requestPayMethods, setRequestPayMethods] = useState<AdminPaymentMethod[]>([]);
  // Informational preference only — the real payment happens after quote
  // acceptance. Selecting here just records the customer's awareness/choice.
  const [prefMethod, setPrefMethod] = useState<string | null>(null);
  useEffect(() => {
    getRequestStepMethods()
      .then((list) => {
        setRequestPayMethods(list);
        const first = list.find((m) => !m.is_coming_soon);
        if (first) setPrefMethod(first.code);
      })
      .catch(() => undefined);
  }, []);

  // Admin-controlled fees. The real repair price is never known up front —
  // it is set by the technician's quote after inspection.
  const inspectionFeeDue = (platformSettings?.inspectionEnabled ?? false)
    ? Math.max(0, platformSettings?.inspectionFee ?? 0)
    : 0;
  const commitmentDue = (platformSettings?.commitmentEnabled ?? false)
    ? Math.max(0, platformSettings?.commitmentFee ?? 0)
    : 0;

  const [location, setLocation] = useState<any>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Place search on the map step. Backed by placesService — Google Places
  // (Arabic & English, Saudi-biased) when a key is configured, otherwise the
  // same expo-location geocoder as before. Selecting a result only moves the
  // map; the existing onRegionChangeComplete drag handler still owns
  // address/city detection, so the submit payload flow stays untouched.
  const mapRef = useRef<OsmMapHandle>(null);

  // Set the dropped-pin location + reverse-geocode the address. Shared by the
  // map's drag handler, the place-search result, and the GPS button so all
  // three keep the address/city auto-detection identical.
  const applyPickedLocation = async (latitude: number, longitude: number) => {
    setLocation({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = places?.[0];
      if (p) {
        const composed = [(p.street ?? '').trim(), (p.district ?? '').trim(), (p.city ?? '').trim()]
          .filter(Boolean)
          .join(', ');
        if (composed) setAddress(composed);
        setSelectedNeighborhood((p.district ?? '').trim());
      }
    } catch {
      // reverse geocode is best-effort
    }
  };
  const [placeQuery, setPlaceQuery] = useState('');
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  // Suppresses the search-as-you-type effect when we set the query
  // programmatically after the customer picks a result.
  const suppressAutoSearchRef = useRef(false);

  const runPlaceSearch = async (showEmptyError: boolean) => {
    const query = placeQuery.trim();
    if (!query || isSearchingPlace) return;
    setIsSearchingPlace(true);
    setPlaceSearchError(null);
    try {
      const results = await searchPlaces(query, isRTL ? 'ar' : 'en');
      if (results.length === 1 && showEmptyError) {
        // Explicit submit with a single match — go straight there.
        selectPlace(results[0]);
        return;
      }
      setPlaceResults(results);
      if (!results.length && showEmptyError) {
        setPlaceSearchError(isRTL ? 'لم يتم العثور على نتائج لهذا البحث' : 'No results found for this search');
      }
    } catch {
      if (showEmptyError) {
        setPlaceSearchError(isRTL ? 'فشل البحث، حاول مرة أخرى' : 'Search failed, please try again');
      }
    } finally {
      setIsSearchingPlace(false);
    }
  };

  const handlePlaceSearch = () => runPlaceSearch(true);

  // Search-as-you-type, only when Google Places is configured (the native
  // geocoder fallback is rate-limited, so it stays submit-driven).
  useEffect(() => {
    if (!isGooglePlacesEnabled()) return;
    if (suppressAutoSearchRef.current) {
      suppressAutoSearchRef.current = false;
      return;
    }
    const query = placeQuery.trim();
    if (query.length < 3) {
      setPlaceResults([]);
      return;
    }
    const timer = setTimeout(() => runPlaceSearch(false), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery]);

  const selectPlace = (place: PlaceResult) => {
    Keyboard.dismiss();
    suppressAutoSearchRef.current = true;
    setPlaceQuery(place.name);
    setPlaceResults([]);
    setPlaceSearchError(null);
    // Recenter the map if it's already mounted; applyPickedLocation seeds the
    // location (mounting the map) and refreshes the address either way.
    if (location) {
      mapRef.current?.recenter(place.latitude, place.longitude, 15);
    }
    applyPickedLocation(place.latitude, place.longitude);
  };

  // Auto-detect serviceable city from the dropped pin. We compute the
  // closest enabled-city centroid (using the same lookup the delivery
  // fee uses) and select it when the pin sits within a generous radius
  // (50 km — covers a city's outskirts but rejects a pin in the next
  // governorate). When no city matches we clear the selection so the
  // Submit button stays disabled and the customer sees the OOS message.
  const SERVICE_RADIUS_KM = 50;
  const autoDetectedCityId = useMemo(() => {
    if (!location?.latitude || !location?.longitude) return null;
    const enabledCities = regionTree
      .filter((r) => r.enabled !== false)
      .flatMap((r) => r.cities.filter((c) => c.enabled !== false));
    if (enabledCities.length === 0) return null;
    let bestId: string | null = null;
    let bestKm = Infinity;
    for (const c of enabledCities) {
      const centroid = getCityCentroid(c.name_en, c.name_ar);
      if (!centroid) continue;
      const km = haversineKm(centroid, {
        lat: location.latitude,
        lng: location.longitude,
      });
      if (km < bestKm) {
        bestKm = km;
        bestId = c.id;
      }
    }
    return bestKm <= SERVICE_RADIUS_KM ? bestId : null;
  }, [location?.latitude, location?.longitude, regionTree]);
  useEffect(() => {
    // Sync the detected city into selection. When the pin moves outside
    // any enabled city, clear the selection so Submit becomes disabled.
    if (autoDetectedCityId !== selectedCityId) {
      setSelectedCityId(autoDetectedCityId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetectedCityId]);
  const pinOutsideCoverage =
    !!location?.latitude &&
    !!location?.longitude &&
    !autoDetectedCityId;

  // Filter the SERVICE_TYPES menu against the admin toggles so disabled
  // booking modes never appear in the customer's first step. Resolved
  // each render so a settings refresh propagates without a remount.
  const enabledServiceTypes = useMemo(() => {
    return SERVICE_TYPES.filter((t) => {
      if (!platformSettings) return true; // optimistic until settings load
      if (t.id === 'mobile') return platformSettings.serviceMobileEnabled;
      if (t.id === 'pickup') return platformSettings.servicePickupEnabled;
      if (t.id === 'personal_handoff') return platformSettings.serviceHandoffEnabled;
      return true;
    });
  }, [platformSettings]);
  // If the currently-selected type just got disabled by admin, snap to
  // the first remaining one so the customer isn't stuck on an invalid
  // step (or on a transparently-disappeared option).
  useEffect(() => {
    if (
      enabledServiceTypes.length > 0 &&
      !enabledServiceTypes.some((t) => t.id === selectedServiceType)
    ) {
      setSelectedServiceType(enabledServiceTypes[0].id);
    }
  }, [enabledServiceTypes, selectedServiceType]);

  // Admin-controlled free-delivery overrides. The master switch flips
  // delivery to free for every customer; the promo code (case-insensitive)
  // flips it for the single customer who typed the code into the
  // discount field.
  const adminFreeDelivery = !!platformSettings?.freeDeliveryEnabled;
  const freeDeliveryPromo = (platformSettings?.freeDeliveryPromoCode ?? '').trim();
  const promoFreeDelivery =
    !!freeDeliveryPromo &&
    discountInput.trim().toUpperCase() === freeDeliveryPromo.toUpperCase();

  // Distance-based delivery fee with a hard 40-SAR cap. We pass the
  // service-area city (centroid lookup) AND the customer's GPS pin —
  // the helper picks tier-by-distance when both are present, falls back
  // to the admin-managed flat fee, or zero on personal hand-off / free
  // delivery overrides.
  const deliveryQuote: ComputedDeliveryFee = computeDeliveryFee({
    customer: location && location.latitude && location.longitude
      ? { lat: location.latitude, lng: location.longitude }
      : null,
    cityNameEn: selectedCity?.name_en ?? null,
    cityNameAr: selectedCity?.name_ar ?? null,
    flatFee: selectedCity?.delivery_fee ?? null,
    freeOverride:
      selectedServiceType === 'personal_handoff' ||
      adminFreeDelivery ||
      promoFreeDelivery,
  });
  const baseDeliveryFee = deliveryQuote.fee;
  // Region → City → Neighborhood resolution. The nested tree already
  // carries every neighborhood for the selected city, so the lookup is
  // synchronous: neighborhood fee (when matched + enabled) overrides the
  // city default; otherwise the city's `delivery_fee` is used.
  const zoneDeliveryFee = resolveDeliveryFee(selectedCity, selectedNeighborhood);
  const deliveryFee = zoneDeliveryFee > 0 ? zoneDeliveryFee : baseDeliveryFee;
  const isFreeDelivery = deliveryQuote.source === 'free' || deliveryFee === 0;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  const STEPS = isRTL
    ? ['الخدمة', 'الجهاز', 'الماركة', 'الموديل', 'العطل', 'التفاصيل', 'الموقع', 'الدفع']
    : ['Service', 'Device', 'Brand', 'Model', 'Issue', 'Details', 'Location', 'Payment'];

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

  // Auto-fetch location when the user lands on the location step (saves a
  // tap). Skipped for drop-off / handoff — no customer location is needed.
  useEffect(() => {
    if (
      currentStep === STEPS.length - 1 &&
      selectedServiceType !== 'personal_handoff' &&
      !location &&
      !isLocating
    ) {
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

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (loc && loc.coords) {
        const { latitude, longitude } = loc.coords;
        logger.info('Request screen: GPS reading', { latitude, longitude });
        setLocation({
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        // Recenter the map onto the fresh GPS fix if it's already mounted.
        mapRef.current?.recenter(latitude, longitude, 16);

        // Reverse geocode is a hint for the address field; allowed to fail
        // silently. Country-mismatch is logged but never blocks the flow —
        // the customer's explicit city selection is the source of truth.
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (reverseGeocode.length > 0) {
            const addr = reverseGeocode[0];
            const composed = [addr.street, addr.district, addr.city].filter(Boolean).join(', ');
            if (composed) setAddress(composed);
            setSelectedNeighborhood((addr.district ?? '').trim());
            const country = ((addr as any).isoCountryCode || addr.country || '').toString().toUpperCase();
            if (country && country !== 'SA' && country !== 'SAUDI ARABIA') {
              logger.warn('Reverse geocode country is not SA (allowed)', { country, latitude, longitude });
            }
          }
        } catch (geoErr) {
          logger.warn('Reverse geocode failed (non-blocking)', geoErr);
        }
      }
    } catch (error) {
      logger.error('Failed to get device location', error);
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
    // Drop-off / handoff: the customer brings the device to our service
    // center, so no customer location is collected or required.
    const isHandoff = selectedServiceType === 'personal_handoff';
    if (!isHandoff && !location) {
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
        service_type: selectedServiceType as 'mobile' | 'pickup' | 'personal_handoff',
        // Stored separately so the DB can evolve without us re-shuffling
        // service_type semantics. See migration `2026_05_20_phase2_*`.
        fulfillment_type: selectedServiceType as 'mobile' | 'pickup' | 'personal_handoff',
        service_id: selectedIssue.id,
        address: isHandoff
          ? (isRTL ? 'تسليم باليد في مركز الخدمة' : 'Drop-off at the service center')
          : (address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`),
        latitude: isHandoff ? null : location.latitude,
        longitude: isHandoff ? null : location.longitude,
        notes: issueDescription || undefined,
        media_urls: mediaUrls,
        estimated_price: finalEstimate,
        customer_phone: (userProfile as any)?.phone,
        spare_part_quality: sparePartQuality,
        discount_code: appliedDiscount?.code.code,
        discount_amount: appliedDiscount?.amount ?? 0,
        accessories: selectedAccessories,
        protection_addons: selectedProtection,
      };

      const result = await createOrder(orderData);

      if (!result) throw new Error('Failed to create request');

      const pointsEarned = pointsForSpend((selectedIssue.estimatedPrice || 0) + deliveryFee);

      // Best-effort persistence of delivery + loyalty snapshot. These columns
      // arrive with a pending migration; until then this update silently
      // no-ops so the (already-created) order is never affected.
      const commitmentFeeOnOrder = commitmentDue;
      supabase
        .from('orders')
        .update({
          delivery_region: selectedCityRegion?.code ?? null,
          delivery_area: selectedCity?.name_en ?? null,
          delivery_fee: deliveryFee,
          loyalty_points_earned: pointsEarned,
          commitment_fee: commitmentFeeOnOrder,
          commitment_paid_at: commitmentFeeOnOrder > 0 ? new Date().toISOString() : null,
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
    if (currentStep === 6) {
      // Drop-off / handoff needs no location or delivery city.
      if (selectedServiceType === 'personal_handoff') return true;
      return !!location && selectedCityAvailable;
    }
    if (currentStep === 7) return true; // payment step is illustrative only
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedTouchable accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'} onPress={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back()} style={styles.backButton}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </AnimatedTouchable>
        <Text style={styles.headerTitle}>{isRTL ? 'طلب صيانة' : 'Repair Request'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar — segments fill in the reading direction (RTL ⇒ from
          the right) and always reflect the real current step. */}
      <View style={styles.stepperContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressStepName} numberOfLines={1}>
            {STEPS[currentStep] ?? ''}
          </Text>
          <Text style={styles.progressCount}>
            {currentStep + 1} / {STEPS.length}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                index <= currentStep && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {currentStep === 0 && (
          <ScrollView>
            <Text style={styles.sectionTitle}>{isRTL ? 'اختر نوع الخدمة' : 'Select Service Type'}</Text>
            {enabledServiceTypes.length === 0 && (
              <View style={[styles.payNotice, { marginTop: 8 }]}>
                <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} />
                <Text style={styles.payNoticeText}>
                  {isRTL
                    ? 'لا توجد خدمات متاحة حالياً. الرجاء المحاولة لاحقاً.'
                    : 'No services are currently available. Please try again later.'}
                </Text>
              </View>
            )}
            {enabledServiceTypes.map((type) => (
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
            {/* BUG-05 — proper 2-column responsive grid. The previous
                ScrollView + flex-wrap squeezed 3 cards per row, which on
                Android rounded down to two tall stacked columns. A FlatList
                with numColumns gives a deterministic grid on both platforms. */}
            <FlatList
              data={filteredBrands}
              keyExtractor={(brand) => brand.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}
              // The card width is (width - 44) / 2, which already budgets for
              // the 16px margins supplied by the parent `content` padding plus
              // the 12px gap — exactly like the device-type grid. Adding a
              // second horizontal padding here over-widened the row and clipped
              // the leftmost card, so only vertical padding lives on the list.
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
              renderItem={({ item: brand }) => (
                <PressableScale
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
                    <BrandLogo brandId={brand.id} name={brand.name} size={34} />
                  </View>
                  <Text style={styles.brandNameText} numberOfLines={1}>{brand.name}</Text>
                </PressableScale>
              )}
            />
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
                    {/* Per-issue prices intentionally hidden — final cost is shown only in the invoice step. */}
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
                  // Friendly badges replace explicit numbers so customers
                  // aren't scared away by a high screen-replacement figure.
                  // The actual price difference still flows into the final
                  // quote the technician sends after inspection.
                  const badge =
                    q === 'original'
                      ? { ar: 'الجودة الأعلى', en: 'Top quality', color: '#10b981' }
                      : q === 'high_quality'
                      ? { ar: 'موصى به', en: 'Recommended', color: '#3b82f6' }
                      : { ar: 'الأوفر', en: 'Best value', color: '#f59e0b' };
                  return (
                    <AnimatedTouchable
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
                        <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                          {isRTL ? SPARE_PART_LABELS[q].ar : SPARE_PART_LABELS[q].en}
                        </Text>
                        <View style={{ backgroundColor: badge.color + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                          <Text style={{ color: badge.color, fontWeight: '700', fontSize: 11 }}>
                            {isRTL ? badge.ar : badge.en}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: COLORS.gray, fontSize: 12, marginTop: 6, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
                        {isRTL ? SPARE_PART_DESCRIPTIONS[q].ar : SPARE_PART_DESCRIPTIONS[q].en}
                      </Text>
                    </AnimatedTouchable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{isRTL ? 'صور أو فيديو' : 'Photos or Video'}</Text>
              <View style={styles.mediaContainer}>
                <AnimatedTouchable style={styles.addMediaButton} onPress={pickImage}>
                  <Ionicons name="camera" size={32} color={COLORS.gray} />
                  <Text style={styles.addMediaText}>{isRTL ? 'إضافة' : 'Add'}</Text>
                </AnimatedTouchable>
                {mediaFiles.map((uri, index) => (
                  <View key={index} style={styles.mediaWrapper}>
                    <Image source={{ uri }} style={styles.mediaThumb} />
                    <AnimatedTouchable
                      style={styles.removeMediaBtn}
                      onPress={() => setMediaFiles(mediaFiles.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                    </AnimatedTouchable>
                  </View>
                ))}
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
                {(() => {
                  // Trimmed value drives both the disabled state and the
                  // network call so whitespace doesn't enable the button
                  // (or get sent to the API as a "code").
                  const trimmedCode = discountInput.trim();
                  const canApply = !!appliedDiscount || trimmedCode.length > 0;
                  const isDisabled = discountChecking || !canApply;
                  return (
                    <AnimatedTouchable
                      disabled={isDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={
                        appliedDiscount
                          ? (isRTL ? 'إزالة كود الخصم' : 'Remove discount code')
                          : (isRTL ? 'تطبيق كود الخصم' : 'Apply discount code')
                      }
                      accessibilityState={{ disabled: isDisabled, busy: discountChecking }}
                      hitSlop={8}
                      onPress={async () => {
                        if (isDisabled) return;
                        if (appliedDiscount) {
                          setAppliedDiscount(null);
                          setDiscountInput('');
                          setDiscountError(null);
                          return;
                        }
                        if (!user) {
                          setDiscountError(
                            isRTL ? 'الرجاء تسجيل الدخول أولاً' : 'Please sign in first',
                          );
                          return;
                        }
                        setDiscountChecking(true);
                        setDiscountError(null);
                        try {
                          const base = selectedIssue?.estimatedPrice ?? 0;
                          const total = Math.round(base * SPARE_PART_MULTIPLIERS[sparePartQuality]);
                          const result = await validateDiscountCode(trimmedCode, total, user.id, language);
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
                        backgroundColor: appliedDiscount
                          ? COLORS.error
                          : isDisabled
                            ? COLORS.gray
                            : COLORS.primary,
                        opacity: isDisabled && !discountChecking ? 0.6 : 1,
                        height: 48,
                        minWidth: 92,
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
                    </AnimatedTouchable>
                  );
                })()}
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

              {/* Payment method is now its own dedicated step (last step),
                  so the customer sees the full invoice + commitment amount
                  before picking how to pay. */}

              {/* Accessory suggestions — context-aware by device type. */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                {isRTL ? 'إكسسوارات مقترحة (اختياري)' : 'Suggested accessories (optional)'}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                {getAccessorySuggestions(selectedDeviceType).map((acc) => {
                  const selected = selectedAccessories.some((x) => x.id === acc.id);
                  return (
                    <AnimatedTouchable
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
                        {isRTL ? acc.name_ar : acc.name_en}
                      </Text>
                    </AnimatedTouchable>
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
                    <AnimatedTouchable
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
                      {/* Price intentionally omitted here — shown in the final invoice. */}
                    </AnimatedTouchable>
                  );
                })}
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {currentStep === 6 && selectedServiceType === 'personal_handoff' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>{isRTL ? 'تسليم الجهاز' : 'Drop off your device'}</Text>
            <View style={styles.payNotice}>
              <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} />
              <Text style={styles.payNoticeText}>
                {isRTL
                  ? 'اخترت التسليم باليد، لذلك ستُحضر جهازك إلى مركز الخدمة. لا حاجة لتحديد موقعك على الخريطة.'
                  : "You chose hand-delivery, so you'll bring your device to our service center — no map location is needed."}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <ServiceCenterCard isRTL={isRTL} COLORS={COLORS} />
            </View>
          </ScrollView>
        )}

        {currentStep === 6 && selectedServiceType !== 'personal_handoff' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>{isRTL ? 'حدد موقعك' : 'Set Your Location'}</Text>

            {/* Place search — moves the map; pin-drag confirmation below is unchanged. */}
            <View style={styles.placeSearchRow}>
              <Ionicons name="search" size={18} color={COLORS.gray} />
              <TextInput
                style={styles.placeSearchInput}
                value={placeQuery}
                onChangeText={(t) => {
                  setPlaceQuery(t);
                  if (placeSearchError) setPlaceSearchError(null);
                }}
                placeholder={isRTL ? 'ابحث عن حي، شارع أو معلم…' : 'Search for an area, street or landmark…'}
                placeholderTextColor={COLORS.gray}
                returnKeyType="search"
                onSubmitEditing={handlePlaceSearch}
                textAlign={isRTL ? 'right' : 'left'}
              />
              {isSearchingPlace ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : placeQuery.trim() ? (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      suppressAutoSearchRef.current = true;
                      setPlaceQuery('');
                      setPlaceResults([]);
                      setPlaceSearchError(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={isRTL ? 'مسح البحث' : 'Clear search'}
                  >
                    <Ionicons name="close-circle" size={20} color={COLORS.gray} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePlaceSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={isRTL ? 'arrow-back-circle' : 'arrow-forward-circle'} size={24} color={COLORS.primary} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
            {placeSearchError ? <Text style={styles.placeSearchError}>{placeSearchError}</Text> : null}

            {/* Search results — tapping one moves the map there; the customer
                can still fine-tune by dragging the pin afterwards. */}
            {placeResults.length > 0 && (
              <View style={styles.placeResultsCard}>
                {placeResults.map((place, index) => (
                  <TouchableOpacity
                    key={`${place.latitude},${place.longitude},${index}`}
                    style={[styles.placeResultRow, index > 0 && styles.placeResultDivider]}
                    onPress={() => selectPlace(place)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeResultName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      {!!place.address && (
                        <Text style={styles.placeResultAddress} numberOfLines={1}>
                          {place.address}
                        </Text>
                      )}
                    </View>
                    <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={COLORS.gray} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[styles.mapContainer, { height: 280 }]}>
              {location && location.latitude && location.longitude ? (
                <OsmMap
                  ref={mapRef}
                  latitude={location.latitude}
                  longitude={location.longitude}
                  zoom={16}
                  interactive
                  // Tap-to-place is Android-only; iOS keeps drag-only behaviour.
                  tapToPlace={Platform.OS === 'android'}
                  onReady={() => setMapReady(true)}
                  onMoveEnd={(lat, lng) => applyPickedLocation(lat, lng)}
                  style={styles.map}
                />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <MaterialCommunityIcons name="map-marker-radius" size={64} color={COLORS.gray} />
                  <Text style={styles.mapPlaceholderText}>{isRTL ? 'الخريطة ستظهر هنا' : 'Map will appear here'}</Text>
                </View>
              )}

              {/* Drag hint overlays the map. The centre pin is drawn by the
                  map itself (Leaflet), so no separate RN pin is needed. */}
              {mapReady && location && (
                <View pointerEvents="none" style={styles.dragHint}>
                  <Ionicons name="hand-left-outline" size={14} color="#fff" />
                  <Text style={styles.dragHintText}>
                    {Platform.OS === 'android'
                      ? (isRTL ? 'اسحب أو اضغط على الخريطة لتحديد الموقع' : 'Tap or drag the map to set location')
                      : (isRTL ? 'اسحب الخريطة لتحديد الموقع' : 'Drag the map to set location')}
                  </Text>
                </View>
              )}

              {!mapReady && location && (
                <View style={[styles.mapPlaceholder, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              )}

              <AnimatedTouchable 
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
              </AnimatedTouchable>
            </View>
            {address ? (
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={styles.addressText}>{address}</Text>
              </View>
            ) : null}

            {/* Delivery area — Saudi-wide, admin-controlled coverage.
                The serviceable city is auto-detected from the dropped pin;
                the customer no longer picks a region/city manually. */}
            {regionTree.length > 0 && (
              <View style={styles.deliveryCard}>
                <View style={styles.deliveryHeader}>
                  <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.deliveryTitle}>
                    {isRTL ? 'منطقة التوصيل' : 'Delivery area'}
                  </Text>
                </View>
                <View style={styles.coverageNotice}>
                  <View style={styles.coverageIconWrap}>
                    <MaterialCommunityIcons
                      name={pinOutsideCoverage ? 'map-marker-off-outline' : 'map-marker-radius'}
                      size={18}
                      color={pinOutsideCoverage ? COLORS.error : COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.coverageTitle, pinOutsideCoverage && { color: COLORS.error }]}>
                      {pinOutsideCoverage
                        ? (isRTL ? 'خارج نطاق الخدمة' : 'Outside coverage')
                        : selectedCityAvailable
                          ? (isRTL ? 'موقعك ضمن منطقة الخدمة' : 'Inside service area')
                          : (isRTL ? 'حدد موقعك على الخريطة' : 'Drop a pin on the map')}
                    </Text>
                    <Text style={styles.coverageBody}>
                      {pinOutsideCoverage
                        ? (isRTL
                            ? 'موقعك الحالي خارج المناطق المخدومة. حرّك الدبوس داخل منطقة مفعّلة لإكمال الطلب.'
                            : 'Your current pin is outside our enabled service areas. Move the pin into a covered area to continue.')
                        : (isRTL
                            ? 'نكتشف مدينتك تلقائياً من موقع الدبوس على الخريطة.'
                            : 'We auto-detect your city from the pin on the map.')}
                    </Text>
                  </View>
                </View>
                {selectedServiceType !== 'personal_handoff' && selectedCityAvailable && (
                  <View style={styles.deliveryFeeRow}>
                    <Text style={styles.summaryLabel}>
                      {isRTL
                        ? (selectedServiceType === 'mobile' ? 'رسوم الفني المتنقل' : 'رسوم التوصيل')
                        : (selectedServiceType === 'mobile' ? 'Mobile-tech fee' : 'Delivery fee')}
                    </Text>
                    <Text style={[styles.summaryValue, { color: COLORS.primary, fontWeight: '800', fontSize: 16 }]}>
                      {isFreeDelivery
                        ? (isRTL ? 'مجاناً' : 'Free')
                        : `${deliveryFee} ${isRTL ? 'ر.س' : 'SAR'}`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Pre-submit review + price details intentionally moved to the
                dedicated Payment step so the customer sees the full invoice
                at the very end, not scattered across earlier steps. */}
          </ScrollView>
        )}

        {currentStep === 7 && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Short snapshot of what's being booked. */}
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
                <Text style={styles.summaryLabel}>{isRTL ? 'العطل' : 'Issue'}</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {isRTL ? selectedIssue?.nameAr : selectedIssue?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'الخدمة' : 'Service'}</Text>
                <Text style={styles.summaryValue}>
                  {(() => {
                    const s = SERVICE_TYPES.find(s => s.id === selectedServiceType);
                    return s ? (isRTL ? s.name : s.nameEn) : '';
                  })()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'العنوان' : 'Address'}</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{address}</Text>
              </View>
            </View>

            {/* Pre-inspection cost. The real repair price is only known
                after the technician inspects the device, so we never show a
                repair total here. */}
            <View style={[styles.summaryCard, { marginTop: 12 }]}>
              <Text style={styles.summaryTitle}>{isRTL ? 'التكلفة' : 'Cost'}</Text>

              <View style={styles.priceNotice}>
                <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceNoticeTitle}>
                    {isRTL
                      ? 'يتم تحديد السعر بعد الفحص'
                      : 'Price will be determined after inspection'}
                  </Text>
                  <Text style={styles.priceNoticeBody}>
                    {isRTL
                      ? 'سيفحص الفني جهازك ثم يرسل لك عرض سعر دقيق للموافقة عليه قبل بدء الإصلاح.'
                      : 'The technician will inspect your device, then send an accurate quote for you to approve before any repair begins.'}
                  </Text>
                </View>
              </View>

              {selectedServiceType !== 'personal_handoff' && (deliveryFee > 0 || isFreeDelivery) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isRTL ? 'رسوم التوصيل' : 'Delivery fee'}</Text>
                  <Text style={styles.summaryValue}>
                    {isFreeDelivery
                      ? (isRTL ? 'مجاناً' : 'Free')
                      : `${deliveryFee} ${isRTL ? 'ر.س' : 'SAR'}`}
                  </Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{isRTL ? 'رسوم الفحص' : 'Inspection fee'}</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    inspectionFeeDue === 0 && { color: COLORS.primary, fontWeight: '700' },
                  ]}
                >
                  {inspectionFeeDue > 0
                    ? `${inspectionFeeDue} ${isRTL ? 'ر.س' : 'SAR'}`
                    : isRTL ? 'مجاني' : 'Free'}
                </Text>
              </View>

              {commitmentDue > 0 && (
                <View style={styles.summaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>
                      {isRTL ? 'مبلغ التأكيد' : 'Confirmation amount'}
                    </Text>
                    <Text style={styles.costNote}>
                      {isRTL
                        ? 'يُدفع الآن ويُخصم من الفاتورة النهائية'
                        : 'Paid now, deducted from the final bill'}
                    </Text>
                  </View>
                  <Text style={styles.summaryValue}>
                    {commitmentDue} {isRTL ? 'ر.س' : 'SAR'}
                  </Text>
                </View>
              )}

              <Text style={styles.summaryVatNote}>
                {isRTL ? 'الأسعار شاملة ضريبة القيمة المضافة' : 'Prices include VAT'}
              </Text>
            </View>

            {/* Service center — shown for drop-off / personal handoff only. */}
            {selectedServiceType === 'personal_handoff' && (
              <View style={{ marginTop: 12 }}>
                <ServiceCenterCard isRTL={isRTL} COLORS={COLORS} />
              </View>
            )}

            {/* Payment methods — illustrative only. No real payment happens
                here; it is completed on the payment page after the customer
                approves the repair quote. */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              {isRTL ? 'طرق الدفع' : 'Payment methods'}
            </Text>
            <View style={styles.payNotice}>
              <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} />
              <Text style={styles.payNoticeText}>
                {isRTL
                  ? 'هذه الخطوة للعرض فقط. يتم الدفع لاحقاً بعد موافقتك على عرض السعر عقب الفحص.'
                  : 'For reference only. Payment is completed later, after you approve the repair quote.'}
              </Text>
            </View>
            <View style={{ gap: 8, marginTop: 4 }}>
              {requestPayMethods.map((pm) => {
                const selected = prefMethod === pm.code;
                return (
                  <AnimatedTouchable
                    key={pm.id}
                    activeOpacity={0.8}
                    disabled={pm.is_coming_soon}
                    onPress={() => setPrefMethod(pm.code)}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      backgroundColor: selected ? COLORS.lightGreen : COLORS.card,
                      borderRadius: 12,
                      padding: 14,
                      opacity: pm.is_coming_soon ? 0.6 : 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={(pm.icon as any) || 'credit-card-outline'}
                      size={24}
                      color={
                        pm.code === 'tabby'
                          ? '#3EB6A0'
                          : pm.code === 'tamara'
                          ? '#E0218A'
                          : COLORS.primary
                      }
                    />
                    <Text style={{ flex: 1, fontWeight: '700', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }}>
                      {isRTL ? pm.name_ar : pm.name_en}
                    </Text>
                    {pm.is_coming_soon ? (
                      <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ fontSize: 10, color: COLORS.gray, fontWeight: '700' }}>
                          {isRTL ? 'قريبًا' : 'Coming Soon'}
                        </Text>
                      </View>
                    ) : selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    ) : null}
                  </AnimatedTouchable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </Animated.View>

      <View style={styles.footer}>
        <AnimatedTouchable
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
        </AnimatedTouchable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean, SHADOWS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.card },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  backButton: { padding: 8 },
  stepperContainer: {
    backgroundColor: COLORS.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  progressLabelRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressStepName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left',
  },
  progressCount: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  progressTrack: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  progressSegmentActive: { backgroundColor: COLORS.primary },
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
  brandCard: { width: (width - 44) / 2, backgroundColor: COLORS.card, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
  brandCheck: { position: 'absolute', top: 6, ...(isRTL ? { left: 6 } : { right: 6 }) },
  // FEAT-05 — sized to match the device-type cards (icon 34 + label,
  // marginTop 8) so brand cards are no longer oversized.
  brandLogoContainer: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  brandLogo: { width: 34, height: 34 },
  brandNameText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
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
  placeSearchRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  placeSearchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  placeSearchError: { fontSize: 13, color: COLORS.error, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' },
  placeResultsCard: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' },
  placeResultRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  placeResultDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  placeResultName: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  placeResultAddress: { fontSize: 12, color: COLORS.gray, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
  osmAttribution: { position: 'absolute', bottom: 4, left: 6, fontSize: 9, color: '#555', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 3 },
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
  summaryVatNote: { fontSize: 11, color: COLORS.gray, marginTop: 8, textAlign: isRTL ? 'right' : 'left' },
  priceNotice: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, backgroundColor: COLORS.lightGreen, borderRadius: 12, padding: 12, marginVertical: 8 },
  priceNoticeTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, textAlign: isRTL ? 'right' : 'left' },
  priceNoticeBody: { fontSize: 12, color: COLORS.gray, marginTop: 3, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  costNote: { fontSize: 11, color: COLORS.gray, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  payNotice: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, backgroundColor: COLORS.lightGreen, borderRadius: 12, padding: 12, marginBottom: 4, alignItems: 'flex-start' },
  payNoticeText: { flex: 1, fontSize: 12, color: COLORS.gray, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  // Coverage banner — replaces the cramped 1-line payNotice for the
  // delivery-area block. Two-row layout (title + body) with a soft icon
  // bubble on one side. Enough air around the text that it doesn't read
  // as a single wall of Arabic in a green rectangle.
  coverageNotice: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.lightGreen,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
  },
  coverageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverageTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    marginBottom: 4,
  },
  coverageBody: {
    fontSize: 12.5,
    color: COLORS.gray,
    lineHeight: 20,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  deliveryFeeHint: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 3,
    lineHeight: 16,
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  footer: { padding: 16, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextButton: { backgroundColor: COLORS.primary, height: 54, borderRadius: BORDER_RADIUS.sm, justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
