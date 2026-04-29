import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

export default function OfflineBanner() {
  const { language } = useApp();
  const isRTL = language === 'ar';
  const [isOffline, setIsOffline] = useState(false);
  const slide = useState(new Animated.Value(-60))[0];

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      Animated.timing(slide, {
        toValue: offline ? 0 : -60,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => unsub();
  }, [slide]);

  const retry = async () => {
    const state = await NetInfo.refresh();
    setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
  };

  if (!isOffline && (slide as any)._value < 0) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slide }] }]}>
      <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="cloud-offline" size={18} color="#fff" />
        <Text style={styles.text}>
          {isRTL ? 'لا يوجد اتصال بالإنترنت' : 'You are offline'}
        </Text>
        <TouchableOpacity
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'إعادة المحاولة' : 'Retry'}
        >
          <Text style={styles.retry}>{isRTL ? 'إعادة' : 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 9999,
    elevation: 10,
  },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  text: { color: '#fff', flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  retry: { color: '#fff', fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
});
