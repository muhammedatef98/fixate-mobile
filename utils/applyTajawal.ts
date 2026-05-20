/**
 * applyTajawal.ts — React 19 + React Native 0.81 compatible
 *
 * defaultProps is removed in React 19 for function components.
 * The correct approach:
 *   - Export AppText / AppTextInput wrapper components that always
 *     inject the right Tajawal variant based on fontWeight.
 *   - Keep applyTajawalToText() as a no-op so existing _layout.tsx
 *     import doesn't break.
 *   - Keep setTextDirection() for RTL support.
 *
 * How to use in screens:
 *   import { AppText } from '../utils/applyTajawal';
 *   <AppText style={{ fontWeight: 'bold' }}>مرحباً</AppText>
 *
 * For global auto-apply without changing every screen, see the
 * metro.config.js alias approach below.
 */

import React from 'react';
import { Text, TextInput, StyleSheet, TextProps, TextInputProps } from 'react-native';

export const getTajawalFamily = (fw?: string | number | null): string => {
  switch (String(fw ?? '').toLowerCase()) {
    case '500':
    case '600':
      return 'Tajawal_500Medium';
    case '700':
    case 'bold':
      return 'Tajawal_700Bold';
    case '800':
    case '900':
      return 'Tajawal_800ExtraBold';
    default:
      return 'Tajawal_400Regular';
  }
};

let _isRTL = true;
export function setTextDirection(isRTL: boolean) {
  _isRTL = isRTL;
}

/** Drop-in replacement for <Text> with auto Tajawal */
export const AppText = React.forwardRef<Text, TextProps>((props, ref) => {
  const flat = StyleSheet.flatten(props.style) || {};
  // Respect explicit fontFamily (e.g. monospace in error screens)
  const fontFamily = flat.fontFamily ?? getTajawalFamily(flat.fontWeight);
  return (
    <Text
      {...props}
      ref={ref}
      style={[{ fontFamily }, props.style]}
    />
  );
});
AppText.displayName = 'AppText';

/** Drop-in replacement for <TextInput> with auto Tajawal */
export const AppTextInput = React.forwardRef<TextInput, TextInputProps>((props, ref) => {
  const flat = StyleSheet.flatten(props.style) || {};
  const fontFamily = flat.fontFamily ?? getTajawalFamily(flat.fontWeight);
  return (
    <TextInput
      {...props}
      ref={ref}
      style={[{ fontFamily }, props.style]}
    />
  );
});
AppTextInput.displayName = 'AppTextInput';

/**
 * Legacy no-op — keeps _layout.tsx from crashing after import.
 * Real font injection now happens via AppText / AppTextInput components.
 */
export function applyTajawalToText() {
  // no-op in React 19. Use <AppText> instead of <Text> in your screens.
}
