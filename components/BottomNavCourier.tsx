import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { selection } from '../utils/haptics';
import { AnimatedTouchable } from './ui/PressableScale';

/**
 * Courier bottom navigation — 3 tabs mirroring BottomNavTech's floating bar
 * so the courier portal feels first-class, not secondary:
 *  - Available → the open delivery-task pool (realtime)
 *  - My Tasks  → accepted / in-progress / completed tasks
 *  - Account   → courier identity, vehicle, verification status, sign out
 */
type TabItem = {
  path: string;
  /** Segment matched against useSegments()[1] ('' = group root / index). */
  segment: string;
  icon: string;
  activeIcon: string;
  labelAr: string;
  labelEn: string;
};

const NAV_ITEMS: TabItem[] = [
  { path: '/(courier)',          segment: '',         icon: 'flash-outline',   activeIcon: 'flash',   labelAr: 'المتاحة',  labelEn: 'Available' },
  { path: '/(courier)/my-tasks', segment: 'my-tasks', icon: 'list-outline',    activeIcon: 'list',    labelAr: 'مهماتي',   labelEn: 'My Tasks' },
  { path: '/(courier)/profile',  segment: 'profile',  icon: 'person-outline',  activeIcon: 'person',  labelAr: 'حسابي',    labelEn: 'My Account' },
];

export default function BottomNavCourier() {
  const router = useRouter();
  const segments = useSegments();
  const currentSegment = ((segments as string[])[1] ?? '') as string;
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);

  const navItems = isRTL ? [...NAV_ITEMS].reverse() : NAV_ITEMS;
  const styles = makeStyles(COLORS, isDark);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.floatingBar}>
        {navItems.map((item) => {
          const isActive =
            currentSegment === item.segment ||
            (item.segment === '' && currentSegment === 'index');

          return (
            <AnimatedTouchable
              key={item.path}
              style={styles.navItem}
              onPress={() => {
                if (isActive) return;
                selection();
                router.replace(item.path as any);
              }}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel={isRTL ? item.labelAr : item.labelEn}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <Ionicons
                  name={(isActive ? item.activeIcon : item.icon) as any}
                  size={22}
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

/** Vertical space the floating bar occupies — for paddingBottom calculations. */
export const COURIER_NAV_HEIGHT = (Platform.OS === 'ios' ? 30 : 20) + 70 + 8;

const makeStyles = (C: any, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20,
  },
  floatingBar: {
    flexDirection: 'row',
    backgroundColor: C.card,
    width: '100%', height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 10,
    borderWidth: isDark ? 1 : 0,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 4 },
  iconWrapper: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20,
  },
  activeIconWrapper: { backgroundColor: C.primarySoft },
  activeDot: {
    position: 'absolute', bottom: -2,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: C.primary,
  },
  label: { fontSize: 12, color: C.textSecondary, marginTop: 2, fontWeight: '600' },
  activeLabel: { color: C.primary, fontWeight: '800' },
});
