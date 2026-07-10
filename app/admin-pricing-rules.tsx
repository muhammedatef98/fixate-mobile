import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import {
  adminListRules,
  adminSaveRule,
  adminDeleteRule,
  type PricingRuleRow,
  type RuleInput,
} from '../services/pricingRegistryService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * Repair pricing registry (§5/§16). Each rule prices a slice of the catalog;
 * empty match fields are wildcards and the most specific active rule wins in
 * the request flow. Empty table = the app keeps its current estimate logic.
 * File/Excel import later inserts rows here (source='import'); this screen is
 * the manual editor over the same registry.
 */
export default function AdminPricingRulesScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const { isAdmin, checking } = useIsAdmin();

  const [rows, setRows] = useState<PricingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRuleRow | null>(null);
  const [deviceType, setDeviceType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');
  const [repairType, setRepairType] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListRules());
    } catch (e) {
      logger.warn('load rules failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && isAdmin) load();
  }, [checking, isAdmin, load]);

  const openNew = () => {
    setEditing(null);
    setDeviceType('');
    setBrand('');
    setModel('');
    setCategory('');
    setRepairType('');
    setPrice('');
    setNote('');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (r: PricingRuleRow) => {
    setEditing(r);
    setDeviceType(r.device_type ?? '');
    setBrand(r.brand ?? '');
    setModel(r.model ?? '');
    setCategory(r.category ?? '');
    setRepairType(r.repair_type ?? '');
    setPrice(String(r.price));
    setNote(r.note ?? '');
    setActive(r.active);
    setModalOpen(true);
  };

  const save = async () => {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'أدخل سعراً صحيحاً' : 'Enter a valid price');
      return;
    }
    if (!deviceType.trim() && !brand.trim() && !model.trim() && !category.trim() && !repairType.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL ? 'حدّد على الأقل حقل مطابقة واحد لتجنّب تسعير كل شيء' : 'Set at least one match field to avoid pricing everything'
      );
      return;
    }
    setSaving(true);
    try {
      const input: RuleInput = {
        device_type: deviceType,
        brand,
        model,
        category,
        repair_type: repairType,
        price: priceNum,
        note,
        active,
      };
      await adminSaveRule(input, editing?.id);
      setModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: PricingRuleRow) => {
    Alert.alert(
      isRTL ? 'حذف' : 'Delete',
      isRTL ? 'حذف قاعدة التسعير؟' : 'Delete this pricing rule?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminDeleteRule(r.id);
              await load();
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e));
            }
          },
        },
      ]
    );
  };

  const matchLabel = (r: PricingRuleRow): string => {
    const parts = [r.device_type, r.brand, r.model, r.category, r.repair_type].filter(Boolean);
    return parts.length ? parts.join(' · ') : (isRTL ? 'كل الطلبات' : 'All repairs');
  };

  if (checking || (loading && rows.length === 0)) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'تسعير الإصلاح' : 'Repair Pricing'} />
        <AdminEmptyState variant="error" title={isRTL ? 'غير مصرّح' : 'Not authorized'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'تسعير الإصلاح' : 'Repair Pricing'}
        subtitle={isRTL ? 'قواعد التسعير حسب الجهاز والماركة والموديل والعطل' : 'Rules by device, brand, model & repair type'}
        rightIcon="add"
        rightLabel={isRTL ? 'إضافة' : 'Add'}
        onRightPress={openNew}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 60 }}>
        {rows.length === 0 ? (
          <AdminEmptyState
            icon="tune-variant"
            title={isRTL ? 'لا توجد قواعد تسعير' : 'No pricing rules'}
            body={
              isRTL
                ? 'التطبيق يستخدم التسعير الافتراضي الحالي. أضِف قاعدة لتخصيص السعر. لاحقاً يمكن استيراد ملف Excel ليملأ هذه القواعد.'
                : 'The app uses the current default pricing. Add a rule to override. A future Excel import fills these rules.'
            }
            ctaLabel={isRTL ? 'إضافة قاعدة' : 'Add rule'}
            onCtaPress={openNew}
          />
        ) : (
          rows.map((r) => (
            <TouchableOpacity key={r.id} style={styles.row} onPress={() => openEdit(r)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{matchLabel(r)}</Text>
                <Text style={styles.rowSub}>
                  {r.source === 'import' ? (isRTL ? 'مستورد' : 'imported') : (isRTL ? 'يدوي' : 'manual')}
                  {!r.active ? (isRTL ? ' · موقوف' : ' · inactive') : ''}
                  {r.note ? ` · ${r.note}` : ''}
                </Text>
              </View>
              <Text style={styles.price}>{Math.round(r.price)} {isRTL ? 'ر.س' : 'SAR'}</Text>
              <TouchableOpacity onPress={() => remove(r)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {editing ? (isRTL ? 'تعديل قاعدة' : 'Edit rule') : (isRTL ? 'قاعدة جديدة' : 'New rule')}
              </Text>
              <Text style={styles.hint}>
                {isRTL
                  ? 'اترك الحقل فارغاً ليعني «الكل». القاعدة الأكثر تحديداً هي التي تُطبَّق.'
                  : 'Leave a field blank for "any". The most specific matching rule wins.'}
              </Text>

              <Field label={isRTL ? 'نوع الجهاز' : 'Device type'} value={deviceType} onChange={setDeviceType} styles={styles} placeholder="phone / tablet / laptop" />
              <Field label={isRTL ? 'الماركة' : 'Brand'} value={brand} onChange={setBrand} styles={styles} placeholder="Apple" />
              <Field label={isRTL ? 'الموديل' : 'Model'} value={model} onChange={setModel} styles={styles} placeholder="iPhone 15 Pro" />
              <Field label={isRTL ? 'الفئة' : 'Category'} value={category} onChange={setCategory} styles={styles} placeholder="screen" />
              <Field label={isRTL ? 'نوع العطل (repair id)' : 'Repair type (issue id)'} value={repairType} onChange={setRepairType} styles={styles} placeholder="screen_replacement" />
              <Field label={isRTL ? 'السعر (ر.س)' : 'Price (SAR)'} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} styles={styles} keyboardType="numeric" />
              <Field label={isRTL ? 'ملاحظة (اختياري)' : 'Note (optional)'} value={note} onChange={setNote} styles={styles} />

              <View style={styles.switchRow}>
                <Text style={styles.label}>{isRTL ? 'مُفعّل' : 'Active'}</Text>
                <Switch value={active} onValueChange={setActive} />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.border }]} onPress={() => setModalOpen(false)}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primary }]} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{isRTL ? 'حفظ' : 'Save'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  styles,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: any;
  keyboardType?: 'numeric' | 'default';
  placeholder?: string;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor="#9AA0A6"
      />
    </>
  );
}

const createStyles = (COLORS: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.card,
      borderColor: COLORS.border,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
      marginBottom: 8,
    },
    rowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' },
    rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    price: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
    modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
    modalCard: { backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.l, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 14, textAlign: isRTL ? 'right' : 'left' },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    input: {
      backgroundColor: COLORS.card,
      borderColor: COLORS.border,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      color: COLORS.text,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    switchRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  });
