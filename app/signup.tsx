import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail } from '../utils/validation';

const { width } = Dimensions.get('window');

export default function SignupScreen() {
  const router = useRouter();
  const { language } = useApp();
  const { signup: authSignup } = useAuth();
  const isRTL = language === 'ar';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [userType, setUserType] = useState<'customer' | 'technician'>('customer');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  
  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState(0);
  const strengthAnim = useRef(new Animated.Value(0)).current;

  const COLORS = {
    primary: '#10b981',
    background: '#f9fafb',
    white: '#ffffff',
    text: '#1f2937',
    gray: '#9ca3af',
    lightGray: '#f3f4f6',
    border: '#e5e7eb',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
  };

  useEffect(() => {
    // Calculate password strength
    let strength = 0;
    if (password.length > 0) {
      if (password.length >= 6) strength += 1;
      if (/[A-Z]/.test(password)) strength += 1;
      if (/[0-9]/.test(password)) strength += 1;
      if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    }
    setPasswordStrength(strength);
    
    Animated.timing(strengthAnim, {
      toValue: strength,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [password]);

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return COLORS.error;
    if (passwordStrength <= 2) return COLORS.warning;
    return COLORS.success;
  };

  const getStrengthText = () => {
    if (password.length === 0) return '';
    if (passwordStrength <= 1) return isRTL ? 'ضعيفة' : 'Weak';
    if (passwordStrength <= 2) return isRTL ? 'متوسطة' : 'Medium';
    return isRTL ? 'قوية' : 'Strong';
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    
    if (name.trim().length < 3) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الاسم يجب أن يكون 3 أحرف على الأقل' : 'Name must be at least 3 characters');
      return;
    }
    
    if (phone.trim().length < 9) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'رقم الجوال غير صحيح' : 'Invalid phone number');
      return;
    }
    
    if (!validateEmail(email)) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    try {
      await authSignup({
        email,
        password,
        name,
        phone,
        role: userType,
      });

      Alert.alert(
        isRTL ? 'تم إنشاء الحساب' : 'Account Created',
        isRTL
          ? 'تم إنشاء حسابك بنجاح!'
          : 'Your account has been created successfully!',
        [
          { text: 'OK', onPress: () => router.replace('/role-selection') }
        ]
      );
    } catch (error: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
    }
  };

  const styles = createStyles(COLORS, isRTL, strengthAnim, getStrengthColor());

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.greenHeader}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.headerBackButton}
              onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}
            >
              <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color="#fff" />
              <Text style={styles.headerBackText}>{isRTL ? 'رجوع' : 'Back'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isRTL ? 'إنشاء حساب' : 'Sign Up'}</Text>
            <View style={{ width: 80 }} />
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../assets/fixate-logo-main.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>Fixate</Text>
            <Text style={styles.brandSlogan}>{isRTL ? 'شريكك الموثوق للصيانة' : 'Your Trusted Repair Partner'}</Text>
          </View>

          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, userType === 'customer' && styles.activeToggle]} 
              onPress={() => setUserType('customer')}
            >
              <Text style={[styles.toggleText, userType === 'customer' && styles.activeToggleText]}>
                {isRTL ? 'عميل' : 'Customer'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, userType === 'technician' && styles.activeToggle]} 
              onPress={() => setUserType('technician')}
            >
              <Text style={[styles.toggleText, userType === 'technician' && styles.activeToggleText]}>
                {isRTL ? 'فني' : 'Technician'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="account-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
                placeholderTextColor={COLORS.gray}
                value={name}
                onChangeText={setName}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'البريد الإلكتروني' : 'Email'}
                placeholderTextColor={COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'رقم الجوال' : 'Phone Number'}
                placeholderTextColor={COLORS.gray}
                value={phone}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '');
                  setPhone(cleaned);
                }}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.gray} />
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'المدينة' : 'City'}
                placeholderTextColor={COLORS.gray}
                value={city}
                onChangeText={setCity}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {userType === 'technician' && (
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="tools" size={20} color={COLORS.gray} />
                <TextInput
                  style={styles.input}
                  placeholder={isRTL ? 'التخصص (مثلاً: صيانة جوالات)' : 'Specialty (e.g. Mobile Repair)'}
                  placeholderTextColor={COLORS.gray}
                  value={specialty}
                  onChangeText={setSpecialty}
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'كلمة المرور' : 'Password'}
                placeholderTextColor={COLORS.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <MaterialCommunityIcons name="lock-outline" size={20} color={COLORS.gray} />
            </View>
            
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarBackground}>
                  <Animated.View 
                    style={[
                      styles.strengthBarActive, 
                      { 
                        width: strengthAnim.interpolate({
                          inputRange: [0, 4],
                          outputRange: ['0%', '100%']
                        }),
                        backgroundColor: getStrengthColor()
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
                  {getStrengthText()}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.mainButton} onPress={handleSignup}>
              <Text style={styles.mainButtonText}>{isRTL ? 'إنشاء حساب' : 'Sign Up'}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <Text style={styles.dividerText}>{isRTL ? 'أو' : 'OR'}</Text>
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialCircle}>
                <Ionicons name="logo-google" size={24} color="#DB4437" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialCircle}>
                <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialCircle}>
                <Ionicons name="logo-apple" size={24} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (COLORS: any, isRTL: boolean, strengthAnim: any, strengthColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  greenHeader: {
    backgroundColor: COLORS.primary,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 50,
  },
  headerBackButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 16,
    overflow: 'hidden',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  brandSlogan: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeToggle: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
  },
  activeToggleText: {
    color: '#fff',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    marginHorizontal: 12,
  },
  strengthContainer: {
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  strengthBarBackground: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthBarActive: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: isRTL ? 'right' : 'left',
  },
  mainButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  socialCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
