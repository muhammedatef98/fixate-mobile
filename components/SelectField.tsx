import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';

export interface SelectOption {
  id: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  options: SelectOption[];
  onSelect: (id: string) => void;
  placeholder?: string;
  isRTL?: boolean;
}

/** Compact dropdown — shows the selected label, opens a bottom-sheet list. */
export default function SelectField({
  value,
  options,
  onSelect,
  placeholder,
  isRTL = false,
}: SelectFieldProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const [open, setOpen] = useState(false);
  const styles = createStyles(COLORS, isRTL);
  const selected = options.find((o) => o.id === value);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Text
          style={[styles.triggerText, { color: selected ? COLORS.text : COLORS.textSecondary }]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder || (isRTL ? 'اختر' : 'Select')}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {options.map((o) => {
              const active = o.id === value;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={styles.row}
                  onPress={() => {
                    onSelect(o.id);
                    setOpen(false);
                  }}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.rowText,
                      active && { color: COLORS.primary, fontWeight: '700' },
                    ]}
                  >
                    {o.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}
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
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: C.card,
    },
    triggerText: { flex: 1, fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      paddingHorizontal: SPACING.lg,
      paddingTop: 8,
      paddingBottom: 28,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.borderStrong,
      alignSelf: 'center',
      marginBottom: 8,
    },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    rowText: { fontSize: 15, color: C.text, textAlign: isRTL ? 'right' : 'left' },
  });
