// One-shot patch that makes every <Text> and <TextInput> in the app pick the
// correct Tajawal variant based on its fontWeight style.
//
// Why this exists: React Native does NOT auto-map fontWeight to a custom
// font's bold variant. If you write
//   <Text style={{ fontWeight: 'bold' }}>Hi</Text>
// after setting `fontFamily: 'Tajawal_400Regular'` as the default, both iOS
// and Android render it in the *regular* weight — the bold attribute is
// silently ignored for custom fonts. The fix is to translate fontWeight to
// the matching family name (`Tajawal_700Bold` etc) at render time.
//
// We do this once at app boot by overriding Text.render. The same patch
// is applied to TextInput. The function is idempotent — calling it twice
// is a no-op so hot-reload doesn't stack overrides.

import { I18nManager, StyleSheet, Text, TextInput } from 'react-native';

const PATCHED = '__fixate_tajawal_patched';

// Cached "current" direction read by the render-time patch. Updated by
// setTextDirection() whenever the user toggles language. Defaults to the
// native I18nManager value so the very first render before
// setTextDirection runs still picks a sensible side.
let currentIsRTL = I18nManager.isRTL;
export const setTextDirection = (isRTL: boolean) => {
  currentIsRTL = isRTL;
};

const familyForWeight = (fw: any): string => {
  // RN allows '100' through '900', plus 'normal' and 'bold'. Map them to
  // the four Tajawal weights we ship.
  switch (String(fw ?? '').toLowerCase()) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
    case '':
    case 'undefined':
      return 'Tajawal_400Regular';
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

const wrapRender = (Comp: any) => {
  if (!Comp || (Comp as any)[PATCHED]) return;
  const original = Comp.render;
  if (typeof original !== 'function') return;
  Comp.render = function patchedRender(props: any, ref: any) {
    const flat = StyleSheet.flatten(props?.style) || {};
    // Compose defaults: Tajawal font family + language-driven textAlign.
    // The defaults sit *before* the caller-provided style so anything
    // explicit on the component (textAlign:'center' for an empty state,
    // textAlign:isRTL?'left':'right' for a key/value layout) still wins.
    const isRTL = currentIsRTL;
    const directionDefaults: any = {
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    };
    if (flat.fontFamily) {
      // Caller picked an explicit family — keep it, but still apply the
      // direction defaults underneath.
      const next = {
        ...props,
        style: [directionDefaults, props?.style],
      };
      return original.call(this, next, ref);
    }
    const family = familyForWeight(flat.fontWeight);
    const next = {
      ...props,
      style: [directionDefaults, { fontFamily: family }, props?.style],
    };
    return original.call(this, next, ref);
  };
  (Comp as any)[PATCHED] = true;
};

export function applyTajawalToText() {
  wrapRender(Text);
  wrapRender(TextInput);
}
