import React, { useRef, useState } from 'react';
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
import { safeBack } from '../utils/navigation';
import SaudiCityPicker from '../components/SaudiCityPicker';

const SPECIALTIES: { id: string; ar: string; en: string; icon: any }[] = [
  { id: 'mobile', ar: 'جوالات', en: 'Mobile phones', icon: 'cellphone' },
  { id: 'laptop', ar: 'لابتوب', en: 'Laptops', icon: 'laptop' },
  { id: 'tablet', ar: 'تابلت', en: 'Tablets', icon: 'tablet' },
  { id: 'home', ar: 'أجهزة منزلية', en: 'Home appliances', icon: 'home-outline' },
  { id: 'watch', ar: 'ساعات ذكية', en: 'Smart watches', icon: 'watch' },
];

export default function TechnicianOnboardingScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, refreshUser } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  // Ref to the form scroller so we can pull a focused field (notably the
  // multiline bio, which sits low on the screen) above the keyboard.
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [years, setYears] = useState('');

  // Toggle a specialty id in/out of the multi-select set (immutable update).
  const toggleSpecialty = (id: string) =>
    setSpecialties((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
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
    specialties.length > 0 &&
    Number(years) >= 0 &&
    Number(years) <= 60 &&
    bio.trim().length >= 20;
  const step3Valid = ibanCheck.valid && Boolean(idDocUri);

  const pickImage = async (setter: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        isRTL ? 'إذن مرفوض' : 'Permission denied',
        isRTL ? 'يرجى السماح بالوصول للمعرض' : 'Please allow gallery access'
      );
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
        specialties,
        yearsOfExperience: Number(years) || 0,
        bio,
        iban,
        idDocumentUri: idDocUri ?? undefined,
        certificateUri: certUri ?? undefined,
      });
      await refreshUser();
      Alert.alert(
        isRTL ? 'تم إرسال طلب التسجيل ✓' : 'Registration request sent ✓',
        isRTL
          ? 'تم إرسال طلب التسجيل بنجاح. سيتم إشعارك عبر البريد الإلكتروني عند مراجعة طلبك وقبوله كفني في Fixate.'
          : 'Your registration request was sent successfully. You will be notified by email once your request is reviewed and approved as a technician at Fixate.',
        [{ text: isRTL ? 'حسناً' : 'OK', onPress: () => router.replace('/(technician)') }]
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle = step === 1
    ? (isRTL ? 'البيانات الشخصية' : 'Personal info')
    : step === 2
    ? (isRTL ? 'المعلومات المهنية' : 'Professional info')
    : (isRTL ? 'التحقّق والمستندات' : 'Verification');

  const stepSubtitle = step === 1
    ? (isRTL ? 'نحتاج هذه البيانات للتحقق من هويتك بحسب أنظمة المملكة' : 'Used to verify your identity per Saudi regulations')
    : step === 2
    ? (isRTL ? 'احكِ لنا عن خبرتك المهنية' : 'Tell us about your professional background')
    : (isRTL ? 'نضمن سرّية مستنداتك. تُستخدم لإرسال أرباحك.' : 'Documents are encrypted; IBAN is for weekly payouts');

  const styles = makeStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {/* Lightweight header — keeps the focus on the form */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(step - 1) : safeBack('/role-selection'))}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          style={styles.backBtn}
        >
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: COLORS.text }]}>{isRTL ? 'تسجيل فني' : 'Become a technician'}</Text>
        <Text style={styles.stepBadge}>{step}/3</Text>
      </View>

      {/* Progress dots */}
      <View style={styles.progress}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressSegment,
              { backgroundColor: s <= step ? COLORS.primary : COLORS.border },
              s === step && { transform: [{ scaleY: 1.6 }] },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // iOS insets the scroll content via automaticallyAdjustKeyboardInsets
        // below, so KAV would double-count — leave it undefined there. Android
        // relies on the manifest's adjustResize (Expo default) to shrink the
        // window, which makes the ScrollView scrollable under the keyboard.
        behavior={undefined}
      >
        <ScrollView
          ref={scrollRef}
          // flexGrow lets short steps fill the screen while long steps grow and
          // scroll; the big bottom pad guarantees headroom to lift the last
          // field (bio) clear of the keyboard on smaller devices.
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // iOS: automatically inset content so the focused input — including
          // the multiline bio — is pushed above the keyboard.
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {/* Section header — icon + title + subtitle */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: COLORS.primary + '15' }]}>
              <MaterialCommunityIcons
                name={step === 1 ? 'account-circle-outline' : step === 2 ? 'briefcase-outline' : 'shield-check-outline'}
                size={26}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>{stepTitle}</Text>
              <Text style={[styles.sectionSubtitle, { color: COLORS.textSecondary }]}>{stepSubtitle}</Text>
            </View>
          </View>

          {step === 1 && (
            <>
              <Field
                icon="account-outline"
                label={isRTL ? 'الاسم الرباعي (كما في الهوية)' : 'Full name (as on ID)'}
                value={fullName}
                onChangeText={setFullName}
                placeholder={isRTL ? 'محمد عبدالله الأحمد' : 'e.g. Mohammed Al-Ahmed'}
                COLORS={COLORS}
                isRTL={isRTL}
              />
              <Field
                icon="cellphone"
                label={isRTL ? 'رقم الجوال' : 'Phone'}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="05xxxxxxxx"
                COLORS={COLORS}
                isRTL={isRTL}
              />
              <Field
                icon="card-account-details-outline"
                label={isRTL ? 'رقم الهوية / الإقامة' : 'National ID / Iqama'}
                value={nationalId}
                onChangeText={(v: string) => setNationalId(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder={isRTL ? '10 أرقام' : '10 digits'}
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

              <Text style={[styles.fieldLabel, { color: COLORS.text, marginTop: 4 }]}>
                {isRTL ? 'مدينتك' : 'Your city'}
              </Text>
              <SaudiCityPicker
                value={city}
                onSelect={setCity}
                isRTL={isRTL}
                placeholder={isRTL ? 'اختر مدينتك' : 'Select your city'}
              />

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
              <Text style={[styles.fieldLabel, { color: COLORS.text }]}>{isRTL ? 'تخصّصاتك' : 'Your specialties'}</Text>
              <Text style={[styles.fieldHint, { color: COLORS.textSecondary }]}>
                {isRTL ? 'يمكنك اختيار أكثر من تخصّص' : 'You can select more than one'}
              </Text>
              <View style={styles.specGrid}>
                {SPECIALTIES.map((s) => {
                  const selected = specialties.includes(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.specCard,
                        { backgroundColor: COLORS.card, borderColor: COLORS.border },
                        selected && { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary },
                      ]}
                      onPress={() => toggleSpecialty(s.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <MaterialCommunityIcons name={s.icon} size={24} color={selected ? COLORS.primary : COLORS.textSecondary} />
                      <Text style={[styles.specText, { color: selected ? COLORS.primary : COLORS.text, fontWeight: selected ? '700' : '500' }]} numberOfLines={1}>
                        {isRTL ? s.ar : s.en}
                      </Text>
                      {selected && (
                        <View style={[styles.specCheck, { backgroundColor: COLORS.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Field
                icon="calendar-clock"
                label={isRTL ? 'سنوات الخبرة' : 'Years of experience'}
                value={years}
                onChangeText={(v: string) => setYears(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="0-60"
                COLORS={COLORS}
                isRTL={isRTL}
              />

              <Text style={[styles.fieldLabel, { color: COLORS.text }]}>
                {isRTL ? 'نبذة عنك' : 'About you'}
              </Text>
              <View style={[styles.bioWrap, { backgroundColor: COLORS.card, borderColor: bio.length >= 20 ? COLORS.primary : COLORS.border }]}>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  onFocus={() => {
                    // Bio is the last field on this step; once the keyboard is
                    // up, scroll it fully into view. Covers Android (where the
                    // window resizes) and reinforces the iOS auto-insets.
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                  }}
                  multiline
                  placeholder={
                    isRTL
                      ? 'مثال: 5 سنوات في صيانة جوالات Apple وSamsung، خبرة في الشاشات والبطاريات...'
                      : 'e.g. 5 years repairing Apple & Samsung phones — screens, batteries, charging ports...'
                  }
                  placeholderTextColor={COLORS.textSecondary}
                  style={[styles.bioInput, { color: COLORS.text }]}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <View style={styles.bioMeta}>
                  <Text style={{ color: bio.length >= 20 ? COLORS.primary : COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    {bio.length >= 20 ? '✓ ' : ''}
                    {isRTL ? `${bio.length} حرف${bio.length < 20 ? ` (الحد الأدنى 20)` : ''}` : `${bio.length} chars${bio.length < 20 ? ` (min 20)` : ''}`}
                  </Text>
                </View>
              </View>

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
              <Field
                icon="bank-outline"
                label={isRTL ? 'رقم الـ IBAN السعودي' : 'Saudi IBAN'}
                value={iban.replace(/(.{4})/g, '$1 ').trim()}
                onChangeText={(v: string) => {
                  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
                  setIban(clean);
                }}
                placeholder="SA00 0000 0000 0000 0000 0000"
                autoCapitalize="characters"
                COLORS={COLORS}
                isRTL={isRTL}
                error={iban.length >= 24 && !ibanCheck.valid ? ibanCheck.message : undefined}
                hint={ibanCheck.valid ? (isRTL ? 'IBAN صحيح ✓' : 'Valid IBAN ✓') : undefined}
              />

              <UploadCard
                label={isRTL ? 'صورة الهوية / الإقامة' : 'National ID / Iqama photo'}
                required
                uri={idDocUri}
                onPick={() => pickImage(setIdDocUri)}
                onClear={() => setIdDocUri(null)}
                COLORS={COLORS}
                isRTL={isRTL}
              />

              <UploadCard
                label={isRTL ? 'شهادة مهنية' : 'Professional certificate'}
                hint={isRTL ? 'اختياري — يساعد بالقبول الأسرع' : 'Optional — speeds up approval'}
                uri={certUri}
                onPick={() => pickImage(setCertUri)}
                onClear={() => setCertUri(null)}
                COLORS={COLORS}
                isRTL={isRTL}
              />

              {/* Review summary */}
              <View style={[styles.reviewCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <View style={[styles.reviewHeader, { borderBottomColor: COLORS.border }]}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={COLORS.primary} />
                  <Text style={{ color: COLORS.text, fontWeight: '700', marginHorizontal: 8 }}>
                    {isRTL ? 'مراجعة قبل الإرسال' : 'Review before submit'}
                  </Text>
                </View>
                <SummaryRow label={isRTL ? 'الاسم' : 'Name'} value={fullName} COLORS={COLORS} isRTL={isRTL} />
                <SummaryRow label={isRTL ? 'الجوال' : 'Phone'} value={phone} COLORS={COLORS} isRTL={isRTL} />
                <SummaryRow label={isRTL ? 'المدينة' : 'City'} value={city} COLORS={COLORS} isRTL={isRTL} />
                <SummaryRow
                  label={isRTL ? 'التخصص' : 'Specialty'}
                  value={specialties
                    .map((id) => {
                      const s = SPECIALTIES.find((sp) => sp.id === id);
                      return s ? (isRTL ? s.ar : s.en) : null;
                    })
                    .filter(Boolean)
                    .join(isRTL ? '، ' : ', ')}
                  COLORS={COLORS}
                  isRTL={isRTL}
                />
                <SummaryRow
                  label={isRTL ? 'الخبرة' : 'Experience'}
                  value={`${years} ${isRTL ? 'سنة' : 'yrs'}`}
                  COLORS={COLORS}
                  isRTL={isRTL}
                />
              </View>

              <View style={[styles.disclaimer, { backgroundColor: COLORS.primary + '10' }]}>
                <MaterialCommunityIcons name="shield-lock-outline" size={18} color={COLORS.primary} />
                <Text style={[styles.disclaimerText, { color: COLORS.text }]}>
                  {isRTL
                    ? 'بيانات مشفّرة وتُستخدم لمرة واحدة فقط للتحقق. الموافقة خلال 1-2 يوم عمل.'
                    : 'Encrypted data, used once for verification. Approval within 1-2 business days.'}
                </Text>
              </View>

              <PrimaryButton
                disabled={!step3Valid || submitting}
                onPress={handleSubmit}
                label={isRTL ? 'إرسال الطلب' : 'Submit application'}
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

function SummaryRow({ label, value, COLORS, isRTL }: any) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 12,
    }}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: COLORS.text,
          fontSize: 13,
          fontWeight: '600',
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
        }}
        numberOfLines={1}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

function Field({
  icon,
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  error,
  hint,
  autoCapitalize,
  COLORS,
  isRTL,
}: any) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? '#ef4444' : focused ? COLORS.primary : COLORS.border;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: COLORS.text, fontWeight: '600', marginBottom: 6, fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 12,
          backgroundColor: COLORS.card,
          borderColor,
          minHeight: 52,
        }}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={focused ? COLORS.primary : COLORS.textSecondary}
            style={{ marginHorizontal: 6 }}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize={autoCapitalize ?? 'none'}
          style={{ flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 10, paddingHorizontal: 6 }}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>
      {error ? (
        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: '#10b981', fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{hint}</Text>
      ) : null}
    </View>
  );
}

function UploadCard({ label, hint, required, uri, onPick, onClear, COLORS, isRTL }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 13 }}>
          {label}{required ? ' *' : ''}
        </Text>
        {hint ? <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>{hint}</Text> : null}
      </View>

      {uri ? (
        <View style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          backgroundColor: COLORS.card,
          borderColor: COLORS.primary,
          borderWidth: 1,
          borderRadius: BORDER_RADIUS.md,
          padding: 10,
          gap: 12,
        }}>
          <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.border }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                {isRTL ? 'تم الرفع' : 'Uploaded'}
              </Text>
            </View>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginTop: 6 }}>
              <TouchableOpacity onPress={onPick} accessibilityRole="button">
                <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '600' }}>
                  {isRTL ? 'تغيير' : 'Replace'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClear} accessibilityRole="button">
                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>
                  {isRTL ? 'حذف' : 'Remove'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          style={{
            backgroundColor: COLORS.card,
            borderColor: COLORS.border,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderRadius: BORDER_RADIUS.md,
            padding: 18,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 110,
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
          </View>
          <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 14 }}>
            {isRTL ? 'اضغط لاختيار صورة' : 'Tap to upload'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
            {isRTL ? 'JPG / PNG حتى 5MB' : 'JPG / PNG up to 5MB'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PrimaryButton({ disabled, onPress, label, loading, COLORS }: any) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        marginTop: 24,
        opacity: disabled ? 0.4 : 1,
        minHeight: 54,
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOpacity: disabled ? 0 : 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: disabled ? 0 : 4,
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    // flexGrow keeps short steps filling the viewport; the large bottom pad
    // gives room to scroll the last field above the keyboard on small screens.
    scrollContent: { padding: SPACING.lg, paddingBottom: 140, flexGrow: 1 },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: C.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 16, fontWeight: '800' },
    stepBadge: {
      color: C.primary,
      fontWeight: '800',
      fontSize: 13,
      backgroundColor: C.primary + '15',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    progress: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: SPACING.lg,
      paddingTop: 12,
      paddingBottom: 4,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    sectionHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      marginBottom: 18,
    },
    sectionIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: { fontSize: 19, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    sectionSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    fieldLabel: { fontWeight: '600', fontSize: 13, marginBottom: 8, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    fieldHint: { fontSize: 11, marginTop: -4, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: { fontWeight: '600', fontSize: 13 },
    specGrid: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 8,
    },
    specCard: {
      width: '48%',
      borderWidth: 1.5,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
      gap: 8,
      minHeight: 86,
      position: 'relative',
    },
    specText: { fontSize: 13 },
    specCheck: {
      position: 'absolute',
      top: 8,
      [isRTL ? 'left' : 'right']: 8,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bioWrap: {
      borderWidth: 1.5,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
    },
    bioInput: {
      fontSize: 14,
      minHeight: 110,
      textAlignVertical: 'top',
    },
    bioMeta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    reviewCard: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginVertical: 14,
    },
    reviewHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingBottom: 8,
      marginBottom: 6,
      borderBottomWidth: 1,
    },
    disclaimer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: BORDER_RADIUS.md,
      marginTop: 6,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      textAlign: isRTL ? 'right' : 'left',
    },
  });
