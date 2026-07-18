import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GEAR_PATH } from './GearLoader';

/**
 * Animated splash overlay — "f i x" spells out, then becomes the logo.
 *
 * Choreography (~2.8s):
 *   1. A lowercase "f" fades up.
 *   2. The "i" joins — its stem is a bar, and its DOT is the brand gear
 *      (the same vector GearLoader uses), spinning the whole time.
 *   3. The "x" lands, completing "fix".
 *   4. The letters give way to the actual logo — the ORIGINAL, untouched
 *      bitmap (assets/fixate-logo-main.png) — via a scale-crossfade, and
 *      the "Fixate" wordmark rises beneath it. Hold, fade into the app.
 *
 * The logo asset is never edited, layered, or recomposed — it appears
 * exactly as designed. Only transform/opacity animate (native driver).
 * Respects reduce-motion: the logo + wordmark show statically for 900ms.
 */

const BG = '#ffffff';
const BRAND = '#10B981';
const DARK_GREEN = '#05956B';
const LOGO = require('../assets/fixate-logo-main.png');

const LETTER_SIZE = 74;
const STEM_W = 11;
const STEM_H = 46;
const DOT_GEAR = 34;

interface AnimatedSplashProps {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Letter entrances
  const fIn = useRef(new Animated.Value(0)).current;
  const iIn = useRef(new Animated.Value(0)).current;
  const xIn = useRef(new Animated.Value(0)).current;
  // Continuous gear rotation across the whole intro
  const gearTurn = useRef(new Animated.Value(0)).current;
  // Letters → logo crossfade
  const lettersOut = useRef(new Animated.Value(0)).current; // 0 = shown, 1 = gone
  const logoIn = useRef(new Animated.Value(0)).current;
  // Wordmark
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordShift = useRef(new Animated.Value(14)).current;
  // Depth rings behind the logo reveal
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
      lettersOut.setValue(1);
      logoIn.setValue(1);
      wordOpacity.setValue(1);
      wordShift.setValue(0);
      const t = setTimeout(fadeOutAndFinish, 900);
      return () => clearTimeout(t);
    }

    const enter = (v: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]);

    const ringPulse = (v: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      // f → i (gear dot) → x
      enter(fIn, 0),
      enter(iIn, 280),
      enter(xIn, 560),

      // The gear spins steadily through the letters phase and eases to a
      // stop as the logo lands (2 full turns, decelerating).
      Animated.timing(gearTurn, {
        toValue: 1,
        duration: 2100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      // Letters give way to the untouched logo.
      Animated.sequence([
        Animated.delay(1350),
        Animated.parallel([
          Animated.timing(lettersOut, {
            toValue: 1,
            duration: 380,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(logoIn, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          ringPulse(ring1, 60),
          ringPulse(ring2, 380),
        ]),
      ]),

      // Wordmark rises under the logo.
      Animated.sequence([
        Animated.delay(1850),
        Animated.parallel([
          Animated.timing(wordOpacity, {
            toValue: 1,
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordShift, {
            toValue: 0,
            duration: 540,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      Animated.delay(2750),
    ]).start(({ finished }) => {
      if (finished) fadeOutAndFinish();
    });
  }, [reduceMotion]);

  const rise = (v: Animated.Value) => ({
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
    ],
  });

  const gearRotate = gearTurn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });

  const lettersStyle = {
    opacity: lettersOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: lettersOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }],
  };
  const logoStyle = {
    opacity: logoIn,
    transform: [{ scale: logoIn.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }],
  };

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.26, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] }) }],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, ringStyle(ring1)]} pointerEvents="none" />
        <Animated.View style={[styles.ring, ringStyle(ring2)]} pointerEvents="none" />

        {/* Phase 1 — "f i x", the i's dot is the spinning gear. */}
        <Animated.View style={[styles.letters, lettersStyle]} pointerEvents="none">
          <Animated.Text style={[styles.letter, rise(fIn)]}>f</Animated.Text>
          <Animated.View style={[styles.iWrap, rise(iIn)]}>
            <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
              <Svg width={DOT_GEAR} height={DOT_GEAR} viewBox="0 0 100 100">
                <Path d={GEAR_PATH} fill={DARK_GREEN} fillRule="evenodd" />
              </Svg>
            </Animated.View>
            <View style={styles.stem} />
          </Animated.View>
          <Animated.Text style={[styles.letter, rise(xIn)]}>x</Animated.Text>
        </Animated.View>

        {/* Phase 2 — the original logo, exactly as designed. */}
        <Animated.Image source={LOGO} resizeMode="contain" style={[styles.logo, logoStyle]} />
      </View>

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
  letters: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  letter: {
    fontSize: LETTER_SIZE,
    lineHeight: LETTER_SIZE * 1.05,
    fontWeight: '800',
    color: BRAND,
  },
  // The "i": gear dot over a rounded stem, sized to sit on the letters'
  // baseline next to f and x.
  iWrap: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: LETTER_SIZE * 0.13,
  },
  stem: {
    width: STEM_W,
    height: STEM_H,
    borderRadius: STEM_W / 2,
    backgroundColor: BRAND,
  },
  logo: { width: 168, height: 168 },
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
