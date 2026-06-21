import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import { formatAppDateOnly } from '../lib/formatDate';
import { logger } from '../utils/logger';
import {
  adminListOffers,
  createOffer,
  updateOffer,
  setOfferActive,
  deleteOffer,
  type Offer,
} from '../services/offersService';

interface FormState {
  id: string | null;
  title: string;
  description: string;
  discount_pct: string;
  valid_until: string; // YYYY-MM-DD or ''
  is_active: boolean;
}

const emptyForm: FormState = {
  id: null,
  title: '',
  description: '',
  discount_pct: '',
  valid_until: '',
  is_active: true,
};

export default function AdminOffersScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();
  const styles = makeStyles(COLORS, isRTL);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setOffers(await adminListOffers());
    } catch (e) {
      logger.warn('admin offers load failed', e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEdit = (o: Offer) => {
    setForm({
      id: o.id,
      title: o.title,
      description: o.description ?? '',
      discount_pct: o.discount_pct != null ? String(o.discount_pct) : '',
      valid_until: o.valid_until ? o.valid_until.slice(0, 10) : '',
      is_active: o.is_active,
    });
    setFormVisible(true);
  };

  const onToggle = async (o: Offer) => {
    const next = !o.is_active;
    setOffers((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: next } : x)));
    try {
      await setOfferActive(o.id, next);
    } catch (e: any) {
      setOffers((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: o.is_active } : x)));
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    }
  };

  const onDelete = (o: Offer) => {
    Alert.alert(
      isRTL ? 'حذف العرض' : 'Delete offer',
      isRTL ? 'سيتم حذف هذا العرض نهائياً.' : 'This offer will be permanently deleted.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOffer(o.id);
              setOffers((prev) => prev.filter((x) => x.id !== o.id));
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const onSave = async () => {
    if (!form.title.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'العنوان مطلوب' : 'Title is required');
      return;
    }
    const pct = form.discount_pct.trim() === '' ? null : Number(form.discount_pct);
    if (pct != null && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'نسبة الخصم يجب أن تكون بين 0 و100' : 'Discount must be 0–100');
      return;
    }
    // Parse YYYY-MM-DD into an ISO timestamp (end of day) or null.
    let validUntil: string | null = null;
    if (form.valid_until.trim()) {
      const d = new Date(form.valid_until.trim());
      if (Number.isNaN(d.getTime())) {
        Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' : 'Invalid date (YYYY-MM-DD)');
        return;
      }
      validUntil = d.toISOString();
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        discount_pct: pct,
        valid_until: validUntil,
        is_active: form.is_active,
      };
      if (form.id) {
        await updateOffer(form.id, payload);
      } else {
        await createOffer(payload);
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.muted}>{isRTL ? 'هذه الصفحة للمشرفين فقط' : 'Admins only'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'عروض وخصومات' : 'Offers & Discounts'}
        rightIcon="add"
        rightLabel={isRTL ? 'عرض جديد' : 'New offer'}
        onRightPress={openCreate}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {offers.length === 0 ? (
            <AdminEmptyState
              icon="sale"
              title={isRTL ? 'لا توجد عروض' : 'No offers'}
              body={isRTL ? 'أنشئ أول عرض ترويجي للعملاء.' : 'Create the first promotion for customers.'}
              ctaLabel={isRTL ? 'عرض جديد' : 'New offer'}
              onCtaPress={openCreate}
            />
          ) : (
            offers.map((o) => (
              <View key={o.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{o.title}</Text>
                    {!!o.description && <Text style={styles.desc} numberOfLines={2}>{o.description}</Text>}
                  </View>
                  <Switch
                    value={o.is_active}
                    onValueChange={() => onToggle(o)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.metaRow}>
                  {o.discount_pct != null && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{isRTL ? `خصم ${o.discount_pct}%` : `${o.discount_pct}% OFF`}</Text>
                    </View>
                  )}
                  {!!o.valid_until && (
                    <Text style={styles.metaText}>
                      {isRTL ? `حتى ${formatAppDateOnly(o.valid_until, isRTL)}` : `Until ${formatAppDateOnly(o.valid_until, isRTL)}`}
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => openEdit(o)} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete(o)} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create / edit form */}
      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {form.id ? (isRTL ? 'تعديل العرض' : 'Edit offer') : (isRTL ? 'عرض جديد' : 'New offer')}
              </Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>{isRTL ? 'العنوان' : 'Title'}</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
                placeholder={isRTL ? 'مثال: خصم 25% على الشاشات' : 'e.g. 25% off screens'}
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.label}>{isRTL ? 'الوصف' : 'Description'}</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                placeholder={isRTL ? 'تفاصيل العرض' : 'Offer details'}
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />

              <Text style={styles.label}>{isRTL ? 'نسبة الخصم %' : 'Discount %'}</Text>
              <TextInput
                style={styles.input}
                value={form.discount_pct}
                onChangeText={(t) => setForm((f) => ({ ...f, discount_pct: t.replace(/[^0-9]/g, '') }))}
                placeholder="0-100"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>{isRTL ? 'صالح حتى (YYYY-MM-DD)' : 'Valid until (YYYY-MM-DD)'}</Text>
              <TextInput
                style={styles.input}
                value={form.valid_until}
                onChangeText={(t) => setForm((f) => ({ ...f, valid_until: t }))}
                placeholder="2026-12-31"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>{isRTL ? 'مُفعّل' : 'Active'}</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{isRTL ? 'حفظ' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    muted: { color: C.textSecondary, fontSize: 14 },
    card: {
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: C.border,
      padding: SPACING.md, marginBottom: SPACING.sm,
    },
    cardHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
    title: { color: C.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    desc: { color: C.textSecondary, fontSize: 12.5, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    metaRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    tag: { backgroundColor: C.primary + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    tagText: { color: C.primary, fontWeight: '800', fontSize: 11 },
    metaText: { color: C.textSecondary, fontSize: 12 },
    iconBtn: { padding: 6 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.background, borderTopLeftRadius: 22, borderTopRightRadius: 22,
      paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 24, maxHeight: '88%',
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 10 },
    modalHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    modalTitle: { color: C.text, fontWeight: '800', fontSize: 17 },
    label: { color: C.textSecondary, fontWeight: '700', fontSize: 12.5, marginTop: 12, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    input: {
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, textAlign: isRTL ? 'right' : 'left',
    },
    switchRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    saveBtn: {
      backgroundColor: C.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: 15,
      alignItems: 'center', marginTop: 22,
    },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
