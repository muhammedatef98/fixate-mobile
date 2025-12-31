import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions, TextInput, Animated, Alert, KeyboardAvoidingView, Platform, Modal, I18nManager, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRequests } from '../contexts/RequestContext';
import { requests, auth } from '../lib/supabase-api';
import { notificationManager } from '../lib/notifications';
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

      const result = await requests.create(orderData);
      
      if (result) {
        // Extract city from address if possible and notify technicians
        const cityMatch = address?.match(/,\s*([^,]+)$/);
        const city = cityMatch ? cityMatch[1].trim() : null;
        
        if (city) {
          notificationManager.notifyTechniciansInCity(city, {
            id: result.id,
            device_brand: orderData.device_brand,
            device_model: orderData.device_model
          });
        }

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

  const handleNext = () => {
    if (canGoNext()) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{isRTL ? 'اختر نوع الخدمة' : 'Select Service Type'}</Text>
            <View style={styles.serviceGrid}>
              {SERVICE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.serviceCard,
                    selectedServiceType === type.id && styles.selectedCard
                  ]}
                  onPress={() => setSelectedServiceType(type.id)}
                >
                  <MaterialCommunityIcons 
                    name={type.icon as any} 
                    size={40} 
                    color={selectedServiceType === type.id ? COLORS.primary : COLORS.gray} 
                  />
                  <Text style={[
                    styles.serviceName,
                    selectedServiceType === type.id && styles.selectedText
                  ]}>
                    {isRTL ? type.name : type.nameEn}
                  </Text>
                  <Text style={styles.serviceDesc}>
                    {isRTL ? type.description : type.descriptionEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{isRTL ? 'ما هو نوع جهازك؟' : 'What is your device type?'}</Text>
            <View style={styles.deviceGrid}>
              {DEVICE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.deviceCard,
                    selectedDeviceType === type.id && styles.selectedCard,
                    !type.available && styles.disabledCard
                  ]}
                  onPress={() => type.available && setSelectedDeviceType(type.id)}
                  disabled={!type.available}
                >
                  <MaterialCommunityIcons 
                    name={type.icon as any} 
                    size={32} 
                    color={selectedDeviceType === type.id ? COLORS.primary : (type.available ? COLORS.gray : '#d1d5db')} 
                  />
                  <Text style={[
                    styles.deviceName,
                    selectedDeviceType === type.id && styles.selectedText,
                    !type.available && { color: '#d1d5db' }
                  ]}>
                    {isRTL ? type.name : type.nameEn}
                  </Text>
                  {!type.available && (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>{isRTL ? 'قريباً' : 'Soon'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{isRTL ? 'اختر الماركة' : 'Select Brand'}</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder={isRTL ? 'ابحث عن ماركة...' : 'Search brand...'}
                value={brandSearch}
                onChangeText={setBrandSearch}
              />
            </View>
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.brandGrid}>
                {filteredBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand.id}
                    style={[
                      styles.brandCard,
                      selectedBrand?.id === brand.id && styles.selectedCard
                    ]}
                    onPress={() => {
                      setSelectedBrand(brand);
                      setSelectedModel(null);
                      setBrandSearch('');
                      handleNext();
                    }}
                  >
                    <Image source={{ uri: brand.logo }} style={styles.brandLogo} resizeMode="contain" />
                    <Text style={[
                      styles.brandName,
                      selectedBrand?.id === brand.id && styles.selectedText
                    ]}>
                      {brand.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {filteredBrands.length === 0 && renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{isRTL ? `موديل ${selectedBrand?.name}` : `${selectedBrand?.name} Model`}</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder={isRTL ? 'ابحث عن موديل...' : 'Search model...'}
                value={modelSearch}
                onChangeText={setModelSearch}
              />
            </View>
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {filteredModels.map((model, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.listItem,
                    selectedModel === model && styles.selectedListItem
                  ]}
                  onPress={() => {
                    setSelectedModel(model);
                    setModelSearch('');
                    handleNext();
                  }}
                >
                  <Text style={[
                    styles.listItemText,
                    selectedModel === model && styles.selectedListItemText
                  ]}>
                    {model}
                  </Text>
                  {selectedModel === model && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
              {filteredModels.length === 0 && renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{isRTL ? 'ما هي المشكلة؟' : 'What is the issue?'}</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder={isRTL ? 'ابحث عن العطل...' : 'Search issue...'}
                value={issueSearch}
                onChangeText={setIssueSearch}
              />
            </View>
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {filteredIssues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={[
                    styles.listItem,
                    selectedIssue?.id === issue.id && styles.selectedListItem
                  ]}
                  onPress={() => {
                    setSelectedIssue(issue);
                    setIssueSearch('');
                    handleNext();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.listItemText,
                      selectedIssue?.id === issue.id && styles.selectedListItemText
                    ]}>
                      {issue.name}
                    </Text>
                    <Text style={styles.issuePrice}>
                      {isRTL ? 'السعر التقديري: ' : 'Est. Price: '}
                      {issue.price} {isRTL ? 'ر.س' : 'SAR'}
                    </Text>
                  </View>
                  {selectedIssue?.id === issue.id && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
              {filteredIssues.length === 0 && renderEmptyState(isRTL ? 'لا توجد نتائج' : 'No results found')}
            </ScrollView>
          </View>
        );
      case 5:
        return (
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.stepContainer}
          >
            <Text style={styles.stepTitle}>{isRTL ? 'تفاصيل إضافية' : 'Additional Details'}</Text>
            <Text style={styles.stepSubtitle}>
              {isRTL ? 'اشرح المشكلة أكثر أو أضف صوراً (اختياري)' : 'Explain more or add photos (optional)'}
            </Text>
            
            <TextInput
              style={styles.detailsInput}
              placeholder={isRTL ? 'اكتب هنا...' : 'Type here...'}
              multiline
              numberOfLines={4}
              value={issueDescription}
              onChangeText={setIssueDescription}
              textAlignVertical="top"
            />
            
            <Text style={styles.sectionTitle}>{isRTL ? 'الصور' : 'Photos'}</Text>
            <View style={styles.mediaGrid}>
              {mediaFiles.map((uri, index) => (
                <View key={index} style={styles.mediaWrapper}>
                  <Image source={{ uri }} style={styles.mediaItem} />
                  <TouchableOpacity 
                    style={styles.removeMedia}
                    onPress={() => setMediaFiles(mediaFiles.filter((_, i) => i !== index))}
                  >
                    <Ionicons name="close-circle" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {mediaFiles.length < 5 && (
                <TouchableOpacity style={styles.addMediaButton} onPress={pickImage}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.gray} />
                  <Text style={styles.addMediaText}>{isRTL ? 'إضافة' : 'Add'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        );
      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{isRTL ? 'حدد موقعك' : 'Set Your Location'}</Text>
            <View style={styles.mapWrapper}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={location || {
                  latitude: 24.7136,
                  longitude: 46.6753,
                  latitudeDelta: 10,
                  longitudeDelta: 10,
                }}
                region={location}
                onPress={(e) => {
                  const coord = e.nativeEvent.coordinate;
                  setLocation({
                    ...coord,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  });
                  // Reverse geocode would go here in a real app
                }}
              >
                {location && <Marker coordinate={location} />}
              </MapView>
              
              <TouchableOpacity 
                style={styles.locateButton} 
                onPress={handleLocationRequest}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="locate" size={20} color="#fff" />
                    <Text style={styles.locateButtonText}>{isRTL ? 'تحديد موقعي الحالي' : 'Use Current Location'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            {address ? (
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
              </View>
            ) : null}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'طلب صيانة' : 'Repair Request'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepperWrapper}>
        <ScrollView 
          ref={stepperScrollRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepperContent}
        >
          {STEPS.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                currentStep === index && styles.activeStepCircle,
                currentStep > index && styles.completedStepCircle
              ]}>
                {currentStep > index ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    currentStep === index && styles.activeStepNumber
                  ]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                currentStep === index && styles.activeStepLabel
              ]}>{step}</Text>
              {index < STEPS.length - 1 && <View style={styles.stepLine} />}
            </View>
          ))}
        </ScrollView>
      </View>

      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        {renderStepContent()}
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, !canGoNext() && styles.disabledButton]}
          onPress={handleNext}
          disabled={!canGoNext() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {currentStep === STEPS.length - 1 
                  ? (isRTL ? 'إرسال الطلب' : 'Submit Request') 
                  : (isRTL ? 'التالي' : 'Next')}
              </Text>
              {currentStep < STEPS.length - 1 && (
                <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(COLORS: any, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#fff',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.text,
    },
    stepperWrapper: {
      backgroundColor: '#fff',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    stepperContent: {
      paddingHorizontal: 16,
      flexDirection: isRTL ? 'row-reverse' : 'row',
    },
    stepItem: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
    },
    stepCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff',
    },
    activeStepCircle: {
      borderColor: COLORS.primary,
      backgroundColor: '#fff',
    },
    completedStepCircle: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary,
    },
    stepNumber: {
      fontSize: 12,
      fontWeight: 'bold',
      color: COLORS.gray,
    },
    activeStepNumber: {
      color: COLORS.primary,
    },
    stepLabel: {
      fontSize: 12,
      color: COLORS.gray,
      marginHorizontal: 8,
    },
    activeStepLabel: {
      color: COLORS.primary,
      fontWeight: 'bold',
    },
    stepLine: {
      width: 20,
      height: 2,
      backgroundColor: COLORS.border,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    stepContainer: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: COLORS.text,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    stepSubtitle: {
      fontSize: 14,
      color: COLORS.gray,
      marginBottom: 20,
      textAlign: isRTL ? 'right' : 'left',
    },
    serviceGrid: {
      flexDirection: 'column',
      gap: 16,
    },
    serviceCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: 'transparent',
      ...getShadows().small,
      alignItems: isRTL ? 'flex-end' : 'flex-start',
    },
    selectedCard: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.lightGreen,
    },
    serviceName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.text,
      marginTop: 12,
      marginBottom: 4,
    },
    serviceDesc: {
      fontSize: 14,
      color: COLORS.gray,
      textAlign: isRTL ? 'right' : 'left',
    },
    deviceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    deviceCard: {
      width: (width - 52) / 2,
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      ...getShadows().small,
    },
    disabledCard: {
      opacity: 0.6,
      backgroundColor: '#f3f4f6',
    },
    deviceName: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.text,
      marginTop: 8,
    },
    comingSoonBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: '#e5e7eb',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    comingSoonText: {
      fontSize: 10,
      color: COLORS.gray,
    },
    searchContainer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 12,
      paddingHorizontal: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    searchInput: {
      flex: 1,
      height: 44,
      paddingHorizontal: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    listContainer: {
      flex: 1,
    },
    brandGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    brandCard: {
      width: (width - 52) / 3,
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      ...getShadows().small,
    },
    brandLogo: {
      width: 40,
      height: 40,
      marginBottom: 8,
    },
    brandName: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.text,
    },
    listItem: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    selectedListItem: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.lightGreen,
    },
    listItemText: {
      fontSize: 16,
      color: COLORS.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    selectedListItemText: {
      color: COLORS.primary,
      fontWeight: 'bold',
    },
    issuePrice: {
      fontSize: 12,
      color: COLORS.gray,
      marginTop: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    detailsInput: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      height: 120,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 20,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: COLORS.text,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    mediaWrapper: {
      position: 'relative',
    },
    mediaItem: {
      width: 80,
      height: 80,
      borderRadius: 8,
    },
    removeMedia: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: '#fff',
      borderRadius: 10,
    },
    addMediaButton: {
      width: 80,
      height: 80,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: COLORS.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addMediaText: {
      fontSize: 12,
      color: COLORS.gray,
      marginTop: 4,
    },
    mapWrapper: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
      position: 'relative',
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    locateButton: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      backgroundColor: COLORS.primary,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      ...getShadows().medium,
    },
    locateButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      marginHorizontal: 8,
    },
    addressContainer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: COLORS.lightGreen,
      padding: 12,
      borderRadius: 12,
    },
    addressText: {
      flex: 1,
      fontSize: 14,
      color: COLORS.text,
      marginHorizontal: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    footer: {
      padding: 20,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    nextButton: {
      backgroundColor: COLORS.primary,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      ...getShadows().medium,
    },
    disabledButton: {
      backgroundColor: '#d1d5db',
    },
    nextButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      marginHorizontal: 8,
    },
    selectedText: {
      color: COLORS.primary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyStateText: {
      marginTop: 12,
      color: COLORS.gray,
      fontSize: 16,
    }
  });
}
