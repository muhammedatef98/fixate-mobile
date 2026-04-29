import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { validateSaudiId, validateSaudiIban, validatePhone } from '../utils/validation';
import { submitTechnicianApplication } from '../services/technicianOnboardingService';
import { getFriendlyError } from '../utils/errorMessages';

const SPECIALTIES = [
  { id: 'mobile', ar: 'جوالات', en: 'Mobile phones' },
  { id: 'laptop', ar: 'لابتوب', en: 'Laptops' },
  { id: 'tablet', ar: 'تابلت', en: 'Tablets' },
  { id: 'home', ar: 'أجهزة منزلية', en: 'Home appliances' },
  { id: 'watch', ar: 'ساعات ذكية', en: 'Smart watches' },
];

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'الخبر', 'الطائف', 'تبوك'];

export default function TechnicianOnboardingScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, refreshUser } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [years, setYears] = useState('');
  const [bio, setBio] = useState('');
  const [iban, setIban] = useState('');
  const [idDocUri, setIdDocUri] = useState<string | null>(null);
  const [certUri, setCertUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const idCheck = validateSaudiId(nationalId);
  const ibanCheck = validateSaudiIban(iban);

  const step1Valid =
    fullName.trim().length >= 3 &&
    validatePhone(phone) &&
    idCheck.valid &&
    city.trim().length > 0;
  const step2Valid =
    specialty.trim().length > 0 &&
    Number(years) >= 0 &&
    Number(years) <= 60 &&
    bio.trim().length >= 20;
  const step3Valid = ibanCheck.valid && Boolean(idDocUri);

  const pickImage = async (setter: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isRTL ? 'إذن مرفوض' : 'Permission denied', isRTL ? 'يرجى السماح بالوصول للمعرض' : 'Please allow gallery access');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setter(res.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await submitTechnicianApplication({
        userId: user.id,
        fullName,
        phone,
        nationalId,
        city,
        specialty,
        yearsOfExperience: Number(years) || 0,
        bio,
        iban,
        idDocumentUri: idDocUri ?? undefined,
        certificateUri: certUri ?? undefined,
      });
      await refreshUser();
      Alert.alert(
        isRTL ? 'تم الإرسال' : 'Submitted',
        isRTL
          ? 'تم استلام طلبك. سيتم مراجعة بياناتك خلال 1-2 يوم عمل وستصلك رسالة عند الموافقة.'
          : 'Your application is received. We will review it within 1-2 business days and notify you upon approval.',
        [{ text: 'OK', onPress: () => router.replace('/(technician)') }]
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'تسجيل فني' : 'Become a technician'}</Text>
        <Text style={styles.stepBadge}>{step}/3</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%`, backgroundColor: COLORS.primary }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          {step === 1 && (
            <>
              <Text style={styles.sectionTitle}>{isRTL ? 'البيانات الشخصية' : 'Personal info'}</Text>
              <Text style={styles.hint}>
                {isRTL ? 'هذه البيانات تُستخدم للتحقق من هويتك بحسب أنظمة المملكة' : 'Used to verify your identity per Saudi regulations'}
              </Text>

              <Field
                label={isRTL ? 'الاسم الرباعي (كما في الهوية)' : 'Full name (as on ID)'}
                value={fullName}
                onChangeText={setFullName}
                COLORS={COLORS}
                isRTL={isRTL}
              />
              <Field
                label={isRTL ? 'رقم الجوال' : 'Phone'}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="05xxxxxxxx"
                COLORS={COLORS}
                isRTL={isRTL}
              />
              <Field
                label={isRTL ? 'رقم الهوية الوطنية / الإقامة' : 'National ID / Iqama'}
                value={nationalId}
                onChangeText={(v) => setNationalId(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder="1xxxxxxxxx"
                COLORS={COLORS}
                isRTL={isRTL}
                error={nationalId.length === 10 && !idCheck.valid ? idCheck.message : undefined}
                hint={
                  idCheck.valid
                    ? idCheck.type === 'citizen'
                      ? isRTL ? 'مواطن سعودي ✓' : 'Saudi citizen ✓'
                      : isRTL ? 'مقيم ✓' : 'Resident ✓'
                    : undefined
                }
              />
              <Text style={styles.label}>{isRTL ? 'المدينة' : 'City'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                {CITIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, city === c && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                    onPress={() => setCity(c)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: city === c }}
                  >
                    <Text style={[styles.chipText, city === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <PrimaryButton
                disabled={!step1Valid}
                onPress={() => setStep(2)}
                label={isRTL ? 'التالي' : 'Next'}
                COLORS={COLORS}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.sectionTitle}>{isRTL ? 'المعلومات المهنية' : 'Professional info'}</Text>
              <Text style={styles.label}>{isRTL ? 'التخصّص' : 'Specialty'}</Text>
              {SPECIALTIES.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.option, specialty === s.id && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' }]}
                  onPress={() => setSpecialty(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: specialty === s.id }}
                >
                  <Text style={[styles.optionText, specialty === s.id && { color: COLORS.primary, fontWeight: '700' }]}>
                    {isRTL ? s.ar : s.en}
                  </Text>
                  {specialty === s.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}

              <Field
                label={isRTL ? 'سنوات الخبرة' : 'Years of experience'}
                value={years}
                onChangeText={(v) => setYears(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                COLORS={COLORS}
                isRTL={isRTL}
              />

              <Text style={styles.label}>{isRTL ? 'نبذة عنك (مهاراتك، تجاربك)' : 'About you (skills, past work)'}</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                placeholder={isRTL ? 'مثال: 5 سنوات في صيانة جوالات Apple وSamsung، خبرة في تغيير الشاشات والبطاريات...' : 'e.g. 5 years repairing Apple & Samsung phones...'}
                placeholderTextColor={COLORS.textSecondary}
                style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, height: 120, textAlignVertical: 'top' }]}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={styles.charCount}>{bio.length}/300 — {isRTL ? '20 حرف على الأقل' : 'min 20 chars'}</Text>

              <PrimaryButton
                disabled={!step2Valid}
                onPress={() => setStep(3)}
                label={isRTL ? 'التالي' : 'Next'}
                COLORS={COLORS}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.sectionTitle}>{isRTL ? 'التحقّق والمستندات' : 'Verification & documents'}</Text>
              <Text style={styles.hint}>
                {isRTL
                  ? 'مستنداتك مشفّرة ومحفوظة بشكل آمن. الـ IBAN يُستخدم لإرسال أرباحك أسبوعياً.'
                  : 'Your documents are encrypted. IBAN is used to disburse your weekly earnings.'}
              </Text>

              <Field
                label={isRTL ? 'رقم الـ IBAN السعودي' : 'Saudi IBAN'}
                value={iban}
                onChangeText={(v) => setIban(v.toUpperCase().replace(/\s/g, ''))}
                placeholder="SAxx xxxx xxxx xxxx xxxx xxxx"
                COLORS={COLORS}
                isRTL={isRTL}
                error={iban.length >= 24 && !ibanCheck.valid ? ibanCheck.message : undefined}
                hint={ibanCheck.valid ? (isRTL ? 'IBAN صحيح ✓' : 'Valid IBAN ✓') : undefined}
              />

              <UploadCard
                label={isRTL ? 'صورة الهوية الوطنية / الإقامة *' : 'National ID / Iqama photo *'}
                uri={idDocUri}
                onPick={() => pickImage(setIdDocUri)}
                COLORS={COLORS}
                isRTL={isRTL}
              />

              <UploadCard
                label={isRTL ? 'شهادة مهنية (اختياري)' : 'Professional certificate (optional)'}
                uri={certUri}
                onPick={() => pickImage(setCertUri)}
                COLORS={COLORS}
                isRTL={isRTL}
              />

              <View style={styles.disclaimer}>
                <MaterialCommunityIcons name="shield-check" size={20} color={COLORS.primary} />
                <Text style={styles.disclaimerText}>
                  {isRTL
                    ? 'بالضغط على "إرسال الطلب" أوافق على الشروط وعلى مشاركة بياناتي مع فريق التحقّق.'
                    : 'By submitting I accept the terms and consent to data review for verification.'}
                </Text>
              </View>

              <PrimaryButton
                disabled={!step3Valid || submitting}
                onPress={handleSubmit}
                label={submitting ? '' : isRTL ? 'إرسال الطلب' : 'Submit application'}
                loading={submitting}
                COLORS={COLORS}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, keyboardType, placeholder, error, hint, COLORS, isRTL }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        style={[styles.input, { color: COLORS.text, borderColor: error ? COLORS.error : COLORS.border }]}
        textAlign={isRTL ? 'right' : 'left'}
        autoCapitalize="none"
      />
      {error ? <Text style={{ color: COLORS.error, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
      {hint ? <Text style={{ color: COLORS.success, fontSize: 12, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

function UploadCard({ label, uri, onPick, COLORS, isRTL }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <TouchableOpacity
        onPress={onPick}
        style={[styles.uploadBox, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {uri ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
            <View>
              <Text style={{ color: COLORS.success, fontWeight: '600' }}>✓ {isRTL ? 'تم رفع الملف' : 'Uploaded'}</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                {isRTL ? 'اضغط لتغيير الصورة' : 'Tap to change'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Ionicons name="cloud-upload-outline" size={32} color={COLORS.primary} />
            <Text style={{ color: COLORS.text, fontWeight: '600' }}>
              {isRTL ? 'اضغط لاختيار صورة' : 'Tap to upload'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function PrimaryButton({ disabled, onPress, label, loading, COLORS }: any) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        marginTop: 24,
        opacity: disabled ? 0.5 : 1,
        minHeight: 56,
        justifyContent: 'center',
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{label}</Text>}
    </TouchableOpacity>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      backgroundColor: C.card,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: C.text },
    stepBadge: { color: C.primary, fontWeight: '700', fontSize: 14 },
    progressBar: { height: 4, backgroundColor: C.border },
    progressFill: { height: 4 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: C.text, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    hint: { color: C.textSecondary, marginBottom: 20, fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginHorizontal: 4, backgroundColor: C.card },
    chipText: { color: C.text, fontWeight: '500' },
    option: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 14,
      marginBottom: 8,
      minHeight: 52,
    },
    optionText: { color: C.text, fontSize: 15 },
    label: { color: C.text, fontWeight: '600', marginBottom: 8, fontSize: 14 },
    input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 14, fontSize: 15 },
    charCount: { color: C.textSecondary, fontSize: 11, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    uploadBox: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.lg,
      alignItems: 'center',
      minHeight: 100,
      justifyContent: 'center',
    },
    disclaimer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: C.primary + '10',
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginTop: SPACING.md,
    },
    disclaimerText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  });

const styles: any = {};
