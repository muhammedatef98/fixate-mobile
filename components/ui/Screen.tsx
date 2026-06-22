import React from 'react';
import { View, ScrollView, StatusBar, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  /** Extra bottom padding so content clears bottom navs. */
  bottomInset?: number;
}

/**
 * Standard screen container: themed background, status bar, consistent
 * horizontal padding (16px) and bottom inset. Use to stop every screen
 * re-implementing SafeAreaView + ScrollView + padding by hand.
 */
export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  bottomInset = 0,
}) => {
  const { isDark } = useApp();
  const C = getColors(isDark);

  const inner: ViewStyle = {
    paddingHorizontal: padded ? SPACING.m : 0,
    paddingBottom: bottomInset,
  };

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: C.background }, style]}>
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
