import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';

/** Height of the bar without the safe-area inset; screens pad their lists by this. */
export const MARKET_TABS_HEIGHT = 60;

const TABS = [
  { path: '/market', icon: 'storefront-outline', iconActive: 'storefront', ar: 'السوق', en: 'Market' },
  { path: '/market-messages', icon: 'chatbubbles-outline', iconActive: 'chatbubbles', ar: 'الرسائل', en: 'Messages' },
  { path: '/my-listings', icon: 'pricetags-outline', iconActive: 'pricetags', ar: 'إعلاناتي', en: 'My listings' },
] as const;

export default function MarketBottomTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);

  return (
    <View
      style={[
        styles.bar,
        {
          height: MARKET_TABS_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      {TABS.map((t) => {
        const active = pathname === t.path;
        const color = active ? COLORS.primary : COLORS.textLight;
        return (
          <TouchableOpacity
            key={t.path}
            style={styles.tab}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => { if (!active) router.replace(t.path as any); }}
          >
            <Ionicons name={(active ? t.iconActive : t.icon) as any} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{isRTL ? t.ar : t.en}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({ android: { elevation: 8 }, default: {} }),
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '700' },
});
