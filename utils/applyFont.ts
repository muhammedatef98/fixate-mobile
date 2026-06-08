/**
 * Global Arabic-aware font resolver for <Text> / <TextInput>.
 *
 * IBM Plex Sans Arabic is the brand font (loaded once at boot in
 * app/_layout.tsx via useFonts). React Native doesn't auto-pick a
 * weighted variant when fontWeight is set on a custom-family text node
 * — you have to name the family explicitly. This helper maps a
 * resolved fontWeight to the right IBM Plex Sans Arabic variant.
 *
 * Weights exposed by @expo-google-fonts/ibm-plex-sans-arabic:
 *   100 Thin, 200 ExtraLight, 300 Light, 400 Regular,
 *   500 Medium, 600 SemiBold, 700 Bold.
 * No 800/900 ships — those fall back to 700 Bold (the heaviest one).
 */

let _isRTL = true;

export function setTextDirection(isRTL: boolean) {
  _isRTL = isRTL;
}

export function getCurrentIsRTL() {
  return _isRTL;
}

export function getAppFontFamily(fw?: string | number | null): string {
  switch (String(fw ?? '').toLowerCase()) {
    case '100':
    case 'thin':
      return 'IBMPlexSansArabic_100Thin';
    case '200':
      return 'IBMPlexSansArabic_200ExtraLight';
    case '300':
    case 'light':
      return 'IBMPlexSansArabic_300Light';
    case '500':
      return 'IBMPlexSansArabic_500Medium';
    case '600':
    case 'semibold':
      return 'IBMPlexSansArabic_600SemiBold';
    case '700':
    case 'bold':
    case '800':
    case '900':
    case 'extra-bold':
    case 'extrabold':
    case 'black':
      // 800/900 are not shipped by IBM Plex Sans Arabic — collapse to 700.
      return 'IBMPlexSansArabic_700Bold';
    default:
      return 'IBMPlexSansArabic_400Regular';
  }
}

// Install a global override on Text and TextInput so every text node in
// the app renders with IBM Plex Sans Arabic by default — without forcing
// every screen to import AppText.
//
// RN 0.81 ships Text and TextInput as plain *function components* (not
// React.forwardRef wrappers anymore), and React 19 removed defaultProps
// support for function components. The previous render-patch / defaultProps
// approaches both no-op silently on this stack — that's why every plain
// <Text> was rendering with the system font even after the helper was
// invoked at boot.
//
// What actually works on RN 0.81 + React 19: replace the Text / TextInput
// property on the react-native module's exports object with a wrapper that
// injects fontFamily and forwards to the original. Metro transpiles
// `import { Text } from 'react-native'` to lazy property access on the
// module (`_reactNative.Text`), so reassigning the property propagates to
// every subsequent render call — both for screens imported before this
// install runs and for screens imported afterwards.
//
// Idempotent — only runs once.
let _installed = false;

export function applyAppFontToText(): void {
  if (_installed) return;
  _installed = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    const { StyleSheet } = RN;

    const wrap = (key: 'Text' | 'TextInput'): void => {
      const Original = RN[key];
      if (!Original || (Original as any).__appFontWrapped) return;

      const Wrapped: any = function FontWrapped(props: any) {
        const flat = (StyleSheet.flatten(props?.style) || {}) as any;
        const family = flat.fontFamily ?? getAppFontFamily(flat.fontWeight);
        // Prepend the resolved family so the caller's style still wins.
        const nextStyle = [{ fontFamily: family }, props?.style];
        return React.createElement(Original, { ...props, style: nextStyle });
      };
      Wrapped.displayName = `App${key}`;
      Wrapped.__appFontWrapped = true;

      // Try plain assignment first; fall back to defineProperty in case the
      // module export was published with a strict descriptor.
      try {
        RN[key] = Wrapped;
      } catch {
        try {
          Object.defineProperty(RN, key, {
            value: Wrapped,
            writable: true,
            configurable: true,
          });
        } catch {
          /* give up silently — AppText remains the explicit opt-in path */
        }
      }
    };

    wrap('Text');
    wrap('TextInput');
  } catch {
    // Best effort — if RN's internals change shape, AppText remains the
    // explicit opt-in path.
  }
}
