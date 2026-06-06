/**
 * Admin Service Areas — Region → City → Neighborhood coverage manager.
 *
 * Standalone, polished screen surfaced from the admin dashboard. Lets the
 * admin toggle entire regions, toggle individual cities, set city + per-
 * neighborhood delivery fees, and define city coverage geometry.
 *
 * Visual language: stat header, sticky search, region cards with a soft
 * accent stripe, expanded cities showing fee inputs and a nested
 * neighborhood drawer.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import {
  AdminScreenHeader,
  AdminSearchBar,
  AdminEmptyState,
  ADMIN_CARD_SHADOW,
} from '../components/admin/AdminUI';
import { AnimatedTouchable } from '../components/ui/PressableScale';
import {
  getRegionTree,
  updateRegion,
  updateCity,
  updateNeighborhood,
  setRegionCitiesEnabled,
  invalidateServiceAreasCache,
  type RegionWithCities,
  type CityWithNeighborhoods,
  type ServiceNeighborhood,
} from '../services/serviceAreasService';
import { getFriendlyError } from '../utils/errorMessages';

interface CoverageDraft {
  regionId: string;
  cityId: string;
  name: string;
  centerText: string;
  radiusText: string;
}

export default function AdminServiceAreasScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const [tree, setTree] = useState<RegionWithCities[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [coverageDraft, setCoverageDraft] = useState<CoverageDraft | null>(null);

  const loadTree = useCallback(async () => {
    invalidateServiceAreasCache();
    try {
      const next = await getRegionTree(false);
      setTree(next);
    } catch {
      setTree([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadTree();
  }, [isAdmin, loadTree]);

  // ── Summary stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!tree) return { regions: 0, citiesOn: 0, citiesTotal: 0, neighborhoodsOn: 0, neighborhoodsTotal: 0 };
    const allCities = tree.flatMap((r) => r.cities);
    const allNb = allCities.flatMap((c) => c.neighborhoods);
    return {
      regions: tree.filter((r) => r.enabled).length,
      regionsTotal: tree.length,
      citiesOn: allCities.filter((c) => c.enabled).length,
      citiesTotal: allCities.length,
      neighborhoodsOn: allNb.filter((n) => n.enabled).length,
      neighborhoodsTotal: allNb.length,
    };
  }, [tree]);

  const filteredTree = useMemo(() => {
    if (!tree) return null;
    const q = search.trim().toLowerCase();
    if (!q) return tree;
    return tree
      .map((r) => {
        const regionMatches =
          r.name_ar.toLowerCase().includes(q) || r.name_en.toLowerCase().includes(q);
        const matchedCities = r.cities.filter((c) => {
          const cityMatches =
            c.name_ar.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q);
          const nbMatches = c.neighborhoods.some(
            (n) =>
              n.name_ar.toLowerCase().includes(q) || n.name_en.toLowerCase().includes(q)
          );
          return regionMatches || cityMatches || nbMatches;
        });
        if (!regionMatches && matchedCities.length === 0) return null;
        return { ...r, cities: matchedCities.length > 0 ? matchedCities : r.cities };
      })
      .filter((r): r is RegionWithCities => r !== null);
  }, [tree, search]);

  // ── Mutators with optimistic patch + rollback on failure ──────────────
  const failAlert = useCallback(
    (e: unknown) =>
      Alert.alert(
        isRTL ? 'فشل الحفظ' : 'Save failed',
        getFriendlyError(e, language as 'ar' | 'en')
      ),
    [isRTL, language]
  );

  const toggleRegion = async (region: RegionWithCities, enabled: boolean) => {
    setTree((t) => t!.map((r) => (r.id === region.id ? { ...r, enabled } : r)));
    try {
      await updateRegion(region.id, { enabled });
    } catch (e) {
      setTree((t) => t!.map((r) => (r.id === region.id ? { ...r, enabled: !enabled } : r)));
      failAlert(e);
    }
  };

  const setAllCitiesInRegion = async (region: RegionWithCities, enabled: boolean) => {
    setTree((t) =>
      t!.map((r) =>
        r.id === region.id
          ? { ...r, cities: r.cities.map((c) => ({ ...c, enabled })) }
          : r
      )
    );
    try {
      await setRegionCitiesEnabled(region.id, enabled);
    } catch (e) {
      loadTree();
      failAlert(e);
    }
  };

  const patchCity = (regionId: string, cityId: string, patch: Partial<CityWithNeighborhoods>) =>
    setTree((t) =>
      t!.map((r) =>
        r.id === regionId
          ? { ...r, cities: r.cities.map((c) => (c.id === cityId ? { ...c, ...patch } : c)) }
          : r
      )
    );

  const toggleCity = async (
    region: RegionWithCities,
    city: CityWithNeighborhoods,
    enabled: boolean
  ) => {
    patchCity(region.id, city.id, { enabled });
    try {
      await updateCity(city.id, { enabled });
    } catch (e) {
      patchCity(region.id, city.id, { enabled: !enabled });
      failAlert(e);
    }
  };

  const setCityFee = async (
    region: RegionWithCities,
    city: CityWithNeighborhoods,
    value: number
  ) => {
    const prev = city.delivery_fee;
    patchCity(region.id, city.id, { delivery_fee: value });
    try {
      await updateCity(city.id, { delivery_fee: value });
    } catch (e) {
      patchCity(region.id, city.id, { delivery_fee: prev });
      failAlert(e);
    }
  };

  const patchNeighborhood = (
    regionId: string,
    cityId: string,
    neighborhoodId: string,
    patch: Partial<ServiceNeighborhood>
  ) =>
    setTree((t) =>
      t!.map((r) =>
        r.id === regionId
          ? {
              ...r,
              cities: r.cities.map((c) =>
                c.id === cityId
                  ? {
                      ...c,
                      neighborhoods: c.neighborhoods.map((n) =>
                        n.id === neighborhoodId ? { ...n, ...patch } : n
                      ),
                    }
                  : c
              ),
            }
          : r
      )
    );

  const toggleNeighborhood = async (
    regionId: string,
    city: CityWithNeighborhoods,
    nb: ServiceNeighborhood,
    enabled: boolean
  ) => {
    patchNeighborhood(regionId, city.id, nb.id, { enabled });
    try {
      await updateNeighborhood(nb.id, { enabled });
    } catch (e) {
      patchNeighborhood(regionId, city.id, nb.id, { enabled: !enabled });
      failAlert(e);
    }
  };

  const setNeighborhoodFee = async (
    regionId: string,
    city: CityWithNeighborhoods,
    nb: ServiceNeighborhood,
    value: number
  ) => {
    const prev = nb.delivery_fee;
    patchNeighborhood(regionId, city.id, nb.id, { delivery_fee: value });
    try {
      await updateNeighborhood(nb.id, { delivery_fee: value });
    } catch (e) {
      patchNeighborhood(regionId, city.id, nb.id, { delivery_fee: prev });
      failAlert(e);
    }
  };

  const openCoverage = (region: RegionWithCities, city: CityWithNeighborhoods) => {
    setCoverageDraft({
      regionId: region.id,
      cityId: city.id,
      name: isRTL ? city.name_ar : city.name_en,
      centerText:
        typeof city.center_lat === 'number' && typeof city.center_lng === 'number'
          ? `${city.center_lat}, ${city.center_lng}`
          : '',
      radiusText: typeof city.radius_km === 'number' ? String(city.radius_km) : '',
    });
  };

  const saveCoverage = async () => {
    if (!coverageDraft) return;
    const parts = coverageDraft.centerText.split(',').map((s) => s.trim());
    const lat = parts[0] ? Number(parts[0]) : NaN;
    const lng = parts[1] ? Number(parts[1]) : NaN;
    const radius = coverageDraft.radiusText ? Number(coverageDraft.radiusText) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
      Alert.alert(
        isRTL ? 'مدخلات غير صالحة' : 'Invalid input',
        isRTL
          ? 'أدخل إحداثيات صحيحة ونصف قطر بالكيلومتر.'
          : 'Enter valid coordinates and a radius in km.'
      );
      return;
    }
    try {
      await updateCity(coverageDraft.cityId, { center_lat: lat, center_lng: lng, radius_km: radius });
      patchCity(coverageDraft.regionId, coverageDraft.cityId, {
        center_lat: lat,
        center_lng: lng,
        radius_km: radius,
      });
      setCoverageDraft(null);
    } catch (e) {
      failAlert(e);
    }
  };

  // ── Gates ─────────────────────────────────────────────────────────────
  if (adminChecking) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <AdminScreenHeader title={isRTL ? 'مناطق الخدمة' : 'Service Areas'} />
        <AdminEmptyState
          variant="error"
          icon="shield-alert-outline"
          title={isRTL ? 'غير مصرّح' : 'Unauthorized'}
          body={isRTL ? 'هذه الصفحة للأدمن فقط' : 'This page is restricted to admins'}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminScreenHeader
        title={isRTL ? 'مناطق الخدمة' : 'Service Areas'}
        subtitle={isRTL ? 'إدارة التغطية والرسوم' : 'Coverage & delivery fees'}
        rightIcon="refresh-outline"
        rightLabel={isRTL ? 'تحديث' : 'Refresh'}
        onRightPress={() => { setRefreshing(true); loadTree(); }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadTree(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Stat row */}
        <View style={styles.statRow}>
          <StatTile
            icon="map-marker-radius"
            color="#0EA5A4"
            label={isRTL ? 'المناطق' : 'Regions'}
            value={`${stats.regions}/${stats.regionsTotal ?? 0}`}
            COLORS={COLORS}
          />
          <StatTile
            icon="city-variant-outline"
            color="#3B82F6"
            label={isRTL ? 'المدن المفعّلة' : 'Cities on'}
            value={`${stats.citiesOn}/${stats.citiesTotal}`}
            COLORS={COLORS}
          />
          <StatTile
            icon="home-city-outline"
            color="#A855F7"
            label={isRTL ? 'الأحياء المفعّلة' : 'Districts on'}
            value={`${stats.neighborhoodsOn}/${stats.neighborhoodsTotal}`}
            COLORS={COLORS}
          />
        </View>

        <AdminSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={isRTL ? 'ابحث منطقة، مدينة أو حي…' : 'Search region, city, or neighborhood…'}
        />

        {!tree ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : !filteredTree || filteredTree.length === 0 ? (
          <AdminEmptyState
            icon="map-search-outline"
            title={isRTL ? 'لا توجد نتائج' : 'No results'}
            body={isRTL ? 'جرّب اسم منطقة أو مدينة مختلفة.' : 'Try a different region or city.'}
          />
        ) : (
          <View style={{ paddingHorizontal: SPACING.lg, gap: 12 }}>
            {filteredTree.map((region) => {
              const isOpen = expandedRegion === region.id;
              const onCount = region.cities.filter((c) => c.enabled).length;
              const accent = region.enabled ? COLORS.primary : COLORS.border;
              return (
                <View
                  key={region.id}
                  style={[
                    styles.regionCard,
                    { backgroundColor: COLORS.card, borderColor: COLORS.border },
                  ]}
                >
                  <View style={[styles.regionAccent, { backgroundColor: accent }]} />

                  <AnimatedTouchable
                    onPress={() => setExpandedRegion(isOpen ? null : region.id)}
                    style={styles.regionHeader}
                    accessibilityRole="button"
                  >
                    <View style={[styles.regionIcon, { backgroundColor: accent + '20' }]}>
                      <MaterialCommunityIcons
                        name="map-marker-radius"
                        size={20}
                        color={region.enabled ? COLORS.primary : COLORS.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.regionTitle, { color: COLORS.text }]}>
                        {isRTL ? region.name_ar : region.name_en}
                      </Text>
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 2,
                        }}
                      >
                        <View
                          style={[
                            styles.miniBadge,
                            { backgroundColor: COLORS.primary + '15' },
                          ]}
                        >
                          <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>
                            {onCount}/{region.cities.length} {isRTL ? 'مدينة' : 'cities'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={COLORS.textSecondary}
                    />
                    <Switch
                      value={region.enabled}
                      onValueChange={(v) => toggleRegion(region, v)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </AnimatedTouchable>

                  {isOpen && (
                    <View style={[styles.regionBody, { borderTopColor: COLORS.border }]}>
                      <View style={styles.bulkRow}>
                        <AnimatedTouchable
                          onPress={() => setAllCitiesInRegion(region, true)}
                          style={[styles.bulkBtn, { backgroundColor: COLORS.primary + '15' }]}
                        >
                          <Ionicons name="checkmark-done" size={14} color={COLORS.primary} />
                          <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>
                            {isRTL ? 'تفعيل الكل' : 'Enable all'}
                          </Text>
                        </AnimatedTouchable>
                        <AnimatedTouchable
                          onPress={() => setAllCitiesInRegion(region, false)}
                          style={[styles.bulkBtn, { backgroundColor: COLORS.error + '15' }]}
                        >
                          <Ionicons name="close" size={14} color={COLORS.error} />
                          <Text style={{ color: COLORS.error, fontWeight: '700', fontSize: 12 }}>
                            {isRTL ? 'إيقاف الكل' : 'Disable all'}
                          </Text>
                        </AnimatedTouchable>
                      </View>

                      {region.cities.map((city) => {
                        const cityOpen = expandedCity === city.id;
                        const nbOnCount = city.neighborhoods.filter((n) => n.enabled).length;
                        const hasCoverage =
                          typeof city.center_lat === 'number' && typeof city.center_lng === 'number';
                        return (
                          <View key={city.id} style={styles.cityCard}>
                            <View style={styles.cityHeader}>
                              <AnimatedTouchable
                                onPress={() => setExpandedCity(cityOpen ? null : city.id)}
                                style={styles.cityHeaderLeft}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name={cityOpen ? 'chevron-down' : 'chevron-forward'}
                                  size={14}
                                  color={COLORS.textSecondary}
                                />
                                <Text
                                  style={[styles.cityName, { color: COLORS.text }]}
                                  numberOfLines={1}
                                >
                                  {isRTL ? city.name_ar : city.name_en}
                                </Text>
                                {city.neighborhoods.length > 0 && (
                                  <View
                                    style={[
                                      styles.miniBadge,
                                      { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
                                    ]}
                                  >
                                    <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' }}>
                                      {nbOnCount}/{city.neighborhoods.length}
                                    </Text>
                                  </View>
                                )}
                              </AnimatedTouchable>

                              <AnimatedTouchable
                                onPress={() => openCoverage(region, city)}
                                style={[
                                  styles.coverageBtn,
                                  { backgroundColor: COLORS.background, borderColor: COLORS.border },
                                ]}
                                accessibilityLabel={isRTL ? 'منطقة التغطية' : 'Coverage'}
                              >
                                <Ionicons
                                  name={hasCoverage ? 'location' : 'location-outline'}
                                  size={14}
                                  color={hasCoverage ? COLORS.primary : COLORS.textSecondary}
                                />
                              </AnimatedTouchable>

                              <Switch
                                value={city.enabled}
                                onValueChange={(v) => toggleCity(region, city, v)}
                                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                thumbColor="#fff"
                              />
                            </View>

                            <View style={styles.feeRow}>
                              <Ionicons name="bicycle-outline" size={14} color={COLORS.textSecondary} />
                              <Text style={{ color: COLORS.textSecondary, fontSize: 11, flex: 1 }}>
                                {isRTL ? 'سعر التوصيل (افتراضي للمدينة)' : 'Delivery fee (city default)'}
                              </Text>
                              <TextInput
                                defaultValue={
                                  typeof city.delivery_fee === 'number' ? String(city.delivery_fee) : ''
                                }
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={COLORS.textSecondary}
                                onEndEditing={(e) => {
                                  const raw = e.nativeEvent.text.trim();
                                  const n = raw === '' ? 0 : Number(raw);
                                  if (!Number.isFinite(n) || n < 0) return;
                                  if (n === city.delivery_fee) return;
                                  setCityFee(region, city, n);
                                }}
                                style={[styles.feeInput, { color: COLORS.text, borderColor: COLORS.border }]}
                              />
                              <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                {isRTL ? 'ر.س' : 'SAR'}
                              </Text>
                            </View>

                            {cityOpen && city.neighborhoods.length > 0 && (
                              <View style={[styles.neighborhoodsBox, { backgroundColor: COLORS.background }]}>
                                <View style={styles.nbHeader}>
                                  <MaterialCommunityIcons
                                    name="home-city-outline"
                                    size={14}
                                    color={COLORS.textSecondary}
                                  />
                                  <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' }}>
                                    {isRTL ? 'الأحياء' : 'Neighborhoods'}
                                  </Text>
                                  <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>
                                    {isRTL ? '(يتجاوز سعر المدينة)' : '(overrides city fee)'}
                                  </Text>
                                </View>
                                {city.neighborhoods.map((nb) => (
                                  <View key={nb.id} style={styles.nbRow}>
                                    <Text
                                      style={[styles.nbName, { color: COLORS.text }]}
                                      numberOfLines={1}
                                    >
                                      {isRTL ? nb.name_ar : nb.name_en}
                                    </Text>
                                    <TextInput
                                      defaultValue={
                                        typeof nb.delivery_fee === 'number' ? String(nb.delivery_fee) : ''
                                      }
                                      keyboardType="numeric"
                                      placeholder={
                                        typeof city.delivery_fee === 'number' ? String(city.delivery_fee) : '0'
                                      }
                                      placeholderTextColor={COLORS.textSecondary}
                                      onEndEditing={(e) => {
                                        const raw = e.nativeEvent.text.trim();
                                        const n = raw === '' ? 0 : Number(raw);
                                        if (!Number.isFinite(n) || n < 0) return;
                                        if (n === nb.delivery_fee) return;
                                        setNeighborhoodFee(region.id, city, nb, n);
                                      }}
                                      style={[styles.nbFee, { color: COLORS.text, borderColor: COLORS.border }]}
                                    />
                                    <Switch
                                      value={nb.enabled}
                                      onValueChange={(v) =>
                                        toggleNeighborhood(region.id, city, nb, v)
                                      }
                                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                                      thumbColor="#fff"
                                    />
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Coverage geometry modal */}
      <Modal
        visible={!!coverageDraft}
        transparent
        animationType="fade"
        onRequestClose={() => setCoverageDraft(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: COLORS.card }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>
              {isRTL ? 'تغطية المدينة' : 'City coverage'}
            </Text>
            <Text style={[styles.modalSub, { color: COLORS.textSecondary }]}>
              {coverageDraft?.name}
            </Text>

            <Text style={[styles.modalLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'الإحداثيات (lat, lng)' : 'Center (lat, lng)'}
            </Text>
            <TextInput
              value={coverageDraft?.centerText ?? ''}
              onChangeText={(t) => setCoverageDraft((d) => (d ? { ...d, centerText: t } : d))}
              placeholder="24.7136, 46.6753"
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.modalInput, { color: COLORS.text, borderColor: COLORS.border }]}
            />

            <Text style={[styles.modalLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'نصف القطر (كم)' : 'Radius (km)'}
            </Text>
            <TextInput
              value={coverageDraft?.radiusText ?? ''}
              onChangeText={(t) => setCoverageDraft((d) => (d ? { ...d, radiusText: t } : d))}
              keyboardType="numeric"
              placeholder="25"
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.modalInput, { color: COLORS.text, borderColor: COLORS.border }]}
            />

            <View style={styles.modalActions}>
              <AnimatedTouchable
                onPress={() => setCoverageDraft(null)}
                style={[styles.modalBtn, { borderColor: COLORS.border, borderWidth: 1 }]}
              >
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </AnimatedTouchable>
              <AnimatedTouchable
                onPress={saveCoverage}
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {isRTL ? 'حفظ' : 'Save'}
                </Text>
              </AnimatedTouchable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  color,
  label,
  value,
  COLORS,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
  COLORS: ReturnType<typeof getColors>;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        padding: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...ADMIN_CARD_SHADOW,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name={icon as never} size={18} color={color} />
      </View>
      <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getColors>, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    statRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      padding: SPACING.lg,
      paddingBottom: 8,
    },

    regionCard: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      overflow: 'hidden',
      ...ADMIN_CARD_SHADOW,
    },
    regionAccent: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      [isRTL ? 'right' : 'left']: 0,
      width: 3,
    },
    regionHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      paddingHorizontal: 18,
    },
    regionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    regionTitle: { fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    miniBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },

    regionBody: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 8,
    },
    bulkRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingTop: 12,
      paddingBottom: 4,
    },
    bulkBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },

    cityCard: {
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      gap: 8,
    },
    cityHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    cityHeaderLeft: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    cityName: { fontSize: 13.5, fontWeight: '700', flex: 1, textAlign: isRTL ? 'right' : 'left' },
    coverageBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },

    feeRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
    },
    feeInput: {
      minWidth: 68,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      fontSize: 13,
      textAlign: isRTL ? 'right' : 'left',
    },

    neighborhoodsBox: {
      borderRadius: BORDER_RADIUS.sm,
      padding: 10,
      gap: 6,
    },
    nbHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingBottom: 6,
    },
    nbRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 3,
    },
    nbName: {
      flex: 1,
      fontSize: 12.5,
      textAlign: isRTL ? 'right' : 'left',
    },
    nbFee: {
      minWidth: 58,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      fontSize: 12,
      textAlign: isRTL ? 'right' : 'left',
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      borderRadius: BORDER_RADIUS.lg,
      padding: 20,
      gap: 6,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    modalSub: { fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
    modalLabel: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' },
    modalInput: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    modalActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      marginTop: 14,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
  });
