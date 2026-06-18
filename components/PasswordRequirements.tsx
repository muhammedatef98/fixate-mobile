import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPasswordChecks, PASSWORD_SPECIAL_EXAMPLES } from '../utils/validation';

/**
 * Inline, real-time password requirements helper shown next to the password
 * field during sign-up. Requirements are ALWAYS visible (not hidden behind a
 * tooltip or only revealed after submit) and each rule turns green the moment
 * it is satisfied — giving the user clear, friendly guidance as they type.
 *
 * The special-character rule is surfaced first and as a headline note because
 * it is the one users most often miss.
 */

const SUCCESS = '#16A34A';

interface ThemeColors {
  text: string;
  textSecondary: string;
  error: string;
  primary: string;
  card: string;
  border: string;
}

interface PasswordRequirementsProps {
  password: string;
  isRTL: boolean;
  COLORS: ThemeColors;
  /** Hide the block entirely (e.g. before the field is touched). */
  visible?: boolean;
}

interface Rule {
  key: string;
  met: boolean;
  label: string;
}

export default function PasswordRequirements({
  password,
  isRTL,
  COLORS,
  visible = true,
}: PasswordRequirementsProps) {
  const checks = useMemo(() => getPasswordChecks(password), [password]);

  if (!visible) return null;

  const rules: Rule[] = [
    {
      key: 'special',
      met: checks.special,
      label: isRTL
        ? 'رمز خاص واحد على الأقل'
        : 'At least one special character',
    },
    {
      key: 'length',
      met: checks.length,
      label: isRTL ? '8 أحرف على الأقل' : 'At least 8 characters',
    },
    {
      key: 'uppercase',
      met: checks.uppercase,
      label: isRTL ? 'حرف إنجليزي كبير (A-Z)' : 'One uppercase letter (A-Z)',
    },
    {
      key: 'lowercase',
      met: checks.lowercase,
      label: isRTL ? 'حرف إنجليزي صغير (a-z)' : 'One lowercase letter (a-z)',
    },
    {
      key: 'number',
      met: checks.number,
      label: isRTL ? 'رقم واحد على الأقل' : 'At least one number',
    },
  ];

  const styles = createStyles(COLORS, isRTL);

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={
        isRTL ? 'متطلبات كلمة المرور' : 'Password requirements'
      }
    >
      {/* Headline note — the special-character rule, spelled out plainly. */}
      <Text style={styles.note}>
        {isRTL
          ? 'يجب أن تحتوي كلمة المرور على رمز خاص واحد على الأقل'
          : 'Your password must contain at least one special character'}
      </Text>
      <Text style={styles.examples}>
        {isRTL ? `أمثلة: ${PASSWORD_SPECIAL_EXAMPLES}` : `e.g. ${PASSWORD_SPECIAL_EXAMPLES}`}
      </Text>

      <View style={styles.divider} />

      {rules.map((rule) => (
        <View key={rule.key} style={styles.row}>
          <Ionicons
            name={rule.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={rule.met ? SUCCESS : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.ruleText,
              { color: rule.met ? SUCCESS : COLORS.textSecondary },
            ]}
          >
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (COLORS: ThemeColors, isRTL: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: COLORS.primary + '0D',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.primary + '22',
      padding: 14,
      marginTop: 10,
      gap: 6,
    },
    note: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
      lineHeight: 20,
    },
    examples: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.border,
      marginVertical: 4,
    },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    ruleText: {
      fontSize: 12.5,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
      flexShrink: 1,
    },
  });
