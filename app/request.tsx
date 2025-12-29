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
  { id: 'console', name: 'ألعاب', nameEn: 'Console', icon: 'gamepad-variant' },
  { id: 'headphones', name: 'سماعات', nameEn: 'Headphones', icon: 'headphones' },
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
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [filteredModels, setFilteredModels] = useState<string[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  
  // Location State
  const [location, setLocation] = useState<any>(null);
  const [address, setAddress] = useState('');
  
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

  // Search Effects - FIXED LOGIC
  useEffect(() => {
    // Pass both query and deviceType to searchBrands
    const results = searchBrands(brandSearch, selectedDeviceType);
    setFilteredBrands(results);
  }, [brandSearch, selectedDeviceType]);

  useEffect(() => {
    if (selectedBrand) {
      setFilteredModels(searchModels(selectedBrand.id, modelSearch));
    }
  }, [modelSearch, selectedBrand]);

  useEffect(() => {
    // Pass deviceType first, then query to searchIssues (matching repairData.ts signature)
    const results = searchIssues(selectedDeviceType, issueSearch);
    setFilteredIssues(results);
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
        customer_id: user?.id,
        created_at: new Date().toISOString(),
        items: orderItems // Store full items list for multi-device orders
      };

      const { data, error } = await requests.create(requestData);

      if (error) throw error;

      addRequest(data);
      
      Alert.alert(
        language === 'ar' ? 'تم بنجاح' : 'Success',
        language === 'ar' ? 'تم إرسال طلبك بنجاح' : 'Your request has been sent successfully',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/orders') }]
      );
    } catch (error: any) {
      console.error('Error submitting request:', error);
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', error.message || 'Failed to submit request');
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill, 
            { 
              width: `${((currentStep + 1) / STEPS.length) * 100}%` 
            }
          ]} 
        />
      </View>
      <Text style={styles.stepText}>
        {STEPS[currentStep]} ({currentStep + 1}/{STEPS.length})
      </Text>
    </View>
  );

  const renderServiceType = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر نوع الخدمة' : 'Select Service Type'}</Text>
      {SERVICE_TYPES.map((type) => (
        <TouchableOpacity
          key={type.id}
          style={[
            styles.optionCard,
            selectedServiceType === type.id && styles.selectedOptionCard
          ]}
          onPress={() => {
            setSelectedServiceType(type.id);
            setCurrentStep(currentStep + 1);
          }}
        >
          <View style={[
            styles.iconContainer,
            selectedServiceType === type.id && styles.selectedIconContainer
          ]}>
            <MaterialCommunityIcons 
              name={type.icon as any} 
              size={32} 
              color={selectedServiceType === type.id ? '#fff' : COLORS.primary} 
            />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={[
              styles.optionTitle,
              selectedServiceType === type.id && styles.selectedOptionText
            ]}>
              {language === 'ar' ? type.name : type.nameEn}
            </Text>
            <Text style={[
              styles.optionDescription,
              selectedServiceType === type.id && styles.selectedOptionDescription
            ]}>
              {language === 'ar' ? type.description : type.descriptionEn}
            </Text>
          </View>
          <Ionicons 
            name={isRTL ? "chevron-back" : "chevron-forward"} 
            size={24} 
            color={selectedServiceType === type.id ? '#fff' : COLORS.gray} 
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDeviceType = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر نوع الجهاز' : 'Select Device Type'}</Text>
      <View style={styles.gridContainer}>
        {DEVICE_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.gridCard,
              selectedDeviceType === type.id && styles.selectedGridCard
            ]}
            onPress={() => {
              setSelectedDeviceType(type.id);
              setCurrentStep(currentStep + 1);
            }}
          >
            <View style={[
              styles.gridIconContainer,
              selectedDeviceType === type.id && styles.selectedGridIconContainer
            ]}>
              <MaterialCommunityIcons 
                name={type.icon as any} 
                size={32} 
                color={selectedDeviceType === type.id ? '#fff' : COLORS.primary} 
              />
            </View>
            <Text style={[
              styles.gridTitle,
              selectedDeviceType === type.id && styles.selectedGridTitle
            ]}>
              {language === 'ar' ? type.name : type.nameEn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderBrandSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر الماركة' : 'Select Brand'}</Text>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'ar' ? 'ابحث عن الماركة...' : 'Search brand...'}
          value={brandSearch}
          onChangeText={setBrandSearch}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>
      <ScrollView style={styles.listContainer}>
        <View style={styles.gridContainer}>
          {filteredBrands.length > 0 ? (
            filteredBrands.map((brand) => (
              <TouchableOpacity
                key={brand.id}
                style={[
                  styles.brandCard,
                  selectedBrand?.id === brand.id && styles.selectedBrandCard
                ]}
                onPress={() => {
                  setSelectedBrand(brand);
                  setCurrentStep(currentStep + 1);
                }}
              >
                <Image 
                  source={{ uri: brand.logo }} 
                  style={styles.brandLogo} 
                  resizeMode="contain"
                />
                <Text style={[
                  styles.brandName,
                  selectedBrand?.id === brand.id && styles.selectedBrandName
                ]}>
                  {language === 'ar' ? brand.nameAr || brand.name : brand.name}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderModelSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر الموديل' : 'Select Model'}</Text>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'ar' ? 'ابحث عن الموديل...' : 'Search model...'}
          value={modelSearch}
          onChangeText={setModelSearch}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>
      <ScrollView style={styles.listContainer}>
        {filteredModels.length > 0 ? (
          filteredModels.map((model, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.listItem,
                selectedModel === model && styles.selectedListItem
              ]}
              onPress={() => {
                setSelectedModel(model);
                setCurrentStep(currentStep + 1);
              }}
            >
              <Text style={[
                styles.listItemText,
                selectedModel === model && styles.selectedListItemText
              ]}>
                {model}
              </Text>
              <Ionicons 
                name={isRTL ? "chevron-back" : "chevron-forward"} 
                size={20} 
                color={selectedModel === model ? '#fff' : COLORS.gray} 
              />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderIssueSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر نوع العطل' : 'Select Issue'}</Text>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'ar' ? 'ابحث عن العطل...' : 'Search issue...'}
          value={issueSearch}
          onChangeText={setIssueSearch}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>
      <ScrollView style={styles.listContainer}>
        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={[
                styles.issueCard,
                selectedIssue?.id === issue.id && styles.selectedIssueCard
              ]}
              onPress={() => {
                setSelectedIssue(issue);
                setCurrentStep(currentStep + 1);
              }}
            >
              <View style={styles.issueHeader}>
                <View style={styles.issueInfo}>
                  <Text style={[
                    styles.issueName,
                    selectedIssue?.id === issue.id && styles.selectedIssueName
                  ]}>
                    {language === 'ar' ? issue.nameAr : issue.name}
                  </Text>
                  <Text style={[
                    styles.issuePrice,
                    selectedIssue?.id === issue.id && styles.selectedIssuePrice
                  ]}>
                    {issue.priceRange ? `${issue.priceRange.min} - ${issue.priceRange.max}` : issue.estimatedPrice} {language === 'ar' ? 'ريال' : 'SAR'}
                  </Text>
                </View>
                <Ionicons 
                  name={isRTL ? "chevron-back" : "chevron-forward"} 
                  size={20} 
                  color={selectedIssue?.id === issue.id ? '#fff' : COLORS.gray} 
                />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderDetails = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'تفاصيل إضافية' : 'Additional Details'}</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{language === 'ar' ? 'وصف المشكلة' : 'Issue Description'}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={language === 'ar' ? 'اشرح المشكلة بالتفصيل...' : 'Describe the issue in detail...'}
          multiline
          numberOfLines={4}
          value={issueDescription}
          onChangeText={setIssueDescription}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{language === 'ar' ? 'صور أو فيديو للمشكلة' : 'Photos or Video of the Issue'}</Text>
        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color={COLORS.primary} />
            <Text style={styles.mediaButtonText}>{language === 'ar' ? 'تصوير' : 'Camera'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Ionicons name="images" size={24} color={COLORS.primary} />
            <Text style={styles.mediaButtonText}>{language === 'ar' ? 'المعرض' : 'Gallery'}</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal style={styles.mediaPreview}>
          {mediaFiles.map((uri, index) => (
            <View key={index} style={styles.mediaItem}>
              <Image source={{ uri }} style={styles.mediaImage} />
              <TouchableOpacity 
                style={styles.removeMedia}
                onPress={() => removeMedia(index)}
              >
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity 
        style={styles.nextButton}
        onPress={handleAddItem}
      >
        <Text style={styles.nextButtonText}>
          {language === 'ar' ? 'إضافة الجهاز' : 'Add Device'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderReview = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'مراجعة الطلب' : 'Review Request'}</Text>
      
      {orderItems.map((item, index) => (
        <View key={index} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewDeviceType}>
              {language === 'ar' 
                ? DEVICE_TYPES.find(d => d.id === item.deviceType)?.name 
                : DEVICE_TYPES.find(d => d.id === item.deviceType)?.nameEn}
            </Text>
            <TouchableOpacity onPress={() => handleRemoveItem(index)}>
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{language === 'ar' ? 'الجهاز:' : 'Device:'}</Text>
            <Text style={styles.reviewValue}>
              {language === 'ar' ? item.brand.nameAr || item.brand.name : item.brand.name} - {item.model}
            </Text>
          </View>
          
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{language === 'ar' ? 'العطل:' : 'Issue:'}</Text>
            <Text style={styles.reviewValue}>
              {language === 'ar' ? item.issue.nameAr : item.issue.name}
            </Text>
          </View>
          
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{language === 'ar' ? 'السعر المتوقع:' : 'Est. Price:'}</Text>
            <Text style={styles.reviewPrice}>
              {item.issue.priceRange ? `${item.issue.priceRange.min} - ${item.issue.priceRange.max}` : item.issue.estimatedPrice} {language === 'ar' ? 'ريال' : 'SAR'}
            </Text>
          </View>
        </View>
      ))}

      <TouchableOpacity 
        style={styles.addMoreButton}
        onPress={handleAddNewItem}
      >
        <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
        <Text style={styles.addMoreText}>
          {language === 'ar' ? 'إضافة جهاز آخر' : 'Add Another Device'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.nextButton}
        onPress={() => setCurrentStep(currentStep + 1)}
      >
        <Text style={styles.nextButtonText}>
          {language === 'ar' ? 'التالي' : 'Next'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLocation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'موقع الخدمة' : 'Service Location'}</Text>
      
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={location}
            onRegionChangeComplete={(region) => {
              setLocation({ ...location, ...region });
              // Reverse geocode to update address
              Location.reverseGeocodeAsync({
                latitude: region.latitude,
                longitude: region.longitude,
              }).then(addresses => {
                if (addresses.length > 0) {
                  const addr = addresses[0];
                  setAddress(`${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`);
                }
              });
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

      <View style={styles.addressContainer}>
        <Ionicons name="location" size={24} color={COLORS.primary} />
        <Text style={styles.addressText}>{address || (language === 'ar' ? 'جاري تحديد العنوان...' : 'Locating address...')}</Text>
      </View>

      <TouchableOpacity 
        style={styles.submitButton}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>
          {language === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (currentStep > 0) {
              setCurrentStep(currentStep - 1);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{language === 'ar' ? 'طلب صيانة' : 'Request Repair'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderStepIndicator()}

      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {currentStep === 0 && renderServiceType()}
        {currentStep === 1 && renderDeviceType()}
        {currentStep === 2 && renderBrandSelection()}
        {currentStep === 3 && renderModelSelection()}
        {currentStep === 4 && renderIssueSelection()}
        {currentStep === 5 && renderDetails()}
        {currentStep === 6 && renderReview()}
        {currentStep === 7 && renderLocation()}
      </Animated.View>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    ...SHADOWS.sm,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  stepIndicator: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: isRTL ? 'left' : 'right',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xl,
    textAlign: isRTL ? 'right' : 'left',
  },
  optionCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  selectedOptionCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: isRTL ? SPACING.md : 0,
    marginRight: isRTL ? 0 : SPACING.md,
  },
  selectedIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  optionTextContainer: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  selectedOptionText: {
    color: '#fff',
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: isRTL ? 'right' : 'left',
  },
  selectedOptionDescription: {
    color: 'rgba(255,255,255,0.8)',
  },
  gridContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  selectedGridCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  gridIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  selectedGridIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  selectedGridTitle: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginHorizontal: SPACING.sm,
    height: '100%',
  },
  listContainer: {
    flex: 1,
  },
  brandCard: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 3,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  selectedBrandCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  brandLogo: {
    width: 48,
    height: 48,
    marginBottom: SPACING.sm,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  selectedBrandName: {
    color: COLORS.primary,
  },
  listItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedListItem: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  listItemText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  selectedListItemText: {
    color: '#fff',
  },
  issueCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  selectedIssueCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  issueHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issueInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  issueName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  selectedIssueName: {
    color: '#fff',
  },
  issuePrice: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  selectedIssuePrice: {
    color: 'rgba(255,255,255,0.9)',
  },
  inputGroup: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: isRTL ? 'right' : 'left',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  textArea: {
    height: 120,
  },
  mediaButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  mediaPreview: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  mediaItem: {
    marginRight: isRTL ? 0 : SPACING.md,
    marginLeft: isRTL ? SPACING.md : 0,
    position: 'relative',
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.md,
  },
  removeMedia: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
    ...SHADOWS.md,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  reviewHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewDeviceType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  reviewRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  reviewLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  reviewValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  reviewPrice: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  addMoreButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    borderStyle: 'dashed',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  addMoreText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  mapContainer: {
    height: 300,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  addressContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    ...SHADOWS.md,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    width: '100%',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
