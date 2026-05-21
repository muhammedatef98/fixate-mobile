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
import {
  getRegionTree,
  updateRegion,
  updateCity,
  setRegionCitiesEnabled,
  type RegionWithCities,
} from '../services/serviceAreasService';
import {
  listPaymentMethods,
  updatePaymentMethod,
  type PaymentMethod,
} from '../services/paymentMethodsService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

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
    if (adminChecked === null) return;
    load();
  }, [adminChecked, load]);

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

  if (adminChecked === null) {
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
                    ? 'تُحتسب عند رفض العميل لعرض السعر بعد الفحص.'
                    : 'Charged when the customer rejects the post-inspection quote.'}
                  value={form.inspectionFee}
                  onChangeText={(v) => set({ inspectionFee: v })}
                  error={errors.inspectionFee}
                  COLORS={COLORS} isRTL={isRTL}
                />
              )}
            </CollapsibleSection>

            {/* 3. Repair service areas */}
            <PaymentMethodsSection COLORS={COLORS} isRTL={isRTL} language={language} />

            <ServiceAreasSection COLORS={COLORS} isRTL={isRTL} language={language} />

            {/* 4. Fees & commission */}
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

// ── Repair service areas section ───────────────────────────────────────────
function ServiceAreasSection({
  COLORS,
  isRTL,
  language,
}: {
  COLORS: any;
  isRTL: boolean;
  language: 'ar' | 'en';
}) {
  const [tree, setTree] = useState<RegionWithCities[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const styles = createStyles(COLORS, isRTL);

  useEffect(() => {
    getRegionTree(false).then(setTree).catch(() => setTree([]));
  }, []);

  const fail = (e: any) =>
    Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', getFriendlyError(e, language));

  const toggleRegion = async (region: RegionWithCities, enabled: boolean) => {
    setTree((t) => t!.map((r) => (r.id === region.id ? { ...r, enabled } : r)));
    try {
      await updateRegion(region.id, { enabled });
    } catch (e) {
      setTree((t) => t!.map((r) => (r.id === region.id ? { ...r, enabled: !enabled } : r)));
      fail(e);
    }
  };

  const toggleCity = async (
    region: RegionWithCities,
    cityId: string,
    enabled: boolean
  ) => {
    setTree((t) =>
      t!.map((r) =>
        r.id === region.id
          ? { ...r, cities: r.cities.map((c) => (c.id === cityId ? { ...c, enabled } : c)) }
          : r
      )
    );
    try {
      await updateCity(cityId, { enabled });
    } catch (e) {
      setTree((t) =>
        t!.map((r) =>
          r.id === region.id
            ? { ...r, cities: r.cities.map((c) => (c.id === cityId ? { ...c, enabled: !enabled } : c)) }
            : r
        )
      );
      fail(e);
    }
  };

  const setAllCities = async (region: RegionWithCities, enabled: boolean) => {
    setTree((t) =>
      t!.map((r) =>
        r.id === region.id
          ? { ...r, cities: r.cities.map((c) => ({ ...c, enabled })) }
          : r
      )
    );
    try {
      await setRegionCitiesEnabled(region.id, enabled);
    } catch (e) {
      getRegionTree(false).then(setTree).catch(() => undefined);
      fail(e);
    }
  };

  return (
    <CollapsibleSection
      icon="map-check"
      iconColor="#06b6d4"
      title={isRTL ? 'مناطق خدمة الإصلاح' : 'Repair service areas'}
      subtitle={isRTL ? 'تفعيل المناطق والمدن لطلبات الإصلاح' : 'Enable regions & cities for repair requests'}
      COLORS={COLORS}
      isRTL={isRTL}
    >
      <Text style={[styles.hint, { marginBottom: 4 }]}>
        {isRTL
          ? 'تُطبَّق هذه الإعدادات على طلبات الإصلاح فقط — لا تؤثر على السوق. وسّع التغطية تدريجياً بتفعيل منطقة أو مدينة.'
          : 'Applies to repair requests only — not the market. Expand coverage gradually by enabling a region or city.'}
      </Text>

      {!tree ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
      ) : (
        tree.map((region) => {
          const isOpen = expanded === region.id;
          const onCount = region.cities.filter((c) => c.enabled).length;
          return (
            <View
              key={region.id}
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: BORDER_RADIUS.md,
                marginTop: 10,
                backgroundColor: COLORS.background,
                overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                <TouchableOpacity
                  onPress={() => setExpanded(isOpen ? null : region.id)}
                  style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, flex: 1 }}
                >
                  <MaterialCommunityIcons name="map-marker-radius" size={18} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
                      {isRTL ? region.name_ar : region.name_en}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                      {onCount}/{region.cities.length} {isRTL ? 'مدينة مفعّلة' : 'cities on'}
                    </Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Switch
                  value={region.enabled}
                  onValueChange={(v) => toggleRegion(region, v)}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#fff"
                />
              </View>

              {isOpen && (
                <View style={{ paddingHorizontal: 12, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 14, paddingVertical: 8 }}>
                    <TouchableOpacity onPress={() => setAllCities(region, true)}>
                      <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>
                        {isRTL ? 'تفعيل الكل' : 'Enable all'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAllCities(region, false)}>
                      <Text style={{ color: COLORS.error, fontSize: 12, fontWeight: '700' }}>
                        {isRTL ? 'إيقاف الكل' : 'Disable all'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {region.cities.map((city) => (
                    <View
                      key={city.id}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                        gap: 10,
                      }}
                    >
                      <Text style={{ color: COLORS.text, fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                        {isRTL ? city.name_ar : city.name_en}
                      </Text>
                      <Switch
                        value={city.enabled}
                        onValueChange={(v) => toggleCity(region, city.id, v)}
                        trackColor={{ false: COLORS.border, true: COLORS.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
    </CollapsibleSection>
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
      <TouchableOpacity onPress={onBack} style={{ padding: 4 }} accessibilityRole="button">
        <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
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
