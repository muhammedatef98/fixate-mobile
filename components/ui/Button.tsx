import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { getColors, getShadows, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
}) => {
  const { isDark } = useApp();
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7, tension: 120 }).start();

  const bg = () => {
    if (disabled) return C.border;
    switch (variant) {
      case 'primary': return C.primary;
      case 'secondary': return C.cardAlt;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return C.primary;
    }
  };
  const fg = () => {
    if (disabled) return C.textSecondary;
    switch (variant) {
      case 'primary': return C.primaryForeground;
      case 'secondary': return C.text;
      case 'outline': return C.primary;
      case 'ghost': return C.textSecondary;
      default: return C.primaryForeground;
    }
  };
  // Min 48px height for medium/large per the design spec.
  const pad = () => {
    switch (size) {
      case 'small': return { minHeight: 38, paddingVertical: 8, paddingHorizontal: 14 };
      case 'large': return { minHeight: 54, paddingVertical: 15, paddingHorizontal: 24 };
      default: return { minHeight: 48, paddingVertical: 13, paddingHorizontal: 20 };
    }
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { alignSelf: 'stretch' }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        accessibilityRole="button"
        style={[
          styles.container,
          { backgroundColor: bg() },
          variant === 'outline' && { borderWidth: 1.5, borderColor: disabled ? C.border : C.primary },
          pad(),
          variant === 'primary' && !disabled && SHADOWS.small,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg()} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                { color: fg(), fontSize: size === 'large' ? 17 : size === 'small' ? 14 : 16 },
                icon ? { marginHorizontal: 8 } : null,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
