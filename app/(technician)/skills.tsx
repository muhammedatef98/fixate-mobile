import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../../components/RTLIcon';
import ImagePickerSheet from '../../components/ImagePickerSheet';
import { supabase } from '../../services/supabaseClient';
import {
  getMyTechnicianProfile,
  uploadDoc,
} from '../../services/technicianOnboardingService';
import { getFriendlyError } from '../../utils/errorMessages';
import { logger } from '../../utils/logger';

/**
 * Skills & Experience — the approved technician's own editor for
 * specialties, years of experience, bio and certificates. Replaces the old
 * (wrong) route that dumped an existing technician back into the full
 * onboarding/registration form.
 */
interface Certification {
  id: string;
  title: string;
  issuer: string;
  year: string;
  image_path?: string;
}

export default function TechnicianSkillsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = makeStyles(C, isRTL, SHADOWS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [years, setYears] = useState('');
  const [bio, setBio] = useState('');
  const [certs, setCerts] = useState<Certification[]>([]);

  // Inline "add certificate" form.
  const [certTitle, setCertTitle] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certYear, setCertYear] = useState('');
  const [certImageUri, setCertImageUri] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingCert, setAddingCert] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const t = await getMyTechnicianProfile(user.id);
        if (t) {
          setSpecialties(Array.isArray(t.specialization) ? t.specialization : []);
          setYears(t.years_of_experience != null ? String(t.years_of_experience) : '');
          setBio(t.bio ?? '');
          setCerts(Array.isArray(t.certifications) ? t.certifications : []);
        }
      } catch (e) {
        logger.warn('load technician skills failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const addSpecialty = () => {
    const s = newSpecialty.trim();
    if (!s) return;
    if (specialties.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setNewSpecialty('');
      return;
    }
    setSpecialties((prev) => [...prev, s]);
    setNewSpecialty('');
  };

  const removeSpecialty = (s: string) =>
    setSpecialties((prev) => prev.filter((x) => x !== s));

  const pickCertImage = async (source: 'camera' | 'gallery') => {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      };
      const res =
        source === 'camera'
          ? await (async () => {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) return null;
              return ImagePicker.launchCameraAsync(opts);
            })()
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (res && !res.canceled && res.assets?.[0]?.uri) {
        setCertImageUri(res.assets[0].uri);
      }
    } catch (e) {
      logger.warn('pick cert image failed', e);
    }
  };

  const addCertificate = async () => {
    if (!user) return;
    const title = certTitle.trim();
    if (!title) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'اكتب اسم الشهادة' : 'Enter the certificate name');
      return;
    }
    setAddingCert(true);
    try {
      let imagePath: string | undefined;
      if (certImageUri) {
        imagePath = await uploadDoc(user.id, certImageUri, 'cert');
      }
      const cert: Certification = {
        id: `${Date.now()}`,
        title,
        issuer: certIssuer.trim(),
        year: certYear.trim(),
        ...(imagePath ? { image_path: imagePath } : {}),
      };
      setCerts((prev) => [...prev, cert]);
      setCertTitle('');
      setCertIssuer('');
      setCertYear('');
      setCertImageUri(null);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setAddingCert(false);
    }
  };

  const removeCertificate = (id: string) =>
    setCerts((prev) => prev.filter((c) => c.id !== id));

  const save = async () => {
    if (!user) return;
    if (specialties.length === 0) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'أضف تخصصاً واحداً على الأقل' : 'Add at least one specialty');
      return;
    }
    const y = years.trim() === '' ? 0 : Number(years);
    if (!Number.isFinite(y) || y < 0 || y > 60) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'سنوات الخبرة غير منطقية' : 'Years of experience looks wrong');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('technicians')
        .update({
          specialization: specialties,
          years_of_experience: y,
          bio: bio.trim(),
          certifications: certs,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL ? 'تم تحديث مهاراتك وخبراتك.' : 'Your skills and experience were updated.',
        [{ text: isRTL ? 'حسناً' : 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'المهارات والخبرات' : 'Skills & Experience'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Specialties */}
            <Text style={styles.sectionTitle}>{isRTL ? 'التخصصات والمهارات' : 'Specialties & skills'}</Text>
            <View style={styles.chipsWrap}>
              {specialties.map((s) => (
                <View key={s} style={[styles.chip, { backgroundColor: C.primary + '14', borderColor: C.primary + '40' }]}>
                  <Text style={[styles.chipText, { color: C.primary }]}>{s}</Text>
                  <TouchableOpacity onPress={() => removeSpecialty(s)} accessibilityLabel={isRTL ? 'إزالة' : 'Remove'}>
                    <Ionicons name="close-circle" size={16} color={C.primary} />
                  </TouchableOpacity>
                </View>
              ))}
              {specialties.length === 0 && (
                <Text style={{ color: C.textSecondary, fontSize: 13 }}>
                  {isRTL ? 'لا توجد مهارات بعد — أضف أول مهارة' : 'No skills yet — add your first one'}
                </Text>
              )}
            </View>
            <View style={styles.addRow}>
              <TextInput
                value={newSpecialty}
                onChangeText={setNewSpecialty}
                onSubmitEditing={addSpecialty}
                placeholder={isRTL ? 'مثال: إصلاح شاشات آيفون' : 'e.g. iPhone screen repair'}
                placeholderTextColor={C.textSecondary}
                style={styles.input}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addSpecialty} style={[styles.addBtn, { backgroundColor: C.primary }]} accessibilityRole="button">
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Experience */}
            <Text style={styles.sectionTitle}>{isRTL ? 'سنوات الخبرة' : 'Years of experience'}</Text>
            <TextInput
              value={years}
              onChangeText={(v) => setYears(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="5"
              placeholderTextColor={C.textSecondary}
              style={[styles.input, { maxWidth: 120 }]}
            />

            {/* Bio */}
            <Text style={styles.sectionTitle}>{isRTL ? 'نبذة عنك' : 'About you'}</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={600}
              placeholder={isRTL ? 'اكتب نبذة قصيرة عن خبرتك وشغلك…' : 'A short bio about your experience…'}
              placeholderTextColor={C.textSecondary}
              style={[styles.input, { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }]}
            />

            {/* Certificates */}
            <Text style={styles.sectionTitle}>{isRTL ? 'الشهادات' : 'Certificates'}</Text>
            {certs.map((c) => (
              <View key={c.id} style={styles.certCard}>
                <View style={[styles.certIcon, { backgroundColor: C.primary + '14' }]}>
                  <MaterialCommunityIcons name="certificate-outline" size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.certTitle}>{c.title}</Text>
                  {(c.issuer || c.year) ? (
                    <Text style={styles.certSub}>
                      {[c.issuer, c.year].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  {c.image_path ? (
                    <Text style={[styles.certSub, { color: C.primary }]}>
                      {isRTL ? 'صورة مرفقة ✓' : 'Image attached ✓'}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      isRTL ? 'حذف الشهادة' : 'Delete certificate',
                      c.title,
                      [
                        { text: isRTL ? 'تراجع' : 'Cancel', style: 'cancel' },
                        { text: isRTL ? 'حذف' : 'Delete', style: 'destructive', onPress: () => removeCertificate(c.id) },
                      ]
                    )
                  }
                  accessibilityLabel={isRTL ? 'حذف' : 'Delete'}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add certificate */}
            <View style={styles.addCertCard}>
              <Text style={[styles.certTitle, { marginBottom: 8 }]}>
                {isRTL ? 'إضافة شهادة' : 'Add a certificate'}
              </Text>
              <TextInput
                value={certTitle}
                onChangeText={setCertTitle}
                placeholder={isRTL ? 'اسم الشهادة *' : 'Certificate name *'}
                placeholderTextColor={C.textSecondary}
                style={[styles.input, { marginBottom: 8 }]}
              />
              <TextInput
                value={certIssuer}
                onChangeText={setCertIssuer}
                placeholder={isRTL ? 'الجهة المانحة (اختياري)' : 'Issuer (optional)'}
                placeholderTextColor={C.textSecondary}
                style={[styles.input, { marginBottom: 8 }]}
              />
              <TextInput
                value={certYear}
                onChangeText={(v) => setCertYear(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={4}
                placeholder={isRTL ? 'السنة (اختياري)' : 'Year (optional)'}
                placeholderTextColor={C.textSecondary}
                style={[styles.input, { marginBottom: 8, maxWidth: 140 }]}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setPickerOpen(true)}
                  style={[styles.attachBtn, { borderColor: C.border }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="image-outline" size={16} color={C.primary} />
                  <Text style={{ color: C.primary, fontSize: 12.5, fontWeight: '700' }}>
                    {certImageUri
                      ? (isRTL ? 'تغيير الصورة' : 'Change image')
                      : (isRTL ? 'إرفاق صورة' : 'Attach image')}
                  </Text>
                </TouchableOpacity>
                {certImageUri && (
                  <Image source={{ uri: certImageUri }} style={{ width: 42, height: 42, borderRadius: 8 }} />
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={addCertificate}
                  disabled={addingCert}
                  style={[styles.addBtn, { backgroundColor: C.primary, opacity: addingCert ? 0.6 : 1, paddingHorizontal: 16, width: undefined }]}
                  accessibilityRole="button"
                >
                  {addingCert ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                      {isRTL ? 'إضافة' : 'Add'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: C.primary, opacity: saving ? 0.6 : 1 }]}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>{isRTL ? 'حفظ التغييرات' : 'Save changes'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <ImagePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(source) => {
          setPickerOpen(false);
          void pickCertImage(source);
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: C.text },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: C.text,
      marginTop: 18,
      marginBottom: 10,
      textAlign: isRTL ? 'right' : 'left',
    },
    chipsWrap: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipText: { fontSize: 13, fontWeight: '700' },
    addRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
      alignItems: 'center',
    },
    input: {
      flex: 1,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    addBtn: {
      width: 46,
      height: 46,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    certCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      marginBottom: 8,
      ...SHADOWS.small,
    },
    certIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    certTitle: { color: C.text, fontSize: 14, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    certSub: { color: C.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    addCertCard: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      marginTop: 4,
    },
    attachBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    saveBtn: {
      minHeight: 52,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 22,
      ...SHADOWS.small,
    },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
