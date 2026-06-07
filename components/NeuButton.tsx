import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, View, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { selection } from '../utils/haptics';

interface NeuButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'flat';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export default function NeuButton({
  title,
  onPress,
  variant = 'flat',
  size = 'medium',
  icon,
  style,
  textStyle,
  disabled = false,
  loading = false,
  fullWidth = false,
  haptic = true,
  accessibilityLabel,
  accessibilityHint,
}: NeuButtonProps) {
  const isInactive = disabled || loading;

  const buttonStyles = [
    styles.base,
    variant === 'primary' && [styles.primary, SHADOWS.primaryGlow],
    variant === 'secondary' && styles.secondary,
    variant === 'flat' && [styles.flat, SHADOWS.neuFlat],
    size === 'small' && styles.small,
    size === 'medium' && styles.medium,
    size === 'large' && styles.large,
    fullWidth && styles.fullWidth,
    isInactive && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    variant === 'primary' && styles.primaryText,
    variant === 'secondary' && styles.secondaryText,
    variant === 'flat' && styles.flatText,
    size === 'small' && styles.smallText,
    size === 'large' && styles.largeText,
    textStyle,
  ];

  const spinnerColor =
    variant === 'primary' ? COLORS.white : COLORS.primary;

  const handlePress = () => {
    if (haptic) selection();
    onPress();
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      disabled={isInactive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          {title && <Text style={textStyles}>{title}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.xl,
  },
  // Variants
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  flat: {
    backgroundColor: COLORS.background,
  },
  // Sizes
  small: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 40,
  },
  medium: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  large: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    minHeight: 56,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  // Text styles
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: COLORS.white,
  },
  secondaryText: {
    color: COLORS.primary,
  },
  flatText: {
    color: COLORS.text,
  },
  smallText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 18,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
});
