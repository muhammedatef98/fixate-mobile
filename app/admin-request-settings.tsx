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
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import {
  PLATFORM_SETTINGS_KEYS,
  getPlatformSettings,
  upsertPlatformSettings,
  invalidatePlatformSettingsCache,
} from '../services/platformSettingsService';
import {
  listRequestDeviceTypes,
  createRequestDeviceType,
  updateRequestDeviceType,
  setRequestDeviceTypeEnabled,
  invalidateRequestDeviceTypesCache,
  type RequestDeviceType,
} from '../services/requestDeviceTypesService';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * Dedicated admin screen for everything that affects the customer
 * repair request flow:
 *   • Service-type availability (mobile / pickup / personal hand-off)
 *   • Inspection fee + enabled
 *   • Confirmation amount (commitment fee + enabled)
 *   • Free delivery (master switch + promo code)
 *   • Device-type catalogue (enable/disable, edit, add)
 *
 * Admin-gated through the same `is_admin(auth.uid())` RLS used elsewhere.
 * No new admin-promotion path is introduced — only existing admins can
 * reach this screen and only their mutations satisfy the policies on
 * `platform_settings` and `request_device_types`. Device types are
 * intentionally disable-only in the UI; the schema allows hard delete
 * via RLS but the project posture (mirrored from Market) is
 * "archive/disable, never destroy".
 */
interface FormState {
  inspectionFee: string;
  inspectionEnabled: boolean;
  commitmentFee: string;
  commitmentEnabled: boolean;
  serviceMobileEnabled: boolean;
  servicePickupEnabled: boolean;
  serviceHandoffEnabled: boolean;
  freeDeliveryEnabled: boolean;
  freeDeliveryPromoCode: string;
}

interface FieldErrors {
  inspectionFee?: string;
  commitmentFee?: string;
}

