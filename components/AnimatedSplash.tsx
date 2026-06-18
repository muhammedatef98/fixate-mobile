import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, AccessibilityInfo } from 'react-native';

/**
 * Animated splash overlay (FEATURE-2).
 *
 * Implemented with React Native's Animated API rather than Lottie on purpose:
 * lottie-react-native is a native module that isn't in the binary, and adding it
 * would force a native rebuild (the same "module not found" class of crash that
 * has already bitten this project). The requested effect — the Fixate logo
 * fading + scaling in with a subtle pulse over ~2s — is fully expressible with
 * Animated, works on the current binary, and needs no rebuild.
 *
 * The native static splash (assets/splash.png, #ffffff) is the first frame, and
 * this overlay uses the same background, so there is no flash on hand-off.
 *
 * Respects reduce-motion: when enabled, the logo is shown statically for 800ms
 * then we continue (no fade/scale/pulse).
 */

const BG = '#ffffff';
const LOGO = require('../assets/fixate-logo-main.png');

interface AnimatedSplashProps {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
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
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinish());
    };

    if (reduceMotion) {
      // Static logo, brief hold, then continue.
      opacity.setValue(1);
      scale.setValue(1);
      const t = setTimeout(fadeOutAndFinish, 800);
      return () => clearTimeout(t);
    }

    // Fade + scale in (~700ms), a subtle pulse, then settle and hand off.
    const intro = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const pulse = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.06,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.0,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    // Total ≈ 700 + 840 + 260 hold ≈ 1.8–2.0s, within the 1.8–2.2s budget.
    const seq = Animated.sequence([intro, pulse, Animated.delay(260)]);
    seq.start(({ finished }) => {
      if (finished) fadeOutAndFinish();
    });
    return () => seq.stop();
  }, [reduceMotion]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.Image
        source={LOGO}
        resizeMode="contain"
        style={[styles.logo, { opacity, transform: [{ scale }] }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: { width: 200, height: 200 },
});
