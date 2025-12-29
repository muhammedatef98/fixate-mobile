import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions, TextInput, Animated, Alert, KeyboardAvoidingView, Platform, Modal, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRequests } from '../contexts/RequestContext';
import { requests, storage, auth } from '../lib/supabase-api';
import { BrandLogo } from '../components/BrandLogo';
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
  { id: 'phone', name: 'جوال', nameEn: 'Phone', icon: 'cellphone' },
  { id: 'tablet', name: 'تابلت', nameEn: 'Tablet', icon: 'tablet' },
  { id: 'laptop', name: 'لابتوب', nameEn: 'Laptop', icon: 'laptop' },
  { id: 'watch', name: 'ساعة ذكية', nameEn: 'Smart Watch', icon: 'watch' },
  { id: 'printer', name: 'طابعة', nameEn: 'Printer', icon: 'printer' },
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
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = createStyles(COLORS, SHADOWS, isRTL);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Multi-Order State
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // Current Item Selection State
  const [selectedServiceType, setSelectedServiceType] = useState<string>('mobile');
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>('phone');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  
  // Search State
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  
  // Filtered Data
  const [filteredBrands, setFilteredBrands] = useState(BRANDS);
  const [filteredModels, setFilteredModels] = useState<string[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  
  // Location State
  const [location, setLocation] = useState<any>(null);
  const [address, setAddress] = useState('');
  const [showMap, setShowMap] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  const STEPS = language === 'ar' 
    ? ['نوع الخدمة', 'نوع الجهاز', 'الماركة', 'الموديل', 'العطل', 'التفاصيل', 'المراجعة', 'الموقع']
    : ['Service Type', 'Device Type', 'Brand', 'Model', 'Issue', 'Details', 'Review', 'Location'];

  // Guest Check Effect
  useEffect(() => {
    if (!user) {
      Alert.alert(
        language === 'ar' ? 'تسجيل الدخول مطلوب' : 'Login Required',
        language === 'ar' ? 'يجب عليك تسجيل الدخول لرفع طلب صيانة' : 'You must login to submit a repair request',
        [
          { text: language === 'ar' ? 'إلغاء' : 'Cancel', onPress: () => router.back(), style: 'cancel' },
          { text: language === 'ar' ? 'تسجيل الدخول' : 'Login', onPress: () => router.push('/(auth)/login') }
        ]
      );
    }
  }, [user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  // Search Effects
  useEffect(() => {
    const allBrands = searchBrands(brandSearch);
    const filtered = selectedDeviceType 
      ? allBrands.filter(b => b.deviceType === selectedDeviceType)
      : allBrands.filter(b => b.deviceType === 'phone');
    setFilteredBrands(filtered);
  }, [brandSearch, selectedDeviceType]);

  useEffect(() => {
    if (selectedBrand) {
      setFilteredModels(searchModels(selectedBrand.id, modelSearch));
    }
  }, [modelSearch, selectedBrand]);

  useEffect(() => {
    const issues = searchIssues(issueSearch, selectedDeviceType);
    setFilteredIssues(issues);
  }, [issueSearch, selectedDeviceType]);

  useEffect(() => {
    getLocation();
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'نحتاج إذن الوصول للمعرض' : 'We need gallery access permission');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaFiles([...mediaFiles, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'نحتاج إذن الكاميرا' : 'We need camera permission');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaFiles([...mediaFiles, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const removeMedia = (index: number) => {
    const newMediaFiles = [...mediaFiles];
    newMediaFiles.splice(index, 1);
    setMediaFiles(newMediaFiles);
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'نحتاج إذن الموقع' : 'We need location permission');
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      const addresses = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      if (addresses.length > 0) {
        const addr = addresses[0];
        setAddress(`${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleAddItem = () => {
    if (!selectedBrand || !selectedModel || !selectedIssue) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء إكمال جميع الحقول' : 'Please complete all fields');
      return;
    }
    const newItem: OrderItem = {
      deviceType: selectedDeviceType,
      brand: selectedBrand,
      model: selectedModel,
      issue: selectedIssue,
      description: issueDescription,
      mediaFiles: [...mediaFiles]
    };
    setOrderItems([...orderItems, newItem]);
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedIssue(null);
    setIssueDescription('');
    setMediaFiles([]);
    setCurrentStep(6);
  };

  const handleAddNewItem = () => {
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedIssue(null);
    setIssueDescription('');
    setMediaFiles([]);
    setCurrentStep(1);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
    if (newItems.length === 0) {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء تحديد الموقع' : 'Please select location');
      return;
    }

    try {
      // Upload media files first
      const uploadedFiles = [];
      for (const uri of mediaFiles) {
        const path = await storage.uploadImage(uri, 'requests');
        if (path) uploadedFiles.push(path);
      }

      // Create request object
      const requestData = {
        service_type: selectedServiceType,
        device_type: orderItems[0].deviceType, // Main device type
        device_brand: orderItems[0].brand.name,
        device_model: orderItems[0].model,
        issue_type: orderItems[0].issue.id,
        description: orderItems[0].description,
        media_urls: uploadedFiles,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address
        },
        status: 'pending',
        items: orderItems // Store all items
      };

      await addRequest(requestData);
      
      Alert.alert(
        language === 'ar' ? 'تم بنجاح' : 'Success',
        language === 'ar' ? 'تم إرسال طلبك بنجاح' : 'Your request has been submitted successfully',
        [{ text: 'OK', onPress: () => router.push('/(customer)/orders') }]
      );
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'حدث خطأ أثناء إرسال الطلب' : 'Error submitting request');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Service Type
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر نوع الخدمة' : 'Select Service Type'}</Text>
            {SERVICE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.optionCard,
                  selectedServiceType === type.id && styles.selectedOptionCard
                ]}
                onPress={() => setSelectedServiceType(type.id)}
              >
                <MaterialCommunityIcons 
                  name={type.icon as any} 
                  size={32} 
                  color={selectedServiceType === type.id ? COLORS.primary : COLORS.textSecondary} 
                />
                <View style={styles.optionTextContainer}>
                  <Text style={[
                    styles.optionTitle,
                    selectedServiceType === type.id && styles.selectedOptionTitle
                  ]}>
                    {language === 'ar' ? type.name : type.nameEn}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {language === 'ar' ? type.description : type.descriptionEn}
                  </Text>
                </View>
                <MaterialIcons 
                  name={selectedServiceType === type.id ? "radio-button-checked" : "radio-button-unchecked"} 
                  size={24} 
                  color={selectedServiceType === type.id ? COLORS.primary : COLORS.textSecondary} 
                />
              </TouchableOpacity>
            ))}
          </View>
        );

      case 1: // Device Type
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر نوع الجهاز' : 'Select Device Type'}</Text>
            <View style={styles.gridContainer}>
              {DEVICE_TYPES.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={[
                    styles.gridItem,
                    selectedDeviceType === device.id && styles.selectedGridItem
                  ]}
                  onPress={() => setSelectedDeviceType(device.id)}
                >
                  <MaterialCommunityIcons 
                    name={device.icon as any} 
                    size={32} 
                    color={selectedDeviceType === device.id ? COLORS.primary : COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.gridLabel,
                    selectedDeviceType === device.id && styles.selectedGridLabel
                  ]}>
                    {language === 'ar' ? device.name : device.nameEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 2: // Brand
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر الماركة' : 'Select Brand'}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'ar' ? 'بحث عن ماركة...' : 'Search brand...'}
              value={brandSearch}
              onChangeText={setBrandSearch}
            />
            <ScrollView style={styles.listContainer}>
              {filteredBrands.map((brand) => (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.listItem,
                    selectedBrand?.id === brand.id && styles.selectedListItem
                  ]}
                  onPress={() => setSelectedBrand(brand)}
                >
                  <BrandLogo brandName={brand.name} size={40} />
                  <Text style={[
                    styles.listItemText,
                    selectedBrand?.id === brand.id && styles.selectedListItemText
                  ]}>
                    {brand.name}
                  </Text>
                  {selectedBrand?.id === brand.id && (
                    <MaterialIcons name="check" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 3: // Model
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر الموديل' : 'Select Model'}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'ar' ? 'بحث عن موديل...' : 'Search model...'}
              value={modelSearch}
              onChangeText={setModelSearch}
            />
            <ScrollView style={styles.listContainer}>
              {filteredModels.map((model, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.listItem,
                    selectedModel === model && styles.selectedListItem
                  ]}
                  onPress={() => setSelectedModel(model)}
                >
                  <Text style={[
                    styles.listItemText,
                    selectedModel === model && styles.selectedListItemText
                  ]}>
                    {model}
                  </Text>
                  {selectedModel === model && (
                    <MaterialIcons name="check" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 4: // Issue
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر العطل' : 'Select Issue'}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'ar' ? 'بحث عن عطل...' : 'Search issue...'}
              value={issueSearch}
              onChangeText={setIssueSearch}
            />
            <ScrollView style={styles.listContainer}>
              {filteredIssues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={[
                    styles.listItem,
                    selectedIssue?.id === issue.id && styles.selectedListItem
                  ]}
                  onPress={() => setSelectedIssue(issue)}
                >
                  <View style={styles.issueInfoContainer}>
                    <MaterialCommunityIcons 
                      name={issue.icon as any} 
                      size={24} 
                      color={selectedIssue?.id === issue.id ? COLORS.primary : COLORS.textSecondary} 
                      style={styles.issueIcon}
                    />
                    <View>
                      <Text style={[
                        styles.listItemText,
                        selectedIssue?.id === issue.id && styles.selectedListItemText
                      ]}>
                        {language === 'ar' ? issue.nameAr : issue.name}
                      </Text>
                      <Text style={styles.priceRangeText}>
                        {issue.priceRange 
                          ? `${issue.priceRange.min} - ${issue.priceRange.max} ${language === 'ar' ? 'ريال' : 'SAR'}`
                          : `${issue.estimatedPrice} ${language === 'ar' ? 'ريال' : 'SAR'}`
                        }
                      </Text>
                    </View>
                  </View>
                  {selectedIssue?.id === issue.id && (
                    <MaterialIcons name="check" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 5: // Details
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'تفاصيل إضافية' : 'Additional Details'}</Text>
            <TextInput
              style={styles.textArea}
              placeholder={language === 'ar' ? 'وصف المشكلة بالتفصيل...' : 'Describe the issue in detail...'}
              value={issueDescription}
              onChangeText={setIssueDescription}
              multiline
              numberOfLines={4}
            />
            
            <Text style={styles.sectionTitle}>{language === 'ar' ? 'صور/فيديو للمشكلة' : 'Photos/Video of the issue'}</Text>
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                <MaterialIcons name="camera-alt" size={24} color={COLORS.primary} />
                <Text style={styles.mediaButtonText}>{language === 'ar' ? 'كاميرا' : 'Camera'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                <MaterialIcons name="photo-library" size={24} color={COLORS.primary} />
                <Text style={styles.mediaButtonText}>{language === 'ar' ? 'معرض' : 'Gallery'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal style={styles.mediaPreview}>
              {mediaFiles.map((uri, index) => (
                <View key={index} style={styles.mediaItem}>
                  <Image source={{ uri }} style={styles.mediaImage} />
                  <TouchableOpacity 
                    style={styles.removeMediaButton}
                    onPress={() => removeMedia(index)}
                  >
                    <MaterialIcons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        );

      case 6: // Review
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'مراجعة الطلب' : 'Review Order'}</Text>
            <ScrollView style={styles.reviewContainer}>
              {orderItems.map((item, index) => (
                <View key={index} style={[styles.reviewCard, SHADOWS.small]}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewDeviceName}>{item.brand.name} {item.model}</Text>
                    <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                      <MaterialIcons name="delete-outline" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.reviewDetail}>
                    {language === 'ar' ? 'العطل:' : 'Issue:'} {language === 'ar' ? item.issue.nameAr : item.issue.name}
                  </Text>
                  <Text style={styles.reviewPrice}>
                    {language === 'ar' ? 'السعر التقديري:' : 'Est. Price:'} {item.issue.priceRange?.min} - {item.issue.priceRange?.max} {language === 'ar' ? 'ريال' : 'SAR'}
                  </Text>
                </View>
              ))}
              
              <TouchableOpacity style={styles.addMoreButton} onPress={handleAddNewItem}>
                <MaterialIcons name="add-circle-outline" size={24} color={COLORS.primary} />
                <Text style={styles.addMoreText}>{language === 'ar' ? 'إضافة جهاز آخر' : 'Add Another Device'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        );

      case 7: // Location
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{language === 'ar' ? 'تحديد الموقع' : 'Select Location'}</Text>
            <View style={styles.mapContainer}>
              {location ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={location}
                  onRegionChangeComplete={(region) => {
                    setLocation({ ...location, ...region });
                    // Reverse geocode logic here if needed
                  }}
                >
                  <Marker coordinate={location} />
                </MapView>
              ) : (
                <View style={styles.loadingMap}>
                  <Text>{language === 'ar' ? 'جاري تحديد الموقع...' : 'Locating...'}</Text>
                </View>
              )}
              
              {/* Current Location Button */}
              <TouchableOpacity 
                style={styles.myLocationButton}
                onPress={getLocation}
              >
                <MaterialIcons name="my-location" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>{language === 'ar' ? 'العنوان:' : 'Address:'}</Text>
              <Text style={styles.addressText}>{address || (language === 'ar' ? 'جاري التحميل...' : 'Loading...')}</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{language === 'ar' ? 'طلب صيانة' : 'Repair Request'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${((currentStep + 1) / STEPS.length) * 100}%` }]} />
      </View>
      <Text style={styles.stepIndicator}>
        {STEPS[currentStep]} ({currentStep + 1}/{STEPS.length})
      </Text>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {renderStepContent()}
      </Animated.View>

      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Text style={styles.secondaryButtonText}>{language === 'ar' ? 'السابق' : 'Back'}</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.primaryButton, currentStep === 0 && { flex: 1 }]} 
          onPress={() => {
            if (currentStep === 5) {
              handleAddItem();
            } else if (currentStep === STEPS.length - 1) {
              handleSubmit();
            } else {
              setCurrentStep(currentStep + 1);
            }
          }}
        >
          <Text style={styles.primaryButtonText}>
            {currentStep === 5 
              ? (language === 'ar' ? 'إضافة للمراجعة' : 'Add to Review')
              : currentStep === STEPS.length - 1 
                ? (language === 'ar' ? 'إرسال الطلب' : 'Submit Request')
                : (language === 'ar' ? 'التالي' : 'Next')
            }
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  progressContainer: {
    height: 4,
    backgroundColor: COLORS.border,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  stepIndicator: {
    textAlign: 'center',
    padding: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: isRTL ? 'right' : 'left',
  },
  optionCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  selectedOptionCard: {
    borderColor: COLORS.primary,
    backgroundColor: isRTL ? COLORS.surface : COLORS.surface, // Can add tint if needed
  },
  optionTextContainer: {
    flex: 1,
    marginHorizontal: SPACING.md,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  selectedOptionTitle: {
    color: COLORS.primary,
  },
  optionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
  },
  gridContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  selectedGridItem: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10', // 10% opacity
  },
  gridLabel: {
    marginTop: SPACING.sm,
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  selectedGridLabel: {
    color: COLORS.primary,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: isRTL ? 'right' : 'left',
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedListItem: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    textAlign: isRTL ? 'right' : 'left',
  },
  selectedListItemText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  issueInfoContainer: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  issueIcon: {
    marginLeft: isRTL ? SPACING.md : 0,
    marginRight: isRTL ? 0 : SPACING.md,
  },
  priceRangeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  textArea: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 100,
    textAlignVertical: 'top',
    textAlign: isRTL ? 'right' : 'left',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: isRTL ? 'right' : 'left',
  },
  mediaButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginBottom: SPACING.md,
  },
  mediaButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mediaButtonText: {
    marginLeft: isRTL ? 0 : SPACING.sm,
    marginRight: isRTL ? SPACING.sm : 0,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  mediaPreview: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginBottom: SPACING.lg,
  },
  mediaItem: {
    marginRight: isRTL ? 0 : SPACING.sm,
    marginLeft: isRTL ? SPACING.sm : 0,
    position: 'relative',
  },
  mediaImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewContainer: {
    flex: 1,
  },
  reviewCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  reviewHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reviewDeviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  reviewDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  reviewPrice: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
    textAlign: isRTL ? 'right' : 'left',
  },
  addMoreButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    borderStyle: 'dashed',
    marginTop: SPACING.sm,
  },
  addMoreText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    marginLeft: isRTL ? 0 : SPACING.sm,
    marginRight: isRTL ? SPACING.sm : 0,
  },
  mapContainer: {
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 24,
    ...SHADOWS.medium,
  },
  addressContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  addressText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  footer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginLeft: isRTL ? 0 : SPACING.sm,
    marginRight: isRTL ? SPACING.sm : 0,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
