import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import {
  listAllDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  groupZonesByCity,
  DeliveryZone,
} from '../services/deliveryZonesService';

// ─── modal payload ────────────────────────────────────────────────────────────
interface ZoneModal {
  mode: 'add_city' | 'add_neighborhood' | 'edit_fee';
  prefillCityAr?: string;
  prefillCityEn?: string;
  zone?: DeliveryZone; // for edit_fee
}

export default function AdminDeliveryZonesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin, checking } = useIsAdmin();

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Modal state
  const [modal, setModal] = useState<ZoneModal | null>(null);
  const [mCityAr, setMCityAr] = useState('');
  const [mCityEn, setMCityEn] = useState('');
  const [mNbrAr, setMNbrAr] = useState('');
  const [mNbrEn, setMNbrEn] = useState('');
  const [mFee, setMFee] = useState('');

  const grouped = useMemo(() => groupZonesByCity(zones), [zones]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAllDeliveryZones();
      setZones(data);
      // Auto-expand cities
      const keys = Array.from(groupZonesByCity(data).keys());
      setExpandedCities(new Set(keys));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? 'Failed to load delivery zones');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const toggleCity = (key: string) => {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleZoneActive = async (zone: DeliveryZone) => {
    // Optimistic
    setZones((prev) =>
      prev.map((z) => (z.id === zone.id ? { ...z, is_active: !z.is_active } : z))
    );
    try {
      await updateDeliveryZone(zone.id, { is_active: !zone.is_active });
    } catch (e: any) {
      // Revert
      setZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, is_active: zone.is_active } : z))
      );
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message);
    }
  };

  const openAddCity = () => {
    setMCityAr(''); setMCityEn(''); setMNbrAr(''); setMNbrEn(''); setMFee('0');
    setModal({ mode: 'add_city' });
  };

  const openAddNeighborhood = (cityAr: string, cityEn: string) => {
    setMCityAr(cityAr); setMCityEn(cityEn); setMNbrAr(''); setMNbrEn(''); setMFee('0');
    setModal({ mode: 'add_neighborhood', prefillCityAr: cityAr, prefillCityEn: cityEn });
  };

  const openEditFee = (zone: DeliveryZone) => {
    setMCityAr(zone.city_name_ar); setMCityEn(zone.city_name_en);
    setMNbrAr(zone.neighborhood_name_ar); setMNbrEn(zone.neighborhood_name_en);
    setMFee(String(zone.delivery_fee));
    setModal({ mode: 'edit_fee', zone });
  };

  const handleDelete = (zone: DeliveryZone) => {
    Alert.alert(
      isRTL ? 'حذف الحي' : 'Delete neighborhood',
      isRTL
        ? `هل أنت متأكد من حذف "${zone.neighborhood_name_ar}"؟`
        : `Delete "${zone.neighborhood_name_en}"?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setZones((prev) => prev.filter((z) => z.id !== zone.id));
            try { await deleteDeliveryZone(zone.id); }
            catch (e: any) { load(); Alert.alert('Error', e?.message); }
          },
        },
      ]
    );
  };

  const handleModalSave = async () => {
    const fee = parseFloat(mFee);
    if (isNaN(fee) || fee < 0) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'أدخل سعر توصيل صحيح' : 'Enter a valid delivery fee');
      return;
    }
    if (!modal) return;

    if (modal.mode === 'edit_fee' && modal.zone) {
      setSaving(true);
      setZones((prev) =>
        prev.map((z) => (z.id === modal.zone!.id ? { ...z, delivery_fee: fee } : z))
      );
      setModal(null);
      try { await updateDeliveryZone(modal.zone.id, { delivery_fee: fee }); }
      catch (e: any) { load(); Alert.alert('Error', e?.message); }
      finally { setSaving(false); }
      return;
    }

    // add_city or add_neighborhood
    const cityAr = modal.mode === 'add_city' ? mCityAr.trim() : modal.prefillCityAr ?? mCityAr.trim();
    const cityEn = modal.mode === 'add_city' ? mCityEn.trim() : modal.prefillCityEn ?? mCityEn.trim();
    const nbrAr = mNbrAr.trim();
    const nbrEn = mNbrEn.trim();
    if (!cityAr || !cityEn || !nbrAr || !nbrEn) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'أكمل جميع الحقول' : 'Fill all fields');
      return;
    }
    setSaving(true);
    setModal(null);
    try {
      const created = await createDeliveryZone({
        city_name_ar: cityAr,
        city_name_en: cityEn,
        neighborhood_name_ar: nbrAr,
        neighborhood_name_en: nbrEn,
        delivery_fee: fee,
        is_active: true,
        sort_order: 0,
      });
      setZones((prev) => [...prev, created]);
    } catch (e: any) {
      load();
      Alert.alert('Error', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const s = styles(COLORS, isRTL);

  if (checking) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  const modalTitle =
    modal?.mode === 'add_city'
      ? (isRTL ? 'إضافة مدينة جديدة' : 'Add new city')
      : modal?.mode === 'add_neighborhood'
      ? (isRTL ? 'إضافة حي جديد' : 'Add neighborhood')
      : (isRTL ? 'تعديل سعر التوصيل' : 'Edit delivery fee');

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack()} style={{ padding: 6 }}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'مناطق التوصيل' : 'Delivery Zones'}
        </Text>
        <TouchableOpacity onPress={openAddCity} style={s.addCityBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.m, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          {grouped.size === 0 ? (
            <View style={s.emptyBox}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={COLORS.textLight} />
              <Text style={[s.emptyText, { color: COLORS.textSecondary }]}>
                {isRTL ? 'لا توجد مناطق توصيل حتى الآن' : 'No delivery zones yet'}
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openAddCity}>
                <Text style={s.emptyBtnText}>
                  {isRTL ? '+ إضافة مدينة' : '+ Add city'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            Array.from(grouped.entries()).map(([key, city]) => {
              const expanded = expandedCities.has(key);
              return (
                <View key={key} style={s.citySection}>
                  {/* City header row */}
                  <TouchableOpacity
                    style={s.cityRow}
                    onPress={() => toggleCity(key)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cityNameAr, { color: COLORS.text }]}>{city.cityAr}</Text>
                      <Text style={[s.cityNameEn, { color: COLORS.textSecondary }]}>{city.cityEn}</Text>
                    </View>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
                      <Text style={[s.zoneCount, { color: COLORS.primary }]}>
                        {city.zones.length} {isRTL ? 'حي' : 'areas'}
                      </Text>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={COLORS.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Neighborhoods */}
                  {expanded && (
                    <View style={s.neighborhoodList}>
                      {city.zones.map((zone) => (
                        <View key={zone.id} style={[s.nbrRow, { backgroundColor: COLORS.background }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.nbrNameAr, { color: COLORS.text }]}>{zone.neighborhood_name_ar}</Text>
                            <Text style={[s.nbrNameEn, { color: COLORS.textSecondary }]}>{zone.neighborhood_name_en}</Text>
                          </View>
                          <TouchableOpacity
                            style={s.feeChip}
                            onPress={() => openEditFee(zone)}
                          >
                            <Text style={s.feeText}>
                              {zone.delivery_fee.toFixed(2)} {isRTL ? 'ر.س' : 'SAR'}
                            </Text>
                            <Ionicons name="pencil" size={11} color="#fff" />
                          </TouchableOpacity>
                          <Switch
                            value={zone.is_active}
                            onValueChange={() => toggleZoneActive(zone)}
                            trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                            thumbColor={zone.is_active ? COLORS.primary : COLORS.textLight}
                          />
                          <TouchableOpacity
                            onPress={() => handleDelete(zone)}
                            style={{ padding: 6 }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {/* Add neighborhood button */}
                      <TouchableOpacity
                        style={[s.addNbrBtn, { borderColor: COLORS.primary }]}
                        onPress={() => openAddNeighborhood(city.cityAr, city.cityEn)}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                        <Text style={[s.addNbrBtnText, { color: COLORS.primary }]}>
                          {isRTL ? 'إضافة حي' : 'Add neighborhood'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal */}
      <Modal visible={modal !== null} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.overlay}
        >
          <View style={[s.modalBox, { backgroundColor: COLORS.card }]}>
            <Text style={[s.modalTitle, { color: COLORS.text }]}>{modalTitle}</Text>

            {/* City fields — only for add_city */}
            {modal?.mode === 'add_city' && (
              <>
                <Text style={[s.fieldLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'اسم المدينة (عربي)' : 'City name (Arabic)'}
                </Text>
                <TextInput
                  style={[s.input, { borderColor: COLORS.border, color: COLORS.text, backgroundColor: COLORS.background }]}
                  value={mCityAr} onChangeText={setMCityAr}
                  placeholder={isRTL ? 'مثال: الرياض' : 'e.g. الرياض'}
                  placeholderTextColor={COLORS.textLight}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <Text style={[s.fieldLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'اسم المدينة (إنجليزي)' : 'City name (English)'}
                </Text>
                <TextInput
                  style={[s.input, { borderColor: COLORS.border, color: COLORS.text, backgroundColor: COLORS.background }]}
                  value={mCityEn} onChangeText={setMCityEn}
                  placeholder="e.g. Riyadh"
                  placeholderTextColor={COLORS.textLight}
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </>
            )}

            {/* Neighborhood fields — add_city and add_neighborhood */}
            {(modal?.mode === 'add_city' || modal?.mode === 'add_neighborhood') && (
              <>
                <Text style={[s.fieldLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'اسم الحي (عربي)' : 'Neighborhood (Arabic)'}
                </Text>
                <TextInput
                  style={[s.input, { borderColor: COLORS.border, color: COLORS.text, backgroundColor: COLORS.background }]}
                  value={mNbrAr} onChangeText={setMNbrAr}
                  placeholder={isRTL ? 'مثال: العليا' : 'e.g. العليا'}
                  placeholderTextColor={COLORS.textLight}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <Text style={[s.fieldLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'اسم الحي (إنجليزي)' : 'Neighborhood (English)'}
                </Text>
                <TextInput
                  style={[s.input, { borderColor: COLORS.border, color: COLORS.text, backgroundColor: COLORS.background }]}
                  value={mNbrEn} onChangeText={setMNbrEn}
                  placeholder="e.g. Al Olaya"
                  placeholderTextColor={COLORS.textLight}
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </>
            )}

            {/* Edit fee mode: show names read-only */}
            {modal?.mode === 'edit_fee' && modal.zone && (
              <View style={[s.readonlyBox, { backgroundColor: COLORS.background }]}>
                <Text style={{ color: COLORS.text, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
                  {modal.zone.neighborhood_name_ar}
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
                  {modal.zone.neighborhood_name_en} · {modal.zone.city_name_en}
                </Text>
              </View>
            )}

            {/* Fee field */}
            <Text style={[s.fieldLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'سعر التوصيل (ر.س)' : 'Delivery fee (SAR)'}
            </Text>
            <TextInput
              style={[s.input, { borderColor: COLORS.border, color: COLORS.text, backgroundColor: COLORS.background }]}
              value={mFee} onChangeText={setMFee}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              textAlign={isRTL ? 'right' : 'left'}
            />

            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: COLORS.border }]}
                onPress={() => setModal(null)}
              >
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleModalSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '800' }}>{isRTL ? 'حفظ' : 'Save'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    addCityBtn: {
      backgroundColor: C.primary,
      borderRadius: 10,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 14 },
    emptyText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
    emptyBtn: {
      backgroundColor: C.primary, borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 24, paddingVertical: 12,
    },
    emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

    citySection: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    cityRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    cityNameAr: { fontSize: 16, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    cityNameEn: { fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    zoneCount: { fontSize: 12, fontWeight: '800' },

    neighborhoodList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    nbrRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    nbrNameAr: { fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    nbrNameEn: { fontSize: 12, textAlign: isRTL ? 'right' : 'left' },
    feeChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    feeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    addNbrBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      margin: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: BORDER_RADIUS.sm,
      paddingVertical: 8,
      justifyContent: 'center',
    },
    addNbrBtnText: { fontSize: 13, fontWeight: '700' },

    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.m },
    modalBox: {
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.m,
      gap: 10,
    },
    modalTitle: { fontSize: 17, fontWeight: '900', textAlign: isRTL ? 'right' : 'left', marginBottom: 4 },
    fieldLabel: { fontSize: 12, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    input: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      padding: 10,
      fontSize: 14,
      fontWeight: '600',
    },
    readonlyBox: {
      borderRadius: BORDER_RADIUS.sm,
      padding: 10,
      gap: 2,
    },
    modalActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      marginTop: 4,
    },
    modalBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.sm,
    },
  });
