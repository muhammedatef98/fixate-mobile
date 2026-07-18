import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
  PressableProps,
} from 'react-native';

// Layout props need to live on the outer Animated.View so the wrapped
// element actually participates in its parent's flex layout. Visual
// props (padding, background, border, flexDirection, gap…) stay on the
// inner touchable so taps cover the full visual area exactly once.
const LAYOUT_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'alignSelf', 'width', 'height',
  'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'position', 'top', 'right', 'bottom', 'left', 'start', 'end',
  'zIndex',
] as const;

const splitLayoutStyle = (style: ViewStyle | ViewStyle[] | undefined): {
  layout: ViewStyle;
  rest: ViewStyle | ViewStyle[] | undefined;
} => {
  if (!style) return { layout: {}, rest: undefined };
  const flat = StyleSheet.flatten(style) as ViewStyle;
  const layout: ViewStyle = {};
  const rest: ViewStyle = { ...flat };
  for (const k of LAYOUT_KEYS) {
    const v = (flat as Record<string, unknown>)[k];
    if (v !== undefined) (layout as Record<string, unknown>)[k] = v;
  }
  // Flex-sizing must NOT stay on the inner touchable: `flex: 1` there
  // resolves against the wrapper's auto height and collapses the button
  // to zero (labels vanish). Width/height/margins stay duplicated —
  // existing screens size the inner visual (bg, radius) through them.
  for (const k of ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf'] as const) {
    delete (rest as Record<string, unknown>)[k];
  }
  return { layout, rest };
};

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

export const AnimatedTouchable: React.FC<TouchableOpacityProps> = ({
  children,
  onPressIn,
  onPressOut,
  style,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();

  const { layout, rest: innerStyle } = useMemo(
    () => splitLayoutStyle(style as ViewStyle | ViewStyle[] | undefined),
    [style]
  );

  return (
    <Animated.View style={[layout, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPressIn={(e) => { animate(0.96); onPressIn?.(e); }}
        onPressOut={(e) => { animate(1); onPressOut?.(e); }}
        style={innerStyle}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};
