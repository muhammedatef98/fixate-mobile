import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet, Easing } from 'react-native';
import { getColors, SPACING } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

/**
 * Full-screen loading state that actually reads as one (§11). A bare small
 * spinner on a flat background disappears; this frames it with a tinted ring,
 * a gentle pulse and an optional label so "loading" is unmistakable in both
 * themes and against any surface.
 */
export default function LoadingScreen({ label }: { label?: string }) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.4] });

  return (
    <View style={[styles.center, { backgroundColor: COLORS.background }]}>
      <Animated.View
        style={[
          styles.ring,
          { backgroundColor: COLORS.primary + '1A', borderColor: COLORS.primary, opacity: ringOpacity, transform: [{ scale }] },
        ]}
      />
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={[styles.label, { color: COLORS.textSecondary }]}>
        {label ?? (isRTL ? 'جاري التحميل…' : 'Loading…')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 2, marginBottom: 40 },
  label: { marginTop: SPACING.m, fontSize: 14, fontWeight: '600' },
});
