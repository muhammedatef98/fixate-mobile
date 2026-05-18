import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { getColors, SPACING } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface Props {
  title: string;
  /** Optional small caption under the title. */
  subtitle?: string;
  /** Optional trailing action (e.g. "See all"). */
  actionLabel?: string;
  onAction?: () => void;
}

/** Consistent 22px+ section title with 24px top spacing rhythm. */
export const SectionHeader: React.FC<Props> = ({ title, subtitle, actionLabel, onAction }) => {
  const { isDark, language } = useApp();
  const C = getColors(isDark);
  const isRTL = language === 'ar';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.l,
        marginBottom: SPACING.s + 4,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '800',
            color: C.text,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={{
              fontSize: 13,
              color: C.textSecondary,
              marginTop: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {!!actionLabel && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SectionHeader;
