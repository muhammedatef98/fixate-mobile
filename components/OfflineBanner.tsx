import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

/**
 * Treat a NetInfo state as offline only when we're SURE there's no
 * connectivity. The first event after app launch often has
 * `isInternetReachable: null` — the OS hasn't probed yet — and flashing
 * a red banner during that micro-window is alarming and incorrect.
 */
const isStateOffline = (state: NetInfoState): boolean => {
  if (state.isConnected === false) return true;
  if (state.isConnected && state.isInternetReachable === false) return true;
  return false; // null/undefined reachability → optimistic
};

export default function OfflineBanner() {
  const { language } = useApp();
  const isRTL = language === 'ar';

  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const slide = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = isStateOffline(state);
      setIsOffline((prev) => {
        if (prev !== offline) {
          Animated.timing(slide, {
            toValue: offline ? 0 : -80,
            duration: 260,
            useNativeDriver: true,
          }).start();
        }
        return offline;
      });
    });
    return () => unsub();
  }, [slide]);

  /**
   * Re-probe the network on demand. The whole banner is the tap target —
   * if connectivity is back, this collapses it instantly; otherwise the
   * banner stays put and we show a tiny "still offline" pulse so the
   * customer knows their tap was registered.
   */
  const probe = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const state = await NetInfo.refresh();
      const stillOffline = isStateOffline(state);
      setIsOffline(stillOffline);
      Animated.timing(slide, {
        toValue: stillOffline ? 0 : -80,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } finally {
      // Give the user a beat of feedback before clearing the checking
      // state, so a "still offline" tap doesn't look like a no-op.
      setTimeout(() => setChecking(false), 280);
    }
  }, [checking, slide]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slide }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={probe}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          isRTL ? 'لا يوجد اتصال بالإنترنت. اضغط لإعادة المحاولة' : 'No internet. Tap to retry'
        }
        style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <View style={styles.iconWrap}>
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="cloud-offline" size={18} color="#fff" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'لا يوجد اتصال بالإنترنت' : 'No internet connection'}
          </Text>
          <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {checking
              ? (isRTL ? 'جاري التحقق من الاتصال…' : 'Checking connection…')
              : (isRTL ? 'اضغط للتحقق من الاتصال' : 'Tap to check again')}
          </Text>
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color="rgba(255,255,255,0.85)"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 12,
    right: 12,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  row: { alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 13, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1 },
});
