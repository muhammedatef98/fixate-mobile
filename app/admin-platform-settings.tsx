import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import ErrorState from '../components/ErrorState';
import { supabase } from '../services/supabaseClient';
import {
  PLATFORM_SETTINGS_KEYS,
  getPlatformSettings,
  upsertPlatformSettings,
  invalidatePlatformSettingsCache,
  type PlatformSettings,
} from '../services/platformSettingsService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

// Local working copy of the settings — numbers stay as strings while the
// admin types so we can preserve partial input ("3" -> "3.5") without
// fighting React. They're parsed/validated at save time.
interface FormState {
  inspectionFee: string;
  returnFee: string;
  commissionRate: string;
  easternProvinceEnabled: boolean;
  serviceAreaMessageAr: string;
  serviceAreaMessageEn: string;
  loyaltyEnabled: boolean;
  loyaltyPointsPerSAR: string;
  loyaltyRedeemMin: string;
  loyaltyRedeemRate: string;
  loyaltyRedeemMaxPct: string;
  /** JSON-encoded tier list, edited as raw text for now. */
  loyaltyTiersJson: string;
  commitmentFee: string;
  commitmentEnabled: boolean;
  maintenanceMode: boolean;
  announcementEnabled: boolean;
  announcementAr: string;
  announcementEn: string;
  minAppVersion: string;
}

const toForm = (s: PlatformSettings): FormState => ({
  inspectionFee: String(s.inspectionFee),
  returnFee: String(s.returnFee),
  commissionRate: String(s.commissionRate),
  easternProvinceEnabled: s.easternProvinceEnabled,
  serviceAreaMessageAr: s.serviceAreaMessageAr,
  serviceAreaMessageEn: s.serviceAreaMessageEn,
  loyaltyEnabled: s.loyalty.enabled,
  loyaltyPointsPerSAR: String(s.loyalty.pointsPerSAR),
  loyaltyRedeemMin: String(s.loyalty.redeemMin),
  loyaltyRedeemRate: String(s.loyalty.redeemRate),
  loyaltyRedeemMaxPct: String(s.loyalty.redeemMaxPct),
  loyaltyTiersJson: JSON.stringify(s.loyalty.tiers, null, 2),
  commitmentFee: String(s.commitmentFee),
  commitmentEnabled: s.commitmentEnabled,
  maintenanceMode: s.maintenanceMode,
  announcementEnabled: s.announcementEnabled,
  announcementAr: s.announcementAr,
  announcementEn: s.announcementEn,
  minAppVersion: s.minAppVersion,
});

interface FieldErrors {
  inspectionFee?: string;
  returnFee?: string;
  commissionRate?: string;
  serviceAreaMessageAr?: string;
  serviceAreaMessageEn?: string;
  loyaltyPointsPerSAR?: string;
  loyaltyRedeemMin?: string;
  loyaltyRedeemRate?: string;
  loyaltyRedeemMaxPct?: string;
  loyaltyTiersJson?: string;
  commitmentFee?: string;
}

