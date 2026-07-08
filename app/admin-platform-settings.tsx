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
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import ErrorState from '../components/ErrorState';
import { supabase } from '../services/supabaseClient';
import {
  PLATFORM_SETTINGS_KEYS,
  getPlatformSettings,
  upsertPlatformSettings,
  invalidatePlatformSettingsCache,
  type PlatformSettings,
} from '../services/platformSettingsService';
import {
  listPaymentMethods,
  updatePaymentMethod,
  type PaymentMethod,
} from '../services/paymentMethodsService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';
import { useIsAdmin } from '../hooks/useAdminGuard';
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODE_DESCRIPTIONS,
} from '../utils/paymentPlan';

interface FormState {
  inspectionFee: string;
  inspectionEnabled: boolean;
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
  loyaltyTiersJson: string;
  commitmentFee: string;
  commitmentEnabled: boolean;
  maintenanceMode: boolean;
  announcementEnabled: boolean;
  announcementAr: string;
  announcementEn: string;
  minAppVersion: string;
  pushNotificationsEnabled: boolean;
  ratingsEnabled: boolean;
  marketplaceEnabled: boolean;
  serviceMobileEnabled: boolean;
  servicePickupEnabled: boolean;
  serviceHandoffEnabled: boolean;
  freeDeliveryEnabled: boolean;
  freeDeliveryPromoCode: string;
  paymentModeActive: string;
  paymentDepositType: 'fixed' | 'percent';
  paymentDepositValue: string;
  paymentPartialPercent: string;
}

