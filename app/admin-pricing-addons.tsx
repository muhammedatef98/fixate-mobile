import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
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
  adminListAddons,
  adminSaveAddon,
  adminDeleteAddon,
  adminImportAddons,
  type PricingAddonRow,
  type AddonInput,
} from '../services/pricingRegistryService';
import CsvImportModal from '../components/CsvImportModal';
import SelectField from '../components/SelectField';
import {
  DEVICE_TYPE_OPTIONS,
  ACCESSORY_PRESETS,
  PROTECTION_PRESETS,
  type Opt,
} from '../constants/pricingOptions';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';
import { Riyal } from '../components/Riyal';
import GearLoader from '../components/GearLoader';

const CUSTOM = '__custom__';
const toSelect = (opts: Opt[], isRTL: boolean) =>
  opts.map((o) => ({ id: o.value, label: isRTL ? o.ar : o.en }));

/**
 * Admin catalog for the accessory & protection add-ons offered during request
 * creation (§4). When this table is empty the request flow keeps its hardcoded
 * suggestions; any active row here replaces the defaults for that kind.
 */
export default function AdminPricingAddonsScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const { isAdmin, checking } = useIsAdmin();

  const [rows, setRows] = useState<PricingAddonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { setRows(await adminListAddons()); } catch (e) { logger.warn('refresh addons failed', e); } finally { setRefreshing(false); }
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingAddonRow | null>(null);
  const [kind, setKind] = useState<'accessory' | 'protection'>('accessory');
  const [deviceType, setDeviceType] = useState('');
  const [itemKey, setItemKey] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [price, setPrice] = useState('');
  const [sort, setSort] = useState('0');
  // Which preset the item_key came from ('' = none yet, CUSTOM = free entry).
  const [presetChoice, setPresetChoice] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListAddons());
    } catch (e) {
      logger.warn('load addons failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && isAdmin) load();
  }, [checking, isAdmin, load]);

  const openNew = () => {
    setEditing(null);
    setKind('accessory');
    setDeviceType('');
    setItemKey('');
    setNameAr('');
    setNameEn('');
    setPrice('');
    setSort('0');
    setPresetChoice('');
    setActive(true);
    setModalOpen(true);
  };

  const presetsFor = (k: 'accessory' | 'protection'): Opt[] =>
    k === 'protection' ? PROTECTION_PRESETS : ACCESSORY_PRESETS;

  // Selecting a preset pre-fills the stable key + bilingual names; "custom"
  // reveals free-text entry for a new item.
  const choosePreset = (choice: string) => {
    setPresetChoice(choice);
    if (choice === CUSTOM || choice === '') {
      if (choice === CUSTOM) { setItemKey(''); setNameAr(''); setNameEn(''); }
      return;
    }
    const p = presetsFor(kind).find((o) => o.value === choice);
    if (p) {
      setItemKey(p.value);
      setNameAr(p.ar);
      setNameEn(p.en);
    }
  };

  const openEdit = (r: PricingAddonRow) => {
    setEditing(r);
    setKind(r.kind);
    setDeviceType(r.device_type ?? '');
    setItemKey(r.item_key);
    setNameAr(r.name_ar);
    setNameEn(r.name_en);
    setPrice(String(r.price));
    setSort(String(r.sort));
    const known = presetsFor(r.kind).some((o) => o.value === r.item_key);
    setPresetChoice(known ? r.item_key : CUSTOM);
    setActive(r.active);
    setModalOpen(true);
  };

  const save = async () => {
    const priceNum = Number(price);
    if (!itemKey.trim() || !nameAr.trim() || !nameEn.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'أكمل المعرّف والاسمين' : 'Fill key and both names');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'أدخل سعراً صحيحاً' : 'Enter a valid price');
      return;
    }
    setSaving(true);
    try {
      const input: AddonInput = {
        kind,
        device_type: deviceType.trim() || null,
        item_key: itemKey,
        name_ar: nameAr,
        name_en: nameEn,
        price: priceNum,
        sort: Number(sort) || 0,
        active,
      };
      await adminSaveAddon(input, editing?.id);
      setModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: PricingAddonRow) => {
    Alert.alert(
      isRTL ? 'حذف' : 'Delete',
      isRTL ? `حذف «${r.name_ar}»؟` : `Delete "${r.name_en}"?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminDeleteAddon(r.id);
              await load();
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e));
            }
          },
        },
      ]
    );
  };

  if (checking || (loading && rows.length === 0)) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <GearLoader size={48} />
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'الإكسسوارات والحماية' : 'Accessories & Protection'} />
        <AdminEmptyState variant="error" title={isRTL ? 'غير مصرّح' : 'Not authorized'} />
      </SafeAreaView>
    );
  }

  const grouped = {
    accessory: rows.filter((r) => r.kind === 'accessory'),
    protection: rows.filter((r) => r.kind === 'protection'),
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'الإكسسوارات والحماية' : 'Accessories & Protection'}
        subtitle={isRTL ? 'أسعار الإضافات في إنشاء الطلب' : 'Add-on pricing in request creation'}
        rightIcon="add"
        rightLabel={isRTL ? 'إضافة' : 'Add'}
        onRightPress={openNew}
      />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        <TouchableOpacity
          onPress={() => setImportOpen(true)}
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: 11, marginBottom: 14 }}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="file-upload-outline" size={18} color={COLORS.primary} />
          <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
            {isRTL ? 'استيراد من Excel/CSV' : 'Import from Excel/CSV'}
          </Text>
        </TouchableOpacity>
        {rows.length === 0 && (
          <AdminEmptyState
            icon="tag-multiple-outline"
            title={isRTL ? 'لا توجد إضافات مُدارة' : 'No managed add-ons'}
            body={
              isRTL
                ? 'حالياً يستخدم التطبيق القائمة الافتراضية. أضِف عنصراً ليحل محلها.'
                : 'The app uses the built-in defaults. Add an item to override them.'
            }
            ctaLabel={isRTL ? 'إضافة عنصر' : 'Add item'}
            onCtaPress={openNew}
          />
        )}
        {(['accessory', 'protection'] as const).map((k) =>
          grouped[k].length === 0 ? null : (
            <View key={k} style={{ marginBottom: SPACING.l }}>
              <Text style={styles.sectionTitle}>
                {k === 'accessory'
                  ? isRTL ? 'الإكسسوارات' : 'Accessories'
                  : isRTL ? 'باقات الحماية' : 'Protection'}
              </Text>
              {grouped[k].map((r) => (
                <TouchableOpacity key={r.id} style={styles.row} onPress={() => openEdit(r)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{isRTL ? r.name_ar : r.name_en}</Text>
                    <Text style={styles.rowSub}>
                      {r.device_type ? `${r.device_type} · ` : ''}
                      {r.item_key}
                      {!r.active ? (isRTL ? ' · موقوف' : ' · inactive') : ''}
                    </Text>
                  </View>
                  <Text style={styles.price}>{Math.round(r.price)} <Riyal /></Text>
                  <TouchableOpacity onPress={() => remove(r)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {editing ? (isRTL ? 'تعديل عنصر' : 'Edit item') : (isRTL ? 'عنصر جديد' : 'New item')}
              </Text>

              <Text style={styles.label}>{isRTL ? 'النوع' : 'Kind'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['accessory', 'protection'] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => { setKind(k); setPresetChoice(''); }}
                    style={[styles.kindChip, kind === k && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                  >
                    <Text style={{ color: kind === k ? '#fff' : COLORS.text, fontWeight: '600' }}>
                      {k === 'accessory' ? (isRTL ? 'إكسسوار' : 'Accessory') : (isRTL ? 'حماية' : 'Protection')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{isRTL ? 'نوع الجهاز' : 'Device type'}</Text>
              <SelectField
                value={deviceType}
                options={[{ id: '', label: isRTL ? 'كل الأجهزة' : 'All devices' }, ...toSelect(DEVICE_TYPE_OPTIONS, isRTL)]}
                onSelect={setDeviceType}
                placeholder={isRTL ? 'كل الأجهزة' : 'All devices'}
                isRTL={isRTL}
              />
              <View style={{ height: 12 }} />

              <Text style={styles.label}>
                {kind === 'protection' ? (isRTL ? 'نوع الحماية' : 'Protection type') : (isRTL ? 'نوع الإكسسوار' : 'Accessory type')}
              </Text>
              <SelectField
                value={presetChoice}
                options={[
                  ...toSelect(presetsFor(kind), isRTL),
                  { id: CUSTOM, label: isRTL ? 'أخرى (إدخال يدوي)' : 'Other (custom)' },
                ]}
                onSelect={choosePreset}
                placeholder={isRTL ? 'اختر النوع' : 'Choose a type'}
                isRTL={isRTL}
              />
              <View style={{ height: 12 }} />

              {presetChoice === CUSTOM && (
                <Field label={isRTL ? 'المعرّف (item key)' : 'Item key'} value={itemKey} onChange={setItemKey} styles={styles} placeholder="charger" />
              )}
              <Field label={isRTL ? 'الاسم بالعربية' : 'Name (Arabic)'} value={nameAr} onChange={setNameAr} styles={styles} />
              <Field label={isRTL ? 'الاسم بالإنجليزية' : 'Name (English)'} value={nameEn} onChange={setNameEn} styles={styles} />
              <Field label={isRTL ? 'السعر (ر.س)' : 'Price (SAR)'} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} styles={styles} keyboardType="numeric" />
              <Field label={isRTL ? 'الترتيب' : 'Sort'} value={sort} onChange={(v) => setSort(v.replace(/[^0-9]/g, ''))} styles={styles} keyboardType="numeric" />

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

      <CsvImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        title={isRTL ? 'استيراد الإضافات' : 'Import add-ons'}
        headerLine="kind,device_type,item_key,name_ar,name_en,price,sort"
        sampleLine="accessory,phone,charger,شاحن,Charger,60,1"
        onImport={adminImportAddons}
        onDone={load}
      />
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
    sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
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
    modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
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
    kindChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
    switchRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  });
