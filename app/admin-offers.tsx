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
 Image } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import { formatAppDateOnly } from '../lib/formatDate';
import { logger } from '../utils/logger';
import { showToast } from '../utils/toast';
import { uploadOfferImage } from '../services/storageService';
import {
  adminListOffers,
  createOffer,
  updateOffer,
  setOfferActive,
  deleteOffer,
  notifyOffer,
  type Offer,
} from '../services/offersService';
import type { PushAudience } from '../services/notifyService';

interface FormState {
  id: string | null;
  title: string;
  description: string;
  discount_pct: string;
  valid_until: string; // YYYY-MM-DD or ''
  is_active: boolean;
  image_url: string | null;
  imageLocalUri: string | null; // freshly picked, not yet uploaded
  autoNotify: boolean;
  audience: PushAudience;
}

const emptyForm: FormState = {
  id: null,
  title: '',
  description: '',
  discount_pct: '',
  valid_until: '',
  is_active: true,
  image_url: null,
  imageLocalUri: null,
  autoNotify: true,
  audience: 'all',
};

const AUDIENCES: { key: PushAudience; ar: string; en: string }[] = [
  { key: 'all', ar: 'الجميع', en: 'All' },
  { key: 'customers', ar: 'العملاء', en: 'Customers' },
  { key: 'technicians', ar: 'الفنيون', en: 'Technicians' },
];

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
      image_url: o.image_url ?? null,
      imageLocalUri: null,
      // Default auto-notify OFF when editing so saving an edit doesn't re-blast
      // a notification; the admin can flip it on or use "Send" on the card.
      autoNotify: false,
      audience: 'all',
    });
    setFormVisible(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isRTL ? 'إذن مرفوض' : 'Permission denied', isRTL ? 'فعّل إذن الصور من الإعدادات' : 'Enable photo permission in settings');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setForm((f) => ({ ...f, imageLocalUri: res.assets[0].uri }));
    }
  };

  // Manual "send notification" for an existing offer (used when auto-notify was off).
  const onSendNotification = (o: Offer) => {
    Alert.alert(
      isRTL ? 'إرسال إشعار' : 'Send notification',
      isRTL ? 'إرسال إشعار بهذا العرض لجميع المستخدمين؟' : 'Send a notification about this offer to everyone?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إرسال' : 'Send',
          onPress: async () => {
            try {
              const r = await notifyOffer(o, 'all');
              showToast.success(
                isRTL ? 'تم الإرسال' : 'Sent',
                isRTL ? `وصل إلى ${r.recipients ?? r.sent} مستخدم` : `Reached ${r.recipients ?? r.sent} users`
              );
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
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
      // Upload a freshly-picked banner first; keep the existing one otherwise.
      let imageUrl = form.image_url;
      if (form.imageLocalUri) {
        imageUrl = await uploadOfferImage(form.imageLocalUri);
      }
      const payload = {
        title: form.title,
        description: form.description,
        discount_pct: pct,
        image_url: imageUrl,
        valid_until: validUntil,
        is_active: form.is_active,
      };
      const saved = form.id ? await updateOffer(form.id, payload) : await createOffer(payload);
      setFormVisible(false);
      await load();

      // Auto-notify when enabled.
      if (form.autoNotify) {
        try {
          const r = await notifyOffer(saved, form.audience);
          showToast.success(
            isRTL ? 'تم إرسال الإشعار' : 'Notification sent',
            isRTL ? `وصل إلى ${r.recipients ?? r.sent} مستخدم` : `Reached ${r.recipients ?? r.sent} users`
          );
        } catch (e) {
          logger.warn('offer auto-notify failed', e);
        }
      }
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
                {!!o.image_url && (
                  <Image source={{ uri: o.image_url }} style={styles.cardImage} resizeMode="cover" />
                )}
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
                  <TouchableOpacity onPress={() => onSendNotification(o)} style={styles.iconBtn} accessibilityLabel={isRTL ? 'إرسال إشعار' : 'Send notification'}>
                    <MaterialCommunityIcons name="bell-ring-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
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

              {/* Banner image */}
              <Text style={styles.label}>{isRTL ? 'صورة العرض' : 'Offer image'}</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
                {form.imageLocalUri || form.image_url ? (
                  <Image source={{ uri: form.imageLocalUri ?? form.image_url ?? '' }} style={styles.imagePreview} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialCommunityIcons name="image-plus" size={28} color={COLORS.textSecondary} />
                    <Text style={styles.muted}>{isRTL ? 'اختر صورة (16:9)' : 'Pick an image (16:9)'}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {(form.imageLocalUri || form.image_url) && (
                <TouchableOpacity onPress={() => setForm((f) => ({ ...f, imageLocalUri: null, image_url: null }))}>
                  <Text style={[styles.metaText, { color: '#EF4444', marginTop: 6, textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? 'إزالة الصورة' : 'Remove image'}
                  </Text>
                </TouchableOpacity>
              )}

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

              {/* Auto-notify + audience */}
              <View style={styles.switchRow}>
                <Text style={styles.label}>{isRTL ? 'إشعار تلقائي عند الحفظ' : 'Auto-notify on save'}</Text>
                <Switch
                  value={form.autoNotify}
                  onValueChange={(v) => setForm((f) => ({ ...f, autoNotify: v }))}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#fff"
                />
              </View>
              {form.autoNotify && (
                <View style={[styles.audienceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {AUDIENCES.map((a) => {
                    const active = form.audience === a.key;
                    return (
                      <TouchableOpacity
                        key={a.key}
                        onPress={() => setForm((f) => ({ ...f, audience: a.key }))}
                        style={[styles.audienceChip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                      >
                        <Text style={[styles.audienceChipText, { color: active ? '#fff' : COLORS.textSecondary }]}>
                          {isRTL ? a.ar : a.en}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

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
    cardImage: { width: '100%', height: 130, borderRadius: BORDER_RADIUS.sm, marginBottom: 10, backgroundColor: C.border + '40' },
    cardHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
    imagePicker: { borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: C.border, overflow: 'hidden', backgroundColor: C.card },
    imagePreview: { width: '100%', height: 150 },
    imagePlaceholder: { height: 110, alignItems: 'center', justifyContent: 'center', gap: 6 },
    audienceRow: { gap: 8, marginTop: 10 },
    audienceChip: { flex: 1, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center' },
    audienceChipText: { fontSize: 13, fontWeight: '700' },
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
