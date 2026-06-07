/**
 * VerifiedBadge — small inline check-mark used wherever a verified
 * user's name is rendered (profile, market feed, listing detail,
 * market chat header). Three size variants keep usage consistent.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Size = 'sm' | 'md' | 'lg';

interface VerifiedBadgeProps {
  size?: Size;
  /** If provided, badge becomes a pill with this label next to the icon. */
  label?: string;
  /** Override the default brand color (e.g. on coloured surfaces). */
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

const SIZE_MAP: Record<Size, { icon: number; padV: number; padH: number; font: number }> = {
  sm: { icon: 12, padV: 2, padH: 6,  font: 10 },
  md: { icon: 14, padV: 3, padH: 8,  font: 11 },
  lg: { icon: 16, padV: 4, padH: 10, font: 12 },
};

export function VerifiedBadge({
  size = 'sm',
  label,
  color = '#10B981',
  backgroundColor,
  style,
}: VerifiedBadgeProps) {
  const s = SIZE_MAP[size];

  if (!label) {
    // Icon-only — used inline next to a name. No background by default.
    return (
      <MaterialIcons
        name="verified"
        size={s.icon}
        color={color}
        style={[{ marginHorizontal: 2 }, style as any]}
        accessibilityLabel="Verified"
      />
    );
  }

  return (
    <View
      style={[
        styles.pill,
        {
          paddingVertical: s.padV,
          paddingHorizontal: s.padH,
          backgroundColor: backgroundColor ?? color + '1A',
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel="Verified"
    >
      <MaterialIcons name="verified" size={s.icon} color={color} />
      <Text style={[styles.label, { color, fontSize: s.font }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    gap: 4,
    alignSelf: 'flex-start',
  },
  label: { fontWeight: '800' },
});

export default VerifiedBadge;
