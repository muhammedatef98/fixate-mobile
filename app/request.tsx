import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions, TextInput, Animated, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRequests } from '../contexts/RequestContext';
import { requests, storage, auth } from '../lib/supabase-api';
import { BrandLogo } from '../components/BrandLogo';
import { BRANDS, ISSUES, searchBrands, searchModels, searchIssues, Brand, Issue } from '../constants/repairData';
import { useApp } from '../contexts/AppContext';

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
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Multi-Order State
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(true); // Start in adding mode

  // Current Item Selection State
  const [selectedServiceType, setSelectedServiceType] = useState<string>('mobile'); // Global for order
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
  const [filteredIssues, setFilteredIssues] = useState(ISSUES);
  
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
    // Filter brands by selected device type
    const filtered = selectedDeviceType 
      ? allBrands.filter(b => b.deviceType === selectedDeviceType)
      : allBrands.filter(b => b.deviceType === 'phone'); // Default to phone
    setFilteredBrands(filtered);
  }, [brandSearch, selectedDeviceType]);

  useEffect(() => {
    if (selectedBrand) {
      setFilteredModels(searchModels(selectedBrand.id, modelSearch));
    }
  }, [modelSearch, selectedBrand]);

  useEffect(() => {
    setFilteredIssues(searchIssues(issueSearch, language));
  }, [issueSearch, language]);

  useEffect(() => {
    getLocation();
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'ar' ? 'تنبيه' : 'Alert',
          language === 'ar' ? 'نحتاج إذن الوصول للمعرض' : 'We need gallery access permission'
        );
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
        Alert.alert(
          language === 'ar' ? 'تنبيه' : 'Alert',
          language === 'ar' ? 'نحتاج إذن الكاميرا' : 'We need camera permission'
        );
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
        Alert.alert(
          language === 'ar' ? 'تنبيه' : 'Alert',
          language === 'ar' ? 'نحتاج إذن الموقع لتحديد موقعك' : 'We need location permission to determine your location'
        );
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
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ في تحديد الموقع. يرجى المحاولة مرة أخرى.' : 'Error getting location. Please try again.'
      );
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
    
    // Reset fields for next item
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedIssue(null);
    setIssueDescription('');
    setMediaFiles([]);
    
    // Go to review step (Step 6)
    setCurrentStep(6);
  };

  const handleAddNewItem = () => {
    // Reset fields
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedIssue(null);
    setIssueDescription('');
    setMediaFiles([]);
    
    // Go back to device type selection (Step 1)
    setCurrentStep(1);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
    
    if (newItems.length === 0) {
      setCurrentStep(1); // Go back to start if no items left
    }
  };

  const handleNext = () => {
    // Step 0: Service Type
    // Step 1: Device Type
    if (currentStep === 2 && !selectedBrand) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء اختيار الماركة' : 'Please select a brand');
      return;
    }
    if (currentStep === 3 && !selectedModel) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء اختيار الموديل' : 'Please select a model');
      return;
    }
    if (currentStep === 4 && !selectedIssue) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء اختيار العطل' : 'Please select an issue');
      return;
    }

    // If at details step (5), add item and go to review
    if (currentStep === 5) {
      handleAddItem();
      return;
    }

    if (currentStep < STEPS.length - 1) {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const submitRequest = async () => {
    if (!location) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء تحديد الموقع' : 'Please select a location');
      return;
    }

    if (orderItems.length === 0) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء إضافة جهاز واحد على الأقل' : 'Please add at least one device');
      return;
    }

    try {
      const user = await auth.getCurrentUser();
      
      if (user) {
        // Upload media files for all items
        const itemsWithMedia = await Promise.all(orderItems.map(async (item, index) => {
          let uploadedUrls: string[] = [];
          if (item.mediaFiles.length > 0) {
            for (let i = 0; i < item.mediaFiles.length; i++) {
              try {
                const uri = item.mediaFiles[i];
                const fileName = `order-${Date.now()}-${index}-${i}.jpg`;
                const url = await storage.uploadImageFromUri('orders', uri, fileName);
                uploadedUrls.push(url);
              } catch (uploadError) {
                console.error('Error uploading file:', uploadError);
              }
            }
          }
          return { ...item, mediaFiles: uploadedUrls };
        }));

        // Create main order
        // Use first item details for backward compatibility/preview
        const firstItem = itemsWithMedia[0];
        const order = await requests.create({
          user_id: user.id,
          service_id: firstItem.issue.id,
          service_type: selectedServiceType,
          device_brand: firstItem.brand.name,
          device_model: firstItem.model,
          issue_description: firstItem.description,
          status: 'pending',
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: address
          },
          images: firstItem.mediaFiles,
          price: firstItem.issue.priceRange.min, // Initial estimate
          created_at: new Date().toISOString(),
          // Store all items in metadata or separate table if needed
          items: itemsWithMedia
        });

        // Add to context
        addRequest(order);

        Alert.alert(
          language === 'ar' ? 'تم بنجاح' : 'Success',
          language === 'ar' ? 'تم إرسال طلبك بنجاح!' : 'Your request has been sent successfully!',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(customer)/orders')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء إرسال الطلب' : 'Error submitting request'
      );
    }
  };

  // Render Steps
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Service Type
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'اختر نوع الخدمة' : 'Select Service Type'}
            </Text>
            {SERVICE_TYPES.map((service) => (
              <TouchableOpacity
                key={service.id}
              style={[
                styles.optionCard,
                selectedServiceType === type.id && styles.selectedOptionCard,
                SHADOWS.neuFlat
              ]}
                onPress={() => setSelectedServiceType(service.id)}
              >
                <View style={[
                  styles.iconContainer,
                  selectedServiceType === service.id && styles.selectedIconContainer
                ]}>
                  <MaterialCommunityIcons 
                    name={service.icon as any} 
                    size={32} 
                    color={selectedServiceType === service.id ? '#FFFFFF' : COLORS.primary} 
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionTitle,
                    selectedServiceType === service.id && styles.selectedOptionText
                  ]}>
                    {language === 'ar' ? service.name : service.nameEn}
                  </Text>
                  <Text style={[
                    styles.optionDescription,
                    selectedServiceType === service.id && styles.selectedOptionText
                  ]}>
                    {language === 'ar' ? service.description : service.descriptionEn}
                  </Text>
                </View>
                {selectedServiceType === service.id && (
                  <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 1: // Device Type
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'اختر نوع الجهاز' : 'Select Device Type'}
            </Text>
            <View style={styles.gridContainer}>
              {DEVICE_TYPES.map((device) => (
                <TouchableOpacity
                  key={device.id}
              style={[
                styles.gridItem,
                selectedDeviceType === type.id && styles.selectedGridItem,
                SHADOWS.neuFlat
              ]}
                  onPress={() => setSelectedDeviceType(device.id)}
                >
                  <MaterialCommunityIcons 
                    name={device.icon as any} 
                    size={40} 
                    color={selectedDeviceType === device.id ? '#FFFFFF' : COLORS.primary} 
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
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'اختر الماركة' : 'Select Brand'}
            </Text>
        <TextInput
          style={[styles.searchInput, SHADOWS.neuInner]}
              placeholder={language === 'ar' ? 'بحث عن ماركة...' : 'Search brand...'}
              placeholderTextColor={COLORS.textLight}
              value={brandSearch}
              onChangeText={setBrandSearch}
              textAlign={language === 'ar' ? 'right' : 'left'}
            />
            <ScrollView style={styles.listContainer}>
              {filteredBrands.map((brand) => (
                <TouchableOpacity
                  key={brand.id}
              style={[
                styles.listItem,
                selectedBrand?.id === item.id && styles.selectedListItem,
                SHADOWS.neuFlat
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
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'اختر الموديل' : 'Select Model'}
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'ar' ? 'بحث عن موديل...' : 'Search model...'}
              placeholderTextColor={COLORS.textLight}
              value={modelSearch}
              onChangeText={setModelSearch}
              textAlign={language === 'ar' ? 'right' : 'left'}
            />
            <ScrollView style={styles.listContainer}>
              {filteredModels.map((model) => (
                <TouchableOpacity
                  key={model}
              style={[
                styles.listItem,
                selectedModel === item && styles.selectedListItem,
                SHADOWS.neuFlat
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
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'اختر العطل' : 'Select Issue'}
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'ar' ? 'بحث عن عطل...' : 'Search issue...'}
              placeholderTextColor={COLORS.textLight}
              value={issueSearch}
              onChangeText={setIssueSearch}
              textAlign={language === 'ar' ? 'right' : 'left'}
            />
            <ScrollView style={styles.listContainer}>
              {filteredIssues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
              style={[
                styles.listItem,
                selectedIssue?.id === item.id && styles.selectedListItem,
                SHADOWS.neuFlat
              ]}
                  onPress={() => setSelectedIssue(issue)}
                >
                  <View style={styles.issueInfo}>
                    <Text style={[
                      styles.listItemText,
                      selectedIssue?.id === issue.id && styles.selectedListItemText
                    ]}>
                      {language === 'ar' ? issue.nameAr : issue.nameEn}
                    </Text>
                    <Text style={styles.priceRange}>
                      {issue.priceRange.min} - {issue.priceRange.max} {language === 'ar' ? 'ريال' : 'SAR'}
                    </Text>
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
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'تفاصيل إضافية' : 'Additional Details'}
            </Text>
            
            <Text style={styles.label}>
              {language === 'ar' ? 'وصف المشكلة' : 'Issue Description'}
            </Text>
        <TextInput
          style={[styles.textArea, SHADOWS.neuInner]}
              placeholder={language === 'ar' ? 'اشرح المشكلة بالتفصيل...' : 'Describe the issue in detail...'}
              placeholderTextColor={COLORS.textLight}
              value={issueDescription}
              onChangeText={setIssueDescription}
              multiline
              numberOfLines={4}
              textAlign={language === 'ar' ? 'right' : 'left'}
            />

            <Text style={styles.label}>
              {language === 'ar' ? 'صور أو فيديو (اختياري)' : 'Photos or Video (Optional)'}
            </Text>
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={[styles.mediaButton, SHADOWS.neuFlat]} onPress={takePhoto}>
                <MaterialIcons name="camera-alt" size={24} color={COLORS.primary} />
                <Text style={styles.mediaButtonText}>
                  {language === 'ar' ? 'التقاط صورة' : 'Take Photo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mediaButton, SHADOWS.neuFlat]} onPress={pickImage}>
                <MaterialIcons name="photo-library" size={24} color={COLORS.primary} />
                <Text style={styles.mediaButtonText}>
                  {language === 'ar' ? 'من المعرض' : 'From Gallery'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal style={styles.mediaPreview}>
              {mediaFiles.map((uri, index) => (
                <View key={index} style={styles.previewItem}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeMedia}
                    onPress={() => removeMedia(index)}
                  >
                    <MaterialIcons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        );

      case 6: // Review & Add More
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'مراجعة الطلب' : 'Review Order'}
            </Text>
            
            <ScrollView style={styles.reviewList}>
              {orderItems.map((item, index) => (
                <View key={index} style={[styles.reviewItem, SHADOWS.neuFlat]}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewDevice}>
                      {item.brand.name} {item.model}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                      <MaterialIcons name="delete" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.reviewIssue}>
                    {language === 'ar' ? item.issue.nameAr : item.issue.nameEn}
                  </Text>
                  <Text style={styles.reviewPrice}>
                    {item.issue.priceRange.min} - {item.issue.priceRange.max} {language === 'ar' ? 'ريال' : 'SAR'}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.addMoreButton}
              onPress={handleAddNewItem}
            >
              <MaterialIcons name="add-circle-outline" size={24} color={COLORS.primary} />
              <Text style={styles.addMoreText}>
                {language === 'ar' ? 'إضافة جهاز آخر' : 'Add Another Device'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 7: // Location
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>
              {language === 'ar' ? 'تحديد الموقع' : 'Select Location'}
            </Text>
            
            <View style={[styles.mapContainer, SHADOWS.neuFlat]}>
              {location ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  region={location}
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
            </View>

            <View style={[styles.addressContainer, SHADOWS.neuFlat]}>
              <MaterialIcons name="location-on" size={24} color={COLORS.primary} />
              <Text style={styles.addressText}>
                {address || (language === 'ar' ? 'جاري تحديد العنوان...' : 'Locating address...')}
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, SHADOWS.neuFlat]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons 
            name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? 'طلب جديد' : 'New Request'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {STEPS.map((_, index) => (
          <View key={index} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              index <= currentStep && styles.progressDotActive
            ]} />
            {index < STEPS.length - 1 && (
              <View style={[
                styles.progressLine,
                index < currentStep && styles.progressLineActive
              ]} />
            )}
          </View>
        ))}
      </View>

      {/* Content */}
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {renderStepContent()}
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.nextButton}
          onPress={currentStep === STEPS.length - 1 ? submitRequest : handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === STEPS.length - 1 
              ? (language === 'ar' ? 'إرسال الطلب' : 'Submit Request')
              : (currentStep === 5 ? (language === 'ar' ? 'إضافة ومراجعة' : 'Add & Review') : (language === 'ar' ? 'التالي' : 'Next'))
            }
          </Text>
          {currentStep < STEPS.length - 1 && (
            <MaterialIcons 
              name={language === 'ar' ? 'arrow-back' : 'arrow-forward'} 
              size={24} 
              color="#FFFFFF" 
            />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, SHADOWS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.2 }],
  },
  progressLine: {
    width: 30,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 2,
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: SPACING.lg,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  selectedOptionCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  selectedIconContainer: {
    backgroundColor: COLORS.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  selectedOptionText: {
    color: COLORS.primary,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  gridItem: {
    width: (width - SPACING.lg * 3) / 2,
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedGridItem: {
    backgroundColor: COLORS.primary,
  },
  gridLabel: {
    marginTop: SPACING.md,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedGridLabel: {
    color: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  selectedListItem: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
  selectedListItemText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  issueInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  priceRange: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  textArea: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    height: 120,
    textAlignVertical: 'top',
    color: COLORS.text,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  mediaButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  mediaPreview: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  previewItem: {
    marginRight: SPACING.md,
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  removeMedia: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 4,
  },
  reviewList: {
    flex: 1,
    marginBottom: SPACING.lg,
  },
  reviewItem: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reviewDevice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  reviewIssue: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reviewPrice: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    borderStyle: 'dashed',
    gap: SPACING.sm,
  },
  addMoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  mapContainer: {
    height: 300,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  footer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.md,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
