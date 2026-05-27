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
import {
  listRequestFaqs,
  createRequestFaq,
  updateRequestFaq,
  setRequestFaqEnabled,
  invalidateRequestFaqsCache,
  type RequestFaq,
} from '../services/requestFaqsService';
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
/**
 * Curated list of MaterialCommunityIcons that are plausible candidates
 * for a "repairable device type". Replaces the previous free-text icon
 * input so the admin can pick visually without memorising icon names.
 * Names that aren't in this list are still allowed via the "Advanced
 * (custom)" escape hatch in the picker — that preserves flexibility for
 * any new device category we haven't anticipated.
 *
 * Categories below are kept loose intentionally — the search bar
 * filters across the full list regardless of grouping.
 */
const DEVICE_ICONS: string[] = [
  // Phones / tablets / computers
  'cellphone', 'cellphone-link', 'tablet', 'laptop', 'desktop-tower',
  'desktop-mac', 'monitor', 'monitor-multiple', 'keyboard', 'mouse',
  // Wearables / audio / camera
  'watch', 'watch-variant', 'headphones', 'headset', 'earbuds',
  'speaker', 'microphone', 'microphone-variant', 'camera', 'video',
  // Display / entertainment
  'television', 'projector', 'projector-screen', 'gamepad-variant',
  'controller-classic', 'remote-tv',
  // Office / connectivity
  'printer', 'scanner', 'fax', 'router-wireless', 'router-network',
  'server', 'cellphone-wireless', 'wifi', 'devices',
  // Drones / e-readers / smart-home
  'drone', 'book-open-variant', 'home-outline', 'lightbulb-outline',
  'doorbell-video', 'security-camera',
  // Appliances
  'fridge-outline', 'microwave', 'stove', 'blender', 'washing-machine',
  'dishwasher', 'fan', 'air-conditioner', 'air-purifier', 'vacuum',
  'iron', 'coffee-maker', 'water-pump', 'kettle',
  // Vehicles / tools / power
  'car', 'motorbike', 'bike', 'scooter', 'drill', 'wrench', 'hammer',
  'tools', 'battery', 'solar-panel', 'power-plug', 'lightning-bolt',
];

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

  const [faqs, setFaqs] = useState<RequestFaq[]>([]);
  const [editingFaq, setEditingFaq] = useState<RequestFaq | null>(null);
  const [creatingFaq, setCreatingFaq] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      invalidatePlatformSettingsCache();
      invalidateRequestDeviceTypesCache();
      invalidateRequestFaqsCache();
      const [s, types, faqRows] = await Promise.all([
        getPlatformSettings(),
        listRequestDeviceTypes(),
        listRequestFaqs(),
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
      setFaqs(faqRows);
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
        isRTL
          ? 'تم تحديث إعدادات الطلب. (أنواع الأجهزة وأسئلة المساعد تُحفظ تلقائياً.)'
          : 'Request settings updated. (Device types and FAQs save automatically.)'
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

  const toggleFaq = async (f: RequestFaq, enabled: boolean) => {
    setFaqs((arr) => arr.map((x) => (x.id === f.id ? { ...x, enabled } : x)));
    try {
      await setRequestFaqEnabled(f.id, enabled);
    } catch (e: any) {
      setFaqs((arr) => arr.map((x) => (x.id === f.id ? { ...x, enabled: !enabled } : x)));
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
              defaultOpen
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

            {/* FAQ catalogue — drives the in-app chatbot. */}
            <Section
              icon="message-question-outline"
              iconColor="#0ea5a4"
              title={isRTL ? 'أسئلة المساعد الذكي' : 'AI assistant FAQ catalogue'}
              subtitle={isRTL
                ? 'أضف، عدّل، أو عطّل الأسئلة والإجابات التي يعرضها المساعد'
                : 'Add, edit, or disable the questions and answers the chatbot uses'}
              COLORS={COLORS} isRTL={isRTL}
            >
              {faqs.length === 0 ? (
                <Text style={[styles.fieldHint, { color: COLORS.textSecondary, marginTop: 6 }]}>
                  {isRTL ? 'لا توجد أسئلة بعد.' : 'No FAQs yet.'}
                </Text>
              ) : (
                faqs.map((f) => (
                  <View key={f.id} style={styles.deviceRow}>
                    <View style={[styles.deviceIcon, { backgroundColor: '#0ea5a414' }]}>
                      <MaterialCommunityIcons name="message-question-outline" size={18} color="#0ea5a4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.deviceName, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
                        numberOfLines={1}
                      >
                        {isRTL ? f.q_ar : f.q_en}
                      </Text>
                      <Text
                        style={[styles.deviceMeta, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}
                        numberOfLines={1}
                      >
                        {f.code} · {(f.keywords?.length ?? 0)}
                        {' '}
                        {isRTL ? 'كلمة' : 'keywords'}
                        {f.related?.length ? ` · ${f.related.length} ${isRTL ? 'متابعة' : 'follow-ups'}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setEditingFaq(f)}
                      style={styles.deviceEdit}
                      accessibilityLabel={isRTL ? 'تعديل' : 'Edit'}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <Switch
                      value={f.enabled}
                      onValueChange={(v) => toggleFaq(f, v)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                ))
              )}
              <TouchableOpacity
                onPress={() => setCreatingFaq(true)}
                style={styles.addDeviceBtn}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={18} color={COLORS.primary} />
                <Text style={[styles.addDeviceText, { color: COLORS.primary }]}>
                  {isRTL ? 'إضافة سؤال' : 'Add FAQ'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.fieldHint, { color: COLORS.textSecondary, marginTop: 8 }]}>
                {isRTL
                  ? 'الأسئلة المعطّلة لا تظهر في المساعد ولا في الاقتراحات. لا يوجد حذف نهائي — فقط إيقاف. المسار الافتراضي للأسئلة الأولى في الترحيب وكلمات الرفض/التحويل تبقى داخل الكود لضمان نطاق المساعد.'
                  : 'Disabled FAQs are hidden from the matcher and the suggestion drawer. No hard-delete — disable only. The welcome bubble\'s starter questions, off-topic guard, and handoff keywords stay code-side as scope guarantees.'}
              </Text>
            </Section>

            {/* Save bar — only covers the platform-settings half of this
                screen (service types, inspection, confirmation, free
                delivery). The device-type and FAQ catalogues save inline
                from their own editor sheets; the helper line below makes
                that scope explicit so admins don't wonder if their FAQ
                or device edits also need this button. */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isRTL ? 'حفظ إعدادات الطلب' : 'Save request settings'}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.fieldHint, {
              color: COLORS.textSecondary,
              textAlign: 'center',
              marginTop: 6,
            }]}>
              {isRTL
                ? 'أنواع الأجهزة وأسئلة المساعد تُحفظ تلقائياً من شاشة التعديل الخاصة بها.'
                : 'Device types and FAQs save automatically from their own editor sheet.'}
            </Text>
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

      {/* Edit / create FAQ sheet */}
      <FaqEditor
        visible={!!editingFaq || creatingFaq}
        initial={editingFaq}
        allFaqs={faqs}
        isRTL={isRTL}
        COLORS={COLORS}
        language={language}
        onClose={() => { setEditingFaq(null); setCreatingFaq(false); }}
        onSaved={async () => {
          setEditingFaq(null);
          setCreatingFaq(false);
          invalidateRequestFaqsCache();
          setFaqs(await listRequestFaqs());
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
  defaultOpen = false,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  COLORS: any;
  isRTL: boolean;
  /** Whether the section starts expanded. The first section on the
   *  screen passes true; the rest collapse so the page is scannable
   *  even with six sections stacked. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.md,
        gap: open ? 10 : 0,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}
      >
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
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
      {open && <View style={{ gap: 10 }}>{children}</View>}
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
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

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
          {/* Icon picker — replaces the previous free-text input. Shows
              a 44×44 preview tile + the icon's name; tap to open a
              searchable picker grid. The picker exposes an "Advanced
              (custom)" toggle so admins can still type a MCI name that
              isn't in the curated list. */}
          <View style={{ gap: 4 }}>
            <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'الأيقونة' : 'Icon'}
            </Text>
            <TouchableOpacity
              onPress={() => setIconPickerOpen(true)}
              activeOpacity={0.75}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: BORDER_RADIUS.md,
                backgroundColor: COLORS.background,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: COLORS.primary + '14',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MaterialCommunityIcons name={icon as any} size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                  {icon}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'اضغط لاختيار أيقونة' : 'Tap to pick an icon'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
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

      {/* Icon picker — searchable curated grid + Advanced custom input. */}
      <IconPicker
        visible={iconPickerOpen}
        current={icon}
        isRTL={isRTL}
        COLORS={COLORS}
        onClose={() => setIconPickerOpen(false)}
        onPick={(name) => {
          setIcon(name);
          setIconPickerOpen(false);
        }}
      />
    </Modal>
  );
}

/**
 * Searchable curated icon picker. The grid renders the `DEVICE_ICONS`
 * list filtered by the search query (case-insensitive substring match
 * on the icon name). The current selection is highlighted with a
 * primary-tinted border + checkmark.
 *
 * An "Advanced: custom name" toggle at the bottom reveals a free-text
 * input so admins can still pick any MaterialCommunityIcons name that
 * isn't in the curated list. This preserves the previous behaviour and
 * means we never have to ship the app just to add one icon.
 */
function IconPicker({
  visible, current, isRTL, COLORS, onClose, onPick,
}: {
  visible: boolean;
  current: string;
  isRTL: boolean;
  COLORS: any;
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [custom, setCustom] = useState(current);

  // Re-seed state every time the sheet opens so opening for a different
  // device type doesn't carry stale custom input.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setCustom(current);
    setAdvancedOpen(!DEVICE_ICONS.includes(current));
  }, [visible, current]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEVICE_ICONS;
    return DEVICE_ICONS.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  if (!visible) return null;

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
          maxHeight: '85%',
          gap: 10,
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center' }} />
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 17, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'اختر أيقونة' : 'Pick an icon'}
          </Text>

          {/* Search */}
          <View style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: BORDER_RADIUS.md,
            backgroundColor: COLORS.background,
          }}>
            <Ionicons name="search" size={16} color={COLORS.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={isRTL ? 'ابحث في الأيقونات…' : 'Search icons…'}
              placeholderTextColor={COLORS.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              style={{
                flex: 1,
                color: COLORS.text,
                fontSize: 14,
                paddingVertical: 0,
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Grid */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
                <Ionicons name="search-outline" size={28} color={COLORS.textLight} />
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                  {isRTL ? 'لا توجد أيقونات مطابقة' : 'No matching icons'}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: 'center' }}>
                  {isRTL
                    ? 'يمكنك إدخال اسم مخصّص من القسم أدناه.'
                    : 'You can enter a custom name in the Advanced section below.'}
                </Text>
              </View>
            ) : (
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'flex-start',
              }}>
                {filtered.map((name) => {
                  const selected = name === current;
                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => onPick(name)}
                      activeOpacity={0.75}
                      style={{
                        width: 64,
                        height: 72,
                        borderRadius: BORDER_RADIUS.md,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.primary + '12' : COLORS.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 4,
                        gap: 3,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={name as any}
                        size={22}
                        color={selected ? COLORS.primary : COLORS.text}
                      />
                      <Text
                        style={{
                          color: selected ? COLORS.primary : COLORS.textSecondary,
                          fontSize: 9,
                          fontWeight: selected ? '800' : '600',
                          textAlign: 'center',
                        }}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Advanced custom name — preserves the previous free-text
                behavior for icons not in the curated list. */}
            <TouchableOpacity
              onPress={() => setAdvancedOpen((v) => !v)}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 14,
                paddingVertical: 8,
              }}
            >
              <MaterialCommunityIcons
                name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 12 }}>
                {isRTL ? 'إعدادات متقدّمة: اسم مخصّص' : 'Advanced: custom name'}
              </Text>
            </TouchableOpacity>
            {advancedOpen && (
              <View style={{ gap: 6, marginTop: 4 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL
                    ? 'أدخل اسم أيقونة من حزمة MaterialCommunityIcons. اسم غير معروف يظهر كأيقونة فارغة.'
                    : 'Enter any MaterialCommunityIcons name. Unknown names render as a blank tile.'}
                </Text>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    value={custom}
                    onChangeText={setCustom}
                    autoCorrect={false}
                    autoCapitalize="none"
                    placeholder="e.g. drone"
                    placeholderTextColor={COLORS.textSecondary}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: BORDER_RADIUS.md,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: COLORS.text,
                      backgroundColor: COLORS.background,
                      textAlign: isRTL ? 'right' : 'left',
                      fontSize: 14,
                    }}
                  />
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: COLORS.primary + '14',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MaterialCommunityIcons name={(custom || 'help') as any} size={22} color={COLORS.primary} />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const trimmed = custom.trim();
                    if (!trimmed) return;
                    onPick(trimmed);
                  }}
                  disabled={!custom.trim()}
                  style={{
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderRadius: BORDER_RADIUS.md,
                    backgroundColor: COLORS.primary,
                    opacity: custom.trim() ? 1 : 0.55,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                    {isRTL ? 'استخدم هذا الاسم' : 'Use this name'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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

/**
 * Bottom-sheet editor for a FAQ row. Shape mirrors the in-memory matcher
 * exactly: question (ar/en), answer (ar/en), keywords (normal weight),
 * strong phrases (3x weight), related codes (other FAQ codes for the
 * follow-up chips), and sort order.
 *
 * Validation, defense-in-depth:
 *  • All four text fields required after trim.
 *  • At least one keyword OR one strong phrase — otherwise the FAQ can
 *    never match free text and only surfaces if tapped directly.
 *  • Code: lowercase, non-empty, unique within the catalogue. Editable
 *    only on create (it's a join key referenced by other FAQs' `related`
 *    arrays — renaming would silently break those links).
 *  • Related: only existing codes; self-reference dropped.
 *  • sort_order: non-negative integer.
 */
function FaqEditor({
  visible, initial, allFaqs, isRTL, language, COLORS, onClose, onSaved,
}: {
  visible: boolean;
  initial: RequestFaq | null;
  allFaqs: RequestFaq[];
  isRTL: boolean;
  language: 'ar' | 'en';
  COLORS: any;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = !!initial;
  const [code, setCode] = useState('');
  const [qAr, setQAr] = useState('');
  const [qEn, setQEn] = useState('');
  const [aAr, setAAr] = useState('');
  const [aEn, setAEn] = useState('');
  const [keywords, setKeywords] = useState('');
  const [strong, setStrong] = useState('');
  const [related, setRelated] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState('100');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const maxSort = allFaqs.reduce((m, f) => Math.max(m, f.sort_order ?? 0), 0);
    setCode(initial?.code ?? '');
    setQAr(initial?.q_ar ?? '');
    setQEn(initial?.q_en ?? '');
    setAAr(initial?.a_ar ?? '');
    setAEn(initial?.a_en ?? '');
    setKeywords((initial?.keywords ?? []).join(', '));
    setStrong((initial?.strong ?? []).join(', '));
    setRelated(initial?.related ?? []);
    setSortOrder(String(initial?.sort_order ?? maxSort + 1));
  }, [initial?.id, visible]);

  const splitCsv = (raw: string): string[] =>
    raw.split(',').map((s) => s.trim()).filter(Boolean);

  const submit = async () => {
    const codeTrim = code.trim().toLowerCase();
    if (!editing && !codeTrim) {
      Alert.alert(isRTL ? 'حقول ناقصة' : 'Missing fields', isRTL ? 'الكود مطلوب.' : 'Code is required.');
      return;
    }
    if (!editing && allFaqs.some((f) => f.code.toLowerCase() === codeTrim)) {
      Alert.alert(
        isRTL ? 'كود مكرر' : 'Duplicate code',
        isRTL ? `هناك سؤال بهذا الكود بالفعل.` : `A FAQ with this code already exists.`
      );
      return;
    }
    if (!qAr.trim() || !qEn.trim() || !aAr.trim() || !aEn.trim()) {
      Alert.alert(
        isRTL ? 'حقول ناقصة' : 'Missing fields',
        isRTL ? 'السؤال والإجابة (عربي وإنجليزي) مطلوبة.' : 'Question and answer (Arabic and English) are required.'
      );
      return;
    }
    const kws = splitCsv(keywords);
    const strs = splitCsv(strong);
    if (kws.length === 0 && strs.length === 0) {
      Alert.alert(
        isRTL ? 'لا توجد كلمات مفتاحية' : 'No keywords',
        isRTL
          ? 'أضف كلمة مفتاحية واحدة على الأقل أو عبارة قوية، وإلا لن يتمكن المساعد من مطابقة السؤال.'
          : 'Add at least one keyword or strong phrase, otherwise the matcher can never reach this FAQ.'
      );
      return;
    }
    const sort = Number(sortOrder);
    if (!Number.isFinite(sort) || sort < 0) {
      Alert.alert(isRTL ? 'ترتيب غير صالح' : 'Invalid sort order');
      return;
    }
    // Drop self-references and any unknown codes from related.
    const knownCodes = new Set(
      allFaqs
        .filter((f) => !editing || f.id !== initial?.id)
        .map((f) => f.code.toLowerCase())
    );
    const cleanRelated = related
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c && c !== codeTrim && knownCodes.has(c));

    setBusy(true);
    try {
      if (editing && initial) {
        await updateRequestFaq(initial.id, {
          q_ar: qAr,
          q_en: qEn,
          a_ar: aAr,
          a_en: aEn,
          keywords: kws,
          strong: strs,
          related: cleanRelated,
          sort_order: Math.floor(sort),
        });
      } else {
        await createRequestFaq({
          code: codeTrim,
          q_ar: qAr,
          q_en: qEn,
          a_ar: aAr,
          a_en: aEn,
          keywords: kws,
          strong: strs,
          related: cleanRelated,
          sort_order: Math.floor(sort),
          enabled: true,
        });
      }
      await onSaved();
    } catch (e: any) {
      Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', getFriendlyError(e, language));
    } finally {
      setBusy(false);
    }
  };

  const otherFaqs = allFaqs.filter((f) => f.id !== initial?.id);
  const relatedSelected = (c: string) => related.includes(c);
  const toggleRelated = (c: string) =>
    setRelated((arr) => (arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]));

  if (!visible) return null;

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
          gap: 10,
          maxHeight: '92%',
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center' }} />
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 17, textAlign: isRTL ? 'right' : 'left' }}>
            {editing
              ? (isRTL ? 'تعديل سؤال' : 'Edit FAQ')
              : (isRTL ? 'إضافة سؤال جديد' : 'Add a new FAQ')}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <SheetField
              label={isRTL ? 'الكود (إنجليزي، فريد)' : 'Code (English, unique)'}
              value={code}
              onChange={setCode}
              placeholder="e.g. shipping"
              disabled={editing}
              COLORS={COLORS} isRTL={isRTL}
            />
            <SheetField
              label={isRTL ? 'السؤال بالعربي' : 'Question (Arabic)'}
              value={qAr}
              onChange={setQAr}
              placeholder={isRTL ? 'مثال: ما هو الضمان؟' : 'e.g. ما هو الضمان؟'}
              COLORS={COLORS} isRTL={isRTL}
            />
            <SheetField
              label={isRTL ? 'السؤال بالإنجليزي' : 'Question (English)'}
              value={qEn}
              onChange={setQEn}
              placeholder="e.g. What warranty do I get?"
              COLORS={COLORS} isRTL={isRTL}
            />
            <MultilineField
              label={isRTL ? 'الإجابة بالعربي' : 'Answer (Arabic)'}
              value={aAr}
              onChange={setAAr}
              COLORS={COLORS} isRTL={isRTL}
            />
            <MultilineField
              label={isRTL ? 'الإجابة بالإنجليزي' : 'Answer (English)'}
              value={aEn}
              onChange={setAEn}
              COLORS={COLORS} isRTL={isRTL}
            />
            <SheetField
              label={isRTL
                ? 'كلمات مفتاحية (مفصولة بفاصلة، وزن 1)'
                : 'Keywords (comma-separated, weight 1)'}
              value={keywords}
              onChange={setKeywords}
              placeholder="warranty, ضمان, guarantee"
              COLORS={COLORS} isRTL={isRTL}
            />
            <SheetField
              label={isRTL
                ? 'عبارات قوية (مفصولة بفاصلة، وزن 3)'
                : 'Strong phrases (comma-separated, weight 3)'}
              value={strong}
              onChange={setStrong}
              placeholder="how much, كم يكلف"
              COLORS={COLORS} isRTL={isRTL}
            />

            {/* Related FAQs picker */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'أسئلة المتابعة المقترحة' : 'Follow-up questions'}
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? 'تظهر للعميل كاقتراحات قابلة للنقر تحت إجابة هذا السؤال.'
                  : 'Shown to the user as tappable chips under this answer.'}
              </Text>
              <TouchableOpacity
                onPress={() => setPicking(true)}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: BORDER_RADIUS.md,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: COLORS.background,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons name="link-variant" size={16} color={COLORS.textSecondary} />
                <Text style={{ flex: 1, color: COLORS.text, fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                  {related.length === 0
                    ? (isRTL ? 'لم يتم اختيار أسئلة متابعة' : 'No follow-ups selected')
                    : related.join(', ')}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Related-FAQs picker */}
      <Modal visible={picking} animationType="fade" transparent onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: SPACING.lg }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPicking(false)} />
          <View style={{
            backgroundColor: COLORS.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.md,
            maxHeight: '75%',
          }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15 }}>
                {isRTL ? 'اختر أسئلة المتابعة' : 'Pick follow-up FAQs'}
              </Text>
              <TouchableOpacity onPress={() => setPicking(false)}>
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{isRTL ? 'تم' : 'Done'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {otherFaqs.length === 0 ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, paddingVertical: 12 }}>
                  {isRTL ? 'لا توجد أسئلة أخرى بعد.' : 'No other FAQs yet.'}
                </Text>
              ) : (
                otherFaqs.map((f) => {
                  const checked = relatedSelected(f.code);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => toggleRelated(f.code)}
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
                        name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={20}
                        color={checked ? COLORS.primary : COLORS.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: checked ? '700' : '500', textAlign: isRTL ? 'right' : 'left' }}>
                          {isRTL ? f.q_ar : f.q_en}
                        </Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                          {f.code}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

/** Multi-line variant of SheetField — used for long-form answer bodies. */
function MultilineField({
  label, value, onChange, COLORS, isRTL,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
        multiline
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10,
          color: COLORS.text,
          backgroundColor: COLORS.background,
          textAlign: isRTL ? 'right' : 'left',
          textAlignVertical: 'top',
          fontSize: 14,
          minHeight: 80,
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
