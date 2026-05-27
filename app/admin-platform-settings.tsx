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
  createCity,
  type RegionWithCities,
  type ServiceCity,
} from '../services/serviceAreasService';
import {
  listPaymentMethods,
  updatePaymentMethod,
  type PaymentMethod,
} from '../services/paymentMethodsService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';
import { useIsAdmin } from '../hooks/useAdminGuard';

// Request-flow controls (inspection / commitment / service-type toggles /
// free delivery) have moved to the dedicated /admin-request-settings
// screen. This screen keeps only the platform-wide controls.
interface FormState {
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
  maintenanceMode: boolean;
  announcementEnabled: boolean;
  announcementAr: string;
  announcementEn: string;
  minAppVersion: string;
  pushNotificationsEnabled: boolean;
  ratingsEnabled: boolean;
  marketplaceEnabled: boolean;
}

const toForm = (s: PlatformSettings): FormState => ({
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
  maintenanceMode: s.maintenanceMode,
  announcementEnabled: s.announcementEnabled,
  announcementAr: s.announcementAr,
  announcementEn: s.announcementEn,
  minAppVersion: s.minAppVersion,
  pushNotificationsEnabled: s.pushNotificationsEnabled,
  ratingsEnabled: s.ratingsEnabled,
  marketplaceEnabled: s.marketplaceEnabled,
});

interface FieldErrors {
  returnFee?: string;
  commissionRate?: string;
  serviceAreaMessageAr?: string;
  serviceAreaMessageEn?: string;
  loyaltyPointsPerSAR?: string;
  loyaltyRedeemMin?: string;
  loyaltyRedeemRate?: string;
  loyaltyRedeemMaxPct?: string;
  loyaltyTiersJson?: string;
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
        { key: PLATFORM_SETTINGS_KEYS.maintenanceMode, value: form.maintenanceMode },
        { key: PLATFORM_SETTINGS_KEYS.announcementEnabled, value: form.announcementEnabled },
        { key: PLATFORM_SETTINGS_KEYS.announcementAr, value: form.announcementAr.trim() },
        { key: PLATFORM_SETTINGS_KEYS.announcementEn, value: form.announcementEn.trim() },
        { key: PLATFORM_SETTINGS_KEYS.minAppVersion, value: form.minAppVersion.trim() },
        { key: PLATFORM_SETTINGS_KEYS.pushNotificationsEnabled, value: form.pushNotificationsEnabled },
        { key: PLATFORM_SETTINGS_KEYS.ratingsEnabled, value: form.ratingsEnabled },
        { key: PLATFORM_SETTINGS_KEYS.marketplaceEnabled, value: form.marketplaceEnabled },
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

            {/* Confirmation amount, inspection, service types, and free
                delivery moved to the dedicated /admin-request-settings
                screen. Keep this screen focused on platform-wide
                concerns (loyalty, marketplace, maintenance, ratings,
                announcements, commission, return fee). */}

