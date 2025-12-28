import { I18nManager } from 'react-native';

/**
 * Check if the app is in RTL mode
 */
export const isRTL = () => I18nManager.isRTL;

/**
 * Get text alignment based on RTL
 */
export const getTextAlign = (): 'left' | 'right' => {
  return isRTL() ? 'right' : 'left';
};

/**
 * Get flex direction based on RTL
 */
export const getFlexDirection = (): 'row' | 'row-reverse' => {
  return isRTL() ? 'row-reverse' : 'row';
};

/**
 * Get writing direction
 */
export const getWritingDirection = (): 'rtl' | 'ltr' => {
  return isRTL() ? 'rtl' : 'ltr';
};

/**
 * Get margin/padding for start (respects RTL)
 */
export const getMarginStart = (value: number) => {
  return isRTL() ? { marginRight: value } : { marginLeft: value };
};

export const getMarginEnd = (value: number) => {
  return isRTL() ? { marginLeft: value } : { marginRight: value };
};

export const getPaddingStart = (value: number) => {
  return isRTL() ? { paddingRight: value } : { paddingLeft: value };
};

export const getPaddingEnd = (value: number) => {
  return isRTL() ? { paddingLeft: value } : { paddingRight: value };
};

/**
 * RTL-aware styles object
 */
export const rtlStyles = {
  textAlign: getTextAlign(),
  flexDirection: getFlexDirection(),
  writingDirection: getWritingDirection(),
};
