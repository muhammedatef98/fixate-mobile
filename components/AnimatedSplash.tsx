import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GEAR_PATH } from './GearLoader';

/**
 * Animated splash overlay.
 *
 * Built on React Native's Animated API rather than Lottie on purpose:
 * lottie-react-native is a native module that isn't in the binary, and adding
 * it would force a native rebuild. Everything here animates only `transform`
 * and `opacity`, so it runs entirely on the native driver — no rebuild, no
 * JS-thread jank.
 *
 * Choreography (~2.2s):
 *   1. Two brand-green rings pulse outward behind the mark (depth + energy).
 *   2. The logo springs in from small with a slight counter-rotation, so the
 *      gear reads as "clicking" into place — thematic for a repair app.
 *   3. The "Fixate" wordmark fades and rises beneath the mark.
 *   4. Brief hold, then the whole overlay fades out into the app.
 *
 * The native static splash (assets/splash.png, #ffffff) is the first frame and
 * shares this background, so there is no flash on hand-off.
 *
 * Respects reduce-motion: the logo + wordmark are shown statically for 900ms,
 * then we continue (no rings, spin, or pulse).
 */

const BG = '#ffffff';
const BRAND = '#10B981';
// The logo bitmap with the gear erased — the gear is drawn separately as a
// vector (same path GearLoader uses, traced from the logo) so it can spin
// independently while the bolt stays still.
const LOGO = require('../assets/fixate-logo-gearless.png');
// Gear geometry inside the source bitmap (510×380): bbox x151..279, y251..379.
// The 168px rendered logo uses resizeMode="contain", so scale = 168/510.
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
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.68)).current;
  const logoSpin = useRef(new Animated.Value(0)).current; // 0 → 1 maps to -14deg → 0
  const gearSpin = useRef(new Animated.Value(0)).current; // 0 → 1 maps to a full turn
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordShift = useRef(new Animated.Value(14)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Each ring animates a shared 0→1 progress into scale + fade.
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
    if (reduceMotion === null) return; // wait until we know the preference

    const fadeOutAndFinish = () => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinish());
    };

    if (reduceMotion) {
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      logoSpin.setValue(1);
      gearSpin.setValue(1);
      wordOpacity.setValue(1);
      wordShift.setValue(0);
      const t = setTimeout(fadeOutAndFinish, 900);
      return () => clearTimeout(t);
    }

    // One expanding-ring pulse: scale out while fading away.
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

    // Mark springs + spins into place.
    const markIn = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(logoSpin, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
    ]);

    // Wordmark rises in just after the mark lands.
    const wordIn = Animated.parallel([
      Animated.timing(wordOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wordShift, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    // Rings run in parallel with the intro; the mark/word are sequenced.
    // The gear does one full easing-out turn across the whole intro —
    // spinning fast at first, settling as the wordmark lands.
    Animated.parallel([
      ringPulse(ring1, 120),
      ringPulse(ring2, 520),
      Animated.timing(gearSpin, {
        toValue: 1,
        duration: 1900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        markIn,
        Animated.delay(120),
        wordIn,
        Animated.delay(420),
      ]),
    ]).start(({ finished }) => {
      if (finished) fadeOutAndFinish();
    });
  }, [reduceMotion]);

  const spin = logoSpin.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] });
  const gearRotate = gearSpin.interpolate({ inputRange: [0, 1], outputRange: ['-360deg', '0deg'] });

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

        <Animated.View
          style={{ opacity: logoOpacity, transform: [{ scale: logoScale }, { rotate: spin }] }}
        >
          <Animated.Image source={LOGO} resizeMode="contain" style={styles.logo} />
          {/* The gear, spinning in place over the exact spot it was erased
              from the bitmap. */}
          <Animated.View
            style={{
              position: 'absolute',
              left: GEAR_LEFT,
              top: GEAR_TOP,
              width: GEAR_SIZE,
              height: GEAR_SIZE,
              transform: [{ rotate: gearRotate }],
            }}
          >
            <Svg width={GEAR_SIZE} height={GEAR_SIZE} viewBox="0 0 100 100">
              <Path d={GEAR_PATH} fill={GEAR_COLOR} fillRule="evenodd" />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Name floats just beneath the dead-centered mark (absolute, so it never
          nudges the logo off centre — the logo stays where the native splash
          put it, and the two read as one centered lockup). */}
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
  // Anchored to the vertical centre, then pushed just below the mark so the
  // logo itself stays dead-centre (half the 168px logo + a small gap).
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
  logo: { width: 168, height: 168 },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
});