            {/* Repair service areas */}
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
              {/* Service-type toggles and free-delivery controls moved
                  to /admin-request-settings. */}
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
  // Active row in the lat/lng + parent editor sheet. The sheet renders
  // when this is non-null and pre-fills with that row's current values.
  const [editingCity, setEditingCity] = useState<{ city: ServiceCity; region: RegionWithCities } | null>(null);
  // Region currently targeted by the "Add city" modal. Null = sheet closed.
  const [creatingInRegion, setCreatingInRegion] = useState<RegionWithCities | null>(null);
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
                    <View style={{ flex: 1 }} />
                    {/* "Add city" affordance — opens a small create sheet
                        whose row gets appended to this region disabled by
                        default. Admin refines lat/lng + parent next via
                        the pencil editor. */}
                    <TouchableOpacity
                      onPress={() => setCreatingInRegion(region)}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <MaterialCommunityIcons name="plus-circle-outline" size={14} color={COLORS.primary} />
                      <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '800' }}>
                        {isRTL ? 'إضافة مدينة' : 'Add city'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {region.cities.map((city) => {
                    const hasCentroid = city.lat != null && city.lng != null;
                    const hasParent = !!city.parent_city_id;
                    const parentName = hasParent
                      ? region.cities.find((c) => c.id === city.parent_city_id)
                      : null;
                    return (
                      <View
                        key={city.id}
                        style={{
                          paddingVertical: 6,
                          gap: 4,
                        }}
                      >
                        <View style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 10,
                        }}>
                          <Text style={{ color: COLORS.text, fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                            {isRTL ? city.name_ar : city.name_en}
                          </Text>
                          {/* Edit affordance — opens the centroid / parent
                              / fee / sort editor sheet for this city.
                              Visible regardless of enabled state so admin
                              can fix data on a disabled row before turning
                              it on. */}
                          <TouchableOpacity
                            onPress={() => setEditingCity({ city, region })}
                            style={{ padding: 6 }}
                            accessibilityLabel={isRTL ? 'تعديل' : 'Edit'}
                          >
                            <MaterialCommunityIcons
                              name="pencil-outline"
                              size={16}
                              color={COLORS.textSecondary}
                            />
                          </TouchableOpacity>
                          <Switch
                            value={city.enabled}
                            onValueChange={(v) => toggleCity(region, city.id, v)}
                            trackColor={{ false: COLORS.border, true: COLORS.primary }}
                            thumbColor="#fff"
                          />
                        </View>
                        {/* Compact data summary so the admin can audit
                            centroid / parent status at a glance without
                            opening the editor. An enabled city without
                            a centroid gets a small amber warning — the
                            customer-side matcher skips such cities, so
                            the toggle is effectively a no-op until the
                            admin sets lat/lng. */}
                        {(hasCentroid || hasParent || (city.enabled && !hasCentroid && !hasParent)) && (
                          <View style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                            paddingHorizontal: 4,
                          }}>
                            {hasCentroid && (
                              <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' }}>
                                {Number(city.lat).toFixed(3)}, {Number(city.lng).toFixed(3)}
                              </Text>
                            )}
                            {hasParent && parentName && (
                              <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: '700' }}>
                                ↳ {isRTL ? parentName.name_ar : parentName.name_en}
                              </Text>
                            )}
                            {city.enabled && !hasCentroid && !hasParent && (
                              <View style={{
                                flexDirection: isRTL ? 'row-reverse' : 'row',
                                alignItems: 'center',
                                gap: 3,
                              }}>
                                <MaterialCommunityIcons
                                  name="alert-circle-outline"
                                  size={11}
                                  color="#B45309"
                                />
                                <Text style={{ color: '#B45309', fontSize: 10, fontWeight: '700' }}>
                                  {isRTL
                                    ? 'لم يتم تحديد الإحداثيات — لن تتطابق مع أي دبوس'
                                    : 'Missing centroid — pin matching disabled'}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* City editor sheet — single instance, driven by `editingCity`. */}
      <CityEditor
        target={editingCity}
        isRTL={isRTL}
        language={language}
        COLORS={COLORS}
        onClose={() => setEditingCity(null)}
        onSaved={async (next: Partial<ServiceCity>) => {
          if (!editingCity) return;
          // Optimistic local update so the row reflects the change
          // immediately; the cache bust inside updateCity ensures the
          // next read is fresh too.
          setTree((t) => t && t.map((r) =>
            r.id === editingCity.region.id
              ? { ...r, cities: r.cities.map((c) => c.id === editingCity.city.id ? { ...c, ...next } : c) }
              : r
          ));
          setEditingCity(null);
        }}
      />

      {/* "Add city" sheet — appends a new row into the targeted region. */}
      <NewCityModal
        region={creatingInRegion}
        isRTL={isRTL}
        language={language}
        COLORS={COLORS}
        onClose={() => setCreatingInRegion(null)}
        onCreated={(created) => {
          if (!creatingInRegion) return;
          // Insert into the in-memory tree in sort order so the new row
          // appears in its expected position immediately.
          setTree((t) => t && t.map((r) => {
            if (r.id !== creatingInRegion.id) return r;
            const next = [...r.cities, created]
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            return { ...r, cities: next };
          }));
          setCreatingInRegion(null);
        }}
      />
    </CollapsibleSection>
  );
}

/**
 * Bottom-sheet create form for a new city row. Intentionally minimal —
 * collects only the fields needed to insert a safe "draft" row:
 *   • English name (required, unique within region — client check)
 *   • Arabic name  (required)
 *   • Delivery fee (defaults to 20 SAR, matches the seed convention)
 *   • Sort order   (defaults to max(existing) + 1 so new rows land at
 *     the bottom of the region's list)
 *
 * The new row is created disabled. The admin opens the existing pencil
 * editor next to set lat/lng + parent_city_id before flipping enabled
 * on. This two-step create-then-refine matches the project posture
 * elsewhere (Market: create → admin moderate; device types: create →
 * admin reviews defaults).
 */
function NewCityModal({
  region, isRTL, language, COLORS, onClose, onCreated,
}: {
  region: RegionWithCities | null;
  isRTL: boolean;
  language: 'ar' | 'en';
  COLORS: any;
  onClose: () => void;
  onCreated: (city: ServiceCity) => void;
}) {
  const visible = !!region;
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('20');
  const [sortOrder, setSortOrder] = useState('100');
  const [saving, setSaving] = useState(false);

  // Re-seed defaults each time the modal opens for a different region.
  useEffect(() => {
    if (!region) return;
    const maxSort = region.cities.reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);
    setNameAr('');
    setNameEn('');
    setDeliveryFee('20');
    setSortOrder(String(maxSort + 1));
  }, [region?.id]);

  if (!region) return null;

  const handleCreate = async () => {
    if (!nameEn.trim() || !nameAr.trim()) {
      Alert.alert(
        isRTL ? 'حقول ناقصة' : 'Missing fields',
        isRTL ? 'الاسم بالعربي وبالإنجليزي مطلوبان.' : 'Arabic and English names are required.'
      );
      return;
    }
    const enLower = nameEn.trim().toLowerCase();
    const arTrim = nameAr.trim();
    const duplicate = region.cities.find(
      (c) => c.name_en.trim().toLowerCase() === enLower || c.name_ar.trim() === arTrim
    );
    if (duplicate) {
      Alert.alert(
        isRTL ? 'مدينة موجودة' : 'City already exists',
        isRTL
          ? `هناك مدينة باسم "${duplicate.name_ar}" في هذه المنطقة بالفعل.`
          : `A city named "${duplicate.name_en}" already exists in this region.`
      );
      return;
    }
    const fee = Number(deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      Alert.alert(isRTL ? 'رسوم غير صالحة' : 'Invalid delivery fee');
      return;
    }
    const sort = Number(sortOrder);
    if (!Number.isFinite(sort) || sort < 0) {
      Alert.alert(isRTL ? 'ترتيب غير صالح' : 'Invalid sort order');
      return;
    }

    setSaving(true);
    try {
      const created = await createCity({
        region_id: region.id,
        name_ar: arTrim,
        name_en: nameEn.trim(),
        delivery_fee: fee,
        sort_order: Math.floor(sort),
        enabled: false,
      });
      onCreated(created);
      // Confirm the create + remind the admin the row is disabled by
      // default so they don't expect customers to see it until they
      // finish setting centroid/parent and flip enabled on.
      Alert.alert(
        isRTL ? 'تمت الإضافة ✓' : 'City added ✓',
        isRTL
          ? `أُنشئت "${arTrim}" معطّلة. اضغط القلم بجانبها لإضافة الإحداثيات والمدينة الأم ثم فعّلها.`
          : `"${nameEn.trim()}" is created and disabled. Tap the pencil next to it to set lat/lng + parent, then enable.`
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'فشل الإضافة' : 'Create failed', getFriendlyError(e, language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{
          backgroundColor: COLORS.card,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: SPACING.lg,
          paddingBottom: 28,
          gap: 12,
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center' }} />
          <View>
            <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 17, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'إضافة مدينة جديدة' : 'Add a new city'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? region.name_ar : region.name_en}
            </Text>
          </View>

          <CityField
            label={isRTL ? 'الاسم بالعربي' : 'Arabic name'}
            value={nameAr}
            onChange={setNameAr}
            COLORS={COLORS} isRTL={isRTL}
          />
          <CityField
            label={isRTL ? 'الاسم بالإنجليزي' : 'English name'}
            value={nameEn}
            onChange={setNameEn}
            COLORS={COLORS} isRTL={isRTL}
          />
          <CityField
            label={isRTL ? 'رسوم التوصيل (ر.س)' : 'Delivery fee (SAR)'}
            value={deliveryFee}
            onChange={setDeliveryFee}
            keyboard="decimal-pad"
            COLORS={COLORS} isRTL={isRTL}
          />
          <CityField
            label={isRTL ? 'ترتيب العرض' : 'Sort order'}
            value={sortOrder}
            onChange={(v) => setSortOrder(v.replace(/[^0-9]/g, ''))}
            keyboard="number-pad"
            COLORS={COLORS} isRTL={isRTL}
          />

          <Text style={{ color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL
              ? 'تُنشأ المدينة معطّلة افتراضياً. اضغط قلم التعديل على الصف الجديد لإضافة الإحداثيات والمدينة الأم قبل تفعيلها.'
              : 'The new city is created disabled. Tap the pencil on the new row to set lat/lng and the parent city before enabling it.'}
          </Text>

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 6 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1, paddingVertical: 13, alignItems: 'center',
                borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={saving}
              style={{
                flex: 2, paddingVertical: 13, alignItems: 'center',
                borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary,
                opacity: saving ? 0.55 : 1,
              }}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>{isRTL ? 'إضافة' : 'Create'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Bottom-sheet editor for one city row in the service-area tree. Lets
 * the admin update centroid (lat/lng), parent_city_id, delivery_fee,
 * and sort_order without leaving the platform-settings screen.
 *
 * Validation is client-side, defense-in-depth:
 *  • lat in [-90, 90], lng in [-180, 180] (or both empty for null)
 *  • delivery_fee and sort_order non-negative finite numbers
 *  • parent_city_id ≠ self, and the parent chain must not contain self
 *    (cycle detection walks the proposed chain via the live region tree)
 *
 * Parent picker is restricted to other cities in the same region — the
 * use case is governorate-style hierarchy, not cross-region links. The
 * DB still permits cross-region parents; only the UI is restricted.
 */
function CityEditor({
  target, isRTL, language, COLORS, onClose, onSaved,
}: {
  target: { city: ServiceCity; region: RegionWithCities } | null;
  isRTL: boolean;
  language: 'ar' | 'en';
  COLORS: any;
  onClose: () => void;
  onSaved: (next: Partial<ServiceCity>) => void | Promise<void>;
}) {
  const visible = !!target;
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed the form whenever the target changes so editing a different
  // city doesn't carry stale values across.
  useEffect(() => {
    if (!target) return;
    const c = target.city;
    setLat(c.lat == null ? '' : String(c.lat));
    setLng(c.lng == null ? '' : String(c.lng));
    setParentId(c.parent_city_id ?? null);
    setDeliveryFee(String(c.delivery_fee ?? 0));
    setSortOrder(String(c.sort_order ?? 0));
  }, [target?.city.id]);

  if (!target) return null;
  const { city, region } = target;
  const siblings = region.cities.filter((c) => c.id !== city.id);
  const currentParent = parentId ? region.cities.find((c) => c.id === parentId) ?? null : null;

  // Walk the proposed parent chain; if we ever revisit `city.id` it would
  // form a cycle and we refuse the save. Bounded by the region size.
  const wouldCycle = (proposedParentId: string | null): boolean => {
    if (!proposedParentId) return false;
    const byId = new Map(region.cities.map((c) => [c.id, c]));
    const seen = new Set<string>([city.id]);
    let cursor: string | null | undefined = proposedParentId;
    while (cursor) {
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      const next = byId.get(cursor);
      cursor = next?.parent_city_id ?? null;
    }
    return false;
  };

  const parseOptionalNumber = (raw: string): { ok: true; value: number | null } | { ok: false } => {
    const t = raw.trim();
    if (t === '') return { ok: true, value: null };
    const n = Number(t);
    if (!Number.isFinite(n)) return { ok: false };
    return { ok: true, value: n };
  };

  const handleSave = async () => {
    // lat / lng: paired — both blank = clear centroid; otherwise both
    // must be valid numbers in range.
    const latP = parseOptionalNumber(lat);
    const lngP = parseOptionalNumber(lng);
    if (!latP.ok || !lngP.ok) {
      Alert.alert(isRTL ? 'إحداثيات غير صالحة' : 'Invalid coordinates');
      return;
    }
    if ((latP.value == null) !== (lngP.value == null)) {
      Alert.alert(
        isRTL ? 'إحداثيات ناقصة' : 'Both coordinates required',
        isRTL ? 'يجب إدخال الاثنين أو تركهما فارغين معاً.' : 'Enter both lat & lng, or leave both blank.'
      );
      return;
    }
    if (latP.value != null && (latP.value < -90 || latP.value > 90)) {
      Alert.alert(isRTL ? 'خط العرض خارج النطاق' : 'Latitude out of range', '-90 ≤ lat ≤ 90');
      return;
    }
    if (lngP.value != null && (lngP.value < -180 || lngP.value > 180)) {
      Alert.alert(isRTL ? 'خط الطول خارج النطاق' : 'Longitude out of range', '-180 ≤ lng ≤ 180');
      return;
    }

    // delivery_fee + sort_order: numbers ≥ 0.
    const fee = Number(deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      Alert.alert(isRTL ? 'رسوم غير صالحة' : 'Invalid delivery fee');
      return;
    }
    const sort = Number(sortOrder);
    if (!Number.isFinite(sort) || sort < 0) {
      Alert.alert(isRTL ? 'ترتيب غير صالح' : 'Invalid sort order');
      return;
    }

    if (parentId === city.id) {
      Alert.alert(isRTL ? 'مرجع غير صالح' : 'Invalid parent', isRTL ? 'لا يمكن أن تكون المدينة أبواً لنفسها.' : 'A city cannot be its own parent.');
      return;
    }
    if (wouldCycle(parentId)) {
      Alert.alert(
        isRTL ? 'دورة في التبعية' : 'Parent cycle detected',
        isRTL
          ? 'هذا الاختيار يُنشئ حلقة مغلقة في علاقات المدن. اختر أباً مختلفاً.'
          : 'This selection would create a cycle in the parent chain. Pick a different parent.'
      );
      return;
    }

    const patch: Partial<ServiceCity> = {
      lat: latP.value,
      lng: lngP.value,
      parent_city_id: parentId,
      delivery_fee: fee,
      sort_order: Math.floor(sort),
    };
    setSaving(true);
    try {
      await updateCity(city.id, patch);
      await onSaved(patch);
      // Subtle confirmation so the admin gets a positive signal that
      // the change went through. Matches the platform-settings save
      // pattern used elsewhere on this screen.
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL
          ? `تم تحديث "${isRTL ? city.name_ar : city.name_en}".`
          : `Updated "${city.name_en}".`
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', getFriendlyError(e, language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{
          backgroundColor: COLORS.card,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: SPACING.lg,
          paddingBottom: 28,
          gap: 12,
          maxHeight: '90%',
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center' }} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            <View>
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 17, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? city.name_ar : city.name_en}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? region.name_ar : region.name_en}
              </Text>
            </View>

            <CityField
              label={isRTL ? 'خط العرض (Latitude)' : 'Latitude'}
              hint={isRTL ? 'من -90 إلى 90. اتركه فارغاً مع خط الطول لإلغاء الإحداثي.' : '-90 to 90. Leave blank (with lng) to clear the centroid.'}
              value={lat}
              onChange={setLat}
              keyboard="decimal-pad"
              COLORS={COLORS} isRTL={isRTL}
            />
            <CityField
              label={isRTL ? 'خط الطول (Longitude)' : 'Longitude'}
              hint={isRTL ? 'من -180 إلى 180.' : '-180 to 180.'}
              value={lng}
              onChange={setLng}
              keyboard="decimal-pad"
              COLORS={COLORS} isRTL={isRTL}
            />

            {/* Parent picker */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'المدينة الأم (نفس المنطقة فقط)' : 'Parent city (same region only)'}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? 'عند الاختيار، تتبع هذه المدينة حالة التغطية للمدينة الأم تلقائياً.'
                  : 'When set, this city inherits coverage from the parent city automatically.'}
              </Text>
              <TouchableOpacity
                onPress={() => setPicking(true)}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: BORDER_RADIUS.md,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: COLORS.background,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons
                  name={currentParent ? 'family-tree' : 'circle-outline'}
                  size={16}
                  color={currentParent ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={{
                  flex: 1,
                  color: currentParent ? COLORS.text : COLORS.textSecondary,
                  fontSize: 14,
                  fontWeight: currentParent ? '700' : '500',
                  textAlign: isRTL ? 'right' : 'left',
                }}>
                  {currentParent
                    ? (isRTL ? currentParent.name_ar : currentParent.name_en)
                    : (isRTL ? 'بدون مدينة أم (مدينة رئيسية)' : 'None (top-level city)')}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <CityField
              label={isRTL ? 'رسوم التوصيل (ر.س)' : 'Delivery fee (SAR)'}
              hint={isRTL ? 'لا يمكن أن تكون سالبة.' : 'Must be non-negative.'}
              value={deliveryFee}
              onChange={setDeliveryFee}
              keyboard="decimal-pad"
              COLORS={COLORS} isRTL={isRTL}
            />
            <CityField
              label={isRTL ? 'ترتيب العرض' : 'Sort order'}
              hint={isRTL ? 'أصغر = أعلى في القائمة.' : 'Lower = higher in the list.'}
              value={sortOrder}
              onChange={(v) => setSortOrder(v.replace(/[^0-9]/g, ''))}
              keyboard="number-pad"
              COLORS={COLORS} isRTL={isRTL}
            />

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  flex: 1, paddingVertical: 13, alignItems: 'center',
                  borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{
                  flex: 2, paddingVertical: 13, alignItems: 'center',
                  borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary,
                  opacity: saving ? 0.55 : 1,
                }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{isRTL ? 'حفظ' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Parent picker — nested modal so it covers the editor sheet
          while still being dismissable back to it. */}
      <Modal visible={picking} animationType="fade" transparent onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: SPACING.lg }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPicking(false)} />
          <View style={{
            backgroundColor: COLORS.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.md,
            maxHeight: '70%',
          }}>
            <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'اختر مدينة أم' : 'Pick a parent city'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => { setParentId(null); setPicking(false); }}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: COLORS.border,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons
                  name={parentId === null ? 'radiobox-marked' : 'radiobox-blank'}
                  size={18}
                  color={parentId === null ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: parentId === null ? '700' : '500' }}>
                  {isRTL ? 'بدون (مدينة رئيسية)' : 'None (top-level)'}
                </Text>
              </TouchableOpacity>
              {siblings.map((s) => {
                const selected = parentId === s.id;
                const cycles = wouldCycle(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      if (cycles) return;
                      setParentId(s.id);
                      setPicking(false);
                    }}
                    disabled={cycles}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: COLORS.border,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                      opacity: cycles ? 0.4 : 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={18}
                      color={selected ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={{
                      flex: 1,
                      color: COLORS.text,
                      fontSize: 14,
                      fontWeight: selected ? '700' : '500',
                      textAlign: isRTL ? 'right' : 'left',
                    }}>
                      {isRTL ? s.name_ar : s.name_en}
                    </Text>
                    {cycles && (
                      <Text style={{ color: COLORS.error, fontSize: 10, fontWeight: '700' }}>
                        {isRTL ? 'دورة' : 'cycle'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function CityField({
  label, hint, value, onChange, keyboard, COLORS, isRTL,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'decimal-pad' | 'number-pad' | 'default';
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>{label}</Text>
      {!!hint && (
        <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>{hint}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        placeholderTextColor={COLORS.textSecondary}
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: COLORS.text,
          backgroundColor: COLORS.background,
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 15,
        }}
      />
    </View>
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
