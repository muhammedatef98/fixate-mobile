import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { selection } from '../utils/haptics';
import { AnimatedTouchable } from './ui/PressableScale';

/**
 * Technician bottom navigation — 4 tabs, deliberately small.
 *
 * Why these four:
 *  - Home       → daily dashboard, status toggle, latest activity
 *  - Requests   → available-orders (jobs to pick up)
 *  - Jobs       → my-orders (jobs the technician has accepted/owns)
 *  - Profile    → identity, earnings/commission, ratings, settings
 *
 * Earnings is intentionally NOT a tab — it lives inside the profile under
 * the "Earnings & Commission" section so the bar stays focused on the
 * technician's daily action loop (find work → do work → me).
 */
type TabItem = {
  path: string;
  /** Segment used for active-state detection — matches what useSegments
   *  returns at index 1 (empty string = group root / index screen). */
  segment: string;
  icon: string;
  activeIcon: string;
  labelAr: string;
  labelEn: string;
};

// Four tabs, deliberately non-overlapping:
//   Home    → daily dashboard + status toggle (also has Available/Mine toggle
//             for the technician's quick-glance "what's open vs. mine" view,
//             so a dedicated Requests tab would duplicate that surface).
//   Jobs    → focused list of the technician's accepted/in-progress work.
//   Chats   → customer conversations across jobs — high-value standalone
//             surface where mid-job communication actually happens.
//   Profile → identity, ratings, settings.
const NAV_ITEMS: TabItem[] = [
  { path: '/(technician)',          segment: '',          icon: 'grid-outline',         activeIcon: 'grid',         labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/(technician)/my-orders', segment: 'my-orders', icon: 'briefcase-outline',    activeIcon: 'briefcase',    labelAr: 'أعمالي',   labelEn: 'Jobs' },
  { path: '/(technician)/chats',    segment: 'chats',     icon: 'chatbubbles-outline',  activeIcon: 'chatbubbles',  labelAr: 'محادثات',  labelEn: 'Chats' },
  { path: '/(technician)/profile',  segment: 'profile',   icon: 'person-outline',       activeIcon: 'person',       labelAr: 'حسابي',    labelEn: 'Profile' },
];

export default function BottomNavTech(_props: { currentRoute?: string } = {}) {
  const router = useRouter();
  const segments = useSegments();
  // segments[1] is the child route inside the (technician) group, or
  // undefined when we're on the group's index. Match against the tab's
  // `segment` (which we control) instead of comparing pathnames — the
  // pathname approach failed because expo-router 6 strips group prefixes
  // from URLs, so '/profile' would never equal '/(technician)/profile'.
  const currentSegment = ((segments as string[])[1] ?? '') as string;
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const COLORS = getColors(isDark);

  // RTL: first logical tab (Home) lands on the right edge — matches the
  // customer BottomNav and the new market tab bar.
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
              <Text
                style={[styles.label, isActive && styles.activeLabel]}
                numberOfLines={1}
              >
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
export const TECH_NAV_HEIGHT =
  (Platform.OS === 'ios' ? 30 : 20) + 70 + 8;

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
  label: { fontSize: 10.5, color: C.textSecondary, marginTop: 2, fontWeight: '600' },
  activeLabel: { color: C.primary, fontWeight: '800' },
});
