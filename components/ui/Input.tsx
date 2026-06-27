import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getInputDirection } from '../../utils/rtl';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, style, ...props }) => {
  const { isDark, language } = useApp();
  const C = getColors(isDark);
  const isRTL = language === 'ar';
  const [focused, setFocused] = useState(false);

  const borderColor = error ? C.error : focused ? C.primary : C.border;

  return (
    <View style={{ marginBottom: SPACING.m }}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: C.text,
            marginBottom: 6,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: C.card,
            borderWidth: focused ? 1.5 : 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
          style,
        ]}
      >
        {icon && <View style={{ marginHorizontal: SPACING.s }}>{icon}</View>}
        <TextInput
          // Direction follows app language, but numeric/email/phone/url fields
          // are forced LTR so digits and handles never visually reverse — even
          // on an Arabic device. See utils/rtl getInputDirection.
          style={[styles.input, { color: C.text }, getInputDirection(isRTL, props.keyboardType)]}
          placeholderTextColor={C.textLight}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error && (
        <Text style={{ color: C.error, fontSize: 12, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    minHeight: 48,
    paddingHorizontal: SPACING.s,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    paddingVertical: 10,
  },
});
