/**
 * AnimatedBackButton — circular back button with a spring press animation.
 * Wraps an icon (chevron-back / arrow-back) and exposes a larger hit area.
 */
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTLIonicon } from './RTLIcon';

interface AnimatedBackButtonProps {
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  size?: number;
  iconSize?: number;
  iconName?: keyof typeof Ionicons.glyphMap;
  rtl?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function AnimatedBackButton({
  onPress,
  color = '#1F2937',
  backgroundColor = 'rgba(0,0,0,0.04)',
  size = 42,
  iconSize = 22,
  iconName = 'chevron-back',
  rtl = false,
  style,
  accessibilityLabel = 'Back',
}: AnimatedBackButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 12,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor,
            transform: [{ scale }],
          },
        ]}
      >
        {rtl ? (
          <RTLIonicon name={iconName} size={iconSize} color={color} />
        ) : (
          <Ionicons name={iconName} size={iconSize} color={color} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});

export default AnimatedBackButton;
