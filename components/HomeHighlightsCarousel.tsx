import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

/**
 * Auto-rotating, swipeable highlights strip for the customer home (§13). Cycles
 * app value-props every few seconds, pauses briefly after a manual swipe, and
 * shows dot indicators. Icon-led premium slides (no bundled imagery) so it
 * stays self-contained and theme-aware.
 */
interface Slide {
  icon: string;
  color: string;
  titleAr: string;
  titleEn: string;
  subAr: string;
  subEn: string;
}

const SLIDES: Slide[] = [
  { icon: 'flash', color: '#10B981', titleAr: 'إصلاح سريع', titleEn: 'Fast repair', subAr: 'فنيون معتمدون يصلحون جهازك بسرعة', subEn: 'Verified technicians fix your device fast' },
  { icon: 'moped', color: '#3B82F6', titleAr: 'استلام حتى بابك', titleEn: 'Doorstep pickup', subAr: 'مندوبنا يستلم الجهاز ويعيده إليك', subEn: 'A courier collects and returns your device' },
  { icon: 'shield-check', color: '#8B5CF6', titleAr: 'ضمان سنة كاملة', titleEn: '1-year warranty', subAr: 'كل إصلاح مضمون لمدة 365 يوماً', subEn: 'Every repair guaranteed for 365 days' },
  { icon: 'account-check', color: '#F59E0B', titleAr: 'فنيون موثّقون', titleEn: 'Vetted technicians', subAr: 'كل فني يُعتمد ويُقيَّم بعد كل طلب', subEn: 'Every technician is vetted and rated' },
  { icon: 'map-marker-path', color: '#EC4899', titleAr: 'تتبّع لحظي', titleEn: 'Live tracking', subAr: 'تابع حالة جهازك في كل مرحلة', subEn: 'Follow your device at every stage' },
];

const ROTATE_MS = 4200;
const PADDING_H = SPACING.m;

export default function HomeHighlightsCarousel() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { width } = useWindowDimensions();
  const cardWidth = width - PADDING_H * 2;

  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const pausedUntil = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        // scrollToIndex handles RTL horizontal lists correctly (offset math
        // inverts under RTL). Guard against the rare layout-not-ready failure.
        try {
          listRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {
          /* layout not ready — the next tick will catch up */
        }
        return next;
      });
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [cardWidth]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setIndex(i);
    // Pause auto-advance briefly so a manual swipe isn't yanked away.
    pausedUntil.current = Date.now() + 6000;
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        // RTL: run the strip right-to-left. The app never flips I18nManager (it
        // would reverse English on an Arabic device), so a horizontal list stays
        // physically LTR — slide 1 on the left, advancing leftwards — which reads
        // backwards in Arabic. `inverted` flips the scroll axis only; RN
        // counter-transforms each cell, so the cards themselves are not mirrored.
        inverted={isRTL}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={onScrollEnd}
        onScrollToIndexFailed={() => {}}
        getItemLayout={(_, i) => ({ length: cardWidth, offset: cardWidth * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <View style={[styles.card, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: item.color + '1A' }]}>
                <MaterialCommunityIcons name={item.icon as any} size={26} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  {isRTL ? item.titleAr : item.titleEn}
                </Text>
                <Text style={[styles.sub, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                  {isRTL ? item.subAr : item.subEn}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
      {/* Dots follow the strip's direction — with an inverted (RTL) list the
          first slide lives on the right, so the first dot must too. */}
      <View style={[styles.dots, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === index ? COLORS.primary : COLORS.border, width: i === index ? 18 : 6 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    minHeight: 88,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 12 },
  dot: { height: 6, borderRadius: 3 },
});
