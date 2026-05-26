import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  adminListDiscountCodes,
  adminCreateDiscountCode,
  adminUpdateDiscountCode,
  adminDeleteDiscountCode,
  adminToggleDiscountCode,
  type DiscountCode,
  type DiscountCodeInput,
} from '../services/discountService';

// Admin-only screen for CRUD on discount_codes. Authorisation is enforced by
// the RLS policy `discount_codes_admin_all` — this UI also gates rendering on
// userProfile.is_admin so non-admins never see the form.
export default function AdminDiscountCodesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCodes(await adminListDiscountCodes());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (c: DiscountCode) => {
    try {
      const next = await adminToggleDiscountCode(c.id, !c.is_active);
      setCodes((prev) => prev.map((x) => (x.id === c.id ? next : x)));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    }
  };

  const handleDelete = (c: DiscountCode) => {
    Alert.alert(
      isRTL ? 'حذف الكود' : 'Delete code',
      isRTL ? `هل تريد حذف ${c.code}؟` : `Delete ${c.code}?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminDeleteDiscountCode(c.id);
              setCodes((prev) => prev.filter((x) => x.id !== c.id));
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(COLORS, isRTL);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert" size={48} color={COLORS.error} />
          <Text style={styles.emptyText}>
            {isRTL ? 'هذه الصفحة للمسؤولين فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'أكواد الخصم' : 'Discount codes'}</Text>
        <TouchableOpacity onPress={() => { setEditing(null); setShowForm(true); }}>
          <Ionicons name="add" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading && codes.length === 0 ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : codes.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={56} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {isRTL ? 'لا توجد أكواد بعد' : 'No discount codes yet'}
            </Text>
          </View>
        ) : (
          codes.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.code}>{c.code}</Text>
                <Switch
                  value={c.is_active}
                  onValueChange={() => handleToggle(c)}
                  trackColor={{ true: COLORS.primary, false: COLORS.border }}
                />
              </View>
              <Text style={styles.cardSub}>
                {c.discount_type === 'percent'
                  ? `${c.discount_value}% ${isRTL ? 'خصم' : 'off'}`
                  : `${c.discount_value} SAR ${isRTL ? 'خصم' : 'off'}`}
                {c.max_discount ? `  •  ${isRTL ? 'حتى' : 'up to'} ${c.max_discount} SAR` : ''}
              </Text>
              {(c.description_ar || c.description_en) && (
                <Text style={styles.cardDesc}>
                  {isRTL ? c.description_ar : c.description_en}
                </Text>
              )}
              <Text style={styles.metaLine}>
                {isRTL ? 'الاستخدام' : 'Used'}: {c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : ''}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.primary + '15' }]}
                  onPress={() => { setEditing(c); setShowForm(true); }}
                >
                  <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.actionText, { color: COLORS.primary }]}>
                    {isRTL ? 'تعديل' : 'Edit'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.error + '15' }]}
                  onPress={() => handleDelete(c)}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  <Text style={[styles.actionText, { color: COLORS.error }]}>
                    {isRTL ? 'حذف' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DiscountCodeForm
        visible={showForm}
        editing={editing}
        isRTL={isRTL}
        COLORS={COLORS}
        onClose={() => setShowForm(false)}
        onSaved={(saved) => {
          setShowForm(false);
          setCodes((prev) => {
            const exists = prev.some((p) => p.id === saved.id);
            return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
          });
        }}
      />
    </SafeAreaView>
  );
}

function DiscountCodeForm({
  visible,
  editing,
  isRTL,
  COLORS,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: DiscountCode | null;
  isRTL: boolean;
  COLORS: any;
  onClose: () => void;
  onSaved: (c: DiscountCode) => void;
}) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setCode(editing.code);
      setDiscountType(editing.discount_type);
      setValue(String(editing.discount_value));
      setMaxDiscount(editing.max_discount ? String(editing.max_discount) : '');
      setMinOrder(editing.min_order_total ? String(editing.min_order_total) : '');
      setUsageLimit(editing.usage_limit ? String(editing.usage_limit) : '');
      setPerUserLimit(editing.per_user_limit != null ? String(editing.per_user_limit) : '1');
      setDescriptionAr(editing.description_ar ?? '');
      setDescriptionEn(editing.description_en ?? '');
      setIsActive(editing.is_active);
    } else {
      setCode('');
      setDiscountType('percent');
      setValue('');
      setMaxDiscount('');
      setMinOrder('');
      setUsageLimit('');
      setPerUserLimit('1');
      setDescriptionAr('');
      setDescriptionEn('');
      setIsActive(true);
    }
  }, [editing, visible]);

  const submit = async () => {
    if (!code.trim() || !value.trim()) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الرجاء إكمال الحقول الأساسية' : 'Please fill required fields');
      return;
    }
    setSaving(true);
    try {
      const payload: DiscountCodeInput = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(value),
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        min_order_total: minOrder ? Number(minOrder) : 0,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        per_user_limit: perUserLimit ? Number(perUserLimit) : 1,
        description_ar: descriptionAr || null,
        description_en: descriptionEn || null,
        is_active: isActive,
        starts_at: null,
        expires_at: null,
      };
      const saved = editing
        ? await adminUpdateDiscountCode(editing.id, payload)
        : await adminCreateDiscountCode(payload);
      onSaved(saved);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {editing ? (isRTL ? 'تعديل كود' : 'Edit code') : (isRTL ? 'كود جديد' : 'New code')}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: 12 }}>
          <Field label={isRTL ? 'الكود' : 'Code'} COLORS={COLORS}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="WELCOME20"
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'نوع الخصم' : 'Discount type'} COLORS={COLORS}>
            <View style={styles.segment}>
              {(['percent', 'fixed'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.segmentItem,
                    discountType === t && { backgroundColor: COLORS.primary },
                  ]}
                  onPress={() => setDiscountType(t)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      discountType === t ? { color: '#fff' } : { color: COLORS.text },
                    ]}
                  >
                    {t === 'percent'
                      ? (isRTL ? 'نسبة %' : 'Percent %')
                      : (isRTL ? 'مبلغ ثابت' : 'Fixed amount')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label={isRTL ? 'القيمة' : 'Value'} COLORS={COLORS}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          {discountType === 'percent' && (
            <Field label={isRTL ? 'الحد الأعلى للخصم (SAR)' : 'Max discount (SAR)'} COLORS={COLORS}>
              <TextInput
                value={maxDiscount}
                onChangeText={setMaxDiscount}
                keyboardType="numeric"
                placeholder={isRTL ? 'اختياري' : 'Optional'}
                placeholderTextColor={COLORS.textSecondary}
                style={[styles.input, { color: COLORS.text }]}
              />
            </Field>
          )}

          <Field label={isRTL ? 'الحد الأدنى للطلب (SAR)' : 'Min order total (SAR)'} COLORS={COLORS}>
            <TextInput
              value={minOrder}
              onChangeText={setMinOrder}
              keyboardType="numeric"
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'حد الاستخدام الكلي' : 'Total usage limit'} COLORS={COLORS}>
            <TextInput
              value={usageLimit}
              onChangeText={setUsageLimit}
              keyboardType="numeric"
              placeholder={isRTL ? 'بدون حد' : 'Unlimited'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'الحد لكل مستخدم' : 'Per-user limit'} COLORS={COLORS}>
            <TextInput
              value={perUserLimit}
              onChangeText={setPerUserLimit}
              keyboardType="numeric"
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'وصف (عربي)' : 'Description (Arabic)'} COLORS={COLORS}>
            <TextInput
              value={descriptionAr}
              onChangeText={setDescriptionAr}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <Field label={isRTL ? 'وصف (إنجليزي)' : 'Description (English)'} COLORS={COLORS}>
            <TextInput
              value={descriptionEn}
              onChangeText={setDescriptionEn}
              style={[styles.input, { color: COLORS.text }]}
            />
          </Field>

          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={{ color: COLORS.text, fontWeight: '600' }}>
              {isRTL ? 'مفعّل' : 'Active'}
            </Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
            />
          </View>

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: COLORS.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {editing ? (isRTL ? 'حفظ التغييرات' : 'Save changes') : (isRTL ? 'إنشاء' : 'Create')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, children, COLORS }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { color: C.textSecondary, fontSize: 14 },
  card: {
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  cardHead: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: 1.5 },
  cardSub: { color: C.text, fontSize: 14, fontWeight: '600' },
  cardDesc: { color: C.textSecondary, fontSize: 13 },
  metaLine: { color: C.textSecondary, fontSize: 12 },
  cardActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  actionText: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    fontSize: 15,
    backgroundColor: C.card,
  },
  segment: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: C.card,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BORDER_RADIUS.md - 2 },
  segmentText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' },
  submit: { paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: 12 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
