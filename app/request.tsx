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
    checkUser();
  }, []);

  const checkUser = async () => {
    const currentUser = await auth.getCurrentUser();
    if (!currentUser) {
      Alert.alert(
        isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required',
        isRTL ? 'يجب عليك تسجيل الدخول لرفع طلب صيانة' : 'You must login to submit a repair request',
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', onPress: () => router.replace('/(customer)'), style: 'cancel' },
          { text: isRTL ? 'تسجيل الدخول' : 'Login', onPress: () => router.replace('/login') }
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

  const handleLocationRequest = async () => {
    setIsLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'يجب السماح بالوصول للموقع' : 'Location permission is required');
        setIsLocating(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      
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

  const pickImage = async () => {
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

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'الرجاء تحديد الموقع' : 'Please select location');
      return;
    }
    
    const currentUser = await auth.getCurrentUser();
    if (!currentUser) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'يجب تسجيل الدخول أولاً' : 'Please login first');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        user_id: currentUser.id,
        device_type: selectedDeviceType,
        device_brand: selectedBrand?.name,
        device_model: selectedModel,
        issue_description: selectedIssue?.name + (issueDescription ? `: ${issueDescription}` : ''),
        estimated_price: selectedIssue?.price || 0,
        status: 'pending',
        location: address || `${location.latitude}, ${location.longitude}`,
        latitude: location.latitude,
        longitude: location.longitude,
        service_type: selectedServiceType,
      };

      const result = await requests.createRequest(orderData);
      
      if (result) {
        setIsSubmitting(false);
        Alert.alert(
          isRTL ? 'نجح' : 'Success', 
          isRTL ? 'تم إرسال طلبك بنجاح' : 'Request submitted successfully',
          [{ text: 'OK', onPress: () => router.replace('/(customer)/orders') }]
        );
      } else {
        throw new Error('Failed to create request');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setIsSubmitting(false);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إرسال الطلب، حاول مرة أخرى' : 'Failed to submit request, please try again');
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
    if (currentStep === 2) return !!selectedBrand;
    if (currentStep === 3) return !!selectedModel;
    if (currentStep === 4) return !!selectedIssue;
    if (currentStep === 5) return true; // Details are optional
    if (currentStep === 6) return !!location;
    return false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back()} style={styles.backButton}>
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
                    <Image 
                      source={typeof brand.logo === 'string' ? { uri: brand.logo } : brand.logo} 
                      style={styles.brandLogo} 
                      resizeMode="contain" 
                    />
                  </View>
                  <Text style={styles.brandNameText}>{brand.name}</Text>
                </TouchableOpacity>
              )) : renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        )}

        {currentStep === 3 && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput 
                placeholder={isRTL ? 'ابحث عن الموديل...' : 'Search model...'}
                style={styles.searchInput}
                value={modelSearch}
                onChangeText={setModelSearch}
              />
            </View>
            <ScrollView>
              {filteredModels.length > 0 ? filteredModels.map((model, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.listItem, selectedModel === model && styles.selectedListItem]}
                  onPress={() => setSelectedModel(model)}
                >
                  <Text style={[styles.listItemText, selectedModel === model && styles.selectedListItemText]}>{model}</Text>
                  {selectedModel === model && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                </TouchableOpacity>
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
                value={issueSearch}
                onChangeText={setIssueSearch}
              />
            </View>
            <ScrollView>
              {filteredIssues.length > 0 ? filteredIssues.map((issue) => (
                <TouchableOpacity 
                  key={issue.id} 
                  style={[styles.issueCard, selectedIssue?.id === issue.id && styles.selectedCard]}
                  onPress={() => setSelectedIssue(issue)}
                >
                  <View style={styles.issueInfo}>
                    <Text style={styles.issueName}>{isRTL ? issue.nameAr : issue.name}</Text>
                    <Text style={styles.issuePrice}>
                      {issue.id === 'other' 
                        ? (isRTL ? 'حسب العطل سيتم التقدير' : 'Price based on diagnosis')
                        : (isRTL ? `يبدأ من ${issue.estimatedPrice} ر.س` : `Starts from ${issue.estimatedPrice} SAR`)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name={issue.icon as any} size={24} color={selectedIssue?.id === issue.id ? COLORS.primary : COLORS.gray} />
                </TouchableOpacity>
              )) : renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        )}

        {currentStep === 5 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView>
              <Text style={styles.sectionTitle}>{isRTL ? 'تفاصيل إضافية' : 'Additional Details'}</Text>
              <TextInput
                style={styles.textArea}
                placeholder={isRTL ? 'اشرح العطل بالتفصيل (اختياري)...' : 'Describe the issue in detail (optional)...'}
                multiline
                numberOfLines={6}
                value={issueDescription}
                onChangeText={setIssueDescription}
                textAlignVertical="top"
              />
              
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
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{isRTL ? 'حدد موقعك' : 'Set Your Location'}</Text>
            <View style={styles.mapContainer}>
              {location ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={location}
                  onRegionChangeComplete={(region) => setLocation(region)}
                >
                  <Marker coordinate={location} />
                </MapView>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <MaterialCommunityIcons name="map-marker-radius" size={64} color={COLORS.gray} />
                  <Text style={styles.mapPlaceholderText}>{isRTL ? 'الخريطة ستظهر هنا' : 'Map will appear here'}</Text>
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
          </View>
        )}
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, (!canGoNext() || isSubmitting) && { opacity: 0.5 }]} 
          onPress={() => {
            if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
            else handleSubmit();
          }}
          disabled={!canGoNext() || isSubmitting}
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
  stepItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginHorizontal: 8 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  activeStepCircle: { backgroundColor: COLORS.primary },
  stepNumber: { fontSize: 12, color: COLORS.gray, fontWeight: 'bold' },
  activeStepNumber: { color: '#fff' },
  stepLabel: { fontSize: 12, color: COLORS.gray, marginHorizontal: 4 },
  activeStepLabel: { color: COLORS.primary, fontWeight: 'bold' },
  stepLine: { width: 20, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  activeStepLine: { backgroundColor: COLORS.primary },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
  serviceCard: { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  selectedCard: { borderColor: COLORS.primary, backgroundColor: '#ecfdf5' },
  serviceInfo: { flex: 1, marginHorizontal: 12 },
  serviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  serviceDesc: { fontSize: 12, color: COLORS.gray, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  deviceGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 },
  deviceCard: { width: (width - 44) / 2, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  deviceName: { marginTop: 8, fontSize: 14, fontWeight: '600', color: COLORS.text },
  comingSoonBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  comingSoonText: { fontSize: 10, color: '#9ca3af' },
  searchBar: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  searchInput: { flex: 1, marginHorizontal: 8, textAlign: isRTL ? 'right' : 'left' },
  brandGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 },
  brandCard: { width: (width - 56) / 3, backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  brandLogoContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  brandLogo: { width: 40, height: 40 },
  brandNameText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  listItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  selectedListItem: { borderColor: COLORS.primary, backgroundColor: '#ecfdf5' },
  listItemText: { fontSize: 16, color: COLORS.text },
  selectedListItemText: { fontWeight: 'bold', color: COLORS.primary },
  issueCard: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  issueInfo: { flex: 1 },
  issueName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  issuePrice: { fontSize: 14, color: COLORS.primary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
  textArea: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, fontSize: 16, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  me  mediaContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  addMediaButton: { width: 80, height: 80, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  addMediaText: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  mediaWrapper: { position: 'relative' },
  mediaThumb: { width: 80, height: 80, borderRadius: 12 },
  removeMediaBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 10 },: 4 },
  mapContainer: { flex: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  mapPlaceholderText: { marginTop: 12, fontSize: 16, color: COLORS.gray },
  locationButton: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: COLORS.primary, height: 48, borderRadius: 24, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  locationButtonText: { color: '#fff', fontWeight: 'bold' },
  addressContainer: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', padding: 12, backgroundColor: '#ecfdf5', borderRadius: 12, gap: 8 },
  addressText: { flex: 1, fontSize: 14, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { marginTop: 12, fontSize: 16, color: COLORS.gray },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border },
  nextButton: { backgroundColor: COLORS.primary, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
