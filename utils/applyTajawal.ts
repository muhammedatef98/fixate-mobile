/**
 * applyTajawal.ts
 *
 * Sets Tajawal as the default font for every <Text> and <TextInput>
 * in the app without patching the render method (which is fragile in
 * Expo SDK 50+ / React Native 0.73+).
 *
 * Strategy:
 *   1. Override Text.defaultProps and TextInput.defaultProps with a base
 *      style that sets fontFamily: 'Tajawal_400Regular'.
 *   2. Export getTajawalFamily(weight) for StyleSheet.create() blocks
 *      where you need a specific weight explicitly.
 *   3. Export setTextDirection(isRTL) so _layout.tsx can keep the
 *      writingDirection in sync with the current language.
 */

import { Text, TextInput, Platform } from 'react-native';

const PATCHED = '__fixate_tajawal_patched';

// Map React Native fontWeight values to the four Tajawal variants we ship.
export const getTajawalFamily = (fw?: string | number): string => {
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

let _isRTL = true; // Arabic by default

export function setTextDirection(isRTL: boolean) {
  _isRTL = isRTL;
}

export function applyTajawalToText() {
  if ((Text as any)[PATCHED]) return; // idempotent

  // defaultProps is the safe, supported way to set a fallback style in RN.
  // Any style passed directly by the component still wins — this is purely
  // the fallback when no fontFamily is specified.
  const baseStyle = {
    fontFamily: 'Tajawal_400Regular',
  };

  Text.defaultProps = Text.defaultProps ?? {};
  Text.defaultProps.style = [
    baseStyle,
    Text.defaultProps.style ?? {},
  ];

  TextInput.defaultProps = TextInput.defaultProps ?? {};
  TextInput.defaultProps.style = [
    baseStyle,
    TextInput.defaultProps.style ?? {},
  ];

  (Text as any)[PATCHED] = true;
}
