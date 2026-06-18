import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  SectionList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { SAUDI_REGIONS } from '../constants/saudiCities';
import { getRegionTree } from '../services/serviceAreasService';
import { logger } from '../utils/logger';

/**
 * The picker has two modes:
 *
 *  - 'serviceable' (default): show every city, but disable rows where the
 *    admin has not enabled coverage. The DB tables `service_area_regions`
 *    + `service_area_cities` are the source of truth (cached for 5 minutes
 *    inside the service). Disabled rows render greyed out with a
 *    "قريباً / Coming soon" pill and ignore taps. Used by every service-
 *    flow caller (addresses, technician onboarding) so coverage stays
 *    consistent across the picker, map validation, and admin settings.
 *
 *  - 'all': use the static `SAUDI_REGIONS` list, every city selectable.
 *    Used by marketplace screens where the city is metadata, not a
 *    coverage gate.
 *
 * If the DB load fails or returns no rows in serviceable mode (e.g.
 * migration not applied on a fresh dev database), the picker falls back
 * to the static list with every city enabled so it never becomes stuck.
 */
export type SaudiCityPickerMode = 'serviceable' | 'all';

interface SaudiCityPickerProps {
  value?: string | null;
  onSelect: (city: string) => void;
  placeholder?: string;
  isRTL?: boolean;
  /** Defaults to 'serviceable' — safe-by-default for new callers. */
  mode?: SaudiCityPickerMode;
}

interface PickerCity {
  ar: string;
  en: string;
  enabled: boolean;
}

interface PickerRegion {
  ar: string;
  en: string;
  cities: PickerCity[];
}

/** Convert the static `SAUDI_REGIONS` constant into the picker's shape,
 *  marking every city as enabled (fallback / 'all' mode). */
const staticPickerData = (): PickerRegion[] =>
  SAUDI_REGIONS.map((r) => ({
    ar: r.nameAr,
    en: r.nameEn,
    cities: r.cities.map((c) => ({ ar: c.ar, en: c.en, enabled: true })),
  }));