export default function AdminRequestSettingsScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin, checking: adminChecking } = useIsAdmin();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [deviceTypes, setDeviceTypes] = useState<RequestDeviceType[]>([]);
  const [editingDevice, setEditingDevice] = useState<RequestDeviceType | null>(null);
  const [creatingDevice, setCreatingDevice] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      invalidatePlatformSettingsCache();
      invalidateRequestDeviceTypesCache();
      const [s, types] = await Promise.all([
        getPlatformSettings(),
        listRequestDeviceTypes(),
      ]);
      setForm({
        inspectionFee: String(s.inspectionFee),
        inspectionEnabled: s.inspectionEnabled,
        commitmentFee: String(s.commitmentFee),
        commitmentEnabled: s.commitmentEnabled,
        serviceMobileEnabled: s.serviceMobileEnabled,
        servicePickupEnabled: s.servicePickupEnabled,
        serviceHandoffEnabled: s.serviceHandoffEnabled,
        freeDeliveryEnabled: s.freeDeliveryEnabled,
        freeDeliveryPromoCode: s.freeDeliveryPromoCode,
      });
      setDeviceTypes(types);
    } catch (e: any) {
      logger.error('admin request-settings load failed', e);
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

  const set = (patch: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  const validate = (f: FormState): FieldErrors => {
    const err: FieldErrors = {};
    const num = (v: string) => Number(v);
    if (!Number.isFinite(num(f.inspectionFee)) || num(f.inspectionFee) < 0)
      err.inspectionFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
    if (!Number.isFinite(num(f.commitmentFee)) || num(f.commitmentFee) < 0)
      err.commitmentFee = isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid number';
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
      await upsertPlatformSettings([
        { key: PLATFORM_SETTINGS_KEYS.inspectionFee, value: Number(form.inspectionFee) },
        { key: PLATFORM_SETTINGS_KEYS.inspectionEnabled, value: form.inspectionEnabled },
        { key: PLATFORM_SETTINGS_KEYS.commitmentFee, value: Number(form.commitmentFee) },
        { key: PLATFORM_SETTINGS_KEYS.commitmentEnabled, value: form.commitmentEnabled },
        { key: PLATFORM_SETTINGS_KEYS.serviceMobileEnabled, value: form.serviceMobileEnabled },
        { key: PLATFORM_SETTINGS_KEYS.servicePickupEnabled, value: form.servicePickupEnabled },
        { key: PLATFORM_SETTINGS_KEYS.serviceHandoffEnabled, value: form.serviceHandoffEnabled },
        { key: PLATFORM_SETTINGS_KEYS.freeDeliveryEnabled, value: form.freeDeliveryEnabled },
        { key: PLATFORM_SETTINGS_KEYS.freeDeliveryPromoCode, value: form.freeDeliveryPromoCode.trim().toUpperCase() },
      ]);
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL ? 'تم تحديث إعدادات الطلب.' : 'Request settings updated.'
      );
    } catch (e: any) {
      logger.error('admin request-settings save failed', e);
      Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', getFriendlyError(e, language));
    } finally {
      setSaving(false);
    }
  };

  // --- Device-type CRUD (admin-only, gated by RLS server-side) ----------

  const toggleDevice = async (d: RequestDeviceType, enabled: boolean) => {
    // Optimistic so the switch feels instant; reverts on failure.
    setDeviceTypes((arr) => arr.map((x) => (x.id === d.id ? { ...x, enabled } : x)));
    try {
      await setRequestDeviceTypeEnabled(d.id, enabled);
    } catch (e: any) {
      setDeviceTypes((arr) => arr.map((x) => (x.id === d.id ? { ...x, enabled: !enabled } : x)));
      Alert.alert(isRTL ? 'فشل' : 'Failed', getFriendlyError(e, language));
    }
  };

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

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
        <Header
          title={isRTL ? 'إعدادات الطلب' : 'Request Settings'}
          isRTL={isRTL} COLORS={COLORS}
          onBack={() => safeBack('/admin')}
        />
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
        title={isRTL ? 'إعدادات الطلب' : 'Request Settings'}
        isRTL={isRTL} COLORS={COLORS}
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
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.deniedBody}>{error}</Text>
            <TouchableOpacity onPress={load} style={[styles.saveBtn, { marginTop: 12 }]}>
              <Text style={styles.saveBtnText}>{isRTL ? 'إعادة المحاولة' : 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        ) : !form ? null : (
          <ScrollView
            contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140, gap: 14 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={COLORS.primary}
              />
            }
          >
            <Text style={styles.intro}>
              {isRTL
                ? 'كل الإعدادات هنا تؤثر مباشرة على شاشة "طلب صيانة" للعميل.'
                : 'Every control here directly affects the customer "New repair" flow.'}
            </Text>

            {/* Service types */}
            <Section
              icon="format-list-checks"
              iconColor="#6366f1"
              title={isRTL ? 'أنواع الخدمة' : 'Service types'}
              subtitle={isRTL ? 'تفعيل أو إيقاف وضع الحجز' : 'Enable or disable booking modes'}
              COLORS={COLORS} isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'خدمة الفني المتنقل' : 'Mobile-technician service'}
                hint={isRTL ? 'فني يأتي إلى موقع العميل.' : 'Technician comes to the customer.'}
                value={form.serviceMobileEnabled}
                onChange={(v) => set({ serviceMobileEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'الاستلام والتوصيل' : 'Pickup & delivery'}
                hint={isRTL ? 'نستلم الجهاز ونوصّله للورشة ونرجعه.' : 'We collect, repair, and return.'}
                value={form.servicePickupEnabled}
                onChange={(v) => set({ servicePickupEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <SwitchRow
                label={isRTL ? 'تسليم شخصي' : 'Personal hand-off'}
                hint={isRTL ? 'العميل يسلّم الجهاز شخصياً، بدون توصيل.' : 'Customer hands the device over in person.'}
                value={form.serviceHandoffEnabled}
                onChange={(v) => set({ serviceHandoffEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
            </Section>

            {/* Confirmation amount */}
            <Section
              icon="cash-lock"
              iconColor="#8b5cf6"
              title={isRTL ? 'مبلغ التأكيد' : 'Confirmation amount'}
              subtitle={isRTL ? 'المبلغ المدفوع قبل الفحص' : 'Amount paid before inspection'}
              COLORS={COLORS} isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'تفعيل مبلغ التأكيد' : 'Enable confirmation amount'}
                hint={isRTL ? 'عند الإيقاف، لا يدفع العميل شيئاً قبل الفحص.' : 'When off, no pre-inspection payment.'}
                value={form.commitmentEnabled}
                onChange={(v) => set({ commitmentEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              {form.commitmentEnabled && (
                <FieldNumber
                  label={isRTL ? 'القيمة (ر.س)' : 'Amount (SAR)'}
                  hint={isRTL ? 'يُخصم من الفاتورة النهائية بعد الإصلاح.' : 'Deducted from the final invoice.'}
                  value={form.commitmentFee}
                  onChangeText={(v) => set({ commitmentFee: v })}
                  error={errors.commitmentFee}
                  COLORS={COLORS} isRTL={isRTL}
                />
              )}
            </Section>

            {/* Inspection fee */}
            <Section
              icon="magnify-scan"
              iconColor="#3b82f6"
              title={isRTL ? 'رسوم الفحص' : 'Inspection fee'}
              subtitle={isRTL ? 'تكلفة فحص الجهاز' : 'Cost of inspecting a device'}
              COLORS={COLORS} isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'تفعيل رسوم الفحص' : 'Charge an inspection fee'}
                hint={isRTL ? 'عند الإيقاف، الفحص مجاني للعميل.' : 'When off, inspection is free.'}
                value={form.inspectionEnabled}
                onChange={(v) => set({ inspectionEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              {form.inspectionEnabled && (
                <FieldNumber
                  label={isRTL ? 'القيمة (ر.س)' : 'Amount (SAR)'}
                  hint={isRTL ? 'تُحتسب عند رفض العميل لعرض السعر.' : 'Charged if the customer rejects the quote.'}
                  value={form.inspectionFee}
                  onChangeText={(v) => set({ inspectionFee: v })}
                  error={errors.inspectionFee}
                  COLORS={COLORS} isRTL={isRTL}
                />
              )}
            </Section>

            {/* Free delivery */}
            <Section
              icon="truck-fast-outline"
              iconColor="#10b981"
              title={isRTL ? 'التوصيل المجاني' : 'Free delivery'}
              subtitle={isRTL ? 'مفتاح رئيسي + كود ترويجي اختياري' : 'Master switch + optional promo code'}
              COLORS={COLORS} isRTL={isRTL}
            >
              <SwitchRow
                label={isRTL ? 'توصيل مجاني للجميع' : 'Free delivery for everyone'}
                hint={isRTL
                  ? 'عند التفعيل، رسوم التوصيل تظهر كـ "مجاناً" لكل العملاء.'
                  : 'When on, every customer sees "Free" delivery.'}
                value={form.freeDeliveryEnabled}
                onChange={(v) => set({ freeDeliveryEnabled: v })}
                COLORS={COLORS} isRTL={isRTL}
              />
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { color: COLORS.text }]}>
                  {isRTL ? 'كود التوصيل المجاني (اختياري)' : 'Free-delivery promo code (optional)'}
                </Text>
                <Text style={[styles.fieldHint, { color: COLORS.textSecondary }]}>
                  {isRTL
                    ? 'إذا كتبه العميل في خانة الخصم، التوصيل يصبح مجانياً. اتركه فارغاً للتعطيل.'
                    : 'If a customer types it in the discount field, delivery becomes free. Leave empty to disable.'}
                </Text>
                <TextInput
                  value={form.freeDeliveryPromoCode}
                  onChangeText={(v) => set({ freeDeliveryPromoCode: v.toUpperCase() })}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={isRTL ? 'مثال: FREESHIP' : 'e.g. FREESHIP'}
                  placeholderTextColor={COLORS.textSecondary}
                  style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, textAlign: isRTL ? 'right' : 'left' }]}
                />
              </View>
            </Section>

            {/* Device types catalogue */}
            <Section
              icon="devices"
              iconColor="#f59e0b"
              title={isRTL ? 'أنواع الأجهزة' : 'Device types'}
              subtitle={isRTL
                ? 'فعّل أو عطّل، أو أضف نوع جهاز جديد قابل للإصلاح'
                : 'Enable / disable or add a new repairable device type'}
              COLORS={COLORS} isRTL={isRTL}
            >
              {deviceTypes.length === 0 ? (
                <Text style={[styles.fieldHint, { color: COLORS.textSecondary, marginTop: 6 }]}>
                  {isRTL ? 'لا توجد أنواع بعد.' : 'No device types yet.'}
                </Text>
              ) : (
                deviceTypes.map((d) => (
                  <View key={d.id} style={styles.deviceRow}>
                    <View style={[styles.deviceIcon, { backgroundColor: COLORS.primary + '12' }]}>
                      <MaterialCommunityIcons name={d.icon as any} size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deviceName, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
                        {isRTL ? d.name_ar : d.name_en}
                      </Text>
                      <Text style={[styles.deviceMeta, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                        {d.code} · {(isRTL ? d.name_en : d.name_ar)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setEditingDevice(d)}
                      style={styles.deviceEdit}
                      accessibilityLabel={isRTL ? 'تعديل' : 'Edit'}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <Switch
                      value={d.enabled}
                      onValueChange={(v) => toggleDevice(d, v)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                ))
              )}
              <TouchableOpacity
                onPress={() => setCreatingDevice(true)}
                style={styles.addDeviceBtn}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={18} color={COLORS.primary} />
                <Text style={[styles.addDeviceText, { color: COLORS.primary }]}>
                  {isRTL ? 'إضافة نوع جهاز' : 'Add device type'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.fieldHint, { color: COLORS.textSecondary, marginTop: 8 }]}>
                {isRTL
                  ? 'الأنواع المعطّلة تظهر للعميل مع شارة "قريباً" ولا يمكن اختيارها. لا يوجد حذف نهائي من الواجهة — فقط إيقاف.'
                  : 'Disabled types show as "Coming soon" to customers and can\'t be picked. No hard-delete from the UI — disable only.'}
              </Text>
            </Section>

            {/* Save bar */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{isRTL ? 'حفظ التغييرات' : 'Save changes'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Edit / create device-type sheet */}
      <DeviceTypeEditor
        visible={!!editingDevice || creatingDevice}
        initial={editingDevice}
        isRTL={isRTL}
        COLORS={COLORS}
        onClose={() => { setEditingDevice(null); setCreatingDevice(false); }}
        onSaved={async () => {
          setEditingDevice(null);
          setCreatingDevice(false);
          invalidateRequestDeviceTypesCache();
          setDeviceTypes(await listRequestDeviceTypes());
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------
// Sub-components — kept inside this file because they're tightly coupled
// to the screen's form state and aren't reused elsewhere.
// ---------------------------------------------------------------------

function Header({
  title, onBack, COLORS, isRTL, right,
}: {
  title: string;
  onBack: () => void;
  COLORS: any;
  isRTL: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.lg,
      }}
    >
      <TouchableOpacity onPress={onBack} accessibilityRole="button">
        <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>{title}</Text>
      {right ?? <View style={{ width: 26 }} />}
    </View>
  );
}

function Section({
  icon, iconColor, title, subtitle, children, COLORS, isRTL,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.md,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: iconColor + '18',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>{title}</Text>
          {!!subtitle && (
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function SwitchRow({
  label, hint, value, onChange, COLORS, isRTL,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>{label}</Text>
        {!!hint && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 16, textAlign: isRTL ? 'right' : 'left' }}>
            {hint}
          </Text>
        )}
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

function FieldNumber({
  label, hint, value, onChangeText, error, COLORS, isRTL,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
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
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholderTextColor={COLORS.textSecondary}
        style={{
          borderWidth: 1,
          borderColor: error ? '#DC2626' : COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: COLORS.text,
          backgroundColor: COLORS.background,
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 15,
        }}
      />
      {!!error && (
        <Text style={{ color: '#DC2626', fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>{error}</Text>
      )}
    </View>
  );
}

function DeviceTypeEditor({
  visible, initial, isRTL, COLORS, onClose, onSaved,
}: {
  visible: boolean;
  initial: RequestDeviceType | null;
  isRTL: boolean;
  COLORS: any;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = !!initial;
  const [code, setCode] = useState(initial?.code ?? '');
  const [nameAr, setNameAr] = useState(initial?.name_ar ?? '');
  const [nameEn, setNameEn] = useState(initial?.name_en ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'devices');
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 100));
  const [busy, setBusy] = useState(false);

  // Re-seed form when the target row changes.
  useEffect(() => {
    setCode(initial?.code ?? '');
    setNameAr(initial?.name_ar ?? '');
    setNameEn(initial?.name_en ?? '');
    setIcon(initial?.icon ?? 'devices');
    setSortOrder(String(initial?.sort_order ?? 100));
  }, [initial?.id, visible]);

  const submit = async () => {
    if (!code.trim() || !nameAr.trim() || !nameEn.trim()) {
      Alert.alert(
        isRTL ? 'حقول ناقصة' : 'Missing fields',
        isRTL ? 'الكود والاسمين مطلوبة.' : 'Code, Arabic name, and English name are required.'
      );
      return;
    }
    setBusy(true);
    try {
      if (editing && initial) {
        await updateRequestDeviceType(initial.id, {
          code: code.trim(),
          name_ar: nameAr.trim(),
          name_en: nameEn.trim(),
          icon: icon.trim(),
          sort_order: Number(sortOrder) || 100,
        });
      } else {
        await createRequestDeviceType({
          code: code.trim(),
          name_ar: nameAr.trim(),
          name_en: nameEn.trim(),
          icon: icon.trim(),
          sort_order: Number(sortOrder) || 100,
          enabled: true,
        });
      }
      await onSaved();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setBusy(false);
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
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 17, textAlign: isRTL ? 'right' : 'left' }}>
            {editing
              ? (isRTL ? 'تعديل نوع الجهاز' : 'Edit device type')
              : (isRTL ? 'إضافة نوع جهاز' : 'Add device type')}
          </Text>
          <SheetField
            label={isRTL ? 'الكود (إنجليزي، فريد)' : 'Code (English, unique)'}
            value={code}
            onChange={setCode}
            placeholder="e.g. printer"
            disabled={editing}
            COLORS={COLORS} isRTL={isRTL}
          />
          <SheetField
            label={isRTL ? 'الاسم بالعربي' : 'Arabic name'}
            value={nameAr}
            onChange={setNameAr}
            placeholder={isRTL ? 'مثال: طابعة' : 'e.g. طابعة'}
            COLORS={COLORS} isRTL={isRTL}
          />
          <SheetField
            label={isRTL ? 'الاسم بالإنجليزي' : 'English name'}
            value={nameEn}
            onChange={setNameEn}
            placeholder="e.g. Printer"
            COLORS={COLORS} isRTL={isRTL}
          />
          <SheetField
            label={isRTL ? 'اسم الأيقونة (MaterialCommunityIcons)' : 'Icon name (MaterialCommunityIcons)'}
            value={icon}
            onChange={setIcon}
            placeholder="e.g. printer"
            COLORS={COLORS} isRTL={isRTL}
          />
          <SheetField
            label={isRTL ? 'ترتيب العرض' : 'Sort order'}
            value={sortOrder}
            onChange={(v) => setSortOrder(v.replace(/[^0-9]/g, ''))}
            placeholder="100"
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
              onPress={submit}
              disabled={busy}
              style={{
                flex: 2, paddingVertical: 13, alignItems: 'center',
                borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary,
                opacity: busy ? 0.55 : 1,
              }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {editing ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إضافة' : 'Create')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetField({
  label, value, onChange, placeholder, disabled, COLORS, isRTL,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: disabled ? COLORS.textSecondary : COLORS.text,
          backgroundColor: disabled ? COLORS.cardAlt : COLORS.background,
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 14,
        }}
      />
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  deniedTitle: { color: C.text, fontWeight: '800', fontSize: 16, marginTop: 8 },
  deniedBody: { color: C.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 4 },
  intro: { color: C.textSecondary, fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' },
  fieldHint: { fontSize: 11, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  deviceRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  deviceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontWeight: '800', fontSize: 13 },
  deviceMeta: { fontSize: 11, marginTop: 2 },
  deviceEdit: { padding: 6 },
  addDeviceBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.primary + '50',
  },
  addDeviceText: { fontWeight: '800', fontSize: 13 },
});
