import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { auth } from '../../lib/supabase-api';
import * as ImagePicker from 'expo-image-picker';

export default function TechnicianProfileScreen() {
  const router = useRouter();
  const { language, setLanguage, isDark, toggleTheme } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = await auth.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setName(currentUser.user_metadata?.name || '');
        setPhone(currentUser.user_metadata?.phone || '');
        setSpecialty(currentUser.user_metadata?.specialty || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Alert',
        language === 'ar' 
          ? 'نحتاج إلى إذن للوصول إلى معرض الصور' 
          : 'We need permission to access your photo library'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      // TODO: Upload image to storage
      Alert.alert(
        language === 'ar' ? 'نجح' : 'Success',
        language === 'ar' ? 'تم اختيار الصورة' : 'Image selected'
      );
    }
  };

  const handleSaveProfile = () => {
    // TODO: Save profile to database
    Alert.alert(
      language === 'ar' ? 'نجح' : 'Success',
      language === 'ar' ? 'تم حفظ التغييرات' : 'Changes saved successfully'
    );
    setEditMode(false);
  };

  const handleLogout = () => {
    Alert.alert(
      language === 'ar' ? 'تسجيل الخروج' : 'Logout',
      language === 'ar' ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        {
          text: language === 'ar' ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: language === 'ar' ? 'تسجيل الخروج' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              router.replace('/role-selection');
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: COLORS.text }]}>
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.card }, SHADOWS.small]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons 
            name={isRTL ? 'arrow-forward' : 'arrow-back'} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'الملف الشخصي' : 'Profile'}
        </Text>
        <TouchableOpacity onPress={() => setEditMode(!editMode)}>
          <MaterialIcons 
            name={editMode ? 'close' : 'edit'} 
            size={24} 
            color={COLORS.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
            <Image
              source={{
                uri: user?.user_metadata?.avatar_url || 
                  `https://ui-avatars.com/api/?name=${name || 'User'}&background=10B981&color=fff&size=200`
              }}
              style={styles.avatar}
            />
            <View style={[styles.editBadge, { backgroundColor: COLORS.primary }]}>
              <MaterialIcons name="camera-alt" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: COLORS.text }]}>
            {name || (language === 'ar' ? 'فني' : 'Technician')}
          </Text>
          <Text style={[styles.userEmail, { color: COLORS.textSecondary }]}>
            {user?.email}
          </Text>
        </View>

        {/* Profile Info */}
        {editMode ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {language === 'ar' ? 'تعديل المعلومات' : 'Edit Information'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'الاسم' : 'Name'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.card, color: COLORS.text }]}
                value={name}
                onChangeText={setName}
                placeholder={language === 'ar' ? 'أدخل الاسم' : 'Enter name'}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.card, color: COLORS.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder={language === 'ar' ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'التخصص' : 'Specialty'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.card, color: COLORS.text }]}
                value={specialty}
                onChangeText={setSpecialty}
                placeholder={language === 'ar' ? 'أدخل التخصص' : 'Enter specialty'}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: COLORS.primary }]}
              onPress={handleSaveProfile}
            >
              <Text style={styles.saveButtonText}>
                {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              {language === 'ar' ? 'المعلومات الشخصية' : 'Personal Information'}
            </Text>
            
            <View style={[styles.infoCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
              <MaterialIcons name="person" size={20} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                  {language === 'ar' ? 'الاسم' : 'Name'}
                </Text>
                <Text style={[styles.infoValue, { color: COLORS.text }]}>
                  {name || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
              <MaterialIcons name="phone" size={20} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                  {language === 'ar' ? 'رقم الهاتف' : 'Phone'}
                </Text>
                <Text style={[styles.infoValue, { color: COLORS.text }]}>
                  {phone || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
              <MaterialCommunityIcons name="tools" size={20} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>
                  {language === 'ar' ? 'التخصص' : 'Specialty'}
                </Text>
                <Text style={[styles.infoValue, { color: COLORS.text }]}>
                  {specialty || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            {language === 'ar' ? 'الإعدادات' : 'Settings'}
          </Text>

          {/* Availability Toggle */}
          <View style={[styles.settingCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons 
                name={isAvailable ? 'check-circle' : 'close-circle'} 
                size={24} 
                color={isAvailable ? '#10B981' : '#EF4444'} 
              />
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: COLORS.text }]}>
                  {language === 'ar' ? 'متاح للعمل' : 'Available for Work'}
                </Text>
                <Text style={[styles.settingSubtitle, { color: COLORS.textSecondary }]}>
                  {language === 'ar' 
                    ? 'تفعيل لاستقبال طلبات جديدة' 
                    : 'Enable to receive new requests'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: COLORS.border, true: '#10B981' }}
              thumbColor={isAvailable ? '#fff' : COLORS.background}
            />
          </View>

          {/* Language */}
          <View style={[styles.settingCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="language" size={24} color={COLORS.primary} />
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: COLORS.text }]}>
                  {language === 'ar' ? 'اللغة' : 'Language'}
                </Text>
              </View>
            </View>
            <View style={styles.languageButtons}>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  { backgroundColor: language === 'ar' ? COLORS.primary : COLORS.card },
                ]}
                onPress={() => setLanguage('ar')}
              >
                <Text
                  style={[
                    styles.langButtonText,
                    { color: language === 'ar' ? '#fff' : COLORS.text },
                  ]}
                >
                  عربي
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  { backgroundColor: language === 'en' ? COLORS.primary : COLORS.card },
                ]}
                onPress={() => setLanguage('en')}
              >
                <Text
                  style={[
                    styles.langButtonText,
                    { color: language === 'en' ? '#fff' : COLORS.text },
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dark Mode */}
          <View style={[styles.settingCard, { backgroundColor: COLORS.card }, SHADOWS.small]}>
            <View style={styles.settingLeft}>
              <MaterialIcons 
                name={isDark ? 'dark-mode' : 'light-mode'} 
                size={24} 
                color={COLORS.primary} 
              />
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: COLORS.text }]}>
                  {language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={isDark ? '#fff' : COLORS.background}
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: COLORS.card }, SHADOWS.small]}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>
            {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  infoContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  input: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    fontSize: 16,
  },
  saveButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  langButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
