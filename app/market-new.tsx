import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  createListing,
  MARKET_DEVICE_TYPES,
  type ListingCategory,
  type ContactPreference,
  type DeviceType,
} from '../services/marketService';
import { uploadMarketMedia } from '../services/storageService';
import SaudiCityPicker from '../components/SaudiCityPicker';
import ImagePickerSheet from '../components/ImagePickerSheet';
import SelectField from '../components/SelectField';

const CONDITIONS: { id: string; ar: string; en: string }[] = [
  { id: 'new', ar: 'جديد', en: 'New' },
  { id: 'like_new', ar: 'شبه جديد', en: 'Like new' },
  { id: 'used', ar: 'مستعمل', en: 'Used' },
  { id: 'for_parts', ar: 'قطع غيار', en: 'For parts' },
];

const CATEGORY_OPTIONS: { id: ListingCategory; ar: string; en: string }[] = [
  { id: 'used_device', ar: 'جهاز مستعمل', en: 'Used device' },
  { id: 'accessory', ar: 'إكسسوار', en: 'Accessory' },
  { id: 'spare_part', ar: 'قطعة غيار', en: 'Spare part' },
  { id: 'other', ar: 'أخرى', en: 'Other' },
];

export default function MarketNewScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const { isAdmin } = useIsAdmin();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ListingCategory>('used_device');
  const [deviceType, setDeviceType] = useState<DeviceType>('phone');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState((userProfile as any)?.phone ?? '');
  const [contactPreference, setContactPreference] = useState<ContactPreference>('both');
  const [condition, setCondition] = useState<string>('used');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<'idle' | 'uploading' | 'publishing'>('idle');
  const [imageSheetOpen, setImageSheetOpen] = useState(false);

  const pickFrom = async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            isRTL ? 'تنبيه' : 'Alert',
            isRTL ? 'نحتاج إذن الكاميرا' : 'Camera permission is required'
          );
          return;
        }
        // Pick at full quality — storageService.compressImage is the single
        // compression stage. Picker-side re-encoding here would stack a second
        // lossy JPEG pass on top, washing out card/hero images.
        const result = await ImagePicker.launchCameraAsync({ quality: 1 });
        if (!result.canceled) {
          setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 8));
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            isRTL ? 'تنبيه' : 'Alert',
            isRTL ? 'نحتاج إذن الوصول للصور' : 'Gallery permission is required'
          );
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 1,
        });
        if (!result.canceled) {
          setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 8));
        }
      }
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    }
  };

  const submit = async () => {
    if (!user) {
      Alert.alert(isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required');
      return;
    }
    if (!title.trim() || !price.trim()) {
      Alert.alert(
        isRTL ? 'حقول ناقصة' : 'Missing fields',
        isRTL ? 'العنوان والسعر مطلوبان' : 'Title and price are required'
      );
      return;
    }
    // Guard the price: a non-numeric or non-positive value would otherwise be
    // submitted as NaN / 0 and land a broken listing.
    const priceValue = Number(price.replace(/,/g, '').trim());
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      Alert.alert(
        isRTL ? 'سعر غير صالح' : 'Invalid price',
        isRTL ? 'أدخل سعراً صحيحاً أكبر من صفر.' : 'Enter a valid price greater than zero.'
      );
      return;
    }
    // Validate before any upload so the seller never waits on a doomed submit.
    if ((contactPreference === 'phone' || contactPreference === 'both') && !contactPhone.trim()) {
      Alert.alert(
        isRTL ? 'رقم التواصل مطلوب' : 'Phone required',
        isRTL
          ? 'اخترت تلقي الاتصال عبر الهاتف. أدخل رقماً أو غيّر طريقة التواصل إلى رسالة فقط.'
          : 'You chose to receive phone contact. Enter a number or switch the contact method to DM only.'
      );
      return;
    }
    setSubmitting(true);
    try {
      let uploaded: string[] = [];
      if (images.length > 0) {
        setSubmitStage('uploading');
        uploaded = await uploadMarketMedia(user.id, images);
      }
      const conditionLabel = CONDITIONS.find((c) => c.id === condition);
      const conditionLine = conditionLabel
        ? (isRTL ? `الحالة: ${conditionLabel.ar}` : `Condition: ${conditionLabel.en}`)
        : '';
      const fullDescription = [conditionLine, description.trim()]
        .filter(Boolean)
        .join('\n');
      setSubmitStage('publishing');
      await createListing(user.id, {
        title: title.trim(),
        description: fullDescription || undefined,
        category,
        device_type: deviceType,
        price: priceValue,
        city: city.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_preference: contactPreference,
        images: uploaded,
        // FEAT-8 — admin listings are auto-branded Fixate Certified.
        official: isAdmin,
      });
      Alert.alert(
        isRTL ? 'تم الإرسال' : 'Submitted',
        isRTL
          ? 'إعلانك بانتظار المراجعة وسيظهر بعد الموافقة.'
          : 'Your listing is pending review and will appear once approved.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
      setSubmitStage('idle');
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'إعلان جديد' : 'New listing'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, gap: 12, paddingBottom: 80, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Field label={isRTL ? 'العنوان' : 'Title'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isRTL ? 'مثال: iPhone 13 Pro نظيف' : 'e.g. iPhone 13 Pro — clean condition'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'الصور' : 'Photos'} COLORS={COLORS} isRTL={isRTL}>
            <View style={styles.chipsWrap}>
              <TouchableOpacity onPress={() => setImageSheetOpen(true)} style={styles.addImg}>
                <Ionicons name="camera" size={22} color={COLORS.textSecondary} />
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {isRTL ? 'إضافة' : 'Add'}
                </Text>
              </TouchableOpacity>
              {images.map((uri, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image source={{ uri }} style={styles.imgThumb} />
                  <TouchableOpacity
                    style={styles.imgRemove}
                    onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>
              {isRTL ? 'يمكنك إضافة حتى 8 صور' : 'You can add up to 8 photos'}
            </Text>
          </Field>

          <Field label={isRTL ? 'الحالة' : 'Condition'} COLORS={COLORS} isRTL={isRTL}>
            <SelectField
              value={condition}
              options={CONDITIONS.map((c) => ({ id: c.id, label: isRTL ? c.ar : c.en }))}
              onSelect={setCondition}
              isRTL={isRTL}
              placeholder={isRTL ? 'اختر الحالة' : 'Select condition'}
            />
          </Field>

          <Field label={isRTL ? 'نوع الجهاز' : 'Device category'} COLORS={COLORS} isRTL={isRTL}>
            <SelectField
              value={deviceType}
              options={MARKET_DEVICE_TYPES.map((d) => ({ id: d.id, label: isRTL ? d.ar : d.en }))}
              onSelect={(id) => setDeviceType(id as DeviceType)}
              isRTL={isRTL}
              placeholder={isRTL ? 'اختر نوع الجهاز' : 'Select device category'}
            />
          </Field>

          <Field label={isRTL ? 'التصنيف' : 'Category'} COLORS={COLORS} isRTL={isRTL}>
            <SelectField
              value={category}
              options={CATEGORY_OPTIONS.map((c) => ({ id: c.id, label: isRTL ? c.ar : c.en }))}
              onSelect={(id) => setCategory(id as ListingCategory)}
              isRTL={isRTL}
              placeholder={isRTL ? 'اختر التصنيف' : 'Select category'}
            />
          </Field>

          <Field label={isRTL ? 'السعر (SAR)' : 'Price (SAR)'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'الوصف' : 'Description'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              placeholder={isRTL
                ? 'اكتب تفاصيل أكثر: الحالة، الملحقات، سبب البيع، قابلية التفاوض...'
                : 'Add more details: condition, accessories, reason for selling, negotiable...'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text, minHeight: 120, textAlignVertical: 'top' }]}
            />
          </Field>

          <Field label={isRTL ? 'المدينة' : 'City'} COLORS={COLORS} isRTL={isRTL}>
            {/* Marketplace listings are not service-gated — a seller can
                post from anywhere in KSA. Explicitly opt out of the
                coverage-gating default so every Saudi city is pickable. */}
            <SaudiCityPicker
              mode="all"
              value={city}
              onSelect={setCity}
              isRTL={isRTL}
              placeholder={isRTL ? 'اختر المدينة' : 'Select city'}
            />
          </Field>

          <Field label={isRTL ? 'كيف تفضل أن يتواصل المشتري؟' : 'How should buyers contact you?'} COLORS={COLORS} isRTL={isRTL}>
            <View style={styles.chipsWrap}>
              {([
                { id: 'both' as const,  ar: 'مكالمة + رسالة', en: 'Phone + DM' },
                { id: 'dm' as const,    ar: 'رسالة فقط',     en: 'Direct message only' },
                { id: 'phone' as const, ar: 'هاتف فقط',     en: 'Phone only' },
              ]).map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setContactPreference(opt.id)}
                  style={[
                    styles.chip,
                    contactPreference === opt.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                  ]}
                >
                  <Text style={[styles.chipText, contactPreference === opt.id && { color: '#fff' }]}>
                    {isRTL ? opt.ar : opt.en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {(contactPreference === 'phone' || contactPreference === 'both') && (
            <Field label={isRTL ? 'رقم التواصل' : 'Contact phone'} COLORS={COLORS} isRTL={isRTL}>
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                style={[styles.input, { color: COLORS.text }]}
              />
            </Field>
          )}

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: COLORS.primary, opacity: submitting ? 0.6 : 1 }]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.submitText}>
                  {submitStage === 'uploading'
                    ? (isRTL ? 'جارٍ رفع الصور…' : 'Uploading photos…')
                    : (isRTL ? 'جارٍ النشر…' : 'Publishing…')}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitText}>{isRTL ? 'نشر الإعلان' : 'Publish Listing'}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.publishNote}>
            {isRTL
              ? 'لن يظهر إعلانك إلا بعد موافقة فريق المراجعة، وسيتم إشعارك عند القبول'
              : "Your listing won't be visible until reviewed and approved. You'll be notified upon approval."}
          </Text>

          {/* §6 — marketplace disclaimer: the platform is only a venue; deals
              are strictly between buyer and seller. */}
          <Text style={styles.publishNote}>
            {isRTL
              ? 'السوق منصّة ربط فقط؛ الصفقات والدفع والتسليم تتم مباشرة بينك وبين الطرف الآخر وعلى مسؤوليتكما. المنصّة غير مسؤولة عن جودة المنتج أو النزاعات. بالنشر فإنك توافق على '
              : 'The Marketplace is a connection venue only; deals, payment and hand-over are directly between you and the other party and at your responsibility. The platform is not liable for item quality or disputes. By publishing you agree to the '}
            <Text
              style={{ color: COLORS.primary, fontWeight: '700' }}
              onPress={() => router.push('/terms' as any)}
            >
              {isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}
            </Text>
            {isRTL ? ' (قسم السوق).' : ' (Marketplace section).'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ImagePickerSheet
        visible={imageSheetOpen}
        onClose={() => setImageSheetOpen(false)}
        onPick={pickFrom}
        isRTL={isRTL}
      />
    </SafeAreaView>
  );
}

function Field({ label, children, COLORS, isRTL }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: COLORS.textSecondary,
          fontWeight: '600',
          fontSize: 13,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    fontSize: 15,
    backgroundColor: C.card,
    textAlign: isRTL ? 'right' : 'left',
  },
  chipsWrap: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  addImg: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgThumb: { width: 72, height: 72, borderRadius: BORDER_RADIUS.md },
  imgRemove: { position: 'absolute', top: -8, [isRTL ? 'left' : 'right']: -8, backgroundColor: C.card, borderRadius: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipText: { color: C.text, fontWeight: '600', fontSize: 13 },
  submit: { paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  publishNote: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },
});
