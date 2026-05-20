import React, { useMemo, useState } from 'react';
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
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  createListing,
  type ListingCategory,
  type DeviceType,
  type ListingCondition,
  type ContactMethod,
} from '../services/marketService';
import { uploadOrderMedia } from '../services/storageService';

const DEVICE_TYPES: { id: DeviceType; ar: string; en: string; icon: string }[] = [
  { id: 'phone',     ar: 'جوال',   en: 'Phone',     icon: 'cellphone' },
  { id: 'laptop',    ar: 'لابتوب', en: 'Laptop',    icon: 'laptop' },
  { id: 'tablet',    ar: 'تابلت',  en: 'Tablet',    icon: 'tablet' },
  { id: 'watch',     ar: 'ساعة',   en: 'Watch',     icon: 'watch' },
  { id: 'accessory', ar: 'إكسسوار', en: 'Accessory', icon: 'headphones' },
  { id: 'other',     ar: 'أخرى',   en: 'Other',     icon: 'dots-horizontal' },
];

const CATEGORIES: { id: ListingCategory; ar: string; en: string }[] = [
  { id: 'used_device', ar: 'جهاز مستعمل', en: 'Used device' },
  { id: 'accessory',   ar: 'إكسسوار',     en: 'Accessory' },
  { id: 'spare_part',  ar: 'قطعة غيار',   en: 'Spare part' },
  { id: 'other',       ar: 'أخرى',        en: 'Other' },
];

const CONDITIONS: { id: ListingCondition; ar: string; en: string }[] = [
  { id: 'new',         ar: 'جديد',        en: 'New' },
  { id: 'like_new',    ar: 'شبه جديد',    en: 'Like new' },
  { id: 'refurbished', ar: 'مجدّد',       en: 'Refurbished' },
  { id: 'used',        ar: 'مستعمل',      en: 'Used' },
  { id: 'for_parts',   ar: 'قطع غيار',    en: 'For parts' },
];

const CONTACT_OPTIONS: { id: ContactMethod; ar: string; en: string; icon: string }[] = [
  { id: 'whatsapp', ar: 'واتساب',      en: 'WhatsApp',          icon: 'logo-whatsapp' },
  { id: 'phone',    ar: 'مكالمة هاتفية', en: 'Phone call',       icon: 'call' },
  { id: 'in_app',   ar: 'رسالة داخل التطبيق', en: 'In-app message', icon: 'chatbubble-ellipses' },
];

