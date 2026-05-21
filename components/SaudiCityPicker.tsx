import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  SectionList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { SAUDI_REGIONS, type SaudiCity } from '../constants/saudiCities';

interface SaudiCityPickerProps {
  value?: string | null;
  onSelect: (city: string) => void;
  placeholder?: string;
  isRTL?: boolean;
}

export default function SaudiCityPicker({
  value,
  onSelect,
  placeholder,
  isRTL = false,
}: SaudiCityPickerProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAUDI_REGIONS.map((region) => {
      const cities = q
        ? region.cities.filter(
            (c) =>
              c.ar.toLowerCase().includes(q) || c.en.toLowerCase().includes(q)
          )
        : region.cities;
      return {
        title: isRTL ? region.nameAr : region.nameEn,
        data: cities,
      };
    }).filter((s) => s.data.length > 0);
  }, [query, isRTL]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const handlePick = (city: SaudiCity) => {
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
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.sheet}>
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

            <SectionList
              sections={sections}
              keyExtractor={(item, index) => item.en + index}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled
              renderSectionHeader={({ section }) => (
                <View style={styles.regionHeader}>
                  <Text style={styles.regionHeaderText}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const label = isRTL ? item.ar : item.en;
                const selected = value === item.ar || value === item.en;
                return (
                  <TouchableOpacity
                    style={styles.cityRow}
                    onPress={() => handlePick(item)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.cityText,
                        selected && { color: COLORS.primary, fontWeight: '700' },
                      ]}
                    >
                      {label}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={COLORS.primary}
                      />
                    )}
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
    cityText: {
      fontSize: 15,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
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
