import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { getPlatformSettings } from '../services/platformSettingsService';
import { logger } from '../utils/logger';

const DISMISS_KEY = 'announcement_dismissed_sig';

/**
 * Admin-managed announcement banner. Reads the announcement from platform
 * settings and shows the localized text when enabled. Dismissal is keyed by
 * the announcement content, so editing the message re-shows it to everyone
 * who dismissed the previous one. Renders nothing when disabled/empty.
 */
export default function AnnouncementBanner() {
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const C = getColors(isDark);

  const [text, setText] = useState('');
  const [sig, setSig] = useState('');
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getPlatformSettings();
        const msg = (isRTL ? s.announcementAr : s.announcementEn)?.trim() ?? '';
        if (!alive) return;
        if (!s.announcementEnabled || !msg) {
          setDismissed(true);
          return;
        }
        // Signature spans both languages so switching language doesn't
        // resurrect a banner the user already dismissed.
        const signature = `${s.announcementAr}|${s.announcementEn}`;
        const prev = await AsyncStorage.getItem(DISMISS_KEY);
        if (!alive) return;
        setText(msg);
        setSig(signature);
        setDismissed(prev === signature);
      } catch (e) {
        logger.warn('announcement load failed', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isRTL]);

  const onDismiss = async () => {
    setDismissed(true);
    try {
      await AsyncStorage.setItem(DISMISS_KEY, sig);
    } catch (e) {
      logger.warn('announcement dismiss persist failed', e);
    }
  };

  if (dismissed || !text) return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: C.primary + '14', borderColor: C.primary + '33', flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <MaterialCommunityIcons name="bullhorn-variant-outline" size={20} color={C.primary} />
      <Text style={[styles.text, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'إغلاق' : 'Dismiss'}
      >
        <MaterialCommunityIcons name="close" size={18} color={C.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginHorizontal: SPACING.m,
    marginTop: SPACING.s,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
