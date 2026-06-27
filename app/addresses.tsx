import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import * as addressService from '../services/addressService';
import { getFriendlyError } from '../utils/errorMessages';
import ErrorState from '../components/ErrorState';
import { safeBack } from '../utils/navigation';
import * as Location from 'expo-location';
import SaudiCityPicker from '../components/SaudiCityPicker';
import { getRegionTree } from '../services/serviceAreasService';
import OsmMap, { type OsmMapHandle } from '../components/OsmMap';
import { searchPlaces, isGooglePlacesEnabled, type PlaceResult } from '../services/placesService';
import { getCityCentroid, haversineKm } from '../utils/deliveryPricing';

// Default map centre when an address has no saved pin yet (Riyadh).
const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 };
// A pin within this distance of an enabled city's centroid is "in coverage".
const SERVICE_RADIUS_KM = 50;

export default function AddressesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [addresses, setAddresses] = useState<addressService.UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Lower-cased set of currently-enabled city names (Arabic + English).
  // Used to flag saved addresses whose city is no longer in active
  // coverage with a subtle informational chip. `null` means "not loaded"
  // — in that case we suppress the warning so it never false-alarms.
  const [enabledCityNames, setEnabledCityNames] = useState<Set<string> | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<addressService.UserAddress | null>(null);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [buildingNo, setBuildingNo] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [additionalNo, setAdditionalNo] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Map picker (§7) ──────────────────────────────────────────────────
  const mapRef = useRef<OsmMapHandle>(null);
  // Remount key bumped whenever the modal opens so the map recentres on the
  // editing address's pin (OsmMap builds its HTML once per mount).
  const [mapKey, setMapKey] = useState(0);
  const [regionTree, setRegionTree] = useState<any[]>([]);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const suppressAutoSearchRef = useRef(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await addressService.getMyAddresses(user.id);
      setAddresses(data);
    } catch (e: any) {
      setErrorMsg(getFriendlyError(e, language));
    } finally {
      setLoading(false);
    }
  }, [user?.id, language]);

  useEffect(() => {
    load();
  }, [load]);

  // Build the enabled-cities lookup once. We deliberately ignore failures
  // and an empty result here — without a known coverage set we hide the
  // "outside coverage" chip rather than risk a false warning.
  useEffect(() => {
    let cancelled = false;
    getRegionTree(true)
      .then((tree) => {
        if (cancelled || !tree || tree.length === 0) return;
        setRegionTree(tree);
        const names = new Set<string>();
        for (const r of tree) {
          for (const c of r.cities) {
            if (c.name_ar) names.add(c.name_ar.trim().toLowerCase());
            if (c.name_en) names.add(c.name_en.trim().toLowerCase());
          }
        }
        if (names.size > 0) setEnabledCityNames(names);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const isCityCovered = (city: string | null | undefined): boolean => {
    if (!city || !enabledCityNames) return true;
    return enabledCityNames.has(city.trim().toLowerCase());
  };

  // Set the dropped-pin location and reverse-geocode it to auto-fill the
  // address / district / postal fields. Shared by the map drag handler, the
  // place-search result and the GPS button.
  const applyPickedLocation = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const p = places?.[0];
      if (p) {
        const street = (p.street ?? '').trim();
        const name = (p.name ?? '').trim();
        const composed =
          [street, name].filter((s) => s && s !== street).join(' ').trim() || street || name;
        if (composed) setAddress(composed);
        if (p.district) setDistrict(p.district);
        if (p.postalCode) setPostalCode(p.postalCode);
        // City is preferably set from the detected coverage zone below; only
        // seed it from the geocoder when nothing is set yet.
        if (p.city) setCity((prev) => prev || p.city || '');
      }
    } catch {
      // reverse geocode is best-effort
    }
  };

  // Nearest enabled service city to the current pin (centroid lookup, same as
  // the repair-request flow). Drives auto-fill of the city and the
  // out-of-coverage warning. `null` when the pin is outside every zone.
  const detectedCity = useMemo<any | null>(() => {
    if (latitude == null || longitude == null || regionTree.length === 0) return null;
    const cities = regionTree
      .filter((r: any) => r.enabled !== false)
      .flatMap((r: any) => r.cities.filter((c: any) => c.enabled !== false));
    let best: any = null;
    let bestKm = Infinity;
    for (const c of cities) {
      const centroid = getCityCentroid(c.name_en, c.name_ar);
      if (!centroid) continue;
      const km = haversineKm(centroid, { lat: latitude, lng: longitude });
      if (km < bestKm) {
        bestKm = km;
        best = c;
      }
    }
    return best && bestKm <= SERVICE_RADIUS_KM ? best : null;
  }, [latitude, longitude, regionTree]);

  // Sync the detected coverage city into the city field so saved addresses
  // map to a configured zone.
  useEffect(() => {
    if (detectedCity) setCity(isRTL ? detectedCity.name_ar : detectedCity.name_en);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedCity]);

  const pinOutsideCoverage =
    latitude != null && longitude != null && regionTree.length > 0 && !detectedCity;

  const runPlaceSearch = async () => {
    const q = placeQuery.trim();
    if (!q || searchingPlace) return;
    setSearchingPlace(true);
    try {
      const res = await searchPlaces(q, isRTL ? 'ar' : 'en');
      setPlaceResults(res);
    } catch {
      setPlaceResults([]);
    } finally {
      setSearchingPlace(false);
    }
  };

  // Search-as-you-type only when Google Places is configured (the native
  // geocoder fallback is rate-limited, so it stays submit-driven).
  useEffect(() => {
    if (!modalOpen || !isGooglePlacesEnabled()) return;
    if (suppressAutoSearchRef.current) {
      suppressAutoSearchRef.current = false;
      return;
    }
    const q = placeQuery.trim();
    if (q.length < 3) {
      setPlaceResults([]);
      return;
    }
    const timer = setTimeout(runPlaceSearch, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery, modalOpen]);

  const selectPlace = (pl: PlaceResult) => {
    suppressAutoSearchRef.current = true;
    setPlaceQuery(pl.name);
    setPlaceResults([]);
    mapRef.current?.recenter(pl.latitude, pl.longitude, 15);
    applyPickedLocation(pl.latitude, pl.longitude);
  };

  const resetForm = () => {
    setLabel('');
    setAddress('');
    setCity('');
    setDistrict('');
    setShortCode('');
    setBuildingNo('');
    setPostalCode('');
    setAdditionalNo('');
    setLatitude(undefined);
    setLongitude(undefined);
    setPlaceQuery('');
    setPlaceResults([]);
  };

  const openNew = () => {
    setEditing(null);
    resetForm();
    setMapKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEdit = (a: addressService.UserAddress) => {
    setEditing(a);
    setLabel(a.label);
    setAddress(a.address);
    setCity(a.city ?? '');
    setDistrict((a as any).district ?? '');
    setShortCode((a as any).short_code ?? '');
    setBuildingNo((a as any).building_no ?? '');
    setPostalCode((a as any).postal_code ?? '');
    setAdditionalNo((a as any).additional_no ?? '');
    setLatitude(a.latitude);
    setLongitude(a.longitude);
    setPlaceQuery('');
    setPlaceResults([]);
    setMapKey((k) => k + 1);
    setModalOpen(true);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(isRTL ? 'إذن مرفوض' : 'Permission denied',
          isRTL ? 'فعّل إذن الموقع من الإعدادات' : 'Enable location permission in settings');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.recenter(loc.coords.latitude, loc.coords.longitude, 15);
      await applyPickedLocation(loc.coords.latitude, loc.coords.longitude);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!label.trim() || !address.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'الاسم والعنوان مطلوبان' : 'Label and address are required');
      return;
    }
    setSaving(true);
    try {
      const sharedFields = {
        label: label.trim(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim() || undefined,
        short_code: shortCode.trim().toUpperCase() || undefined,
        building_no: buildingNo.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        additional_no: additionalNo.trim() || undefined,
        latitude,
        longitude,
      };
      if (editing) {
        await addressService.updateAddress(editing.id, sharedFields);
      } else {
        await addressService.createAddress(user.id, {
          ...sharedFields,
          is_default: addresses.length === 0,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (a: addressService.UserAddress) => {
    Alert.alert(
      isRTL ? 'حذف العنوان' : 'Delete address',
      isRTL ? `حذف "${a.label}"؟` : `Delete "${a.label}"?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await addressService.deleteAddress(a.id);
              await load();
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (a: addressService.UserAddress) => {
    try {
      await addressService.setDefaultAddress(a.id);
      await load();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    }
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack()}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'عناويني' : 'My Addresses'}</Text>
        <TouchableOpacity
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'إضافة عنوان' : 'Add address'}
        >
          <Ionicons name="add" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={load} />
      ) : addresses.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={72} color={COLORS.border} />
          <Text style={styles.emptyTitle}>{isRTL ? 'لا توجد عناوين بعد' : 'No addresses yet'}</Text>
          <Text style={styles.emptySub}>
            {isRTL ? 'أضف عناوينك لتسريع طلبات الصيانة' : 'Add addresses to speed up your repair requests'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openNew} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{isRTL ? 'إضافة عنوان' : 'Add address'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          {addresses.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLabel}>
                  <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.primary} />
                  <Text style={styles.cardLabelText}>{a.label}</Text>
                  {a.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>{isRTL ? 'افتراضي' : 'Default'}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.cardAddress}>{a.address}</Text>
              {a.city ? <Text style={styles.cardCity}>{a.city}</Text> : null}
              {!isCityCovered(a.city) && (
                <View style={styles.coverageWarn}>
                  <Ionicons name="information-circle-outline" size={13} color="#B45309" />
                  <Text style={styles.coverageWarnText}>
                    {isRTL
                      ? 'هذا العنوان خارج نطاق التغطية حالياً'
                      : 'This address is outside current service coverage'}
                  </Text>
                </View>
              )}
              <View style={styles.cardActions}>
                {!a.is_default && (
                  <TouchableOpacity onPress={() => handleSetDefault(a)} accessibilityRole="button">
                    <Text style={styles.actionLink}>{isRTL ? 'تعيين كافتراضي' : 'Set default'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openEdit(a)} accessibilityRole="button">
                  <Text style={styles.actionLink}>{isRTL ? 'تعديل' : 'Edit'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(a)} accessibilityRole="button">
                  <Text style={[styles.actionLink, { color: COLORS.error }]}>{isRTL ? 'حذف' : 'Delete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: COLORS.card, maxHeight: '90%' }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>
                  {editing ? (isRTL ? 'تعديل العنوان' : 'Edit address') : isRTL ? 'إضافة عنوان' : 'New address'}
                </Text>

                {/* ── Map picker (§7) — search, drag the pin, auto-fill ──── */}
                <View style={styles.searchRow}>
                  <TextInput
                    placeholder={isRTL ? 'ابحث عن مكان…' : 'Search for a place…'}
                    placeholderTextColor={COLORS.textSecondary}
                    value={placeQuery}
                    onChangeText={setPlaceQuery}
                    onSubmitEditing={runPlaceSearch}
                    returnKeyType="search"
                    style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, flex: 1, marginBottom: 0 }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                  <TouchableOpacity
                    onPress={runPlaceSearch}
                    disabled={searchingPlace}
                    style={[styles.searchBtn, { backgroundColor: COLORS.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel={isRTL ? 'بحث' : 'Search'}
                  >
                    {searchingPlace ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons name="search" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {placeResults.length > 0 && (
                  <View style={[styles.resultsBox, { borderColor: COLORS.border, backgroundColor: COLORS.background }]}>
                    {placeResults.slice(0, 5).map((r, i) => (
                      <TouchableOpacity
                        key={`${r.latitude},${r.longitude},${i}`}
                        onPress={() => selectPlace(r)}
                        style={[styles.resultRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border }]}
                        accessibilityRole="button"
                      >
                        <Ionicons name="location-outline" size={15} color={COLORS.primary} />
                        <Text style={[styles.resultText, { color: COLORS.text }]} numberOfLines={2}>
                          {r.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.mapWrap}>
                  <OsmMap
                    key={mapKey}
                    ref={mapRef}
                    latitude={latitude ?? DEFAULT_CENTER.lat}
                    longitude={longitude ?? DEFAULT_CENTER.lng}
                    zoom={latitude != null ? 15 : 11}
                    interactive
                    tapToPlace={Platform.OS === 'android'}
                    onMoveEnd={applyPickedLocation}
                    style={styles.map}
                  />
                  <View style={[styles.mapHint, { backgroundColor: COLORS.card }]}>
                    <Ionicons name="information-circle-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={[styles.mapHintText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                      {isRTL ? 'حرّك الخريطة لضبط الدبوس على موقعك' : 'Move the map to set the pin on your location'}
                    </Text>
                  </View>
                </View>

                {pinOutsideCoverage ? (
                  <View style={styles.coverageWarn}>
                    <Ionicons name="alert-circle-outline" size={13} color="#B45309" />
                    <Text style={styles.coverageWarnText}>
                      {isRTL
                        ? 'هذا الموقع خارج نطاق التغطية الحالية'
                        : 'This location is outside current service coverage'}
                    </Text>
                  </View>
                ) : detectedCity ? (
                  <View style={[styles.coverageWarn, { backgroundColor: '#16A34A12', borderColor: '#16A34A30' }]}>
                    <Ionicons name="checkmark-circle-outline" size={13} color="#16A34A" />
                    <Text style={[styles.coverageWarnText, { color: '#16A34A' }]}>
                      {isRTL
                        ? `ضمن التغطية · ${detectedCity.name_ar}`
                        : `In coverage · ${detectedCity.name_en}`}
                    </Text>
                  </View>
                ) : null}

                {/* Use my location — fills address/city/district/postal automatically */}
                <TouchableOpacity
                  onPress={useMyLocation}
                  disabled={locating}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderWidth: 1, borderRadius: BORDER_RADIUS.md,
                    borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10',
                    minHeight: 48, paddingVertical: 10, paddingHorizontal: SPACING.md,
                    marginBottom: 12,
                  }}
                  accessibilityRole="button"
                >
                  {locating ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={18} color={COLORS.primary} />
                      <Text
                        numberOfLines={1}
                        style={{ color: COLORS.primary, fontWeight: '700', fontSize: 15, flexShrink: 1 }}
                      >
                        {isRTL ? 'استخدم موقعي الحالي' : 'Use my current location'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TextInput
                  placeholder={isRTL ? 'الاسم (مثال: المنزل)' : 'Label (e.g. Home)'}
                  placeholderTextColor={COLORS.textSecondary}
                  value={label}
                  onChangeText={setLabel}
                  style={[styles.input, { color: COLORS.text, borderColor: COLORS.border }]}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <TextInput
                  placeholder={isRTL ? 'العنوان التفصيلي (الشارع، الرقم)' : 'Street address'}
                  placeholderTextColor={COLORS.textSecondary}
                  value={address}
                  onChangeText={setAddress}
                  style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, height: 70 }]}
                  multiline
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                  <TextInput
                    placeholder={isRTL ? 'الحي' : 'District'}
                    placeholderTextColor={COLORS.textSecondary}
                    value={district}
                    onChangeText={setDistrict}
                    style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, flex: 1 }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                  <View style={{ flex: 1 }}>
                    <SaudiCityPicker
                      value={city}
                      onSelect={setCity}
                      isRTL={isRTL}
                      placeholder={isRTL ? 'المدينة' : 'City'}
                    />
                  </View>
                </View>

                {/* Saudi National Address — optional precision fields */}
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 6, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? 'العنوان الوطني (اختياري)' : 'Saudi National Address (optional)'}
                </Text>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                  <TextInput
                    placeholder={isRTL ? 'الرمز (RUH)' : 'Code (RUH)'}
                    placeholderTextColor={COLORS.textSecondary}
                    value={shortCode}
                    onChangeText={(v) => setShortCode(v.toUpperCase().slice(0, 4))}
                    autoCapitalize="characters"
                    style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, flex: 1 }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                  <TextInput
                    placeholder={isRTL ? 'رقم المبنى' : 'Building #'}
                    placeholderTextColor={COLORS.textSecondary}
                    value={buildingNo}
                    onChangeText={(v) => setBuildingNo(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, flex: 1 }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                  <TextInput
                    placeholder={isRTL ? 'الرمز البريدي' : 'Postal code'}
                    placeholderTextColor={COLORS.textSecondary}
                    value={postalCode}
                    onChangeText={(v) => setPostalCode(v.replace(/\D/g, '').slice(0, 5))}
                    keyboardType="number-pad"
                    style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, flex: 1 }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                  <TextInput
                    placeholder={isRTL ? 'الرقم الإضافي' : 'Additional #'}
                    placeholderTextColor={COLORS.textSecondary}
                    value={additionalNo}
                    onChangeText={(v) => setAdditionalNo(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    style={[styles.input, { color: COLORS.text, borderColor: COLORS.border, flex: 1 }]}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setModalOpen(false)}
                  style={[styles.modalBtn, { backgroundColor: COLORS.border }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.modalBtn, { backgroundColor: COLORS.primary, opacity: saving ? 0.5 : 1 }]}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{isRTL ? 'حفظ' : 'Save'}</Text>
                  )}
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
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: C.text },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: C.text, marginTop: SPACING.lg },
    emptySub: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.lg },
    primaryBtn: { backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: BORDER_RADIUS.md },
    primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
    cardLabel: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, flex: 1 },
    cardLabelText: { fontWeight: 'bold', color: C.text, fontSize: 16 },
    defaultBadge: { backgroundColor: C.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    defaultText: { color: C.primary, fontSize: 11, fontWeight: '600' },
    cardAddress: { color: C.text, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' },
    cardCity: { color: C.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    // Subtle amber chip below the city line when the saved address sits
    // outside the currently-enabled service coverage. Informational only —
    // no auto-edits, no link to delete.
    coverageWarn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: '#B4530912',
      borderWidth: 1,
      borderColor: '#B4530930',
    },
    coverageWarnText: {
      color: '#B45309',
      fontSize: 11,
      fontWeight: '700',
    },
    cardActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: SPACING.lg,
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    actionLink: { color: C.primary, fontWeight: '600' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    searchRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    searchBtn: { width: 48, height: 48, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    resultsBox: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, marginBottom: 8, overflow: 'hidden' },
    resultRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    resultText: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' },
    mapWrap: { height: 200, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', marginBottom: 10, position: 'relative' },
    map: { flex: 1 },
    mapHint: {
      position: 'absolute',
      bottom: 8,
      alignSelf: 'center',
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      opacity: 0.95,
      maxWidth: '92%',
    },
    mapHintText: { fontSize: 11, fontWeight: '700' },
    input: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      fontSize: 16,
    },
    modalActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.md, marginTop: SPACING.sm },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  });
