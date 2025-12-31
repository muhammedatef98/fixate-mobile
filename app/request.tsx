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
  
  // Force light theme colors for this specific design as per screenshot
  const COLORS = {
    primary: '#10b981', // Green
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
  
  // Multi-Order State
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // Current Item Selection State
  const [selectedServiceType, setSelectedServiceType] = useState<string>('mobile');
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
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
  const [isLocating, setIsLocating] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  const STEPS = language === 'ar' 
    ? ['الخدمة', 'الجهاز', 'الماركة', 'الموديل', 'العطل', 'التفاصيل', 'الموقع']
    : ['Service', 'Device', 'Brand', 'Model', 'Issue', 'Details', 'Location'];

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
    if (selectedDeviceType) {
      const results = searchBrands(brandSearch, selectedDeviceType);
      setFilteredBrands(results);
    }
  }, [brandSearch, selectedDeviceType]);

  useEffect(() => {
    if (selectedBrand) {
      setFilteredModels(searchModels(selectedBrand.id, modelSearch));
    }
  }, [modelSearch, selectedBrand]);

  useEffect(() => {
    if (selectedDeviceType) {
      const results = searchIssues(selectedDeviceType, issueSearch);
      setFilteredIssues(results);
    }
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
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'نحتاج إذن الموقع' : 'We need location permission');
        setIsLocating(false);
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
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'فشل تحديد الموقع' : 'Failed to get location');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء تحديد الموقع' : 'Please select location');
      return;
    }

    if (!selectedDeviceType || !selectedBrand || !selectedModel || !selectedIssue) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'الرجاء إكمال جميع الحقول' : 'Please complete all fields');
      return;
    }

    try {
      const finalItems = [{
        deviceType: selectedDeviceType,
        brand: selectedBrand,
        model: selectedModel,
        issue: selectedIssue,
        description: issueDescription,
        mediaFiles: [...mediaFiles]
      }];

      // Upload media files first
      const uploadedFiles = [];
      for (const item of finalItems) {
        for (const uri of item.mediaFiles) {
          const path = await storage.uploadImage(uri, 'requests');
          if (path) uploadedFiles.push(path);
        }
      }

      // Create request object
      const requestData = {
        service_type: selectedServiceType,
        device_type: finalItems[0].deviceType,
        device_brand: finalItems[0].brand.name,
        device_model: finalItems[0].model,
        issue_type: finalItems[0].issue.id,
        description: finalItems[0].description,
        media_urls: uploadedFiles,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address
        },
        status: 'pending',
        customer_id: user?.id,
        created_at: new Date().toISOString(),
        items: finalItems
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
    <View style={styles.stepperContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepperContent}>
        {STEPS.map((step, index) => (
          <View key={index} style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              index <= currentStep && styles.activeStepCircle,
              index === currentStep && styles.currentStepCircle
            ]}>
              {index < currentStep ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text style={[
                  styles.stepNumber,
                  index === currentStep && styles.activeStepNumber
                ]}>{index + 1}</Text>
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              index <= currentStep && styles.activeStepLabel
            ]}>{step}</Text>
            {index < STEPS.length - 1 && (
              <View style={[
                styles.stepLine,
                index < currentStep && styles.activeStepLine
              ]} />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderServiceType = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{language === 'ar' ? 'اختر نوع الخدمة' : 'Select Service Type'}</Text>
      <Text style={styles.stepSubtitle}>{language === 'ar' ? 'كيف تريد إصلاح جهازك؟' : 'How do you want to fix your device?'}</Text>
      
      {SERVICE_TYPES.map((type) => (
        <TouchableOpacity
          key={type.id}
          style={[
            styles.largeOptionCard,
            selectedServiceType === type.id && styles.selectedLargeOptionCard
          ]}
          onPress={() => setSelectedServiceType(type.id)}
        >
          <View style={styles.largeOptionContent}>
            <View style={styles.largeOptionIconContainer}>
              <MaterialCommunityIcons 
                name={type.icon as any} 
                size={40} 
                color={selectedServiceType === type.id ? COLORS.primary : COLORS.gray} 
              />
            </View>
            <View style={styles.largeOptionTextContainer}>
              <Text style={[
                styles.largeOptionTitle,
                selectedServiceType === type.id && styles.selectedLargeOptionTitle
              ]}>
                {language === 'ar' ? type.name : type.nameEn}
              </Text>
              <Text style={styles.largeOptionDescription}>
                {language === 'ar' ? type.description : type.descriptionEn}
              </Text>
            </View>
            {selectedServiceType === type.id && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity 
        style={styles.bottomButton}
        onPress={() => setCurrentStep(currentStep + 1)}
      >
        <Text style={styles.bottomButtonText}>{language === 'ar' ? 'التالي' : 'Next'}</Text>
        <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color="#fff" />
      </TouchableOpacity>
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
            onPress={() => setSelectedDeviceType(type.id)}
          >
            <MaterialCommunityIcons 
              name={type.icon as any} 
              size={32} 
              color={selectedDeviceType === type.id ? COLORS.primary : COLORS.gray} 
            />
            <Text style={[
              styles.gridTitle,
              selectedDeviceType === type.id && styles.selectedGridTitle
            ]}>
              {language === 'ar' ? type.name : type.nameEn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity 
        style={[styles.bottomButton, !selectedDeviceType && styles.disabledButton]}
        onPress={() => selectedDeviceType && setCurrentStep(currentStep + 1)}
        disabled={!selectedDeviceType}
      >
        <Text style={styles.bottomButtonText}>{language === 'ar' ? 'التالي' : 'Next'}</Text>
        <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color="#fff" />
      </TouchableOpacity>
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
                onPress={() => setSelectedBrand(brand)}
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
      <TouchableOpacity 
        style={[styles.bottomButton, !selectedBrand && styles.disabledButton]}
        onPress={() => selectedBrand && setCurrentStep(currentStep + 1)}
        disabled={!selectedBrand}
      >
        <Text style={styles.bottomButtonText}>{language === 'ar' ? 'التالي' : 'Next'}</Text>
        <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color="#fff" />
      </TouchableOpacity>
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
              onPress={() => setSelectedModel(model)}
            >
              <Text style={[
                styles.listItemText,
                selectedModel === model && styles.selectedListItemText
              ]}>
                {model}
              </Text>
              {selectedModel === model && (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              )}
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
      <TouchableOpacity 
        style={[styles.bottomButton, !selectedModel && styles.disabledButton]}
        onPress={() => selectedModel && setCurrentStep(currentStep + 1)}
        disabled={!selectedModel}
      >
        <Text style={styles.bottomButtonText}>{language === 'ar' ? 'التالي' : 'Next'}</Text>
        <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color="#fff" />
      </TouchableOpacity>
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
              onPress={() => setSelectedIssue(issue)}
            >
              <View style={styles.issueHeader}>
                <View style={styles.issueInfo}>
                  <Text style={[
                    styles.issueName,
                    selectedIssue?.id === issue.id && styles.selectedIssueName
                  ]}>
                    {language === 'ar' ? issue.nameAr : issue.name}
                  </Text>
                  <View style={styles.priceContainer}>
                    <Text style={[
                      styles.issuePrice,
                      selectedIssue?.id === issue.id && styles.selectedIssuePrice
                    ]}>
                      {issue.id.startsWith('other') 
                        ? (language === 'ar' ? 'حسب العطل سيتم التقدير' : 'Price will be estimated based on issue')
                        : (issue.priceRange ? `${issue.priceRange.min} - ${issue.priceRange.max} ${language === 'ar' ? 'ريال' : 'SAR'}` : `${issue.estimatedPrice} ${language === 'ar' ? 'ريال' : 'SAR'}`)
                      }
                    </Text>
                    {!issue.id.startsWith('other') && (
                      <Text style={styles.priceLabel}>
                        {language === 'ar' ? '(سعر تقديري)' : '(Est. Price)'}
                      </Text>
                    )}
                  </View>
                </View>
                {selectedIssue?.id === issue.id && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                )}
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
      <TouchableOpacity 
        style={[styles.bottomButton, !selectedIssue && styles.disabledButton]}
        onPress={() => selectedIssue && setCurrentStep(currentStep + 1)}
        disabled={!selectedIssue}
      >
        <Text style={styles.bottomButtonText}>{language === 'ar' ? 'التالي' : 'Next'}</Text>
        <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color="#fff" />
      </TouchableOpacity>
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
        style={styles.bottomButton}
        onPress={() => setCurrentStep(currentStep + 1)}
      >
        <Text style={styles.bottomButtonText}>{language === 'ar' ? 'التالي' : 'Next'}</Text>
        <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color="#fff" />
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
        
        <TouchableOpacity 
          style={styles.locateButton}
          onPress={getLocation}
        >
          <Ionicons name="locate" size={24} color={COLORS.primary} />
        </TouchableOpacity>
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
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
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
        {currentStep === 6 && renderLocation()}
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  stepperContainer: {
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  stepperContent: {
    paddingHorizontal: 20,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  activeStepCircle: {
    backgroundColor: COLORS.primary,
  },
  currentStepCircle: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  stepNumber: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  activeStepNumber: {
    color: COLORS.primary,
  },
  stepLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  activeStepLabel: {
    color: COLORS.text,
    fontWeight: '600',
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  activeStepLine: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: isRTL ? 'right' : 'left',
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 24,
    textAlign: isRTL ? 'right' : 'left',
  },
  largeOptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedLargeOptionCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightGreen,
    borderWidth: 2,
  },
  largeOptionContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  largeOptionIconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeOptionTextContainer: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  largeOptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  selectedLargeOptionTitle: {
    color: COLORS.primary,
  },
  largeOptionDescription: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: isRTL ? 'right' : 'left',
  },
  checkIcon: {
    marginLeft: isRTL ? 0 : 8,
    marginRight: isRTL ? 8 : 0,
  },
  bottomButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gridContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  gridCard: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  selectedGridCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightGreen,
    borderWidth: 2,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
    textAlign: 'center',
  },
  selectedGridTitle: {
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginHorizontal: 8,
    height: '100%',
  },
  listContainer: {
    flex: 1,
  },
  brandCard: {
    width: (width - 56) / 3,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  selectedBrandCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightGreen,
    borderWidth: 2,
  },
  brandLogo: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 12,
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
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedListItem: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightGreen,
    borderWidth: 2,
  },
  listItemText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  selectedListItemText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  issueCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedIssueCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightGreen,
    borderWidth: 2,
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
    color: COLORS.primary,
  },
  priceContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
  },
  issuePrice: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  selectedIssuePrice: {
    color: COLORS.primary,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.gray,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: isRTL ? 'right' : 'left',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  textArea: {
    height: 120,
  },
  mediaButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginBottom: 12,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
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
    marginRight: isRTL ? 0 : 12,
    marginLeft: isRTL ? 12 : 0,
    position: 'relative',
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeMedia: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  locateButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addressContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    textAlign: isRTL ? 'right' : 'left',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
