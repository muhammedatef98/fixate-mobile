import React, { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { auth } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function TechnicianAuthScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const COLORS = {
    primary: '#10b981',
    background: '#f9fafb',
    white: '#ffffff',
    text: '#1f2937',
    gray: '#9ca3af',
    lightGray: '#f3f4f6',
    border: '#e5e7eb',
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await auth.signIn(email, password);
        if (error) throw error;
        router.replace('/(technician)');
      } else {
        const { error } = await auth.signUp(email, password, name, 'technician');
        if (error) throw error;
        Alert.alert(isRTL ? 'نجح' : 'Success', isRTL ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!');
        setIsLogin(true);
      }
    } catch (error: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Green Header Bar */}
      <View style={styles.greenHeader}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.headerBackButton}
              onPress={() => router.back()}
            >
              <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={24} color="#fff" />
              <Text style={styles.headerBackText}>{isRTL ? 'رجوع' : 'Back'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isRTL ? 'بوابة الفنيين' : 'Technician Portal'}</Text>
            <View style={{ width: 80 }} />
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="wrench-cog" size={50} color={COLORS.primary} />
            </View>
            <Text style={styles.brandName}>Fixate</Text>
            <Text style={styles.brandSlogan}>{isRTL ? 'انضم لفريق الفنيين المعتمدين' : 'Join our certified technicians team'}</Text>
          </View>

          {/* Toggle Login/Signup */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, !isLogin && styles.activeToggle]} 
              onPress={() => setIsLogin(false)}
            >
              <Text style={[styles.toggleText, !isLogin && styles.activeToggleText]}>
                {isRTL ? 'إنشاء حساب' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, isLogin && styles.activeToggle]} 
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.toggleText, isLogin && styles.activeToggleText]}>
                {isRTL ? 'تسجيل الدخول' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            {!isLogin && (
              <>
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
                  <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder={isRTL ? 'رقم الجوال' : 'Phone Number'}
                    placeholderTextColor={COLORS.gray}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons name="tools" size={20} color={COLORS.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder={isRTL ? 'التخصص' : 'Specialization'}
                    placeholderTextColor={COLORS.gray}
                    value={specialization}
                    onChangeText={setSpecialization}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              </>
            )}

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

            <TouchableOpacity style={styles.mainButton} onPress={handleAuth} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainButtonText}>
                  {isLogin ? (isRTL ? 'تسجيل الدخول' : 'Login') : (isRTL ? 'إنشاء حساب' : 'Sign Up')}
                </Text>
              )}
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

const createStyles = (COLORS: any, isRTL: boolean) => StyleSheet.create({
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
