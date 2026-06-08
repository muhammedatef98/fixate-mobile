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
// every screen to import AppText. We wrap the components' render so we
// can inject a default fontFamily under the user's style (so anything
// they pass still wins). Idempotent — only runs once.
let _installed = false;

export function applyAppFontToText(): void {
  if (_installed) return;
  _installed = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    const { Text, TextInput, StyleSheet } = RN;

    const patch = (Component: any): void => {
      if (!Component || Component.__appFontPatched) return;
      const originalRender = Component.render;
      if (!originalRender) return;
      Component.__appFontPatched = true;
      Component.render = function (...args: unknown[]) {
        const element = originalRender.apply(this, args as []);
        if (!element || !element.props) return element;
        const userStyle = element.props.style;
        const flat = (StyleSheet.flatten(userStyle) || {}) as any;
        const family = flat.fontFamily ?? getAppFontFamily(flat.fontWeight);
        return {
          ...element,
          props: {
            ...element.props,
            style: [{ fontFamily: family }, userStyle],
          },
        };
      };
    };

    patch(Text);
    patch(TextInput);
  } catch {
    // Best effort — if RN's internals change shape, AppText remains the
    // explicit opt-in path.
  }
}