export default function AdminPlatformSettingsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [adminChecked, setAdminChecked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Same admin gate the dashboard uses, so this screen is safe even if a
  // non-admin lands on it directly via a deep link.
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setAdminChecked(false);
      return;
    }
    Promise.resolve(
      supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
    )
      .then(({ data }: any) => !cancelled && setAdminChecked(data?.is_admin === true))
      .catch(() => !cancelled && setAdminChecked(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const metaAdmin = (user?.user_metadata as any)?.is_admin === true;
  const isAdmin = adminChecked === true || (userProfile as any)?.is_admin === true || metaAdmin;

  const load = useCallback(async () => {
    setError(null);
    try {
      invalidatePlatformSettingsCache();
      const s = await getPlatformSettings();
      setForm(toForm(s));
    } catch (e: any) {
      logger.error('admin platform-settings load failed', e);
      setError(getFriendlyError(e, language));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language]);

  useEffect(() => {
    if (adminChecked === null) return; // wait for gate
    load();
  }, [adminChecked, load]);

  const validate = (f: FormState): FieldErrors => {
    const err: FieldErrors = {};
    const inspection = Number(f.inspectionFee);
    if (!Number.isFinite(inspection) || inspection < 0) {
      err.inspectionFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    }
    const ret = Number(f.returnFee);
    if (!Number.isFinite(ret) || ret < 0) {
      err.returnFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    }
    const rate = Number(f.commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      err.commissionRate = isRTL
        ? 'النسبة يجب أن تكون بين 0 و 1'
        : 'Rate must be between 0 and 1';
    }
    const lpps = Number(f.loyaltyPointsPerSAR);
    if (!Number.isFinite(lpps) || lpps < 0) {
      err.loyaltyPointsPerSAR = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    }
    const lmin = Number(f.loyaltyRedeemMin);
    if (!Number.isFinite(lmin) || lmin < 0) {
      err.loyaltyRedeemMin = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    }
    const lrate = Number(f.loyaltyRedeemRate);
    if (!Number.isFinite(lrate) || lrate < 0) {
      err.loyaltyRedeemRate = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    }
    const lmax = Number(f.loyaltyRedeemMaxPct);
    if (!Number.isFinite(lmax) || lmax < 0 || lmax > 1) {
      err.loyaltyRedeemMaxPct = isRTL ? 'بين 0 و 1' : 'Between 0 and 1';
    }
    try {
      const parsed = JSON.parse(f.loyaltyTiersJson);
      if (!Array.isArray(parsed)) throw new Error('not array');
    } catch {
      err.loyaltyTiersJson = isRTL ? 'JSON غير صالح' : 'Invalid JSON array';
    }
    const com = Number(f.commitmentFee);
    if (!Number.isFinite(com) || com < 0) {
      err.commitmentFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    }
    if (!f.serviceAreaMessageAr.trim()) {
      err.serviceAreaMessageAr = isRTL ? 'مطلوب' : 'Required';
    }
    if (!f.serviceAreaMessageEn.trim()) {
      err.serviceAreaMessageEn = isRTL ? 'مطلوب' : 'Required';
    }
    return err;
  };

  const handleSave = async () => {
    if (!form) return;
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length > 0) {
      Alert.alert(
        isRTL ? 'تحقّق من المدخلات' : 'Check your inputs',
        isRTL ? 'يوجد حقول غير صالحة' : 'Some fields are invalid'
      );
      return;
    }
    setSaving(true);
    try {
      const tiers = JSON.parse(form.loyaltyTiersJson);
      await upsertPlatformSettings([
        { key: PLATFORM_SETTINGS_KEYS.inspectionFee, value: Number(form.inspectionFee) },
        { key: PLATFORM_SETTINGS_KEYS.returnFee, value: Number(form.returnFee) },
        { key: PLATFORM_SETTINGS_KEYS.commissionRate, value: Number(form.commissionRate) },
        { key: PLATFORM_SETTINGS_KEYS.easternProvinceEnabled, value: form.easternProvinceEnabled },
        { key: PLATFORM_SETTINGS_KEYS.serviceAreaMessageAr, value: form.serviceAreaMessageAr.trim() },
        { key: PLATFORM_SETTINGS_KEYS.serviceAreaMessageEn, value: form.serviceAreaMessageEn.trim() },
        { key: PLATFORM_SETTINGS_KEYS.loyaltyEnabled, value: form.loyaltyEnabled },
        { key: PLATFORM_SETTINGS_KEYS.loyaltyPointsPerSAR, value: Number(form.loyaltyPointsPerSAR) },
        { key: PLATFORM_SETTINGS_KEYS.loyaltyRedeemMin, value: Number(form.loyaltyRedeemMin) },
        { key: PLATFORM_SETTINGS_KEYS.loyaltyRedeemRate, value: Number(form.loyaltyRedeemRate) },
        { key: PLATFORM_SETTINGS_KEYS.loyaltyRedeemMaxPct, value: Number(form.loyaltyRedeemMaxPct) },
        { key: PLATFORM_SETTINGS_KEYS.loyaltyTiers, value: tiers },
        { key: PLATFORM_SETTINGS_KEYS.commitmentFee, value: Number(form.commitmentFee) },
        { key: PLATFORM_SETTINGS_KEYS.commitmentEnabled, value: form.commitmentEnabled },
        { key: PLATFORM_SETTINGS_KEYS.maintenanceMode, value: form.maintenanceMode },
        { key: PLATFORM_SETTINGS_KEYS.announcementEnabled, value: form.announcementEnabled },
        { key: PLATFORM_SETTINGS_KEYS.announcementAr, value: form.announcementAr.trim() },
        { key: PLATFORM_SETTINGS_KEYS.announcementEn, value: form.announcementEn.trim() },
        { key: PLATFORM_SETTINGS_KEYS.minAppVersion, value: form.minAppVersion.trim() },
      ]);
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL ? 'تم تحديث إعدادات المنصة بنجاح.' : 'Platform settings updated successfully.'
      );
    } catch (e: any) {
      logger.error('admin platform-settings save failed', e);
      Alert.alert(
        isRTL ? 'فشل الحفظ' : 'Save failed',
        getFriendlyError(e, language)
      );
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  // Admin gate is still resolving
  if (adminChecked === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={isRTL ? 'إعدادات المنصة' : 'Platform Settings'}
          isRTL={isRTL}
          COLORS={COLORS}
          onBack={() => safeBack('/admin')}
        />
        <View style={styles.centered}>
          <MaterialCommunityIcons name="shield-lock-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.deniedTitle}>
            {isRTL ? 'صلاحية الوصول مرفوضة' : 'Access denied'}
          </Text>
          <Text style={styles.deniedBody}>
            {isRTL
              ? 'هذه الشاشة مخصصة للمدراء فقط.'
              : 'This screen is restricted to admins only.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header
        title={isRTL ? 'إعدادات المنصة' : 'Platform Settings'}
        isRTL={isRTL}
        COLORS={COLORS}
        onBack={() => safeBack('/admin')}
        right={
          <TouchableOpacity
            onPress={onRefresh}
            disabled={loading || refreshing || saving}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'تحديث' : 'Refresh'}
            style={styles.refreshBtn}
          >
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading && !form ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {isRTL ? 'جاري تحميل الإعدادات…' : 'Loading settings…'}
            </Text>
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !form ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="tune-vertical" size={56} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>
              {isRTL ? 'لا توجد إعدادات بعد' : 'No settings yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {isRTL
                ? 'سيتم إنشاء الصفوف عند الحفظ لأول مرة.'
                : 'Rows will be created on first save.'}
            </Text>
            <TouchableOpacity onPress={load} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{isRTL ? 'تحميل' : 'Load'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
            }
          >
            <Text style={styles.intro}>
              {isRTL
                ? 'هذه القيم تُطبَّق على كامل المنصة. التعديلات تحتاج صلاحية مدير.'
                : 'These values apply platform-wide. Changes require admin privileges.'}
            </Text>

            {/* App control */}
            <SectionTitle isRTL={isRTL} COLORS={COLORS}>
              {isRTL ? 'التحكم بالتطبيق' : 'App control'}
            </SectionTitle>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isRTL ? 'وضع الصيانة' : 'Maintenance mode'}
                </Text>
                <Text style={styles.hint}>
                  {isRTL
                    ? 'عند التفعيل، يُعرض للمستخدمين إشعار بأن التطبيق تحت الصيانة.'
                    : 'When on, users are shown a maintenance notice.'}
                </Text>
              </View>
              <Switch
                value={form.maintenanceMode}
                onValueChange={(v) => setForm({ ...form, maintenanceMode: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isRTL ? 'شريط الإعلان' : 'Announcement banner'}
                </Text>
                <Text style={styles.hint}>
                  {isRTL
                    ? 'يعرض شريطاً في أعلى التطبيق بالرسالة أدناه.'
                    : 'Shows a banner at the top of the app with the message below.'}
                </Text>
              </View>
              <Switch
                value={form.announcementEnabled}
                onValueChange={(v) => setForm({ ...form, announcementEnabled: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>

            <FieldMultiline
              label={isRTL ? 'نص الإعلان (عربي)' : 'Announcement text (Arabic)'}
              value={form.announcementAr}
              onChangeText={(v) => setForm({ ...form, announcementAr: v })}
              COLORS={COLORS}
              isRTL={isRTL}
              forceRTL
            />
            <FieldMultiline
              label={isRTL ? 'نص الإعلان (إنجليزي)' : 'Announcement text (English)'}
              value={form.announcementEn}
              onChangeText={(v) => setForm({ ...form, announcementEn: v })}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            <FieldNumber
              label={isRTL ? 'أدنى إصدار مطلوب للتطبيق' : 'Minimum required app version'}
              hint={
                isRTL
                  ? 'مثال: 1.2.0 — المستخدمون على إصدار أقدم سيُطلب منهم التحديث.'
                  : 'e.g. 1.2.0 — users on an older version will be asked to update.'
              }
              value={form.minAppVersion}
              onChangeText={(v) => setForm({ ...form, minAppVersion: v })}
              COLORS={COLORS}
              isRTL={isRTL}
              step="0.1"
            />

            {/* Fees */}
            <SectionTitle isRTL={isRTL} COLORS={COLORS}>
              {isRTL ? 'الرسوم' : 'Fees'}
            </SectionTitle>

            <FieldNumber
              label={isRTL ? 'رسوم الفحص الافتراضية (ر.س)' : 'Default inspection fee (SAR)'}
              hint={
                isRTL
                  ? 'تُحتسب عند رفض العميل لعرض السعر بعد فحص الفني.'
                  : 'Charged when the customer rejects the technician quote.'
              }
              value={form.inspectionFee}
              onChangeText={(v) => setForm({ ...form, inspectionFee: v })}
              error={errors.inspectionFee}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            <FieldNumber
              label={isRTL ? 'رسوم الإرجاع الافتراضية (ر.س)' : 'Default return fee (SAR)'}
              hint={
                isRTL
                  ? 'تُضاف لرسوم الفحص في حالة الاستلام والتوصيل عند الرفض.'
                  : 'Added to the inspection fee when a picked-up device is returned.'
              }
              value={form.returnFee}
              onChangeText={(v) => setForm({ ...form, returnFee: v })}
              error={errors.returnFee}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            <FieldNumber
              label={isRTL ? 'عمولة المنصة (0 - 1)' : 'Platform commission (0 - 1)'}
              hint={
                isRTL
                  ? 'نسبة بين 0 و 1. مثال: 0.15 تعني 15٪.'
                  : 'A ratio between 0 and 1. Example: 0.15 means 15%.'
              }
              value={form.commissionRate}
              onChangeText={(v) => setForm({ ...form, commissionRate: v })}
              error={errors.commissionRate}
              COLORS={COLORS}
              isRTL={isRTL}
              step="0.01"
            />

            {/* Service area */}
            <SectionTitle isRTL={isRTL} COLORS={COLORS}>
              {isRTL ? 'منطقة الخدمة' : 'Service area'}
            </SectionTitle>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isRTL ? 'تفعيل المنطقة الشرقية' : 'Eastern Province enabled'}
                </Text>
                <Text style={styles.hint}>
                  {isRTL
                    ? 'فعّل هذا الخيار عند توسّع الخدمة لكامل المنطقة الشرقية.'
                    : 'Turn on once service expands across the Eastern Province.'}
                </Text>
              </View>
              <Switch
                value={form.easternProvinceEnabled}
                onValueChange={(v) => setForm({ ...form, easternProvinceEnabled: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>

            <FieldMultiline
              label={isRTL ? 'رسالة منطقة الخدمة (عربي)' : 'Service-area message (Arabic)'}
              value={form.serviceAreaMessageAr}
              onChangeText={(v) => setForm({ ...form, serviceAreaMessageAr: v })}
              error={errors.serviceAreaMessageAr}
              COLORS={COLORS}
              isRTL={isRTL}
              forceRTL
            />

            <FieldMultiline
              label={isRTL ? 'رسالة منطقة الخدمة (إنجليزي)' : 'Service-area message (English)'}
              value={form.serviceAreaMessageEn}
              onChangeText={(v) => setForm({ ...form, serviceAreaMessageEn: v })}
              error={errors.serviceAreaMessageEn}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            {/* Commitment amount (pre-inspection) */}
            <SectionTitle isRTL={isRTL} COLORS={COLORS}>
              {isRTL ? 'مبلغ التأكيد قبل الفحص' : 'Pre-inspection commitment'}
            </SectionTitle>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isRTL ? 'تفعيل مبلغ التأكيد' : 'Enable commitment amount'}
                </Text>
                <Text style={styles.hint}>
                  {isRTL
                    ? 'عند الإيقاف، لا يُطلب من العميل دفع أي مبلغ قبل بدء الفحص.'
                    : 'When off, the customer is not asked to pay anything before inspection.'}
                </Text>
              </View>
              <Switch
                value={form.commitmentEnabled}
                onValueChange={(v) => setForm({ ...form, commitmentEnabled: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>

            <FieldNumber
              label={isRTL ? 'مبلغ التأكيد (ر.س)' : 'Commitment amount (SAR)'}
              hint={
                isRTL
                  ? 'يدفعه العميل قبل بدء الفحص لتأكيد جدية الحجز. يُخصم من الفاتورة النهائية بعد انتهاء الإصلاح.'
                  : 'Paid by the customer before inspection to confirm seriousness of booking. Deducted from the final invoice after the repair completes.'
              }
              value={form.commitmentFee}
              onChangeText={(v) => setForm({ ...form, commitmentFee: v })}
              error={errors.commitmentFee}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            {/* Loyalty program */}
            <SectionTitle isRTL={isRTL} COLORS={COLORS}>
              {isRTL ? 'برنامج الولاء' : 'Loyalty program'}
            </SectionTitle>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isRTL ? 'تفعيل برنامج الولاء' : 'Enable loyalty program'}
                </Text>
                <Text style={styles.hint}>
                  {isRTL
                    ? 'عند الإيقاف، يتم إخفاء كسب النقاط واستبدالها من تطبيق العميل.'
                    : 'When off, earning and redeeming are hidden from the customer app.'}
                </Text>
              </View>
              <Switch
                value={form.loyaltyEnabled}
                onValueChange={(v) => setForm({ ...form, loyaltyEnabled: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>

            <FieldNumber
              label={isRTL ? 'النقاط لكل ريال (معدل الكسب)' : 'Points per SAR (earn rate)'}
              hint={isRTL ? 'كم نقطة يحصل عليها العميل لكل ريال يصرفه.' : 'How many points the customer earns per SAR spent.'}
              value={form.loyaltyPointsPerSAR}
              onChangeText={(v) => setForm({ ...form, loyaltyPointsPerSAR: v })}
              error={errors.loyaltyPointsPerSAR}
              COLORS={COLORS}
              isRTL={isRTL}
              step="0.1"
            />

            <FieldNumber
              label={isRTL ? 'الحد الأدنى للاستبدال (نقاط)' : 'Minimum points to redeem'}
              hint={isRTL ? 'لا يُسمح بالاستبدال أقل من هذا الرصيد.' : 'No redemption is allowed below this balance.'}
              value={form.loyaltyRedeemMin}
              onChangeText={(v) => setForm({ ...form, loyaltyRedeemMin: v })}
              error={errors.loyaltyRedeemMin}
              COLORS={COLORS}
              isRTL={isRTL}
            />

            <FieldNumber
              label={isRTL ? 'قيمة النقطة (ر.س)' : 'Value per point (SAR)'}
              hint={isRTL ? 'قيمة النقطة الواحدة عند تطبيقها على الفاتورة.' : 'SAR value of one point when applied to an invoice.'}
              value={form.loyaltyRedeemRate}
              onChangeText={(v) => setForm({ ...form, loyaltyRedeemRate: v })}
              error={errors.loyaltyRedeemRate}
              COLORS={COLORS}
              isRTL={isRTL}
              step="0.01"
            />

            <FieldNumber
              label={isRTL ? 'الحد الأقصى من الفاتورة (0 - 1)' : 'Max share of invoice (0 - 1)'}
              hint={isRTL ? 'مثال: 0.3 يعني أن النقاط لا تغطي أكثر من 30٪ من الفاتورة.' : 'Example: 0.3 means points can cover at most 30% of the bill.'}
              value={form.loyaltyRedeemMaxPct}
              onChangeText={(v) => setForm({ ...form, loyaltyRedeemMaxPct: v })}
              error={errors.loyaltyRedeemMaxPct}
              COLORS={COLORS}
              isRTL={isRTL}
              step="0.01"
            />

            <FieldMultiline
              label={isRTL ? 'مستويات الاستبدال (JSON)' : 'Redemption tiers (JSON)'}
              value={form.loyaltyTiersJson}
              onChangeText={(v) => setForm({ ...form, loyaltyTiersJson: v })}
              error={errors.loyaltyTiersJson}
              COLORS={COLORS}
              isRTL={isRTL}
            />
          </ScrollView>
        )}

        {form && !error && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'حفظ' : 'Save'}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {isRTL ? 'حفظ الإعدادات' : 'Save settings'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({
  title,
  isRTL,
  COLORS,
  onBack,
  right,
}: {
  title: string;
  isRTL: boolean;
  COLORS: any;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        style={{ padding: 4 }}
      >
        <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text }}>{title}</Text>
      <View style={{ width: 32 }}>{right}</View>
    </View>
  );
}

function SectionTitle({ children, isRTL, COLORS }: any) {
  return (
    <Text
      style={{
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '800',
        marginTop: 18,
        marginBottom: 10,
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {children}
    </Text>
  );
}

function FieldNumber({
  label,
  hint,
  value,
  onChangeText,
  error,
  COLORS,
  isRTL,
  step,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  COLORS: any;
  isRTL: boolean;
  step?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      {hint ? (
        <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
          {hint}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^0-9.\-]/g, ''))}
        keyboardType="decimal-pad"
        inputMode={step ? 'decimal' : 'numeric'}
        style={{
          borderWidth: 1,
          borderColor: error ? '#EF4444' : COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: COLORS.text,
          backgroundColor: COLORS.card,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
      {error ? (
        <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function FieldMultiline({
  label,
  value,
  onChangeText,
  error,
  COLORS,
  isRTL,
  forceRTL,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  COLORS: any;
  isRTL: boolean;
  forceRTL?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{
          borderWidth: 1,
          borderColor: error ? '#EF4444' : COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: COLORS.text,
          backgroundColor: COLORS.card,
          minHeight: 92,
          textAlign: forceRTL ? 'right' : isRTL ? 'right' : 'left',
          writingDirection: forceRTL ? 'rtl' : undefined,
        }}
      />
      {error ? (
        <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 10 },
    loadingText: { color: COLORS.textSecondary, marginTop: 8 },
    deniedTitle: { color: COLORS.text, fontWeight: '800', fontSize: 18, marginTop: 12 },
    deniedBody: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
    emptyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16, marginTop: 12 },
    emptyBody: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
    primaryBtn: {
      marginTop: 16,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    refreshBtn: { padding: 4 },
    intro: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 6,
      textAlign: isRTL ? 'right' : 'left',
    },
    label: { color: COLORS.text, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    hint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    switchRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
      marginBottom: 14,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: SPACING.lg,
      backgroundColor: COLORS.background,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    saveBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: COLORS.primary,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.md,
    },
    saveBtnText: { color: '#fff', fontWeight: '800' },
  });
