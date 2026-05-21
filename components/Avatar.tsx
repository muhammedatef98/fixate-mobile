import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import { getInitials, getAvatarColor } from '../utils/avatars';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shows a user photo when `uri` is provided, otherwise a coloured circle
 * with the person's initials. Colour is derived deterministically from the
 * name so the same user looks consistent everywhere.
 */
export default function Avatar({ name, uri, size = 48, style }: AvatarProps) {
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          { width: size, height: size, borderRadius: radius },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: getAvatarColor(name),
        },
        style,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
