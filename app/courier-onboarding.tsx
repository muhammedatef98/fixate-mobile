import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getMyCourierProfile,
  submitCourierApplication,
} from '../services/courierService';
import * as userService from '../services/userService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

const VEHICLES: { id: 'car' | 'motorcycle' | 'van'; ar: string; en: string; icon: string }[] = [
  { id: 'car', ar: 'سيارة', en: 'Car', icon: 'car' },
  { id: 'motorcycle', ar: 'دراجة نارية', en: 'Motorcycle', icon: 'motorbike' },
  { id: 'van', ar: 'فان', en: 'Van', icon: 'van-utility' },
];

/**
 * Courier application: the minimum profile the ops team needs to review a
 * courier (city, vehicle, ID number). Submitting creates/updates the
 * couriers row with verification_status='submitted'; the (courier) layout
 * gate then shows the under-review state until an admin approves.
 */
export default function CourierOnboardingScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [vehicle, setVehicle] = useState<'car' | 'motorcycle' | 'van'>('car');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/courier-auth');
      return;
    }
    let cancelled = false;
    (async () => {
      const profile = await getMyCourierProfile(user.id);
      if (cancelled) return;
      if (profile) {
        setCity(profile.city ?? '');
        setVehicle((profile.vehicle_type as any) ?? 'car');
        setIdNumber(profile.id_number ?? '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Prefill identity from the users row (hydrates in the background) so
  // re-applications and edits never make the courier retype their details.
  useEffect(() => {
    setFullName((prev) => prev || userProfile?.name || '');
    setPhone((prev) => prev || userProfile?.phone || '');
  }, [userProfile]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Missing info',
        isRTL ? 'اكتب اسمك الكامل' : 'Enter your full name'
      );
      return;
    }
    if (!city.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Missing info',
        isRTL ? 'اكتب المدينة التي ستعمل فيها' : 'Enter the city you will operate in'
      );
      return;
    }
    setSubmitting(true);
    try {
      // Identity lives on the users row (name shown to admins and customers);
      // the courier application only carries work details.
      await userService.createOrUpdateUserProfile(user.id, {
        name: fullName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      await submitCourierApplication(user.id, {
        city: city.trim(),
        vehicle_type: vehicle,
        id_number: idNumber.trim() || undefined,
      });
      Alert.alert(
        isRTL ? 'تم الإرسال ✓' : 'Submitted ✓',
        isRTL
          ? 'استلمنا طلبك. سيراجعه الفريق خلال 1-2 يوم عمل وستصلك رسالة عند الموافقة.'
          : "Application received. The team reviews it within 1-2 business days — you'll be notified once approved.",
        [{ text: isRTL ? 'حسناً' : 'OK', onPress: () => router.replace('/(courier)' as any) }]
      );
    } catch (e) {
      logger.warn('courier application failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={[
          styles.header,
          { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: COLORS.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(courier)' as any))}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'تسجيل مندوب توصيل' : 'Courier registration'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL
              ? 'مهمتك كمندوب: استلام الأجهزة من العملاء وتوصيلها للفنيين، ثم إعادتها بعد الإصلاح. أكمل بياناتك ليراجعها الفريق.'
              : 'As a courier you pick devices up from customers, deliver them to technicians, and return them after repair. Complete your details for review.'}
          </Text>

          <Text style={[styles.sectionLabel, { color: COLORS.primary, textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'البيانات الشخصية' : 'Personal details'}
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'الاسم الكامل' : 'Full name'}
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="account-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder={isRTL ? 'اسمك كما في الهوية' : 'Your name as on your ID'}
                placeholderTextColor={COLORS.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'رقم الجوال (اختياري)' : 'Phone number (optional)'}
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder="05XXXXXXXX"
                placeholderTextColor={COLORS.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: COLORS.primary, textAlign: isRTL ? 'right' : 'left', marginTop: 4 }]}>
            {isRTL ? 'بيانات العمل' : 'Work details'}
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'المدينة' : 'City'}
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder={isRTL ? 'مثال: القطيف' : 'e.g. Al Qatif'}
                placeholderTextColor={COLORS.textSecondary}
                value={city}
                onChangeText={setCity}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'وسيلة التوصيل' : 'Vehicle'}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.sm }}>
              {VEHICLES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVehicle(v.id)}
                  style={[
                    styles.vehicleChip,
                    {
                      backgroundColor: vehicle === v.id ? COLORS.primary : COLORS.card,
                      borderColor: vehicle === v.id ? COLORS.primary : COLORS.border,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name={v.icon as any}
                    size={22}
                    color={vehicle === v.id ? '#fff' : COLORS.textSecondary}
                  />
                  <Text
                    style={{
                      color: vehicle === v.id ? '#fff' : COLORS.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {isRTL ? v.ar : v.en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'رقم الهوية / الإقامة (اختياري)' : 'Saudi ID / Iqama number (optional)'}
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="card-account-details-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder="1XXXXXXXXX"
                placeholderTextColor={COLORS.textSecondary}
                value={idNumber}
                onChangeText={setIdNumber}
                keyboardType="number-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: COLORS.primary, opacity: submitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isRTL ? 'إرسال الطلب للمراجعة' : 'Submit for review'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  inputWrap: {
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 54,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15 },
  vehicleChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  submit: {
    height: 54,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
