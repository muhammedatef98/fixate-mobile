import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GEAR_PATH } from './GearLoader';

/**
 * Animated splash overlay — the brand mark assembles from its real parts.
 *
 * The logo bitmap is split into its two shapes (assets/fixate-logo-bolt.png,
 * assets/fixate-logo-flap.png — the pixels the gear covered are repaired
 * underneath), and the gear is drawn as a vector (the same path GearLoader
 * uses, traced from the logo artboard). Choreography (~2.3s):
 *
 *   1. The bolt — the "F" stroke — rises into place.
 *   2. The top flap folds in from above, completing the letterform.
 *   3. The gear (the "i" dot) spins into its slot and settles.
 *   4. The "Fixate" wordmark fades up. Hold, then fade into the app.
 *
 * Every part ends at its exact position in the original bitmap, so the final
 * frame is pixel-identical to the untouched logo — no crop, no seams.
 *
 * Built on RN Animated (transform/opacity only → native driver, no Lottie).
 * Respects reduce-motion: parts render statically for 900ms, then continue.
 */

const BG = '#ffffff';
const BRAND = '#10B981';
const BOLT_IMG = require('../assets/fixate-logo-bolt.png');
const FLAP_IMG = require('../assets/fixate-logo-flap.png');

// Gear geometry inside the source bitmap (510×380): bbox x151..279, y251..379.
// Both layer PNGs keep the full canvas, so all three parts share one 168-box.
const LOGO_BOX = 168;
const SRC_W = 510;
const SRC_H = 380;
const SCALE = LOGO_BOX / SRC_W;
const GEAR_SIZE = 128 * SCALE;
const GEAR_LEFT = 151 * SCALE;
const GEAR_TOP = (LOGO_BOX - SRC_H * SCALE) / 2 + 251 * SCALE;
const GEAR_COLOR = '#05956B';

interface AnimatedSplashProps {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const stageScale = useRef(new Animated.Value(0.94)).current;

  const boltOpacity = useRef(new Animated.Value(0)).current;
  const boltShift = useRef(new Animated.Value(22)).current;
  const flapOpacity = useRef(new Animated.Value(0)).current;
  const flapShift = useRef(new Animated.Value(-18)).current;
  const gearOpacity = useRef(new Animated.Value(0)).current;
  const gearSpin = useRef(new Animated.Value(0)).current; // 0→1 = -270deg→0

  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordShift = useRef(new Animated.Value(14)).current;

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (!cancelled) setReduceMotion(v); })
      .catch(() => { if (!cancelled) setReduceMotion(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;

    const fadeOutAndFinish = () => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinish());
    };

    if (reduceMotion) {
      stageScale.setValue(1);
      boltOpacity.setValue(1); boltShift.setValue(0);
      flapOpacity.setValue(1); flapShift.setValue(0);
      gearOpacity.setValue(1); gearSpin.setValue(1);
      wordOpacity.setValue(1); wordShift.setValue(0);
      const t = setTimeout(fadeOutAndFinish, 900);
      return () => clearTimeout(t);
    }

    const ringPulse = (v: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    const inTiming = (v: Animated.Value, to: number, duration: number, delay = 0) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: to,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      ringPulse(ring1, 260),
      ringPulse(ring2, 660),
      Animated.spring(stageScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),

      // 1 — the bolt (the F stroke) rises in.
      inTiming(boltOpacity, 1, 380),
      inTiming(boltShift, 0, 480),

      // 2 — the flap folds down onto it.
      inTiming(flapOpacity, 1, 340, 260),
      inTiming(flapShift, 0, 420, 260),

      // 3 — the gear (the i dot) spins into its slot: rotation-only, in
      //     place, so it always lands exactly where the bitmap gear was.
      inTiming(gearOpacity, 1, 220, 520),
      Animated.sequence([
        Animated.delay(520),
        Animated.timing(gearSpin, {
          toValue: 1,
          duration: 1150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 4 — wordmark rises once the mark has assembled.
      inTiming(wordOpacity, 1, 480, 1050),
      inTiming(wordShift, 0, 560, 1050),

      Animated.delay(2250),
    ]).start(({ finished }) => {
      if (finished) fadeOutAndFinish();
    });
  }, [reduceMotion]);

  const gearRotate = gearSpin.interpolate({ inputRange: [0, 1], outputRange: ['-270deg', '0deg'] });

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.28, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.6] }) }],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.stage}>
        {/* Depth rings behind the mark */}
        <Animated.View style={[styles.ring, ringStyle(ring1)]} pointerEvents="none" />
        <Animated.View style={[styles.ring, ringStyle(ring2)]} pointerEvents="none" />

        <Animated.View style={{ width: LOGO_BOX, height: LOGO_BOX, transform: [{ scale: stageScale }] }}>
          <Animated.Image
            source={BOLT_IMG}
            resizeMode="contain"
            style={[styles.layer, { opacity: boltOpacity, transform: [{ translateY: boltShift }] }]}
          />
          <Animated.Image
            source={FLAP_IMG}
            resizeMode="contain"
            style={[styles.layer, { opacity: flapOpacity, transform: [{ translateY: flapShift }] }]}
          />
          <Animated.View
            style={{
              position: 'absolute',
              left: GEAR_LEFT,
              top: GEAR_TOP,
              width: GEAR_SIZE,
              height: GEAR_SIZE,
              opacity: gearOpacity,
              transform: [{ rotate: gearRotate }],
            }}
          >
            <Svg width={GEAR_SIZE} height={GEAR_SIZE} viewBox="0 0 100 100">
              <Path d={GEAR_PATH} fill={GEAR_COLOR} fillRule="evenodd" />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Name floats just beneath the dead-centered mark. */}
      <Animated.View style={[styles.wordWrap, { opacity: wordOpacity, transform: [{ translateY: wordShift }] }]}>
        <Text style={styles.wordmark}>Fixate</Text>
      </Animated.View>
    </Animated.View>
  );
}

const RING_SIZE = 180;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  stage: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', top: 0, left: 0, width: LOGO_BOX, height: LOGO_BOX },
  wordWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: 94,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: BRAND,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
});
