import React, { useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated, Pressable } from 'react-native';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'elevated',
  padding,
}) => {
  const { isDark } = useApp();
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const scale = useRef(new Animated.Value(1)).current;

  const base: ViewStyle = {
    backgroundColor: variant === 'flat' ? C.cardAlt : C.card,
    borderRadius: BORDER_RADIUS.md,
    padding: padding ?? SPACING.m,
    marginBottom: SPACING.m,
  };
  const variantStyle =
    variant === 'elevated'
      ? { ...SHADOWS.small, borderWidth: 1, borderColor: C.border }
      : variant === 'outlined'
      ? { borderWidth: 1, borderColor: C.border, backgroundColor: 'transparent' as const }
      : {};

  if (!onPress) {
    return <View style={[base, variantStyle, style]}>{children}</View>;
  }

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7, tension: 120 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(0.985)}
        onPressOut={() => animate(1)}
        style={[base, variantStyle, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({});
