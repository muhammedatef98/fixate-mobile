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
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AdminScreenHeader, AdminEmptyState } from '../components/admin/AdminUI';
import {
  listAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SpareSupplier,
} from '../services/spareSuppliersService';
import { getFriendlyError } from '../utils/errorMessages';
import { logger } from '../utils/logger';

export default function AdminSuppliersScreen() {
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  // Gate on the admin check (JWT claim + RBAC RPC), never on the users-row
  // fetch: if that read fails, userProfile stays null forever and the screen
  // would hang on a blank spinner (2026-07-05 regression).
  const profileLoaded = !adminChecking;

  const [suppliers, setSuppliers] = useState<SpareSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SpareSupplier | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSuppliers(await listAllSuppliers());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setWhatsapp('');
    setSpecialty('');
    setNotes('');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (s: SpareSupplier) => {
    setEditing(s);
    setName(s.name);
    setWhatsapp(s.whatsapp_number);
    setSpecialty(s.specialty ?? '');
    setNotes(s.notes ?? '');
    setActive(s.is_active);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !whatsapp.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'الاسم ورقم الواتساب مطلوبان' : 'Name and WhatsApp number are required');
      return;
    }
    setSaving(true);
    try {
      const input = { name, whatsapp_number: whatsapp, specialty, notes, is_active: active };
      if (editing) await updateSupplier(editing.id, input);
      else await createSupplier(input);
      setModalOpen(false);
      await load();
    } catch (e) {
      logger.warn('save supplier failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: SpareSupplier) => {
    Alert.alert(
      isRTL ? 'حذف المورّد' : 'Delete supplier',
      isRTL ? `حذف "${s.name}"؟` : `Delete "${s.name}"?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSupplier(s.id);
              await load();
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (s: SpareSupplier) => {
    try {
      await updateSupplier(s.id, { is_active: !s.is_active });
      await load();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    }
  };

  if (!profileLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'موردو قطع الغيار' : 'Spare-parts suppliers'} />
        <AdminEmptyState
          variant="error"
          icon="shield-alert-outline"
          title={isRTL ? 'غير مصرّح' : 'Unauthorized'}
          body={isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'موردو قطع الغيار' : 'Spare-parts suppliers'}
        subtitle={isRTL ? `${suppliers.length} مورّد` : `${suppliers.length} suppliers`}
        rightIcon="add"
        rightLabel={isRTL ? 'إضافة' : 'Add'}
        onRightPress={openNew}
      />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : suppliers.length === 0 ? (
        <AdminEmptyState
          icon="truck-outline"
          title={isRTL ? 'لا يوجد موردون' : 'No suppliers yet'}
          body={isRTL ? 'أضف موردي قطع الغيار ليصل إليهم الفنيون' : 'Add spare-parts suppliers for technicians to reach'}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48 }}>
          {suppliers.map((s) => (
            <View key={s.id} style={[styles.card, !s.is_active && { opacity: 0.6 }]}>
              <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                  {!!s.specialty && <Text style={styles.specialty} numberOfLines={1}>{s.specialty}</Text>}
                  <Text style={styles.phone} numberOfLines={1}>
                    <MaterialCommunityIcons name="whatsapp" size={13} color="#25D366" /> {s.whatsapp_number}
                  </Text>
                  {!!s.notes && <Text style={styles.notes} numberOfLines={2}>{s.notes}</Text>}
                </View>
                <Switch value={s.is_active} onValueChange={() => toggleActive(s)} />
              </View>
              <View style={[styles.cardActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity onPress={() => openEdit(s)} accessibilityRole="button">
                  <Text style={styles.actionLink}>{isRTL ? 'تعديل' : 'Edit'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(s)} accessibilityRole="button">
                  <Text style={[styles.actionLink, { color: COLORS.error }]}>{isRTL ? 'حذف' : 'Delete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>
                  {editing ? (isRTL ? 'تعديل المورّد' : 'Edit supplier') : isRTL ? 'مورّد جديد' : 'New supplier'}
                </Text>
                <TextInput
                  placeholder={isRTL ? 'اسم المورّد' : 'Supplier name'}
                  placeholderTextColor={COLORS.textSecondary}
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <TextInput
                  placeholder={isRTL ? 'رقم الواتساب (مثال: 9665xxxxxxxx)' : 'WhatsApp number (e.g. 9665xxxxxxxx)'}
                  placeholderTextColor={COLORS.textSecondary}
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                  style={styles.input}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <TextInput
                  placeholder={isRTL ? 'التخصص (اختياري)' : 'Specialty (optional)'}
                  placeholderTextColor={COLORS.textSecondary}
                  value={specialty}
                  onChangeText={setSpecialty}
                  style={styles.input}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <TextInput
                  placeholder={isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                  placeholderTextColor={COLORS.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  style={[styles.input, { height: 70 }]}
                  multiline
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <View style={[styles.switchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.switchLabel}>{isRTL ? 'نشط' : 'Active'}</Text>
                  <Switch value={active} onValueChange={setActive} />
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setModalOpen(false)}
                  style={[styles.modalBtn, { backgroundColor: COLORS.border }]}
                >
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.modalBtn, { backgroundColor: COLORS.primary, opacity: saving ? 0.5 : 1 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{isRTL ? 'حفظ' : 'Save'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    cardTop: { alignItems: 'center', gap: 12 },
    name: { fontSize: 16, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    specialty: { fontSize: 12.5, color: C.primary, fontWeight: '700', marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    phone: { fontSize: 13, color: C.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    notes: { fontSize: 12, color: C.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    cardActions: { gap: SPACING.lg, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    actionLink: { color: C.primary, fontWeight: '700' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: SPACING.md, textAlign: isRTL ? 'right' : 'left' },
    input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      fontSize: 15,
      color: C.text,
      marginBottom: SPACING.md,
    },
    switchRow: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    switchLabel: { fontSize: 14, fontWeight: '700', color: C.text },
    modalActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.md, marginTop: SPACING.sm },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  });
