import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, DimensionValue } from 'react-native';
import { getColors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** A single shimmering placeholder block. */
export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 16, radius = 8, style }) => {
  const { isDark } = useApp();
  const C = getColors(isDark);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: C.cardAlt, opacity: pulse },
        style,
      ]}
    />
  );
};

/** A card-shaped skeleton row, matching the standard list/card layout. */
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 2 }) => {
  const { isDark } = useApp();
  const C = getColors(isDark);
  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Skeleton width={48} height={48} radius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={14} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '40%' : '85%'} height={12} />
        ))}
      </View>
    </View>
  );
};

export default Skeleton;
