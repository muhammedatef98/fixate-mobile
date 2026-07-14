import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { selection } from '../utils/haptics';
import { AnimatedTouchable } from './ui/PressableScale';

/**
 * Geometry of the floating nav bar, exported so anything that has to sit
 * relative to it (e.g. the home smart-assistant FAB) anchors off the real
 * numbers instead of re-deriving them by hand and silently drifting.
 *
 *   BOTTOM_NAV_TOP = distance from the parent's bottom padding edge to the
 *   TOP of the bar. Park a floating element at BOTTOM_NAV_TOP + gap to sit
 *   just above the bar without overlapping it.
 *
 * BOTTOM_NAV_SIDE_INSET matches the bar's own horizontal inset, so a FAB
 * pinned to it lines up flush with the bar's edge.
 */
export const BOTTOM_NAV_BAR_HEIGHT = 70;
export const BOTTOM_NAV_BOTTOM_OFFSET = Platform.OS === 'ios' ? 30 : 20;
export const BOTTOM_NAV_TOP = BOTTOM_NAV_BOTTOM_OFFSET + BOTTOM_NAV_BAR_HEIGHT;
export const BOTTOM_NAV_SIDE_INSET = 20;

const NAV_ITEMS = [
  { path: '/(customer)', icon: 'home-outline', activeIcon: 'home', labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/services', icon: 'construct-outline', activeIcon: 'construct', labelAr: 'الخدمات', labelEn: 'Services' },
  { path: '/market', icon: 'storefront-outline', activeIcon: 'storefront', labelAr: 'السوق', labelEn: 'Market' },
  { path: '/profile', icon: 'person-outline', activeIcon: 'person', labelAr: 'حسابي', labelEn: 'Profile' },
];

interface BottomNavProps {
  currentRoute?: string;
  /**
   * Floating element parked directly above the bar, on its trailing edge (the
   * home screen's smart-assistant puck). It renders INSIDE this component's
   * container — the same box the bar itself lives in — so the two are laid out
   * against one shared origin. A caller positioning it from the outside has to
   * re-derive the bar's offset against its own parent, and any padding that
   * parent applies (a SafeAreaView inset, a screen frame) silently pushes the
   * two apart. Passing it in makes that impossible.
   */
  above?: React.ReactNode;
}

/** Air between the `above` accessory and the bar's top edge. */
export const BOTTOM_NAV_ACCESSORY_GAP = 6;

export default function BottomNav({ above }: BottomNavProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);

  const navItems = isRTL ? [...NAV_ITEMS].reverse() : NAV_ITEMS;
  const styles = makeStyles(COLORS, isDark);

  // The root ScreenFrame (app/_layout.tsx) applies the Android bottom inset, so
  // this bar uses a plain fixed offset; on Android it is lifted above the
  // system nav bar by that frame. iOS keeps its existing 30px offset.
  return (
    <View style={styles.container} pointerEvents="box-none">
      {above ? (
        <View
          style={[
            styles.accessory,
            { alignSelf: isRTL ? 'flex-start' : 'flex-end' },
          ]}
        >
          {above}
        </View>
      ) : null}
      <View style={styles.floatingBar}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path === '/(customer)' && pathname === '/');

          return (
            <AnimatedTouchable
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
              <Text style={[styles.label, isActive && styles.activeLabel]} numberOfLines={1}>
                {isRTL ? item.labelAr : item.labelEn}
              </Text>
            </AnimatedTouchable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C: any, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: BOTTOM_NAV_BOTTOM_OFFSET,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BOTTOM_NAV_SIDE_INSET,
  },
  accessory: {
    marginBottom: BOTTOM_NAV_ACCESSORY_GAP,
  },
  floatingBar: {
    flexDirection: 'row',
    backgroundColor: C.card,
    width: '100%',
    height: BOTTOM_NAV_BAR_HEIGHT,
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
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  activeLabel: {
    color: C.primary,
    fontWeight: 'bold',
  },
});
