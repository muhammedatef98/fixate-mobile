/**
 * AppText / AppTextInput — thin wrappers around React Native's Text and
 * TextInput that:
 *   1. Pick the correct Tajawal weight from the resolved fontWeight.
 *   2. Default textAlign + writingDirection to the current language so
 *      Arabic strings render right-to-left by default.
 *
 * The caller's `style` still wins because it sits AFTER the defaults in
 * the style array — anything explicit (e.g. textAlign:'center' on a
 * button label) is preserved as-is.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextProps,
  type TextInputProps,
} from 'react-native';
import { getCurrentIsRTL, getTajawalFamily } from '../utils/applyTajawal';

export const AppText = React.forwardRef<Text, TextProps>(function AppText(
  props,
  ref,
) {
  const flat = (StyleSheet.flatten(props.style) || {}) as any;
  const family = flat.fontFamily ?? getTajawalFamily(flat.fontWeight);
  const isRTL = getCurrentIsRTL();
  return (
    <Text
      ref={ref}
      {...props}
      style={[
        {
          fontFamily: family,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        props.style,
      ]}
    />
  );
});

export const AppTextInput = React.forwardRef<TextInput, TextInputProps>(
  function AppTextInput(props, ref) {
    const flat = (StyleSheet.flatten(props.style) || {}) as any;
    const family = flat.fontFamily ?? getTajawalFamily(flat.fontWeight);
    const isRTL = getCurrentIsRTL();
    return (
      <TextInput
        ref={ref}
        {...props}
        style={[
          {
            fontFamily: family,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
          props.style,
        ]}
      />
    );
  },
);