export default function MarketNewScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ListingCategory>('used_device');
  const [deviceType, setDeviceType] = useState<DeviceType>('phone');
  const [condition, setCondition] = useState<ListingCondition>('used');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState((userProfile as any)?.phone ?? '');
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>(['in_app']);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const toggleContact = (m: ContactMethod) => {
    setContactMethods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const addImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Alert',
        isRTL ? 'نحتاج إذن الوصول للصور' : 'Gallery permission is required'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 10));
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return isRTL ? 'أدخل عنوان الإعلان' : 'Listing title is required';
    if (title.trim().length < 4) return isRTL ? 'العنوان قصير جداً' : 'Title is too short';
    if (!price.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0)
      return isRTL ? 'أدخل سعراً صحيحاً' : 'Enter a valid price';
    if (!description.trim() || description.trim().length < 15)
      return isRTL
        ? 'أضف وصفاً مفيداً (15 حرفاً على الأقل)'
        : 'Add a helpful description (at least 15 characters)';
    if (images.length === 0)
      return isRTL ? 'أضف صورة واحدة على الأقل' : 'Add at least one photo';
    if (contactMethods.length === 0)
      return isRTL
        ? 'اختر طريقة تواصل واحدة على الأقل'
        : 'Pick at least one contact method';
    const phoneNeeded = contactMethods.includes('whatsapp') || contactMethods.includes('phone');
    if (phoneNeeded && !contactPhone.trim())
      return isRTL
        ? 'أدخل رقم التواصل (مطلوب لواتساب/الاتصال)'
        : 'Enter a contact phone (required for WhatsApp/Call)';
    return null;
  };

  const submit = async () => {
    if (!user) {
      Alert.alert(isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required');
      return;
    }
    const err = validate();
    if (err) {
      Alert.alert(isRTL ? 'حقول ناقصة' : 'Missing fields', err);
      return;
    }
    setSubmitting(true);
    try {
      let uploaded: string[] = [];
      if (images.length > 0) {
        uploaded = await uploadOrderMedia(user.id, images, `market/${user.id}/${Date.now()}`);
      }
      await createListing(user.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        device_type: deviceType,
        condition,
        price: Number(price),
        city: city.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_methods: contactMethods,
        // Keep the old contact_preference column populated for any code
        // still reading it (backward compat during rollout).
        contact_preference: contactMethods.length === 1 && contactMethods[0] === 'in_app'
          ? 'dm'
          : (contactMethods.includes('in_app') ? 'both' : 'phone'),
        images: uploaded,
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
    }
  };

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'إعلان جديد' : 'New listing'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 14, paddingBottom: 100 }}>
          {/* Photos */}
          <Field label={isRTL ? 'الصور (مطلوب)' : 'Photos (required)'} COLORS={COLORS} isRTL={isRTL}>
            <View style={styles.chipsWrap}>
              <TouchableOpacity onPress={addImages} style={styles.addImg}>
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
            <Hint COLORS={COLORS}>
              {isRTL ? `حتى 10 صور — ${images.length}/10 مضافة` : `Up to 10 photos — ${images.length}/10 added`}
            </Hint>
          </Field>

          {/* Title */}
          <Field label={isRTL ? 'العنوان' : 'Title'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isRTL ? 'مثال: iPhone 13 Pro نظيف 256GB' : 'e.g. iPhone 13 Pro 256GB — clean condition'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
              maxLength={80}
            />
          </Field>

          {/* Device type */}
          <Field label={isRTL ? 'نوع الجهاز' : 'Device type'} COLORS={COLORS} isRTL={isRTL}>
            <View style={styles.chipsWrap}>
              {DEVICE_TYPES.map((d) => {
                const active = deviceType === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setDeviceType(d.id)}
                    style={[styles.chip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <MaterialCommunityIcons name={d.icon as any} size={14} color={active ? '#fff' : COLORS.text} />
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {isRTL ? d.ar : d.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* Condition */}
          <Field label={isRTL ? 'الحالة' : 'Condition'} COLORS={COLORS} isRTL={isRTL}>
            <View style={styles.chipsWrap}>
              {CONDITIONS.map((c) => {
                const active = condition === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCondition(c.id)}
                    style={[styles.chip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {isRTL ? c.ar : c.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* Category */}
          <Field label={isRTL ? 'التصنيف' : 'Category'} COLORS={COLORS} isRTL={isRTL}>
            <View style={styles.chipsWrap}>
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategory(c.id)}
                    style={[styles.chip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {isRTL ? c.ar : c.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* Price */}
          <Field label={isRTL ? 'السعر (ر.س)' : 'Price (SAR)'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={price}
              onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={isRTL ? 'مثال: 1850' : 'e.g. 1850'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          {/* Description */}
          <Field label={isRTL ? 'الوصف' : 'Description'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              placeholder={isRTL
                ? 'اكتب: الحالة العامة، الملحقات المرفقة، سبب البيع، قابلية التفاوض، أي عيوب...'
                : 'Describe: overall condition, included accessories, reason for selling, negotiable, any defects...'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text, minHeight: 120, textAlignVertical: 'top' }]}
              maxLength={1500}
            />
            <Hint COLORS={COLORS}>{description.length}/1500</Hint>
          </Field>

          {/* City */}
          <Field label={isRTL ? 'المدينة' : 'City'} COLORS={COLORS} isRTL={isRTL}>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder={isRTL ? 'مثال: القطيف' : 'e.g. Al Qatif'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          {/* Contact methods */}
          <Field label={isRTL ? 'طرق التواصل المفضلة' : 'Preferred contact methods'} COLORS={COLORS} isRTL={isRTL}>
            <View style={{ gap: 8 }}>
              {CONTACT_OPTIONS.map((opt) => {
                const active = contactMethods.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => toggleContact(opt.id)}
                    style={[styles.contactRow, active && { backgroundColor: COLORS.primary + '10', borderColor: COLORS.primary }]}
                  >
                    <View style={[styles.contactIcon, { backgroundColor: active ? COLORS.primary : COLORS.border }]}>
                      <Ionicons name={opt.icon as any} size={18} color={active ? '#fff' : COLORS.text} />
                    </View>
                    <Text style={[styles.contactLabel, { color: COLORS.text }]}>
                      {isRTL ? opt.ar : opt.en}
                    </Text>
                    <Ionicons
                      name={active ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={active ? COLORS.primary : COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Hint COLORS={COLORS}>
              {isRTL
                ? 'يمكنك اختيار أكثر من طريقة. سيرى المشتري فقط الأزرار التي اخترتها.'
                : 'Pick one or more. Buyers will only see the contact buttons you allow.'}
            </Hint>
          </Field>

          {(contactMethods.includes('whatsapp') || contactMethods.includes('phone')) && (
            <Field label={isRTL ? 'رقم التواصل' : 'Contact phone'} COLORS={COLORS} isRTL={isRTL}>
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                placeholder={isRTL ? 'مثال: +9665XXXXXXXX' : 'e.g. +9665XXXXXXXX'}
                placeholderTextColor={COLORS.textSecondary}
                style={[styles.input, { color: COLORS.text }]}
              />
            </Field>
          )}

          <View style={{ height: 8 }} />
          <TouchableOpacity
            style={[styles.previewBtn, { borderColor: COLORS.primary }]}
            onPress={() => {
              const err = validate();
              if (err) {
                Alert.alert(isRTL ? 'تحقق من المدخلات' : 'Check inputs', err);
                return;
              }
              setPreviewing(true);
            }}
          >
            <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.previewBtnText, { color: COLORS.primary }]}>
              {isRTL ? 'معاينة الإعلان' : 'Preview listing'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: COLORS.primary, opacity: submitting ? 0.6 : 1 }]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{isRTL ? 'إرسال للمراجعة' : 'Submit for review'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Preview modal — shows the listing exactly as a buyer would see it */}
      <Modal visible={previewing} animationType="slide" onRequestClose={() => setPreviewing(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setPreviewing(false)}>
              <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isRTL ? 'معاينة' : 'Preview'}</Text>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 12 }}>
            {images.length > 0 && (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={{ width: 320, height: 220, borderRadius: 12, marginRight: 8 }} />
                ))}
              </ScrollView>
            )}
            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text }}>{title}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.primary }}>{price} {isRTL ? 'ر.س' : 'SAR'}</Text>
            <Text style={{ color: COLORS.textSecondary }}>
              {isRTL ? `${DEVICE_TYPES.find(d => d.id === deviceType)?.ar} · ${CONDITIONS.find(c => c.id === condition)?.ar}` : `${DEVICE_TYPES.find(d => d.id === deviceType)?.en} · ${CONDITIONS.find(c => c.id === condition)?.en}`}
              {city ? ` · ${city}` : ''}
            </Text>
            <Text style={{ color: COLORS.text, lineHeight: 22 }}>{description}</Text>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 6 }} />
            <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>
              {isRTL ? 'أزرار التواصل التي سيراها المشتري:' : 'Contact buttons the buyer will see:'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {contactMethods.map((m) => {
                const opt = CONTACT_OPTIONS.find((o) => o.id === m)!;
                return (
                  <View key={m} style={[styles.previewPill, { backgroundColor: COLORS.primary + '15' }]}>
                    <Ionicons name={opt.icon as any} size={14} color={COLORS.primary} />
                    <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>
                      {isRTL ? opt.ar : opt.en}
                    </Text>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: COLORS.primary, marginTop: 18 }]}
              onPress={() => { setPreviewing(false); submit(); }}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{isRTL ? 'تأكيد ونشر' : 'Confirm & publish'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  COLORS,
  isRTL,
}: {
  label: string;
  children: React.ReactNode;
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      {children}
    </View>
  );
}

function Hint({ children, COLORS }: { children: React.ReactNode; COLORS: any }) {
  return <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>{children}</Text>;
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
    input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      fontSize: 15,
      backgroundColor: C.card,
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
    imgRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: C.card, borderRadius: 10 },
    chip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    chipText: { color: C.text, fontWeight: '600', fontSize: 13 },
    contactRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
    },
    contactIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
    previewBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    previewBtnText: { fontWeight: '700', fontSize: 14 },
    previewPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    submit: {
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      marginTop: 4,
    },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  });
