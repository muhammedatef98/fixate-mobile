import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, SPACING } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { Button } from './Button';

interface Props {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Standard empty state: icon + title + description + optional action. */
export const EmptyState: React.FC<Props> = ({
  icon = 'inbox-outline',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { isDark } = useApp();
  const C = getColors(isDark);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.l }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: C.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: SPACING.m,
        }}
      >
        <MaterialCommunityIcons name={icon} size={42} color={C.primary} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' }}>{title}</Text>
      {!!description && (
        <Text
          style={{
            fontSize: 14,
            color: C.textSecondary,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 21,
            maxWidth: 300,
          }}
        >
          {description}
        </Text>
      )}
      {!!actionLabel && onAction && (
        <View style={{ marginTop: SPACING.l }}>
          <Button title={actionLabel} onPress={onAction} size="medium" />
        </View>
      )}
    </View>
  );
};

export default EmptyState;
