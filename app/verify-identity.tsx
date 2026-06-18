/**
 * verify-identity.tsx — Saudi ID / Iqama verification application.
 *
 * Renders three states based on the user's most recent application:
 *   - no application yet → show the form
 *   - status === 'pending'  → show "Under review" empty state
 *   - status === 'rejected' → show rejection reason + allow re-submit
 *   - status === 'approved' → show success, link back to profile
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING } from '../constants/theme';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import {
  submitUserVerification,
  getMyVerification,
  generateChallenge,
  type IdDocumentType,
  type UserVerificationRow,
} from '../services/userVerificationService';

export default function VerifyIdentityScreen() {
  const router = useRouter();
  const { isDark, language } = useApp();
  const { user, refreshUser } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<UserVerificationRow | null>(null);

  const [docType, setDocType] = useState<IdDocumentType>('saudi_id');
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  // FEATURE-1 — a fresh anti-replay challenge generated when the screen opens.
  const [challenge, setChallenge] = useState<string>('');

  useEffect(() => {
    setChallenge((prev) => generateChallenge(isRTL, prev || null));
    // Regenerate when language flips so the displayed text matches.
  }, [isRTL]);

  const regenerateChallenge = () =>
    setChallenge((prev) => generateChallenge(isRTL, prev || null));

  const loadExisting = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const row = await getMyVerification(user.id);
      setExisting(row);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const pickImage = async (setter: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        isRTL ? 'الإذن مرفوض' : 'Permission denied',
        isRTL ? 'يرجى السماح بالوصول للمعرض' : 'Please allow gallery access',
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.uri) setter(res.assets[0].uri);
  };

  // Selfie must be captured live with the front camera (KYC liveness).
  const captureSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        isRTL ? 'الإذن مرفوض' : 'Permission denied',
        isRTL ? 'يرجى السماح باستخدام الكاميرا' : 'Please allow camera access',
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.uri) setSelfieUri(res.assets[0].uri);
  };

  const canSubmit = useMemo(() => (
    fullName.trim().length >= 3
    && docNumber.trim().length >= 6
    && !!frontUri
    && !!selfieUri
    && !!challenge
    && !submitting
  ), [fullName, docNumber, frontUri, selfieUri, challenge, submitting]);

  const handleSubmit = async () => {
    if (!user?.id || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitUserVerification({
        userId: user.id,
        documentType: docType,
        documentNumber: docNumber,
        fullName,
        frontImageUri: frontUri ?? '',
        selfieImageUri: selfieUri ?? '',
        challengeText: challenge,
      });
      await refreshUser?.();
      Alert.alert(
        isRTL ? 'تم الإرسال ✓' : 'Submitted ✓',
        isRTL
          ? 'استلمنا طلبك. ستظهر العلامة الموثّقة عند موافقة المسؤول.'
          : 'We received your request. The verified mark will appear once an admin approves it.',
        [{ text: 'OK', onPress: () => safeBack('/profile') }],
      );
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg === 'PENDING_ALREADY_EXISTS') {
        Alert.alert(
          isRTL ? 'طلب قائم' : 'Application exists',
          isRTL ? 'لديك طلب قيد المراجعة بالفعل.' : 'You already have a pending application.',
        );
      } else {
        Alert.alert(isRTL ? 'خطأ' : 'Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Header (reused across all states)
  const renderHeader = () => (
    <View style={styles.header}>
      <AnimatedBackButton
        onPress={() => safeBack('/profile')}
        color={COLORS.text}
        backgroundColor={COLORS.surface ?? COLORS.background}
        size={42}
        iconSize={22}
        rtl
        accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
      />
      <Text style={styles.headerTitle}>
        {isRTL ? 'توثيق الحساب' : 'Account Verification'}
      </Text>
      <View style={{ width: 42 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Approved state
  if (existing?.status === 'approved') {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, { backgroundColor: '#10B98122' }]}>
            <MaterialIcons name="verified" size={48} color="#10B981" />
          </View>
          <Text style={styles.stateTitle}>
            {isRTL ? 'حسابك موثّق' : 'Your account is verified'}
          </Text>
          <Text style={styles.stateBody}>
            {isRTL
              ? 'يظهر لك علامة التوثيق في الملف الشخصي وعلى إعلانات السوق.'
              : 'The verified mark appears on your profile and on every market listing you publish.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Pending state
  if (existing?.status === 'pending') {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.stateWrap}>
          <View style={[styles.stateIcon, { backgroundColor: '#F59E0B22' }]}>
            <MaterialCommunityIcons name="clock-outline" size={48} color="#F59E0B" />
          </View>
          <Text style={styles.stateTitle}>
            {isRTL ? 'طلبك قيد المراجعة' : 'Application under review'}
          </Text>
          <Text style={styles.stateBody}>
            {isRTL
              ? 'يراجع فريقنا مستنداتك. سنُعلمك فور اعتمادها.'
              : 'Our team is reviewing your documents. You will be notified once approved.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form (no application yet OR last one was rejected → allow resubmit)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {renderHeader()}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {existing?.status === 'rejected' && existing.rejection_reason ? (
            <View style={styles.rejectionCard}>
              <View style={styles.rejectionRow}>
                <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                <Text style={styles.rejectionTitle}>
                  {isRTL ? 'طلبك السابق مرفوض' : 'Previous application rejected'}
                </Text>
              </View>
              <Text style={styles.rejectionBody}>{existing.rejection_reason}</Text>
            </View>
          ) : null}

          <Text style={styles.intro}>
            {isRTL
              ? 'لرفع علامة التوثيق على حسابك وعلى إعلاناتك في السوق، أرفق صورة هويتك الوطنية أو إقامتك، والتقط صورة شخصية أثناء تنفيذ التحدي الظاهر بالأسفل. تبقى مستنداتك خاصة ولا تظهر للمستخدمين.'
              : 'To earn the verified mark, upload your Saudi national ID or Iqama and take a live selfie performing the challenge shown below. Documents remain private and are never shown to other users.'}
          </Text>

          {/* Document type */}
          <Text style={styles.label}>
            {isRTL ? 'نوع المستند' : 'Document type'}
          </Text>
          <View style={styles.segmentRow}>
            {(['saudi_id', 'iqama'] as IdDocumentType[]).map((t) => {
              const active = docType === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setDocType(t)}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: active ? COLORS.primary : COLORS.card,
                      borderColor: active ? COLORS.primary : COLORS.border,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, { color: active ? '#fff' : COLORS.text }]}>
                    {t === 'saudi_id'
                      ? (isRTL ? 'هوية وطنية' : 'Saudi national ID')
                      : (isRTL ? 'إقامة' : 'Iqama')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Full name */}
          <Text style={styles.label}>
            {isRTL ? 'الاسم كما في المستند' : 'Full name (as on document)'}
          </Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={isRTL ? 'الاسم الرباعي' : 'Full legal name'}
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
          />

          {/* Document number */}
          <Text style={styles.label}>
            {isRTL ? 'رقم المستند' : 'Document number'}
          </Text>
          <TextInput
            value={docNumber}
            onChangeText={setDocNumber}
            placeholder={isRTL ? '1XXXXXXXXX' : '1XXXXXXXXX'}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            maxLength={12}
            style={styles.input}
          />

          {/* Front image */}
          <Text style={styles.label}>
            {isRTL ? 'صورة الوجه الأمامي' : 'Document front photo'}
          </Text>
          <UploadTile
            uri={frontUri}
            onPress={() => pickImage(setFrontUri)}
            placeholder={isRTL ? 'اضغط لاختيار صورة الوجه الأمامي' : 'Tap to upload front side'}
            COLORS={COLORS}
            isRTL={isRTL}
          />

          {/* FEATURE-1 — liveness challenge + selfie */}
          <Text style={styles.label}>
            {isRTL ? 'صورة شخصية مع التحدي' : 'Selfie with the challenge'}
          </Text>
          <View style={styles.challengeCard}>
            <View style={styles.challengeRow}>
              <MaterialCommunityIcons name="shield-account-outline" size={18} color={COLORS.primary} />
              <Text style={styles.challengeLabel}>
                {isRTL ? 'افعل التالي في الصورة:' : 'Do the following in the photo:'}
              </Text>
            </View>
            <Text style={styles.challengeText}>{challenge}</Text>
            <TouchableOpacity onPress={regenerateChallenge} style={styles.challengeRefresh} activeOpacity={0.8}>
              <MaterialCommunityIcons name="refresh" size={14} color={COLORS.primary} />
              <Text style={styles.challengeRefreshText}>
                {isRTL ? 'تحدٍّ آخر' : 'Another challenge'}
              </Text>
            </TouchableOpacity>
          </View>
          <UploadTile
            uri={selfieUri}
            onPress={captureSelfie}
            placeholder={isRTL ? 'اضغط لالتقاط صورة شخصية مع تنفيذ التحدي' : 'Tap to take a selfie performing the challenge'}
            COLORS={COLORS}
            isRTL={isRTL}
          />

          <TouchableOpacity
            disabled={!canSubmit}
            onPress={handleSubmit}
            activeOpacity={0.85}
            style={[
              styles.submitBtn,
              { backgroundColor: canSubmit ? COLORS.primary : COLORS.border },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.submitBtnText, { color: canSubmit ? '#fff' : COLORS.textSecondary }]}>
                {isRTL ? 'إرسال طلب التوثيق' : 'Submit for verification'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            {isRTL
              ? 'باستخدام هذه الميزة فإنك توافق على معالجة بياناتك لأغراض التحقق فقط.'
              : 'By submitting you agree your documents are used solely for identity verification.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function UploadTile({
  uri,
  onPress,
  placeholder,
  COLORS,
  isRTL,
}: {
  uri: string | null;
  onPress: () => void;
  placeholder: string;
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderWidth: 1.5,
        borderColor: uri ? COLORS.primary : COLORS.border,
        borderStyle: uri ? 'solid' : 'dashed',
        borderRadius: 16,
        backgroundColor: COLORS.card,
        overflow: 'hidden',
        marginBottom: 6,
        minHeight: 140,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: 180, resizeMode: 'cover' }} />
      ) : (
        <View style={{ alignItems: 'center', padding: 16 }}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={32} color={COLORS.primary} />
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center', textAlignVertical: 'center' }}>
            {placeholder}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  intro: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: isRTL ? 'right' : 'left',
  },
  label: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    textAlign: isRTL ? 'right' : 'left',
  },
  segmentRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
    textAlign: isRTL ? 'right' : 'left',
  },
  submitBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '800' },
  footnote: {
    color: C.textSecondary,
    fontSize: 11,
    marginTop: 14,
    lineHeight: 17,
    textAlign: 'center',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  stateIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  stateTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  stateBody: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  rejectionCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectionRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rejectionTitle: { color: '#991B1B', fontWeight: '800', fontSize: 13 },
  rejectionBody: { color: '#7F1D1D', fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  challengeCard: {
    backgroundColor: C.primary + '12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.primary + '44',
    padding: 14,
    marginBottom: 10,
  },
  challengeRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  challengeLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  challengeText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: isRTL ? 'right' : 'left',
    lineHeight: 24,
  },
  challengeRefresh: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
    marginTop: 10,
  },
  challengeRefreshText: { color: C.primary, fontSize: 12, fontWeight: '700' },
});
