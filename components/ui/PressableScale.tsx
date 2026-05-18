import React, { useRef } from 'react';
import { Animated, Pressable, ViewStyle, PressableProps } from 'react-native';

interface Props extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Scale target on press-in (default 0.97). */
  to?: number;
}

/**
 * Drop-in replacement for TouchableOpacity that adds the design-system
 * press feedback (subtle scale-down). Keeps the same onPress contract.
 */
export const PressableScale: React.FC<Props> = ({ children, style, to = 0.97, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 7, tension: 120 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => animate(to)}
        onPressOut={() => animate(1)}
        style={style as any}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default PressableScale;
