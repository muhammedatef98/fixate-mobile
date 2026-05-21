import React, { useEffect, useState, useCallback } from 'react';
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

export default function AddressesScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [addresses, setAddresses] = useState<addressService.UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  };

  const openNew = () => {
    setEditing(null);
    resetForm();
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
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      const places = await Location.reverseGeocodeAsync(loc.coords);
      const p = places?.[0];
      if (p) {
        const street = (p.street ?? '').trim();
        const name = (p.name ?? '').trim();
        const composed = [street, name].filter((s) => s && s !== street).join(' ').trim() || street || name;
        if (composed) setAddress(composed);
        if (p.district) setDistrict(p.district);
        if (p.city) setCity(p.city);
        if (p.postalCode) setPostalCode(p.postalCode);
      }
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

                {/* Use my location — fills address/city/district/postal automatically */}
                <TouchableOpacity
                  onPress={useMyLocation}
                  disabled={locating}
                  style={[styles.input, {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10',
                    height: 48, marginBottom: 12,
                  }]}
                  accessibilityRole="button"
                >
                  {locating ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={18} color={COLORS.primary} />
                      <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
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
    input: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      fontSize: 16,
    },
    modalActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: SPACING.md, marginTop: SPACING.sm },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  });
