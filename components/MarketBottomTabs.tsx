import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { selection } from '../utils/haptics';

export const MARKET_TABS_HEIGHT = Platform.OS === 'ios' ? 100 : 90;

interface MarketTab {
  path: string;
  icon: string;
  activeIcon: string;
  labelAr: string;
  labelEn: string;
}

const MARKET_TABS: MarketTab[] = [
  { path: '/(customer)',      icon: 'home-outline',                activeIcon: 'home',               labelAr: 'الرئيسية',  labelEn: 'Home' },
  { path: '/market',          icon: 'storefront-outline',         activeIcon: 'storefront',         labelAr: 'السوق',     labelEn: 'Market' },
  { path: '/market-messages', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses', labelAr: 'الرسائل',   labelEn: 'Messages' },
  { path: '/my-listings',     icon: 'list-outline',               activeIcon: 'list',               labelAr: 'إعلاناتي', labelEn: 'My Listings' },
];

export default function MarketBottomTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);

  const tabs = isRTL ? [...MARKET_TABS].reverse() : MARKET_TABS;
  const styles = makeStyles(COLORS, isDark);

  // The root ScreenFrame (app/_layout.tsx) applies the Android bottom inset, so
  // this bar uses a plain fixed offset and is lifted above the system nav bar
  // by that frame. iOS keeps its existing 30px offset.
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.floatingBar}>
        {tabs.map((item) => {
          const isActive = pathname === item.path;

          return (
            <TouchableOpacity
              key={item.path}
              style={styles.navItem}
              onPress={() => { selection(); router.push(item.path as any); }}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={isRTL ? item.labelAr : item.labelEn}
              accessibilityState={{ selected: isActive }}
              accessibilityHint={isRTL ? 'انتقال إلى ' + item.labelAr : 'Navigate to ' + item.labelEn}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <Ionicons
                  name={(isActive ? item.activeIcon : item.icon) as any}
                  size={24}
                  color={isActive ? COLORS.primary : COLORS.textSecondary}
                />
                {isActive && <View style={styles.activeDot} />}
              </View>
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {isRTL ? item.labelAr : item.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C: any, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  floatingBar: {
    flexDirection: 'row',
    backgroundColor: C.card,
    width: '100%',
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    borderWidth: isDark ? 1 : 0,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  activeIconWrapper: {
    backgroundColor: C.primarySoft,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
  label: {
    fontSize: 10,
    color: C.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  activeLabel: {
    color: C.primary,
    fontWeight: 'bold',
  },
});
