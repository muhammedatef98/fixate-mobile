import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { RTLIonicon } from '../components/RTLIcon';
import { getColors } from '../constants/theme';
import { safeBack } from '../utils/navigation';
import Avatar from '../components/Avatar';
import { uploadAvatar } from '../services/storageService';
import { updateUserProfile } from '../services/userService';

export default function EditProfileScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile, refreshUser } = useAuth();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);

  const [name, setName] = useState(userProfile?.name ?? '');
  const [phone, setPhone] = useState(userProfile?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    userProfile?.avatar_url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Refresh the auth user on every focus. The email-change confirmation
  // completes server-side; without this, the locally cached JWT keeps the
  // old email claim until the next auto-refresh tick (~60 min) and the
  // screen would keep showing the old email after the user returns from
  // confirming the change.
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser])
  );

  // Sync local email input with the canonical user.email whenever
  // refreshUser (or any other path) lands a fresh auth user. The initial
  // useState above only fires once at mount; without this effect, the
  // field would stay at the value it had on first render even after the
  // email actually flips.
  useEffect(() => {
    setEmail(user?.email ?? '');
  }, [user?.email]);

  const pickAvatar = (fromCamera: boolean) => async () => {
    if (!user) return;
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          isRTL ? 'تنبيه' : 'Permission',
          isRTL
            ? 'نحتاج إذن الوصول لإكمال هذه الخطوة'
            : 'Permission is required to continue'
        );
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
      if (result.canceled || !result.assets?.[0]) return;

      setUploadingAvatar(true);
      const url = await uploadAvatar(user.id, result.assets[0].uri);
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onChangePhoto = () => {
    Alert.alert(
      isRTL ? 'صورة الملف الشخصي' : 'Profile photo',
      undefined,
      [
        { text: isRTL ? 'التقاط صورة' : 'Take a photo', onPress: pickAvatar(true) },
        {
          text: isRTL ? 'اختيار من المعرض' : 'Choose from gallery',
          onPress: pickAvatar(false),
        },
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Alert',
        isRTL ? 'الرجاء إدخال الاسم' : 'Please enter your name'
      );
      return;
    }
    if (!user) return;

    // Email is optional. If provided, validate format. If unchanged from
    // the current auth email, we skip the Supabase email-change call so
    // we don't trigger an unnecessary confirmation flow.
    const trimmedEmail = email.trim();
    const currentEmail = (user?.email ?? '').trim();
    const emailChanged = !!trimmedEmail && trimmedEmail !== currentEmail;
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Alert',
        isRTL ? 'الرجاء إدخال بريد إلكتروني صحيح' : 'Please enter a valid email'
      );
      return;
    }

    setSaving(true);
    try {
      // Persist to public.users — this is the row useAuth().userProfile reads,
      // so updating it (then refreshing) is what makes the new name re-render
      // everywhere in the app.
      await updateUserProfile(user.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl || undefined,
      });

      // Keep auth user_metadata in sync — order creation reads phone/name
      // from there.
      try {
        await supabase.auth.updateUser({
          data: { name: name.trim(), phone: phone.trim() },
        });
      } catch (e) {
        logger.warn('auth metadata sync failed (non-fatal)', e);
      }

      // Email change is a separate auth call so errors (e.g. "email already
      // in use") surface to the user instead of being swallowed alongside
      // the metadata sync. Supabase sends a confirmation link to the new
      // address; the actual auth.users.email value flips only after the
      // user clicks that link.
      //
      // emailRedirectTo points Supabase at our static landing page (see
      // docs/email-change-confirmation.html, served via GitHub Pages of
      // this repo), which then auto-attempts to deep-link back into the
      // app via fixatee:///auth/callback and offers a manual "Open Fixatee"
      // button as a fallback. The URL must also be on Supabase's
      // Additional Redirect URLs allow-list. Env override is available for
      // staging builds; default is the live prod page so the call always
      // has a real destination (never localhost).
      const emailRedirectTo =
        process.env.EXPO_PUBLIC_EMAIL_REDIRECT_URL ||
        'https://muhammedatef98.github.io/fixatee-mobile/email-change-confirmation.html';
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser(
          { email: trimmedEmail },
          { emailRedirectTo }
        );
        if (emailError) {
          Alert.alert(
            isRTL ? 'خطأ' : 'Error',
            emailError.message ||
              (isRTL
                ? 'فشل تحديث البريد الإلكتروني'
                : 'Failed to update email')
          );
          setSaving(false);
          return;
        }
      }

      await refreshUser();

      Alert.alert(
        isRTL ? 'نجح' : 'Success',
        emailChanged
          ? isRTL
            ? 'تم حفظ التغييرات. تم إرسال رابط لتأكيد البريد الإلكتروني الجديد.'
            : 'Changes saved. A confirmation link has been sent to your new email.'
          : isRTL
            ? 'تم تحديث الملف الشخصي بنجاح'
            : 'Profile updated successfully',
        [{ text: 'OK', onPress: () => safeBack() }]
      );
    } catch (e: any) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        e?.message ??
          (isRTL ? 'فشل تحديث الملف الشخصي' : 'Failed to update profile')
      );
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.card}
      />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          onPress={() => safeBack()}
          style={styles.backButton}
        >
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={onChangePhoto}
            activeOpacity={0.8}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تغيير الصورة' : 'Change photo'}
          >
            <Avatar name={name} uri={avatarUrl} size={104} />
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={18} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>
            {isRTL ? 'اضغط لتغيير الصورة' : 'Tap to change photo'}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{isRTL ? 'الاسم الكامل' : 'Full Name'}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="person-outline"
              size={20}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={isRTL ? 'أدخل اسمك' : 'Enter your name'}
              placeholderTextColor={COLORS.textSecondary}
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {isRTL ? 'البريد الإلكتروني' : 'Email'}
          </Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{isRTL ? 'رقم الجوال' : 'Phone Number'}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="call-outline"
              size={20}
              color={COLORS.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="05xxxxxxxx"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (saving || uploadingAvatar) && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={saving || uploadingAvatar}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: ReturnType<typeof getColors>, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      height: 60,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.card,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: C.text },
    backButton: { padding: 8 },
    content: { padding: 20 },
    avatarSection: { alignItems: 'center', marginBottom: 24 },
    avatarWrap: { position: 'relative' },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: isRTL ? undefined : 0,
      left: isRTL ? 0 : undefined,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: C.background,
    },
    avatarHint: {
      marginTop: 10,
      fontSize: 13,
      color: C.textSecondary,
    },
    inputGroup: { marginBottom: 20 },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textSecondary,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    inputWrapper: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 12,
    },
    inputIcon: { marginHorizontal: 6 },
    input: { flex: 1, height: 50, fontSize: 16, color: C.text },
    saveButton: {
      backgroundColor: C.primary,
      height: 55,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
    },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  });
