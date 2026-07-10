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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getMyCourierProfile,
  submitCourierApplication,
} from '../services/courierService';
import { generateChallenge } from '../services/userVerificationService';
import * as userService from '../services/userService';
import { getFriendlyError } from '../utils/errorMessages';
import { validateDocNumber } from '../utils/validation';
import { logger } from '../utils/logger';

type VehicleId = 'car' | 'motorcycle' | 'van';

const VEHICLES: { id: VehicleId; ar: string; en: string; icon: string }[] = [
  { id: 'car', ar: 'سيارة', en: 'Car', icon: 'car' },
  { id: 'motorcycle', ar: 'دراجة نارية', en: 'Motorcycle', icon: 'motorbike' },
  { id: 'van', ar: 'فان', en: 'Van', icon: 'van-utility' },
];

// The vehicle-registration document is named differently per vehicle type in
// KSA (سيارة/فان = استمارة، دراجة = رخصة سير), so the field label, placeholder
// and helper adapt to the selected vehicle — this is what makes the form read
// as operationally accurate rather than a generic text box.
const REGISTRATION_COPY: Record<VehicleId, { labelAr: string; labelEn: string; phAr: string; phEn: string }> = {
  car: { labelAr: 'رقم استمارة السيارة', labelEn: 'Vehicle registration (Istimara) number', phAr: 'كما في الاستمارة', phEn: 'As printed on the Istimara' },
  motorcycle: { labelAr: 'رقم رخصة سير الدراجة', labelEn: 'Motorcycle registration number', phAr: 'كما في رخصة السير', phEn: 'As printed on the registration' },
  van: { labelAr: 'رقم استمارة الفان', labelEn: 'Van registration (Istimara) number', phAr: 'كما في الاستمارة', phEn: 'As printed on the Istimara' },
};

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
  const [vehicle, setVehicle] = useState<VehicleId>('car');
  const [idNumber, setIdNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  // §7 — verification document images + identity challenge selfie.
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [registrationImage, setRegistrationImage] = useState<string | null>(null);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [challenge, setChallenge] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setChallenge((prev) => generateChallenge(isRTL, prev || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickImage = async (setter: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isRTL ? 'الإذن مرفوض' : 'Permission denied', isRTL ? 'يرجى السماح بالوصول للمعرض' : 'Please allow gallery access');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.uri) setter(res.assets[0].uri);
  };

  const captureSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isRTL ? 'الإذن مرفوض' : 'Permission denied', isRTL ? 'يرجى السماح باستخدام الكاميرا' : 'Please allow camera access');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.uri) setSelfieImage(res.assets[0].uri);
  };

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
        setLicenseNumber(profile.driver_license_number ?? '');
        setRegistrationNumber(profile.vehicle_registration_number ?? '');
        // Preserve previously-uploaded document paths on re-submission; the
        // uploader treats a non-local (stored) path as "keep as-is".
        setLicenseImage(profile.license_image_url ?? null);
        setRegistrationImage(profile.registration_image_url ?? null);
        setIdImage(profile.id_image_url ?? null);
        setSelfieImage(profile.selfie_url ?? null);
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
    // Verification documents — required for the admin review.
    if (!validateDocNumber(licenseNumber).valid) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Missing info',
        isRTL
          ? 'اكتب رقم رخصة القيادة (4–20 حرفاً/رقماً)'
          : 'Enter a valid driver license number (4–20 letters/digits)'
      );
      return;
    }
    if (!validateDocNumber(registrationNumber).valid) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Missing info',
        isRTL
          ? 'اكتب رقم استمارة/تسجيل المركبة (4–20 حرفاً/رقماً)'
          : 'Enter a valid vehicle registration / form number (4–20 letters/digits)'
      );
      return;
    }
    // §7 — document images + identity selfie are mandatory (re-submissions may
    // already carry a stored path, so a previously-saved value counts).
    if (!licenseImage) {
      Alert.alert(isRTL ? 'تنبيه' : 'Missing info', isRTL ? 'أرفق صورة رخصة القيادة' : 'Attach a photo of your driver license');
      return;
    }
    if (!registrationImage) {
      Alert.alert(isRTL ? 'تنبيه' : 'Missing info', isRTL ? 'أرفق صورة استمارة/تسجيل المركبة' : 'Attach a photo of the vehicle registration / form');
      return;
    }
    if (!selfieImage) {
      Alert.alert(isRTL ? 'تنبيه' : 'Missing info', isRTL ? 'التقط صورة شخصية أثناء تنفيذ التحدي' : 'Take a selfie performing the challenge');
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
        driver_license_number: licenseNumber.trim(),
        vehicle_registration_number: registrationNumber.trim(),
        licenseImageUri: licenseImage ?? undefined,
        registrationImageUri: registrationImage ?? undefined,
        idImageUri: idImage ?? undefined,
        selfieImageUri: selfieImage ?? undefined,
        challengeText: challenge,
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

          <Text style={[styles.sectionLabel, { color: COLORS.primary, textAlign: isRTL ? 'right' : 'left', marginTop: 4 }]}>
            {isRTL ? 'مستندات التحقق' : 'Verification documents'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19, textAlign: isRTL ? 'right' : 'left', marginTop: -SPACING.sm }}>
            {isRTL
              ? 'مطلوبة للموافقة على حسابك كمندوب. تُستخدم للتحقق فقط ولا تظهر للعملاء.'
              : 'Required to approve your courier account. Used for verification only — never shown to customers.'}
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'رقم رخصة القيادة' : 'Driver license number'}
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="card-account-details-star-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder={isRTL ? 'كما في الرخصة' : 'As printed on your license'}
                placeholderTextColor={COLORS.textSecondary}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                autoCapitalize="characters"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? REGISTRATION_COPY[vehicle].labelAr : REGISTRATION_COPY[vehicle].labelEn}
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.card, borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder={isRTL ? REGISTRATION_COPY[vehicle].phAr : REGISTRATION_COPY[vehicle].phEn}
                placeholderTextColor={COLORS.textSecondary}
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                autoCapitalize="characters"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
            <Text style={{ color: COLORS.textLight, fontSize: 11.5, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL
                ? `مرتبطة بوسيلة التوصيل المختارة: ${VEHICLES.find((v) => v.id === vehicle)?.ar}.`
                : `Matched to your selected vehicle: ${VEHICLES.find((v) => v.id === vehicle)?.en}.`}
            </Text>
          </View>

          {/* §7 — document photos + live identity challenge */}
          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.m, marginBottom: SPACING.m }}>
            <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'صور المستندات والتحقق من الهوية' : 'Document photos & identity check'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 14, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL
                ? 'مستنداتك خاصة ولا تظهر للعملاء — يراجعها فريق التحقق فقط.'
                : 'Your documents are private and never shown to customers — only the review team sees them.'}
            </Text>

            <DocTile
              label={isRTL ? 'صورة رخصة القيادة' : 'Driver license photo'}
              uri={licenseImage}
              onPress={() => pickImage(setLicenseImage)}
              COLORS={COLORS}
              isRTL={isRTL}
            />
            <DocTile
              label={isRTL ? 'صورة استمارة/تسجيل المركبة' : 'Vehicle registration / form photo'}
              uri={registrationImage}
              onPress={() => pickImage(setRegistrationImage)}
              COLORS={COLORS}
              isRTL={isRTL}
            />
            <DocTile
              label={isRTL ? 'صورة الهوية/الإقامة (اختياري)' : 'National ID / Iqama photo (optional)'}
              uri={idImage}
              onPress={() => pickImage(setIdImage)}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            {/* Live identity challenge */}
            <View style={{ backgroundColor: COLORS.primary + '10', borderRadius: BORDER_RADIUS.md, padding: 12, marginTop: 6 }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13 }}>
                  {isRTL ? 'تحدّي التحقق' : 'Verification challenge'}
                </Text>
                <TouchableOpacity onPress={() => setChallenge((p) => generateChallenge(isRTL, p || null))} accessibilityRole="button">
                  <MaterialCommunityIcons name="refresh" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: COLORS.primary, fontSize: 15, fontWeight: '800', marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                {challenge}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11.5, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'التقط صورة شخصية مباشرة أثناء تنفيذ التعليمة أعلاه.' : 'Take a live selfie while performing the instruction above.'}
              </Text>
              <DocTile
                label={isRTL ? 'الصورة الشخصية (كاميرا مباشرة)' : 'Selfie (live camera)'}
                uri={selfieImage}
                onPress={captureSelfie}
                COLORS={COLORS}
                isRTL={isRTL}
                camera
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

function DocTile({
  label,
  uri,
  onPress,
  COLORS,
  isRTL,
  camera,
}: {
  label: string;
  uri: string | null;
  onPress: () => void;
  COLORS: any;
  isRTL: boolean;
  camera?: boolean;
}) {
  const done = !!uri;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: done ? '#10B981' : COLORS.border,
        borderRadius: BORDER_RADIUS.md,
        padding: 10,
        marginTop: 10,
        marginBottom: 2,
        backgroundColor: done ? '#10B98112' : 'transparent',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: 44, height: 44, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}>
          <MaterialCommunityIcons name={camera ? 'camera-outline' : 'file-image-plus-outline'} size={22} color={COLORS.primary} />
        </View>
      )}
      <Text style={{ flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <MaterialCommunityIcons
        name={done ? 'check-circle' : camera ? 'camera' : 'upload'}
        size={20}
        color={done ? '#10B981' : COLORS.textSecondary}
      />
    </TouchableOpacity>
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
