/**
 * MarketBottomTabs.tsx — Bottom navigation bar for the marketplace screens.
 * Rendered as a floating bar at the bottom of market-related screens so
 * users can jump between the main marketplace views without going back.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';

/** Height consumed by the tab bar — screens should pad their content by this. */
export const MARKET_TABS_HEIGHT = 64;

interface Tab {
  route: string;
  iconActive: React.ReactNode;
  iconInactive: React.ReactNode;
  labelAr: string;
  labelEn: string;
}

export default function MarketBottomTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const tabs: Tab[] = [
    {
      route: '/market',
      iconActive: <Ionicons name="storefront" size={22} color={COLORS.primary} />,
      iconInactive: <Ionicons name="storefront-outline" size={22} color={COLORS.textSecondary} />,
      labelAr: 'السوق',
      labelEn: 'Market',
    },
    {
      route: '/market-messages',
      iconActive: <MaterialCommunityIcons name="message-text" size={22} color={COLORS.primary} />,
      iconInactive: <MaterialCommunityIcons name="message-text-outline" size={22} color={COLORS.textSecondary} />,
      labelAr: 'الرسائل',
      labelEn: 'Messages',
    },
    {
      route: '/my-listings',
      iconActive: <Ionicons name="list" size={22} color={COLORS.primary} />,
      iconInactive: <Ionicons name="list-outline" size={22} color={COLORS.textSecondary} />,
      labelAr: 'إعلاناتي',
      labelEn: 'My Listings',
    },
  ];

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.route || pathname.startsWith(tab.route + '/');
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={isRTL ? tab.labelAr : tab.labelEn}
          >
            {active ? tab.iconActive : tab.iconInactive}
            <Text
              style={[
                styles.label,
                { color: active ? COLORS.primary : COLORS.textSecondary },
              ]}
            >
              {isRTL ? tab.labelAr : tab.labelEn}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MARKET_TABS_HEIGHT,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 8 : 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
});
