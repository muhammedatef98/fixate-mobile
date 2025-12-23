import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { getColors } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#374151' : '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
}

// Skeleton Card Component
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);

  return (
    <View style={[styles.card, { backgroundColor: COLORS.card }, style]}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLoader width="60%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="40%" height={12} />
        </View>
      </View>
      <SkeletonLoader width="100%" height={80} borderRadius={8} style={{ marginTop: 12 }} />
    </View>
  );
}

// Skeleton List Component
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

// Skeleton Order Card
export function SkeletonOrderCard() {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);

  return (
    <View style={[styles.orderCard, { backgroundColor: COLORS.card }]}>
      <View style={styles.orderHeader}>
        <SkeletonLoader width={60} height={60} borderRadius={8} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLoader width="70%" height={18} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="50%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonLoader width="40%" height={12} />
        </View>
      </View>
      <View style={styles.orderFooter}>
        <SkeletonLoader width={100} height={32} borderRadius={16} />
        <SkeletonLoader width={80} height={16} />
      </View>
    </View>
  );
}

// Skeleton Profile
export function SkeletonProfile() {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);

  return (
    <View style={[styles.profileContainer, { backgroundColor: COLORS.card }]}>
      <SkeletonLoader width={100} height={100} borderRadius={50} style={{ marginBottom: 16 }} />
      <SkeletonLoader width={150} height={20} style={{ marginBottom: 8 }} />
      <SkeletonLoader width={120} height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
  },
});
