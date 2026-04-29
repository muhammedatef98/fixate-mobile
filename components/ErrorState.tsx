import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';

interface Props {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

export default function ErrorState({ message, onRetry, retryLabel }: Props) {
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);
  const label = retryLabel ?? (isRTL ? 'إعادة المحاولة' : 'Retry');

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: COLORS.error + '15' }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.error} />
      </View>
      <Text style={[styles.message, { color: COLORS.text }]}>{message}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: COLORS.primary }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={styles.buttonText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 44,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