export default function SaudiCityPicker({
  value,
  onSelect,
  placeholder,
  isRTL = false,
  mode = 'serviceable',
}: SaudiCityPickerProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PickerRegion[] | null>(mode === 'all' ? staticPickerData() : null);
  const [loading, setLoading] = useState(false);
  // Live keyboard height so the results list can shrink to stay fully visible
  // above the keyboard (Fix 5).
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!open) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0)
    );
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  // Combined height of the handle + header + search bar inside the sheet.
  const SHEET_CHROME = 150;
  const screenH = Dimensions.get('window').height;
  const kbOpen = keyboardHeight > 0;
  const topLimit = insets.top + 16;
  // When the keyboard is up, cap the list so the WHOLE sheet (chrome + list)
  // fits in the space above it; otherwise use a comfortable 85%-screen sheet.
  const listMaxHeight = kbOpen
    ? Math.max(160, screenH - keyboardHeight - topLimit - SHEET_CHROME - insets.bottom - 20)
    : Math.round(screenH * 0.85) - SHEET_CHROME;
  const sheetMaxHeight = kbOpen ? screenH - keyboardHeight - topLimit : Math.round(screenH * 0.85);

  // Load coverage data when the sheet opens (serviceable mode only).
  // We keep `data` cached on the component instance so re-opens are
  // instant; the service-level cache absorbs cross-screen reuse.
  useEffect(() => {
    if (!open) return;
    if (mode === 'all') {
      if (!data) setData(staticPickerData());
      return;
    }
    if (data) return;
    let cancelled = false;
    setLoading(true);
    getRegionTree(false)
      .then((tree) => {
        if (cancelled) return;
        if (!tree || tree.length === 0) {
          // Half-configured environment — keep the picker usable by
          // falling back to the static list with everything enabled.
          logger.warn('SaudiCityPicker: empty region tree, falling back to static list');
          setData(staticPickerData());
          return;
        }
        const mapped: PickerRegion[] = tree.map((r) => ({
          ar: r.name_ar,
          en: r.name_en,
          cities: r.cities.map((c) => ({
            ar: c.name_ar,
            en: c.name_en,
            // A city is bookable only when both its region and the city
            // itself are flagged enabled — mirrors the request-flow
            // validation in app/request.tsx.
            enabled: r.enabled && c.enabled,
          })),
        }));
        setData(mapped);
      })
      .catch((e) => {
        logger.warn('SaudiCityPicker: region tree load failed, using static fallback', e);
        if (!cancelled) setData(staticPickerData());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, mode, data]);

  const sections = useMemo(() => {
    const source = data ?? [];
    const q = query.trim().toLowerCase();
    return source
      .map((region) => {
        // Search across every city (including disabled) so users can find
        // and confirm that a specific city is not yet covered.
        const cities = q
          ? region.cities.filter(
              (c) => c.ar.toLowerCase().includes(q) || c.en.toLowerCase().includes(q)
            )
          : region.cities;
        return {
          title: isRTL ? region.ar : region.en,
          data: cities,
        };
      })
      .filter((s) => s.data.length > 0);
  }, [data, query, isRTL]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setKeyboardHeight(0);
  };

  const handlePick = (city: PickerCity) => {
    if (!city.enabled) return;
    onSelect(isRTL ? city.ar : city.en);
    close();
  };

  const styles = createStyles(COLORS, isRTL);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
        <Text
          style={[
            styles.triggerText,
            { color: value ? COLORS.text : COLORS.textSecondary },
          ]}
          numberOfLines={1}
        >
          {value || placeholder || (isRTL ? 'اختر المدينة' : 'Select city')}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
      >
        {/* Fix 5 — the sheet is lifted above the keyboard by exactly its height
            (marginBottom) and its results list is capped (listMaxHeight) so the
            search bar stays on top and the full list stays visible/scrollable
            while typing, on both iOS and Android. */}
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight, marginBottom: keyboardHeight }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {isRTL ? 'اختر المدينة' : 'Select city'}
              </Text>
              <TouchableOpacity onPress={close} accessibilityRole="button">
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={COLORS.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={isRTL ? 'ابحث عن مدينة...' : 'Search city...'}
                placeholderTextColor={COLORS.textSecondary}
                style={styles.searchInput}
                autoCorrect={false}
                textAlign={isRTL ? 'right' : 'left'}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item, index) => item.en + index}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: listMaxHeight }}
                stickySectionHeadersEnabled
                renderSectionHeader={({ section }) => (
                  <View style={styles.regionHeader}>
                    <Text style={styles.regionHeaderText}>{section.title}</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const label = isRTL ? item.ar : item.en;
                  const selected = value === item.ar || value === item.en;
                  const disabled = !item.enabled;
                  return (
                    <TouchableOpacity
                      style={[styles.cityRow, disabled && styles.cityRowDisabled]}
                      onPress={() => handlePick(item)}
                      activeOpacity={disabled ? 1 : 0.6}
                      disabled={disabled}
                      accessibilityState={{ disabled }}
                    >
                      <Text
                        style={[
                          styles.cityText,
                          selected && { color: COLORS.primary, fontWeight: '700' },
                          disabled && { color: COLORS.textSecondary },
                        ]}
                      >
                        {label}
                      </Text>
                      {disabled ? (
                        <View style={[styles.soonPill, { backgroundColor: COLORS.textSecondary + '20' }]}>
                          <Text style={[styles.soonText, { color: COLORS.textSecondary }]}>
                            {isRTL ? 'قريباً' : 'Coming soon'}
                          </Text>
                        </View>
                      ) : selected ? (
                        <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Ionicons
                      name="search-outline"
                      size={32}
                      color={COLORS.textLight}
                    />
                    <Text style={styles.emptyText}>
                      {isRTL ? 'لا توجد نتائج' : 'No results found'}
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 32 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (C: ReturnType<typeof getColors>, isRTL: boolean) =>
  StyleSheet.create({
    trigger: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: C.card,
    },
    triggerText: {
      flex: 1,
      fontSize: 15,
      textAlign: isRTL ? 'right' : 'left',
    },
    backdrop: {
      flex: 1,
      backgroundColor: C.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      maxHeight: '85%',
      paddingTop: 8,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.borderStrong,
      alignSelf: 'center',
      marginBottom: 8,
    },
    sheetHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingBottom: 12,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
    },
    searchBox: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: SPACING.lg,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.cardAlt,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: C.text,
      padding: 0,
    },
    regionHeader: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: 8,
      backgroundColor: C.background,
    },
    regionHeaderText: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
    },
    cityRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    cityRowDisabled: {
      // Faint background tint so disabled rows read as "not available"
      // without competing with the rest of the list.
      opacity: 0.55,
    },
    cityText: {
      fontSize: 15,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    soonPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    soonText: {
      fontSize: 11,
      fontWeight: '700',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: C.textLight,
    },
  });
