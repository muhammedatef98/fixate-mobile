import React from 'react';
import { View, ScrollView, StatusBar, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { getColors, SPACING } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface ScreenProps {
  children: React.ReactNode;
  /** Wrap children in a ScrollView (default true). */
  scroll?: boolean;
  /** Apply the standard 16px horizontal page padding (default true). */
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Extra bottom padding so content clears floating bottom navs. */
  bottomInset?: number;
  /**
   * Which safe-area edges to inset. Defaults to top + bottom so content never
   * sits flush against the Android status bar or gesture/nav bar. Screens that
   * own their bottom bar can pass `['top']`, etc.
   */
  edges?: readonly Edge[];
}

/**
 * Standard screen container: themed background, status bar, consistent
 * horizontal padding (16px) and safe-area insets. Use to stop every screen
 * re-implementing SafeAreaView + ScrollView + padding by hand.
 *
 * Uses react-native-safe-area-context (NOT react-native's SafeAreaView, which
 * is a no-op on Android) so top/bottom insets are correct on Android too. The
 * bottom system-bar inset is applied to the scroll content (so short pages
 * still clear the Android nav bar) on top of any `bottomInset` for floating
 * tab bars.
 */
export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  bottomInset = 0,
  edges = ['top', 'bottom'],
}) => {
  const { isDark } = useApp();
  const C = getColors(isDark);
  const insets = useSafeAreaInsets();

  // When the SafeAreaView is NOT insetting the bottom edge itself, fold the
  // bottom system inset into the scroll content so content always clears the
  // Android nav bar. Avoids double-counting when `bottom` is in `edges`.
  const bottomSafe = edges.includes('bottom') ? 0 : insets.bottom;

  const inner: ViewStyle = {
    paddingHorizontal: padded ? SPACING.m : 0,
    paddingBottom: bottomInset + bottomSafe,
  };

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: C.background }, style]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.background} />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[inner, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({});
export default Screen;
