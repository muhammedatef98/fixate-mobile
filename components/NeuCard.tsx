import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface NeuCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'flat' | 'pressed' | 'elevated';
}

export default function NeuCard({ 
  children, 
  style, 
  onPress,
  variant = 'flat' 
}: NeuCardProps) {
  const cardStyles = [
    styles.base,
    variant === 'flat' && [styles.flat, SHADOWS.neuFlat],
    variant === 'pressed' && styles.pressed,
    variant === 'elevated' && [styles.elevated, SHADOWS.medium],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.92}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.md,
  },
  flat: {
  },
  pressed: {
    // Inset shadow effect (simulated with border)
    borderWidth: 1,
    borderColor: COLORS.shadowDark,
  },
  elevated: {
    backgroundColor: COLORS.white,
  },
});
