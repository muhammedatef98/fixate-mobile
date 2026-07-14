import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getColors, SPACING } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import GearLoader from './GearLoader';

/**
 * Full-screen loading state that actually reads as one (§11).
 *
 * This used to be a stock ActivityIndicator framed by a pulsing tinted ring —
 * the ring existed because a bare small spinner disappears against a flat
 * background. The brand gear carries that weight on its own, so the ring and
 * its pulse are gone: one turning mark plus a label, which is both quieter and
 * unmistakably ours.
 */
export default function LoadingScreen({ label }: { label?: string }) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  return (
    <View style={[styles.center, { backgroundColor: COLORS.background }]}>
      <GearLoader size={56} />
      <Text style={[styles.label, { color: COLORS.textSecondary }]}>
        {label ?? (isRTL ? 'جاري التحميل…' : 'Loading…')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: SPACING.m, fontSize: 14, fontWeight: '600' },
});
