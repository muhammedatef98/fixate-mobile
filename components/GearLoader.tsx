import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/theme';

/**
 * The brand's gear, rotating — our loading indicator instead of a stock spinner.
 *
 * The path is the gear traced from the logo artboard itself
 * (assets/icons/source/fixate-icon.pdf), so it is the same shape the launcher
 * icon carries rather than a generic gear that merely resembles it. It is drawn
 * as a vector rather than shipped as a bitmap, which keeps it crisp at any size,
 * lets it take the theme's colour, and — importantly — means the locked icon
 * pipeline and brand assets are untouched.
 *
 * Two subpaths (gear body, hub) + evenodd: the hub reads as a hole, so the
 * surface behind it shows through on any background.
 */
const GEAR_PATH =
  'M40.92 0.00 L59.08 0.00 L60.18 11.74 L65.14 13.58 L69.36 15.78 L78.90 8.26 L91.74 21.10 ' +
  'L83.85 30.64 L86.06 35.60 L87.16 39.45 L99.82 40.73 L99.82 59.08 L86.79 60.37 L84.77 65.32 ' +
  'L83.12 68.26 L91.74 78.72 L78.90 91.56 L78.53 91.56 L68.07 82.75 L64.40 84.59 L60.73 85.69 ' +
  'L60.37 86.06 L60.18 87.52 L59.08 99.82 L40.92 99.82 L39.63 86.24 L39.08 85.69 L34.68 84.22 ' +
  'L31.93 82.75 L22.75 90.46 L20.92 91.56 L8.26 78.90 L16.88 68.26 L14.68 64.22 L13.39 60.55 ' +
  'L12.84 60.18 L0.00 59.08 L0.00 40.92 L12.66 39.63 L13.94 35.41 L16.15 30.83 L8.26 21.10 ' +
  'L21.10 8.26 L30.28 15.78 L35.23 13.39 L39.27 12.11 L39.82 11.56 L40.92 0.00 Z ' +
  'M47.52 26.61 L52.29 26.61 L56.15 27.34 L61.28 29.54 L64.40 31.74 L67.16 34.50 L69.36 37.61 ' +
  'L71.56 42.75 L72.29 46.61 L72.29 51.19 L71.56 55.05 L70.83 57.25 L68.07 62.20 L64.04 66.42 ' +
  'L60.73 68.62 L56.33 70.46 L52.66 71.19 L47.16 71.19 L43.67 70.46 L38.90 68.44 L36.15 66.61 ' +
  'L33.21 63.85 L30.46 60.00 L28.99 56.88 L27.71 51.74 L27.52 48.26 L28.44 42.57 L30.28 38.17 ' +
  'L32.48 34.86 L35.96 31.38 L39.27 29.17 L43.85 27.34 L47.52 26.61 Z';

// One unhurried turn. Fast enough to read as "working", slow enough not to nag.
const ROTATION_DURATION_MS = 2400;

interface GearLoaderProps {
  /** Rendered width/height in px. */
  size?: number;
  /** Defaults to the brand green. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Deliberately reads no context. The brand green is the same token in light and
 * dark (COLORS.primary === '#10B981' in both), so there is nothing to theme —
 * and staying context-free lets this render above AppProvider, which the
 * font-loading gate in app/_layout.tsx does.
 */
export default function GearLoader({ size = 48, color = COLORS.primary, style }: GearLoaderProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => !cancelled && setReduceMotion(v))
      .catch(() => !cancelled && setReduceMotion(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: ROTATION_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin, reduceMotion]);

  // The gear is 8-fold symmetric, so a 45° sweep is a full visual revolution —
  // rotating a whole 360° would just repeat the same frames eight times over.
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    // No explicit width/height here: on Android, an `accessible` view carrying
    // accessibilityRole="progressbar" AND exact bounds gets painted with the
    // platform's default progress-bar backing — a grey square behind the gear,
    // showing through the hub. The Svg already sizes itself, so letting the
    // wrapper shrink-wrap keeps the screen-reader semantics without the box.
    <View accessibilityRole="progressbar" accessible style={[styles.container, style]}>
      <Animated.View style={reduceMotion ? undefined : { transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={GEAR_PATH} fill={color} fillRule="evenodd" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
