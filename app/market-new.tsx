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
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { createListing, type ListingCategory } from '../services/marketService';

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
  const [submitting, setSubmitting] = useState(false);

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
      await createListing(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        price: Number(price),
        city: city.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
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
              numberOfLines={4}
              style={[styles.input, { color: COLORS.text, minHeight: 100, textAlignVertical: 'top' }]}
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
  chipsWrap: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipText: { color: C.text, fontWeight: '600', fontSize: 13 },
  submit: { paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
