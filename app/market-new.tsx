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
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { createListing, type ListingCategory } from '../services/marketService';
import { uploadOrderMedia } from '../services/storageService';

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
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ListingCategory>('used_device');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState((userProfile as any)?.phone ?? '');
  const [condition, setCondition] = useState<string>('used');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'نحتاج إذن الوصول للصور' : 'Gallery permission is required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 8));
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
    setSubmitting(true);
    try {
      let uploaded: string[] = [];
      if (images.length > 0) {
        uploaded = await uploadOrderMedia(user.id, images, `market/${user.id}/${Date.now()}`);
      }
      const conditionLabel = CONDITIONS.find((c) => c.id === condition);
      const conditionLine = conditionLabel
        ? (isRTL ? `الحالة: ${conditionLabel.ar}` : `Condition: ${conditionLabel.en}`)
        : '';
      const fullDescription = [conditionLine, description.trim()]
        .filter(Boolean)
        .join('\n');
      await createListing(user.id, {
        title: title.trim(),
        description: fullDescription || undefined,
        category,
        price: Number(price),
        city: city.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 12 }}>
          <Field label={isRTL ? 'العنوان' : 'Title'} COLORS={COLORS}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isRTL ? 'مثال: iPhone 13 Pro نظيف' : 'e.g. iPhone 13 Pro — clean condition'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'الصور' : 'Photos'} COLORS={COLORS}>
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
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>
              {isRTL ? 'يمكنك إضافة حتى 8 صور' : 'You can add up to 8 photos'}
            </Text>
          </Field>

          <Field label={isRTL ? 'الحالة' : 'Condition'} COLORS={COLORS}>
            <View style={styles.chipsWrap}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCondition(c.id)}
                  style={[
                    styles.chip,
                    condition === c.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                  ]}
                >
                  <Text style={[styles.chipText, condition === c.id && { color: '#fff' }]}>
                    {isRTL ? c.ar : c.en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label={isRTL ? 'التصنيف' : 'Category'} COLORS={COLORS}>
            <View style={styles.chipsWrap}>
              {CATEGORY_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[
                    styles.chip,
                    category === c.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                  ]}
                >
                  <Text style={[styles.chipText, category === c.id && { color: '#fff' }]}>
                    {isRTL ? c.ar : c.en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label={isRTL ? 'السعر (SAR)' : 'Price (SAR)'} COLORS={COLORS}>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'الوصف' : 'Description'} COLORS={COLORS}>
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

          <Field label={isRTL ? 'المدينة' : 'City'} COLORS={COLORS}>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder={isRTL ? 'مثال: الرياض' : 'e.g. Riyadh'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'رقم التواصل' : 'Contact phone'} COLORS={COLORS}>
            <TextInput
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, flex: 1 }}>
              {isRTL
                ? 'سيظهر إعلانك بعد مراجعة فريق Fixate.'
                : 'Listings appear after review by the Fixate team.'}
            </Text>
          </View>

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
    </SafeAreaView>
  );
}

function Field({ label, children, COLORS }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: COLORS.textSecondary, fontWeight: '600', fontSize: 13 }}>{label}</Text>
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipText: { color: C.text, fontWeight: '600', fontSize: 13 },
  submit: { paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