const toForm = (s: PlatformSettings): FormState => ({
  inspectionFee: String(s.inspectionFee),
  inspectionEnabled: s.inspectionEnabled,
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
  pushNotificationsEnabled: s.pushNotificationsEnabled,
  ratingsEnabled: s.ratingsEnabled,
  marketplaceEnabled: s.marketplaceEnabled,
  serviceMobileEnabled: s.serviceMobileEnabled,
  servicePickupEnabled: s.servicePickupEnabled,
  serviceHandoffEnabled: s.serviceHandoffEnabled,
  freeDeliveryEnabled: s.freeDeliveryEnabled,
  freeDeliveryPromoCode: s.freeDeliveryPromoCode,
  paymentModeActive: s.paymentMode.mode,
  paymentDepositType: s.paymentMode.depositType,
  paymentDepositValue: String(s.paymentMode.depositValue),
  paymentPartialPercent: String(s.paymentMode.partialPercent),
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
  paymentDepositValue?: string;
  paymentPartialPercent?: string;
}

export default function AdminPlatformSettingsScreen() {
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

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
    if (adminChecking) return;
    load();
  }, [adminChecking, load]);

  const validate = (f: FormState): FieldErrors => {
    const err: FieldErrors = {};
    const num = (v: string) => Number(v);
    if (!Number.isFinite(num(f.inspectionFee)) || num(f.inspectionFee) < 0)
      err.inspectionFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    if (!Number.isFinite(num(f.returnFee)) || num(f.returnFee) < 0)
      err.returnFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    const rate = num(f.commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1)
      err.commissionRate = isRTL ? 'النسبة بين 0 و 1' : 'Rate must be 0–1';
    if (!Number.isFinite(num(f.loyaltyPointsPerSAR)) || num(f.loyaltyPointsPerSAR) < 0)
      err.loyaltyPointsPerSAR = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    if (!Number.isFinite(num(f.loyaltyRedeemMin)) || num(f.loyaltyRedeemMin) < 0)
      err.loyaltyRedeemMin = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    if (!Number.isFinite(num(f.loyaltyRedeemRate)) || num(f.loyaltyRedeemRate) < 0)
      err.loyaltyRedeemRate = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    const lmax = num(f.loyaltyRedeemMaxPct);
    if (!Number.isFinite(lmax) || lmax < 0 || lmax > 1)
      err.loyaltyRedeemMaxPct = isRTL ? 'بين 0 و 1' : 'Between 0 and 1';
    try {
      if (!Array.isArray(JSON.parse(f.loyaltyTiersJson))) throw new Error('not array');
    } catch {
      err.loyaltyTiersJson = isRTL ? 'JSON غير صالح' : 'Invalid JSON array';
    }
    if (!Number.isFinite(num(f.commitmentFee)) || num(f.commitmentFee) < 0)
      err.commitmentFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    const dep = num(f.paymentDepositValue);
    if (!Number.isFinite(dep) || dep < 0 || (f.paymentDepositType === 'percent' && dep > 100))
      err.paymentDepositValue = isRTL ? 'أدخل قيمة صحيحة' : 'Enter a valid value';
    const pp = num(f.paymentPartialPercent);
    if (!Number.isFinite(pp) || pp <= 0 || pp > 100)
      err.paymentPartialPercent = isRTL ? 'نسبة بين 1 و 100' : 'Percent between 1 and 100';
    if (!f.serviceAreaMessageAr.trim())
      err.serviceAreaMessageAr = isRTL ? 'مطلوب' : 'Required';
    if (!f.serviceAreaMessageEn.trim())
      err.serviceAreaMessageEn = isRTL ? 'مطلوب' : 'Required';
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
        { key: PLATFORM_SETTINGS_KEYS.inspectionEnabled, value: form.inspectionEnabled },
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
        { key: PLATFORM_SETTINGS_KEYS.pushNotificationsEnabled, value: form.pushNotificationsEnabled },
        { key: PLATFORM_SETTINGS_KEYS.ratingsEnabled, value: form.ratingsEnabled },
        { key: PLATFORM_SETTINGS_KEYS.marketplaceEnabled, value: form.marketplaceEnabled },
        { key: PLATFORM_SETTINGS_KEYS.serviceMobileEnabled, value: form.serviceMobileEnabled },
        { key: PLATFORM_SETTINGS_KEYS.servicePickupEnabled, value: form.servicePickupEnabled },
        { key: PLATFORM_SETTINGS_KEYS.serviceHandoffEnabled, value: form.serviceHandoffEnabled },
        { key: PLATFORM_SETTINGS_KEYS.freeDeliveryEnabled, value: form.freeDeliveryEnabled },
        { key: PLATFORM_SETTINGS_KEYS.freeDeliveryPromoCode, value: form.freeDeliveryPromoCode.trim().toUpperCase() },
        { key: PLATFORM_SETTINGS_KEYS.paymentModeActive, value: form.paymentModeActive },
        { key: PLATFORM_SETTINGS_KEYS.paymentDepositType, value: form.paymentDepositType },
        { key: PLATFORM_SETTINGS_KEYS.paymentDepositValue, value: Number(form.paymentDepositValue) },
        { key: PLATFORM_SETTINGS_KEYS.paymentPartialPercent, value: Number(form.paymentPartialPercent) },
      ]);
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL ? 'تم تحديث إعدادات المنصة بنجاح.' : 'Platform settings updated successfully.'
      );
    } catch (e: any) {
      logger.error('admin platform-settings save failed', e);
      Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', getFriendlyError(e, language));
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);
  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));

  if (adminChecking) {
    return (
      <SafeAreaView style={styles.container}>
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
        <Header title={isRTL ? 'إعدادات المنصة' : 'Platform Settings'} isRTL={isRTL} COLORS={COLORS} onBack={() => safeBack('/admin')} />
        <View style={styles.centered}>
          <MaterialCommunityIcons name="shield-lock-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.deniedTitle}>{isRTL ? 'صلاحية الوصول مرفوضة' : 'Access denied'}</Text>
          <Text style={styles.deniedBody}>
            {isRTL ? 'هذه الشاشة مخصصة للمدراء فقط.' : 'This screen is restricted to admins only.'}
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
            onPress={() => { setRefreshing(true); load(); }}
            disabled={loading || refreshing || saving}
            style={{ padding: 4 }}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading && !form ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>{isRTL ? 'جاري تحميل الإعدادات…' : 'Loading settings…'}</Text>
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !form ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 150, gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
            }
          >
            <Text style={styles.intro}>
              {isRTL
                ? 'القيم تُطبَّق على كامل المنصة. اضغط على القسم لفتحه.'
                : 'Values apply platform-wide. Tap a section to expand it.'}
            </Text>

            {/* 0. Payment policy — how customers pay after accepting an
                offer. Snapshotted per-order at acceptance, so changing it
                here only affects NEW acceptances. */}
            <CollapsibleSection
              icon="credit-card-settings-outline"
              iconColor="#0ea5e9"
              title={isRTL ? 'سياسة الدفع' : 'Payment policy'}
              subtitle={isRTL ? 'كيف يدفع العميل بعد قبول العرض' : 'How customers pay after accepting an offer'}
              defaultOpen
              COLORS={COLORS}
              isRTL={isRTL}
            >
              {PAYMENT_MODES.map((m) => {
                const active = form.paymentModeActive === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => set({ paymentModeActive: m })}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderWidth: 1.5,
                      borderColor: active ? COLORS.primary : COLORS.border,
                      backgroundColor: active ? COLORS.primary + '10' : 'transparent',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <MaterialCommunityIcons
                      name={active ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={active ? COLORS.primary : COLORS.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 13.5, textAlign: isRTL ? 'right' : 'left' }}>
                        {PAYMENT_MODE_LABELS[m][isRTL ? 'ar' : 'en']}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11.5, marginTop: 2, lineHeight: 16, textAlign: isRTL ? 'right' : 'left' }}>
                        {PAYMENT_MODE_DESCRIPTIONS[m][isRTL ? 'ar' : 'en']}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {form.paymentModeActive === 'deposit_then_rest' && (
                <>
                  <SwitchRow
                    label={isRTL ? 'العربون كنسبة مئوية' : 'Deposit as a percentage'}
                    hint={isRTL
                      ? 'عند الإيقاف، يكون العربون مبلغاً ثابتاً بالريال.'
                      : 'When off, the deposit is a fixed SAR amount.'}
                    value={form.paymentDepositType === 'percent'}
                    onChange={(v) => set({ paymentDepositType: v ? 'percent' : 'fixed' })}
                    COLORS={COLORS} isRTL={isRTL}
                  />
                  <FieldNumber
                    label={form.paymentDepositType === 'percent'
                      ? (isRTL ? 'نسبة العربون (%)' : 'Deposit percent (%)')
                      : (isRTL ? 'قيمة العربون (ر.س)' : 'Deposit amount (SAR)')}
                    hint={isRTL
                      ? 'يُدفع فور قبول العرض، والباقي بعد الإصلاح.'
                      : 'Paid right after accepting the offer; the rest after the repair.'}
                    value={form.paymentDepositValue}
                    onChangeText={(v) => set({ paymentDepositValue: v })}
                    error={errors.paymentDepositValue}
                    COLORS={COLORS} isRTL={isRTL}
                  />
                </>
              )}
              {form.paymentModeActive === 'partial_then_final' && (
                <FieldNumber
                  label={isRTL ? 'نسبة الدفعة الأولى (%)' : 'First payment percent (%)'}
                  hint={isRTL
                    ? 'النسبة المدفوعة فور القبول، والمتبقي بعد معرفة الإجمالي النهائي.'
                    : 'Percent paid at acceptance; the remainder once the final total is known.'}
                  value={form.paymentPartialPercent}
                  onChangeText={(v) => set({ paymentPartialPercent: v })}
                  error={errors.paymentPartialPercent}
                  COLORS={COLORS} isRTL={isRTL}
                />
              )}
              <Text style={{ color: COLORS.textSecondary, fontSize: 11.5, lineHeight: 16, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? 'يُثبَّت الوضع على كل طلب لحظة قبول العرض — تغيير السياسة هنا يسري على القبولات الجديدة فقط.'
                  : 'The mode is snapshotted onto each order at offer acceptance — changing it here affects new acceptances only.'}
              </Text>
            </CollapsibleSection>

            {/* 1. Confirmation amount */}
            <CollapsibleSection
              icon="cash-lock"
              iconColor="#8b5cf6"
              title={isRTL ? 'مبلغ التأكيد' : 'Confirmation amount'}
              subtitle={isRTL ? 'المبلغ المدفوع قبل الفحص' : 'Amount paid before inspection'}
              defaultOpen
              COLORS={COLORS}
              isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'تفعيل مبلغ التأكيد' : 'Enable confirmation amount'}
                hint={isRTL
                  ? 'عند الإيقاف، لا يُطلب من العميل دفع أي مبلغ قبل الفحص.'
                  : 'When off, the customer pays nothing before inspection.'}
                value={form.commitmentEnabled}
                onChange={(v) => set({ commitmentEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              {form.commitmentEnabled && (
                <FieldNumber
                  label={isRTL ? 'قيمة مبلغ التأكيد (ر.س)' : 'Confirmation amount (SAR)'}
                  hint={isRTL ? 'يُخصم من الفاتورة النهائية بعد الإصلاح.' : 'Deducted from the final invoice after the repair.'}
                  value={form.commitmentFee}
                  onChangeText={(v) => set({ commitmentFee: v })}
                  error={errors.commitmentFee}
                  COLORS={COLORS} isRTL={isRTL}
                />
              )}
            </CollapsibleSection>

            {/* 2. Inspection */}
            <CollapsibleSection
              icon="magnify-scan"
              iconColor="#3b82f6"
              title={isRTL ? 'الفحص' : 'Inspection'}
              subtitle={isRTL ? 'رسوم فحص الجهاز' : 'Device inspection fee'}
              COLORS={COLORS}
              isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'تفعيل رسوم الفحص' : 'Charge an inspection fee'}
                hint={isRTL
                  ? 'عند الإيقاف، يكون الفحص مجانياً للعميل.'
                  : 'When off, inspection is free for the customer.'}
                value={form.inspectionEnabled}
                onChange={(v) => set({ inspectionEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              {form.inspectionEnabled && (
                <FieldNumber
                  label={isRTL ? 'قيمة رسوم الفحص (ر.س)' : 'Inspection fee (SAR)'}
                  hint={isRTL
                    ? 'رسوم فحص اختيارية تُطبَّق حسب سياسة المنصة.'
                    : 'Optional inspection fee applied per platform policy.'}
                  value={form.inspectionFee}
                  onChangeText={(v) => set({ inspectionFee: v })}
                  error={errors.inspectionFee}
                  COLORS={COLORS} isRTL={isRTL}
                />
              )}
            </CollapsibleSection>

            {/* Payment methods */}
            <PaymentMethodsSection COLORS={COLORS} isRTL={isRTL} language={language} />

            {/* Fees & commission */}
            <CollapsibleSection
              icon="percent"
              iconColor="#f59e0b"
              title={isRTL ? 'الرسوم والعمولة' : 'Fees & commission'}
              subtitle={isRTL ? 'الإرجاع وعمولة المنصة' : 'Return fee and platform commission'}
              COLORS={COLORS}
              isRTL={isRTL}
            >
              <FieldNumber
                label={isRTL ? 'رسوم الإرجاع (ر.س)' : 'Return fee (SAR)'}
                hint={isRTL
                  ? 'تُضاف لرسوم الفحص عند إرجاع جهاز تم استلامه.'
                  : 'Added to the inspection fee when a picked-up device is returned.'}
                value={form.returnFee}
                onChangeText={(v) => set({ returnFee: v })}
                error={errors.returnFee}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldNumber
                label={isRTL ? 'عمولة المنصة (0 - 1)' : 'Platform commission (0 - 1)'}
                hint={isRTL ? 'مثال: 0.15 تعني 15٪.' : 'Example: 0.15 means 15%.'}
                value={form.commissionRate}
                onChangeText={(v) => set({ commissionRate: v })}
                error={errors.commissionRate}
                COLORS={COLORS} isRTL={isRTL}
              />
            </CollapsibleSection>

            {/* 5. Service-area messaging */}
            <CollapsibleSection
              icon="map-marker-radius"
              iconColor="#10b981"
              title={isRTL ? 'رسائل منطقة الخدمة' : 'Service-area messaging'}
              subtitle={isRTL ? 'النصوص المعروضة للعميل' : 'Text shown to the customer'}
              COLORS={COLORS}
              isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'تفعيل المنطقة الشرقية' : 'Eastern Province enabled'}
                hint={isRTL ? 'فعّله عند توسّع الخدمة لكامل المنطقة الشرقية.' : 'Turn on once service covers the whole Eastern Province.'}
                value={form.easternProvinceEnabled}
                onChange={(v) => set({ easternProvinceEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldMultiline
                label={isRTL ? 'رسالة منطقة الخدمة (عربي)' : 'Service-area message (Arabic)'}
                value={form.serviceAreaMessageAr}
                onChangeText={(v) => set({ serviceAreaMessageAr: v })}
                error={errors.serviceAreaMessageAr}
                COLORS={COLORS} isRTL={isRTL} forceRTL
              />
              <FieldMultiline
                label={isRTL ? 'رسالة منطقة الخدمة (إنجليزي)' : 'Service-area message (English)'}
                value={form.serviceAreaMessageEn}
                onChangeText={(v) => set({ serviceAreaMessageEn: v })}
                error={errors.serviceAreaMessageEn}
                COLORS={COLORS} isRTL={isRTL}
              />
            </CollapsibleSection>

            {/* 6. App control */}
            <CollapsibleSection
              icon="cellphone-cog"
              iconColor="#ef4444"
              title={isRTL ? 'التحكم بالتطبيق' : 'App control'}
              subtitle={isRTL ? 'الصيانة، الإعلانات، الإصدار' : 'Maintenance, announcements, version'}
              COLORS={COLORS}
              isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'وضع الصيانة' : 'Maintenance mode'}
                hint={isRTL ? 'يُعرض للمستخدمين إشعار بأن التطبيق تحت الصيانة.' : 'Users are shown a maintenance notice.'}
                value={form.maintenanceMode}
                onChange={(v) => set({ maintenanceMode: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'شريط الإعلان' : 'Announcement banner'}
                hint={isRTL ? 'يعرض شريطاً في أعلى التطبيق بالرسالة أدناه.' : 'Shows a banner at the top of the app.'}
                value={form.announcementEnabled}
                onChange={(v) => set({ announcementEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'الإشعارات الخارجية (Push)' : 'External push notifications'}
                hint={isRTL
                  ? 'فعّلها عند الإطلاق على المتاجر. الإشعارات داخل التطبيق تعمل دائماً.'
                  : 'Turn on for the App Store / Google Play launch. In-app notifications always work.'}
                value={form.pushNotificationsEnabled}
                onChange={(v) => set({ pushNotificationsEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'تقييمات الفنيين' : 'Technician ratings'}
                hint={isRTL
                  ? 'إظهار شاشة التقييم للعميل بعد اكتمال الطلب.'
                  : 'Show the rating screen to the customer after an order is completed.'}
                value={form.ratingsEnabled}
                onChange={(v) => set({ ratingsEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'سوق Fixate' : 'Fixate marketplace'}
                hint={isRTL
                  ? 'مفتاح رئيسي لتفعيل أو إيقاف سوق الإعلانات.'
                  : 'Master switch for the marketplace browse + create flows.'}
                value={form.marketplaceEnabled}
                onChange={(v) => set({ marketplaceEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              {/* Per-service availability — turn off a booking mode without
                  a code release. Disabled modes are hidden from the
                  customer's service-type chooser entirely. */}
              <SwitchRow
                label={isRTL ? 'خدمة الفني المتنقل' : 'Mobile-technician service'}
                hint={isRTL
                  ? 'فني يأتي إلى موقع العميل ويصلح الجهاز في المكان.'
                  : 'Technician comes to the customer location and fixes on-site.'}
                value={form.serviceMobileEnabled}
                onChange={(v) => set({ serviceMobileEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'خدمة الاستلام والتوصيل' : 'Pickup & delivery service'}
                hint={isRTL
                  ? 'نستلم جهاز العميل ونوصّله للمحل المتعاقد ونُرجعه بعد الإصلاح.'
                  : 'We pick up the device, take it to the partner shop, and return it.'}
                value={form.servicePickupEnabled}
                onChange={(v) => set({ servicePickupEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'تسليم واستلام شخصي' : 'Personal hand-off'}
                hint={isRTL
                  ? 'العميل يسلّم الجهاز للفني شخصياً في مركز الخدمة بدون رسوم توصيل.'
                  : 'Customer hands the device to the technician in person — no delivery fee.'}
                value={form.serviceHandoffEnabled}
                onChange={(v) => set({ serviceHandoffEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              {/* Free delivery — master switch + optional promo code. When
                  the switch is on, every customer sees the delivery fee as
                  "free". When the code is set, a customer typing that code
                  in the discount field at request time gets free delivery
                  even if the master switch is off. Case-insensitive. */}
              <SwitchRow
                label={isRTL ? 'توصيل مجاني للجميع' : 'Free delivery for everyone'}
                hint={isRTL
                  ? 'عند التفعيل، تظهر رسوم التوصيل بقيمة "مجاناً" لكل العملاء.'
                  : 'When on, every customer sees the delivery fee as "Free".'}
                value={form.freeDeliveryEnabled}
                onChange={(v) => set({ freeDeliveryEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'كود التوصيل المجاني (اختياري)' : 'Free-delivery promo code (optional)'}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL
                    ? 'إذا أدخل العميل هذا الكود في خانة الخصم، يصبح التوصيل مجانياً. اتركه فارغاً لتعطيل الميزة.'
                    : 'If a customer enters this code in the discount field, delivery becomes free. Leave empty to disable.'}
                </Text>
                <TextInput
                  value={form.freeDeliveryPromoCode}
                  onChangeText={(v) => set({ freeDeliveryPromoCode: v.toUpperCase() })}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={isRTL ? 'مثال: FREESHIP' : 'e.g. FREESHIP'}
                  placeholderTextColor={COLORS.textSecondary}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: BORDER_RADIUS.md,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: COLORS.text,
                    backgroundColor: COLORS.background,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                />
              </View>
              <FieldMultiline
                label={isRTL ? 'نص الإعلان (عربي)' : 'Announcement text (Arabic)'}
                value={form.announcementAr}
                onChangeText={(v) => set({ announcementAr: v })}
                COLORS={COLORS} isRTL={isRTL} forceRTL
              />
              <FieldMultiline
                label={isRTL ? 'نص الإعلان (إنجليزي)' : 'Announcement text (English)'}
                value={form.announcementEn}
                onChangeText={(v) => set({ announcementEn: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldNumber
                label={isRTL ? 'أدنى إصدار مطلوب' : 'Minimum required app version'}
                hint={isRTL ? 'مثال: 1.2.0' : 'e.g. 1.2.0'}
                value={form.minAppVersion}
                onChangeText={(v) => set({ minAppVersion: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
            </CollapsibleSection>

            {/* 7. Loyalty program */}
            <CollapsibleSection
              icon="star-circle"
              iconColor="#eab308"
              title={isRTL ? 'برنامج الولاء' : 'Loyalty program'}
              subtitle={isRTL ? 'كسب واستبدال النقاط' : 'Earning and redeeming points'}
              COLORS={COLORS}
              isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'تفعيل برنامج الولاء' : 'Enable loyalty program'}
                hint={isRTL ? 'عند الإيقاف، يُخفى من تطبيق العميل.' : 'When off, hidden from the customer app.'}
                value={form.loyaltyEnabled}
                onChange={(v) => set({ loyaltyEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldNumber
                label={isRTL ? 'النقاط لكل ريال' : 'Points per SAR'}
                value={form.loyaltyPointsPerSAR}
                onChangeText={(v) => set({ loyaltyPointsPerSAR: v })}
                error={errors.loyaltyPointsPerSAR}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldNumber
                label={isRTL ? 'الحد الأدنى للاستبدال (نقاط)' : 'Minimum points to redeem'}
                value={form.loyaltyRedeemMin}
                onChangeText={(v) => set({ loyaltyRedeemMin: v })}
                error={errors.loyaltyRedeemMin}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldNumber
                label={isRTL ? 'قيمة النقطة (ر.س)' : 'Value per point (SAR)'}
                value={form.loyaltyRedeemRate}
                onChangeText={(v) => set({ loyaltyRedeemRate: v })}
                error={errors.loyaltyRedeemRate}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldNumber
                label={isRTL ? 'الحد الأقصى من الفاتورة (0 - 1)' : 'Max share of invoice (0 - 1)'}
                value={form.loyaltyRedeemMaxPct}
                onChangeText={(v) => set({ loyaltyRedeemMaxPct: v })}
                error={errors.loyaltyRedeemMaxPct}
                COLORS={COLORS} isRTL={isRTL}
              />
              <FieldMultiline
                label={isRTL ? 'مستويات الاستبدال (JSON)' : 'Redemption tiers (JSON)'}
                value={form.loyaltyTiersJson}
                onChangeText={(v) => set({ loyaltyTiersJson: v })}
                error={errors.loyaltyTiersJson}
                COLORS={COLORS} isRTL={isRTL}
              />
            </CollapsibleSection>
          </ScrollView>
        )}

        {form && !error && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>{isRTL ? 'حفظ الإعدادات' : 'Save settings'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PaymentMethodsSection({
  COLORS,
  isRTL,
  language,
}: {
  COLORS: any;
  isRTL: boolean;
  language: 'ar' | 'en';
}) {
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const styles = createStyles(COLORS, isRTL);

  useEffect(() => {
    listPaymentMethods().then(setMethods).catch(() => setMethods([]));
  }, []);

  const patch = async (m: PaymentMethod, change: Partial<PaymentMethod>) => {
    setMethods((list) => list!.map((x) => (x.id === m.id ? { ...x, ...change } : x)));
    try {
      await updatePaymentMethod(m.id, change);
    } catch (e: any) {
      setMethods((list) => list!.map((x) => (x.id === m.id ? m : x)));
      Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', getFriendlyError(e, language));
    }
  };

  const ToggleLine = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: COLORS.text, fontSize: 12.5, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <CollapsibleSection
      icon="credit-card-multiple-outline"
      iconColor="#0ea5e9"
      title={isRTL ? 'طرق الدفع' : 'Payment methods'}
      subtitle={isRTL ? 'التحكم بطرق الدفع وأماكن ظهورها' : 'Control payment methods and where they appear'}
      COLORS={COLORS}
      isRTL={isRTL}
    >
      {!methods ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
      ) : (
        methods.map((m) => (
          <View
            key={m.id}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: BORDER_RADIUS.md,
              padding: 12,
              marginTop: 10,
              backgroundColor: COLORS.background,
            }}
          >
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <MaterialCommunityIcons name={(m.icon as any) || 'credit-card-outline'} size={20} color={COLORS.primary} />
              <Text style={{ flex: 1, color: COLORS.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? m.name_ar : m.name_en}
              </Text>
            </View>
            <ToggleLine
              label={isRTL ? 'مفعّل' : 'Enabled'}
              value={m.enabled}
              onChange={(v) => patch(m, { enabled: v })}
            />
            <ToggleLine
              label={isRTL ? 'قريباً' : 'Coming soon'}
              value={m.is_coming_soon}
              onChange={(v) => patch(m, { is_coming_soon: v })}
            />
            <ToggleLine
              label={isRTL ? 'يظهر في خطوة الطلب' : 'Show in request step'}
              value={m.show_in_request_step}
              onChange={(v) => patch(m, { show_in_request_step: v })}
            />
            <ToggleLine
              label={isRTL ? 'يظهر في صفحة الدفع' : 'Show in payment page'}
              value={m.show_in_payment_page}
              onChange={(v) => patch(m, { show_in_payment_page: v })}
            />
          </View>
        ))
      )}
    </CollapsibleSection>
  );
}

// ── Reusable pieces ────────────────────────────────────────────────────────
function CollapsibleSection({
  icon,
  iconColor,
  title,
  subtitle,
  defaultOpen,
  children,
  COLORS,
  isRTL,
}: {
  icon: any;
  iconColor: string;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  COLORS: any;
  isRTL: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const styles = createStyles(COLORS, isRTL);
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
        style={styles.sectionHeader}
        accessibilityRole="button"
      >
        <View style={[styles.sectionIcon, { backgroundColor: iconColor + '20' }]}>
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
  COLORS,
  isRTL,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  COLORS: any;
  isRTL: boolean;
}) {
  const styles = createStyles(COLORS, isRTL);
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#fff"
      />
    </View>
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
      <AnimatedBackButton
        onPress={onBack}
        color={COLORS.text}
        backgroundColor={COLORS.background}
        size={42}
        iconSize={22}
        rtl
      />
      <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.text }}>{title}</Text>
      <View style={{ width: 32, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

function FieldNumber({
  label, hint, value, onChangeText, error, COLORS, isRTL,
}: {
  label: string; hint?: string; value: string; onChangeText: (v: string) => void;
  error?: string; COLORS: any; isRTL: boolean;
}) {
  return (
    <View style={{ marginTop: 12 }}>
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
        style={{
          borderWidth: 1,
          borderColor: error ? '#EF4444' : COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: COLORS.text,
          backgroundColor: COLORS.background,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
      {error ? (
        <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{error}</Text>
      ) : null}
    </View>
  );
}

function FieldMultiline({
  label, value, onChangeText, error, COLORS, isRTL, forceRTL,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  error?: string; COLORS: any; isRTL: boolean; forceRTL?: boolean;
}) {
  return (
    <View style={{ marginTop: 12 }}>
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
          backgroundColor: COLORS.background,
          minHeight: 92,
          textAlign: forceRTL || isRTL ? 'right' : 'left',
          writingDirection: forceRTL ? 'rtl' : undefined,
        }}
      />
      {error ? (
        <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>{error}</Text>
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
    intro: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionCard: {
      backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    sectionIcon: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    sectionSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    sectionBody: {
      paddingHorizontal: 14,
      paddingBottom: 16,
      paddingTop: 2,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    label: { color: COLORS.text, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    hint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    switchRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
    },
    footer: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
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
