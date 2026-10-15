import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import IntlogyLogo, { INTLOGY_WORDMARK_RATIO } from './IntlogyLogo';

// "by INTLOGY" brand lockup shown under the Fixate logo and in footers.
// The lockup stays in English and left-to-right in both languages so the
// brand mark always reads the same way.
type Props = {
  isDark?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

export default function IntlogyCredit({ isDark = false, size = 'sm', style }: Props) {
  const height = size === 'md' ? 18 : 13;
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel="by Intlogy"
    >
      <Text
        style={[
          styles.by,
          { fontSize: size === 'md' ? 13 : 11, color: isDark ? '#9CA3AF' : '#6B7280' },
        ]}
      >
        by
      </Text>
      <IntlogyLogo width={height * INTLOGY_WORDMARK_RATIO} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    direction: 'ltr',
  },
  by: {
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
