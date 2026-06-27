import type { KeyboardTypeOptions, TextStyle } from 'react-native';

/**
 * Direction helpers driven by the APP LANGUAGE, not the device locale.
 *
 * IMPORTANT: direction must follow the app's `language` flag (isRTL = language
 * === 'ar'), NOT `I18nManager.isRTL`. On an Arabic Android device the native
 * locale would otherwise force English text/inputs to render right-to-left.
 * These helpers take `isRTL` as an explicit argument so callers pass the
 * language-derived value (e.g. from `useApp()`), keeping English LTR and Arabic
 * RTL regardless of the device locale — without any global I18nManager flip.
 */

export const getTextAlign = (isRTL: boolean): TextStyle['textAlign'] =>
  isRTL ? 'right' : 'left';

export const getWritingDirection = (isRTL: boolean): TextStyle['writingDirection'] =>
  isRTL ? 'rtl' : 'ltr';

export const getFlexDirection = (isRTL: boolean): 'row' | 'row-reverse' =>
  isRTL ? 'row-reverse' : 'row';

/**
 * Keyboard types whose content is inherently left-to-right (numbers, emails,
 * phone numbers, URLs). Fields using these should stay LTR even when the app
 * language is Arabic, so digits/handles don't get visually reversed.
 */
const LTR_KEYBOARD_TYPES: ReadonlySet<KeyboardTypeOptions> = new Set([
  'number-pad',
  'numeric',
  'decimal-pad',
  'phone-pad',
  'email-address',
  'url',
]);

export const isLtrKeyboardType = (kt?: KeyboardTypeOptions): boolean =>
  !!kt && LTR_KEYBOARD_TYPES.has(kt);

/**
 * Resolve the `{ textAlign, writingDirection }` for a TextInput. Numeric / email
 * / phone / url fields are forced LTR regardless of language; everything else
 * follows the app language. Use for any input that may hold mixed or
 * English-only content.
 */
export const getInputDirection = (
  isRTL: boolean,
  keyboardType?: KeyboardTypeOptions
): Pick<TextStyle, 'textAlign' | 'writingDirection'> => {
  if (isLtrKeyboardType(keyboardType)) {
    return { textAlign: 'left', writingDirection: 'ltr' };
  }
  return { textAlign: getTextAlign(isRTL), writingDirection: getWritingDirection(isRTL) };
};

/**
 * Style for text that is ALWAYS left-to-right regardless of app language —
 * order codes, timestamps, emails, phone numbers, raw numbers. Apply on top of
 * the base text style so these never visually reverse on Arabic screens.
 */
export const LTR_TEXT_STYLE: Pick<TextStyle, 'textAlign' | 'writingDirection'> = {
  textAlign: 'left',
  writingDirection: 'ltr',
};
