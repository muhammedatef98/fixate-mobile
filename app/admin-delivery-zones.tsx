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
  Switch,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { logger } from '../utils/logger';
import {
  getRegionTree,
  updateCity,
  type RegionWithCities,
  type ServiceCity,
} from '../services/serviceAreasService';
import {
  type DeliveryZone,
  listAllDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
} from '../services/deliveryZonesService';

type ModalMode =
  | { kind: 'closed' }
  | { kind: 'edit-city-fee'; city: ServiceCity }
  | { kind: 'add-neighborhood'; city: ServiceCity }
  | { kind: 'edit-neighborhood'; zone: DeliveryZone };

export default function AdminServiceAndDeliveryZonesScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const s = createStyles(COLORS, isRTL);
  const { isAdmin, checking } = useIsAdmin();

  const [tree, setTree] = useState<RegionWithCities[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalMode>({ kind: 'closed' });
  const [savingId, setSavingId] = useState<string | null>(null);

  // Bucket zones by their city_name_en for O(1) lookup while rendering.
  const zonesByCity: Record<string, DeliveryZone[]> = useMemo(() => {
    const map: Record<string, DeliveryZone[]> = {};
    for (const z of zones) {
      const key = z.city_name_en;
      if (!map[key]) map[key] = [];
      map[key].push(z);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [zones]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [t, z] = await Promise.all([
        getRegionTree(false),
        listAllDeliveryZones(),
      ]);
      setTree(t);
      setZones(z);
      // Open all regions by default the first time the screen renders so
      // the admin sees real content immediately instead of empty
      // accordions.
      setExpandedRegions((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const next: Record<string, boolean> = {};
        for (const r of t) next[r.id] = true;
        return next;
      });
    } catch (e) {
      logger.warn('[adminServiceAndZones] load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  const toggleZoneActive = async (z: DeliveryZone) => {
    setSavingId(z.id);
    setZones((prev) => prev.map((x) => (x.id === z.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      await updateDeliveryZone(z.id, { is_active: !z.is_active });
    } catch (e: unknown) {
      setZones((prev) => prev.map((x) => (x.id === z.id ? { ...x, is_active: z.is_active } : x)));
      Alert.alert(
        isRTL ? 'تعذر التحديث' : 'Update failed',
        (e as Error)?.message ?? (isRTL ? 'حاول مرة أخرى' : 'Please try again')
      );
    } finally {
      setSavingId(null);
    }
  };

  const confirmDeleteZone = (z: DeliveryZone) => {
    Alert.alert(
      isRTL ? 'حذف الحي' : 'Delete neighborhood',
      isRTL
        ? `سيتم حذف "${z.neighborhood_name_ar}" من "${z.city_name_ar}". تأكيد؟`
        : `"${z.neighborhood_name_en}" in "${z.city_name_en}" will be removed. Confirm?`,
      [
        { text: isRTL ? 'تراجع' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const prev = zones;
            setZones((p) => p.filter((x) => x.id !== z.id));
            try {
              await deleteDeliveryZone(z.id);
            } catch (e: unknown) {
              setZones(prev);
              Alert.alert(
                isRTL ? 'تعذر الحذف' : 'Delete failed',
                (e as Error)?.message ?? (isRTL ? 'حاول مرة أخرى' : 'Please try again')
              );
            }
          },
        },
      ]
    );
  };

  if (checking) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={s.container}>
        <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'مناطق الخدمة والتوصيل' : 'Service & Delivery Zones'} />
        <View style={s.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={s.emptyText}>{isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'مناطق الخدمة والتوصيل' : 'Service & Delivery Zones'} />

      <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 120 }}>
        <Text style={s.subtitle}>
          {isRTL
            ? 'حدد رسوم التوصيل لكل مدينة وأضف الأحياء مع رسومها الخاصة. الأحياء غير المفعلة يتم تجاوزها في تدفق الطلب.'
            : 'Set the delivery fee per city and add neighborhoods with their own fees. Inactive neighborhoods are skipped in the request flow.'}
        </Text>

        <View style={s.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={s.infoBannerText}>
            {isRTL
              ? 'تتم إدارة المدن في إعدادات مناطق الخدمة'
              : 'Cities are managed in Service Areas settings'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : tree.length === 0 ? (
          <View style={s.empty}>
            <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={COLORS.textSecondary} />
            <Text style={s.emptyText}>
              {isRTL ? 'لا توجد مناطق خدمة بعد' : 'No service regions yet'}
            </Text>
          </View>
        ) : (
          tree.map((region) => {
            const regionOpen = expandedRegions[region.id] !== false;
            return (
              <View key={region.id} style={s.regionCard}>
                <TouchableOpacity
                  style={s.regionHeader}
                  onPress={() =>
                    setExpandedRegions((p) => ({ ...p, [region.id]: !regionOpen }))
                  }
                  accessibilityRole="button"
                >
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <MaterialCommunityIcons name="map" size={20} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.regionName}>
                        {isRTL ? region.name_ar : region.name_en}
                      </Text>
                      <Text style={s.regionSub}>
                        {region.cities.length} {isRTL ? 'مدينة' : 'cities'}
                        {region.enabled === false ? (isRTL ? ' · معطلة' : ' · disabled') : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={regionOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>

                {regionOpen && (
                  <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border }}>
                    {region.cities.length === 0 ? (
                      <Text style={s.noCitiesText}>
                        {isRTL ? 'لا توجد مدن في هذه المنطقة' : 'No cities in this region'}
                      </Text>
                    ) : (
                      region.cities.map((city) => {
                        const cityOpen = !!expandedCities[city.id];
                        const cityZones = zonesByCity[city.name_en] ?? [];
                        return (
                          <View key={city.id} style={s.cityWrap}>
                            <View style={s.cityRow}>
                              <TouchableOpacity
                                style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}
                                onPress={() =>
                                  setExpandedCities((p) => ({ ...p, [city.id]: !cityOpen }))
                                }
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name={cityOpen ? 'chevron-down' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                                  size={16}
                                  color={COLORS.textSecondary}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text style={s.cityName}>
                                    {isRTL ? city.name_ar : city.name_en}
                                  </Text>
                                  <Text style={s.citySub}>
                                    {cityZones.length} {isRTL ? 'حي' : 'neighborhoods'}
                                    {city.enabled === false ? (isRTL ? ' · معطلة' : ' · disabled') : ''}
                                  </Text>
                                </View>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={s.feeChip}
                                onPress={() => setModal({ kind: 'edit-city-fee', city })}
                                accessibilityRole="button"
                              >
                                <Text style={s.feeChipText}>
                                  {city.delivery_fee} {isRTL ? 'ر.س' : 'SAR'}
                                </Text>
                                <Ionicons name="pencil" size={12} color={COLORS.primary} />
                              </TouchableOpacity>
                            </View>

                            {cityOpen && (
                              <View style={s.zonesWrap}>
                                {cityZones.map((z) => (
                                  <View key={z.id} style={s.zoneRow}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={s.zoneName}>
                                        {isRTL ? z.neighborhood_name_ar : z.neighborhood_name_en}
                                      </Text>
                                      <Text style={s.zoneAlt}>
                                        {isRTL ? z.neighborhood_name_en : z.neighborhood_name_ar}
                                      </Text>
                                    </View>

                                    <TouchableOpacity
                                      style={s.feeChip}
                                      onPress={() => setModal({ kind: 'edit-neighborhood', zone: z })}
                                      accessibilityRole="button"
                                    >
                                      <Text style={s.feeChipText}>
                                        {z.delivery_fee} {isRTL ? 'ر.س' : 'SAR'}
                                      </Text>
                                      <Ionicons name="pencil" size={12} color={COLORS.primary} />
                                    </TouchableOpacity>

                                    <Switch
                                      value={z.is_active}
                                      onValueChange={() => toggleZoneActive(z)}
                                      disabled={savingId === z.id}
                                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                      thumbColor="#fff"
                                    />

                                    <TouchableOpacity
                                      onPress={() => confirmDeleteZone(z)}
                                      style={{ padding: 6 }}
                                      accessibilityRole="button"
                                      accessibilityLabel={isRTL ? 'حذف' : 'Delete'}
                                    >
                                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                                    </TouchableOpacity>
                                  </View>
                                ))}

                                <TouchableOpacity
                                  style={s.addNeighborhoodBtn}
                                  onPress={() => setModal({ kind: 'add-neighborhood', city })}
                                  accessibilityRole="button"
                                >
                                  <Ionicons name="add" size={16} color={COLORS.primary} />
                                  <Text style={s.addNeighborhoodText}>
                                    {isRTL ? 'إضافة حي' : 'Add neighborhood'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <EditorModal
        mode={modal}
        onClose={() => setModal({ kind: 'closed' })}
        onSaved={reload}
        COLORS={COLORS}
        isRTL={isRTL}
      />
    </SafeAreaView>
  );
}

function Header({ isRTL, COLORS, title }: { isRTL: boolean; COLORS: any; title: string }) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.m,
    }}>
      <TouchableOpacity onPress={() => safeBack('/admin')} accessibilityRole="button">
        <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 19, fontWeight: '800', color: COLORS.text }}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

interface EditorModalProps {
  mode: ModalMode;
  onClose: () => void;
  onSaved: () => void;
  COLORS: any;
  isRTL: boolean;
}

function EditorModal({ mode, onClose, onSaved, COLORS, isRTL }: EditorModalProps) {
  const [neighborhoodAr, setNeighborhoodAr] = useState('');
  const [neighborhoodEn, setNeighborhoodEn] = useState('');
  const [fee, setFee] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode.kind === 'closed') return;
    if (mode.kind === 'edit-city-fee') {
      setNeighborhoodAr(''); setNeighborhoodEn('');
      setFee(String(mode.city.delivery_fee ?? 0));
    } else if (mode.kind === 'add-neighborhood') {
      setNeighborhoodAr(''); setNeighborhoodEn(''); setFee('0');
    } else if (mode.kind === 'edit-neighborhood') {
      setNeighborhoodAr(mode.zone.neighborhood_name_ar);
      setNeighborhoodEn(mode.zone.neighborhood_name_en);
      setFee(String(mode.zone.delivery_fee));
    }
  }, [mode]);

  if (mode.kind === 'closed') return null;

  const title =
    mode.kind === 'edit-city-fee' ? (isRTL ? 'تعديل رسوم المدينة' : 'Edit city delivery fee')
    : mode.kind === 'add-neighborhood' ? (isRTL ? 'إضافة حي جديد' : 'Add new neighborhood')
    : (isRTL ? 'تعديل الحي' : 'Edit neighborhood');

  const showCityFeeNotice = mode.kind === 'edit-city-fee';
  const showNeighborhoodFields = mode.kind !== 'edit-city-fee';

  const cityNameForDisplay =
    mode.kind === 'edit-city-fee' ? (isRTL ? mode.city.name_ar : mode.city.name_en)
    : mode.kind === 'add-neighborhood' ? (isRTL ? mode.city.name_ar : mode.city.name_en)
    : (isRTL ? mode.zone.city_name_ar : mode.zone.city_name_en);

  const handleSave = async () => {
    const feeNum = Number(fee);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      Alert.alert(isRTL ? 'قيمة غير صالحة' : 'Invalid fee', isRTL ? 'أدخل رقماً صحيحاً' : 'Enter a valid non-negative number');
      return;
    }
    if (showNeighborhoodFields) {
      if (!neighborhoodAr.trim() || !neighborhoodEn.trim()) {
        Alert.alert(isRTL ? 'الاسم مطلوب' : 'Name required', isRTL ? 'أدخل اسم الحي بالعربية والإنجليزية' : 'Enter the neighborhood name in both Arabic and English');
        return;
      }
    }

    setSaving(true);
    try {
      if (mode.kind === 'edit-city-fee') {
        await updateCity(mode.city.id, { delivery_fee: feeNum });
      } else if (mode.kind === 'add-neighborhood') {
        await createDeliveryZone({
          city_name_ar: mode.city.name_ar,
          city_name_en: mode.city.name_en,
          neighborhood_name_ar: neighborhoodAr.trim(),
          neighborhood_name_en: neighborhoodEn.trim(),
          delivery_fee: feeNum,
          is_active: true,
          sort_order: 0,
        });
      } else if (mode.kind === 'edit-neighborhood') {
        await updateDeliveryZone(mode.zone.id, {
          delivery_fee: feeNum,
          neighborhood_name_ar: neighborhoodAr.trim(),
          neighborhood_name_en: neighborhoodEn.trim(),
        });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      Alert.alert(isRTL ? 'فشل الحفظ' : 'Save failed', (e as Error)?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center', padding: SPACING.l,
      }}>
        <View style={{
          backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.l,
        }}>
          <Text style={{
            color: COLORS.text, fontSize: 17, fontWeight: '800',
            marginBottom: 4, textAlign: isRTL ? 'right' : 'left',
          }}>
            {title}
          </Text>
          <Text style={{
            color: COLORS.textSecondary, fontSize: 12, fontWeight: '700',
            marginBottom: SPACING.m, textAlign: isRTL ? 'right' : 'left',
          }}>
            {cityNameForDisplay}
          </Text>

          {showCityFeeNotice && (
            <View style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 6,
              padding: 10, borderRadius: BORDER_RADIUS.md,
              backgroundColor: COLORS.primarySoft, marginBottom: SPACING.m,
            }}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={{
                color: COLORS.primary, fontSize: 11, fontWeight: '700', flex: 1,
                textAlign: isRTL ? 'right' : 'left',
              }}>
                {isRTL
                  ? 'هذه الرسوم تستخدم عندما لا يطابق العنوان أي حي مفعل'
                  : 'Used when the customer address does not match any active neighborhood'}
              </Text>
            </View>
          )}

          {showNeighborhoodFields && (
            <>
              <ModalInput
                label={isRTL ? 'اسم الحي (عربي)' : 'Neighborhood (AR)'}
                value={neighborhoodAr} onChangeText={setNeighborhoodAr}
                COLORS={COLORS} isRTL={isRTL}
              />
              <ModalInput
                label={isRTL ? 'اسم الحي (English)' : 'Neighborhood (EN)'}
                value={neighborhoodEn} onChangeText={setNeighborhoodEn}
                COLORS={COLORS} isRTL={isRTL}
              />
            </>
          )}
          <ModalInput
            label={isRTL ? 'رسوم التوصيل (ر.س)' : 'Delivery fee (SAR)'}
            value={fee} onChangeText={(v) => setFee(v.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
            COLORS={COLORS} isRTL={isRTL}
          />

          <View style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 10, marginTop: SPACING.m,
          }}>
            <TouchableOpacity
              style={{ flex: 1, padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, padding: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' }}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>{isRTL ? 'حفظ' : 'Save'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ModalInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  editable?: boolean;
  keyboardType?: 'default' | 'numeric';
  COLORS: any;
  isRTL: boolean;
}

function ModalInput({ label, value, onChangeText, editable = true, keyboardType = 'default', COLORS, isRTL }: ModalInputProps) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{
        color: COLORS.textSecondary, fontSize: 12, fontWeight: '700',
        marginBottom: 4, textAlign: isRTL ? 'right' : 'left',
      }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        style={{
          borderWidth: 1, borderColor: COLORS.border,
          borderRadius: BORDER_RADIUS.md, padding: 10,
          color: COLORS.text,
          backgroundColor: editable ? COLORS.background : COLORS.cardAlt,
          textAlign: isRTL ? 'right' : 'left',
        }}
      />
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyText: { color: C.text, fontWeight: '700', marginTop: 8 },
    subtitle: {
      color: C.textSecondary, fontSize: 13, lineHeight: 19,
      marginBottom: SPACING.m, textAlign: isRTL ? 'right' : 'left',
    },
    infoBanner: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 8,
      padding: 12, borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.primarySoft, marginBottom: SPACING.m,
    },
    infoBannerText: {
      color: C.primary, fontSize: 12, fontWeight: '700', flex: 1,
      textAlign: isRTL ? 'right' : 'left',
    },
    regionCard: {
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.md,
      marginBottom: 10, borderWidth: 1, borderColor: C.border,
      overflow: 'hidden',
    },
    regionHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', padding: 14, gap: 8,
    },
    regionName: { color: C.text, fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    regionSub: { color: C.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    noCitiesText: {
      color: C.textSecondary, fontSize: 12, padding: 14, fontStyle: 'italic',
      textAlign: isRTL ? 'right' : 'left',
    },
    cityWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    cityRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 8, padding: 12,
    },
    cityName: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    citySub: { color: C.textSecondary, fontSize: 11, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
    zonesWrap: { backgroundColor: C.cardAlt, paddingBottom: 6 },
    zoneRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
    },
    zoneName: { color: C.text, fontSize: 13, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    zoneAlt: { color: C.textSecondary, fontSize: 11, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
    feeChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 999, backgroundColor: C.primarySoft,
    },
    feeChipText: { color: C.primary, fontWeight: '800', fontSize: 12 },
    addNeighborhoodBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: 10, marginHorizontal: 14, marginTop: 8,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1, borderColor: C.border,
      backgroundColor: C.background,
    },
    addNeighborhoodText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  });
