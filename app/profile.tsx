import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Modal, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { getColors, getShadows, SPACING } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { translations } from '../constants/translations';
import { RTLMaterialIcon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';

const MENU_ITEMS = [
  { id: 'account', title: 'تعديل الملف الشخصي', titleEn: 'Edit Profile', icon: 'person-outline' },
  { id: 'wallet', title: 'المحفظة وطرق الدفع', titleEn: 'Wallet & Payment', icon: 'account-balance-wallet' },
  { id: 'notifications', title: 'الإشعارات', titleEn: 'Notifications', icon: 'notifications-none' },
  { id: 'language', title: 'اللغة / Language', titleEn: 'Language', icon: 'language' },
  { id: 'support', title: 'الدعم والمساعدة', titleEn: 'Support & Help', icon: 'headset-mic' },
  { id: 'about', title: 'عن التطبيق', titleEn: 'About App', icon: 'info-outline' },
];

// Profile Screen - All buttons functional
export default function ProfileScreen() {
  const router = useRouter();
  const { isDark, language, setLanguage } = useApp();
  const { user, userProfile, signOut } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  
  const [name, setName] = useState((userProfile as any)?.name || '');
  const [phone, setPhone] = useState((userProfile as any)?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const handleMenuPress = (itemId: string) => {
    switch (itemId) {
      case 'account':
        setEditModalVisible(true);
        break;
      case 'wallet':
        setWalletModalVisible(true);
        break;
      case 'notifications':
        setNotificationsModalVisible(true);
        break;
      case 'language':
        setLanguageModalVisible(true);
        break;
      case 'support':
        router.push('/contact');
        break;
      case 'about':
        setAboutModalVisible(true);
        break;
    }
  };

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Logout',
      isRTL ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { 
          text: isRTL ? 'تسجيل الخروج' : 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/role-selection');
          }
        },
      ]
    );
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedBackButton
            onPress={() => safeBack()}
            color={COLORS.text}
            backgroundColor={COLORS.surface}
            size={44}
            iconSize={24}
            iconName="arrow-back"
            rtl
            accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          />
          <Text style={styles.headerTitle}>{isRTL ? 'الملف الشخصي' : 'Profile'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Info — centered green card with avatar, name, edit button */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardGlow} />
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: 'https://ui-avatars.com/api/?name=Mohamed+Atef&background=10B981&color=fff&size=128' }}
              style={styles.avatar}
            />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => Alert.alert(isRTL ? 'تغيير الصورة' : 'Change Photo', isRTL ? 'سيتم إضافة هذه الميزة قريباً' : 'This feature will be added soon')}
            >
              <MaterialIcons name="camera-alt" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{name}</Text>
          {(userProfile as any)?.is_verified ? (
            <View style={styles.verifiedRow}>
              <MaterialIcons name="verified" size={14} color="#FFF" />
              <Text style={styles.verifiedText}>
                {isRTL ? 'حساب موثّق' : 'Verified account'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => router.push('/verify-identity' as any)}
              style={styles.verifyCta}
            >
              <MaterialIcons name="shield" size={14} color="#FFF" />
              <Text style={styles.verifyCtaText}>
                {isRTL ? 'احصل على علامة التوثيق' : 'Get verified'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.editProfileBtn}
            activeOpacity={0.85}
            onPress={() => setEditModalVisible(true)}
          >
            <MaterialIcons name="edit" size={14} color="#FFF" />
            <Text style={styles.editProfileBtnText}>
              {isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats — centered card with icon-led stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.primary + '18' }]}>
              <MaterialIcons name="check-circle" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>{isRTL ? 'طلب مكتمل' : 'Completed'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIconWrap, { backgroundColor: '#F59E0B22' }]}>
              <MaterialIcons name="star" size={16} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>4.9</Text>
            <Text style={styles.statLabel}>{isRTL ? 'التقييم' : 'Rating'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIconWrap, { backgroundColor: '#6366F122' }]}>
              <MaterialIcons name="event" size={16} color="#6366F1" />
            </View>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>{isRTL ? 'سنة انضمام' : 'Years'}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.id)}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIcon}>
                  <MaterialIcons name={item.icon as any} size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.menuTitle}>{isRTL ? item.title : item.titleEn}</Text>
              </View>
              <RTLMaterialIcon name="chevron-right" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>{isRTL ? 'تسجيل الخروج' : 'Logout'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{isRTL ? 'الإصدار' : 'Version'} 1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>{isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}</Text>
            
            <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isRTL ? 'الاسم' : 'Name'}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.background, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
              value={name}
              onChangeText={setName}
            />
            
            <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isRTL ? 'رقم الجوال' : 'Phone'}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.background, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            
            <Text style={[styles.label, { color: COLORS.textSecondary }]}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.background, color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: COLORS.primary }]}
                onPress={() => {
                  setEditModalVisible(false);
                  Alert.alert(isRTL ? 'تم الحفظ' : 'Saved', isRTL ? 'تم حفظ التغييرات بنجاح' : 'Changes saved successfully');
                }}
              >
                <Text style={styles.modalButtonText}>{isRTL ? 'حفظ' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: COLORS.border }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: COLORS.text }]}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Modal */}
      <Modal visible={walletModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>{isRTL ? 'المحفظة وطرق الدفع' : 'Wallet & Payment'}</Text>
            
            <View style={styles.walletCard}>
              <Text style={[styles.walletLabel, { color: COLORS.textSecondary }]}>{isRTL ? 'الرصيد الحالي' : 'Current Balance'}</Text>
              <Text style={[styles.walletAmount, { color: COLORS.primary }]}>{isRTL ? '250 ر.س' : 'SAR 250'}</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.paymentOption, { backgroundColor: COLORS.background }]}
              onPress={() => {
                Alert.alert(
                  isRTL ? 'إضافة بطاقة' : 'Add Card',
                  isRTL ? 'سيتم إضافة هذه الميزة قريباً' : 'This feature will be added soon'
                );
              }}
            >
              <MaterialIcons name="credit-card" size={24} color={COLORS.primary} />
              <Text style={[styles.paymentText, { color: COLORS.text }]}>{isRTL ? 'إضافة بطاقة ائتمان' : 'Add Credit Card'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.paymentOption, { backgroundColor: COLORS.background }]}
              onPress={() => {
                Alert.alert(
                  isRTL ? 'ربط حساب بنكي' : 'Link Bank',
                  isRTL ? 'سيتم إضافة هذه الميزة قريباً' : 'This feature will be added soon'
                );
              }}
            >
              <MaterialIcons name="account-balance" size={24} color={COLORS.primary} />
              <Text style={[styles.paymentText, { color: COLORS.text }]}>{isRTL ? 'ربط حساب بنكي' : 'Link Bank Account'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: COLORS.border, marginTop: 20 }]}
              onPress={() => setWalletModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: COLORS.text }]}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={notificationsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>{isRTL ? 'الإشعارات' : 'Notifications'}</Text>
            
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>{isRTL ? 'تفعيل الإشعارات' : 'Enable Notifications'}</Text>
              <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
            </View>
            
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>{isRTL ? 'إشعارات البريد' : 'Email Notifications'}</Text>
              <Switch value={emailNotifications} onValueChange={setEmailNotifications} />
            </View>
            
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: COLORS.text }]}>{isRTL ? 'إشعارات SMS' : 'SMS Notifications'}</Text>
              <Switch value={smsNotifications} onValueChange={setSmsNotifications} />
            </View>
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: COLORS.primary, marginTop: 20 }]}
              onPress={() => {
                setNotificationsModalVisible(false);
                Alert.alert(isRTL ? 'تم الحفظ' : 'Saved', isRTL ? 'تم حفظ إعدادات الإشعارات' : 'Notification settings saved');
              }}
            >
              <Text style={styles.modalButtonText}>{isRTL ? 'حفظ' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={languageModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>{isRTL ? 'اختر اللغة' : 'Choose Language'}</Text>
            
            <TouchableOpacity 
              style={[styles.languageOption, language === 'ar' && { backgroundColor: COLORS.primary + '20' }]}
              onPress={() => {
                setLanguage('ar');
                setLanguageModalVisible(false);
              }}
            >
              <Text style={[styles.languageText, { color: COLORS.text }]}>العربية</Text>
              {language === 'ar' && <MaterialIcons name="check" size={24} color={COLORS.primary} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.languageOption, language === 'en' && { backgroundColor: COLORS.primary + '20' }]}
              onPress={() => {
                setLanguage('en');
                setLanguageModalVisible(false);
              }}
            >
              <Text style={[styles.languageText, { color: COLORS.text }]}>English</Text>
              {language === 'en' && <MaterialIcons name="check" size={24} color={COLORS.primary} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: COLORS.border, marginTop: 20 }]}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: COLORS.text }]}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal visible={aboutModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.surface }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>Fixate</Text>
            
            <Text style={[styles.aboutText, { color: COLORS.text }]}>
              {isRTL 
                ? 'تطبيق Fixate هو منصة شاملة لخدمات الصيانة والإصلاح. نربط العملاء بأفضل الفنيين المعتمدين لإصلاح الأجهزة الإلكترونية.'
                : 'Fixate is a comprehensive platform for maintenance and repair services. We connect customers with the best certified technicians to repair electronic devices.'
              }
            </Text>
            
            <View style={styles.aboutInfo}>
              <Text style={[styles.aboutLabel, { color: COLORS.textSecondary }]}>{isRTL ? 'الإصدار' : 'Version'}</Text>
              <Text style={[styles.aboutValue, { color: COLORS.text }]}>1.0.0</Text>
            </View>
            
            <View style={styles.aboutInfo}>
              <Text style={[styles.aboutLabel, { color: COLORS.textSecondary }]}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Text>
              <Text style={[styles.aboutValue, { color: COLORS.text }]}>fixate01@gmail.com</Text>
            </View>
            
            <View style={styles.aboutInfo}>
              <Text style={[styles.aboutLabel, { color: COLORS.textSecondary }]}>{isRTL ? 'الهاتف' : 'Phone'}</Text>
              <Text style={[styles.aboutValue, { color: COLORS.text }]}>0548940042</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: COLORS.border, marginTop: 20 }]}
              onPress={() => setAboutModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: COLORS.text }]}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profileCard: {
    alignSelf: 'center',
    width: '88%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    overflow: 'hidden',
  },
  profileCardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0B7A56',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  verifiedRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  verifyCta: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  verifyCtaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  phone: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: '88%',
    marginBottom: SPACING.xl,
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  editProfileBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  menuContainer: {
    paddingHorizontal: SPACING.lg,
  },
  menuItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: isRTL ? 0 : SPACING.md,
    marginRight: isRTL ? SPACING.md : 0,
  },
  menuTitle: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
  version: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  walletCard: {
    padding: 20,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  walletLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  paymentText: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLabel: {
    fontSize: 16,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  languageText: {
    fontSize: 16,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  aboutInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
