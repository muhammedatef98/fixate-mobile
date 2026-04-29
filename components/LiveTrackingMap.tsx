import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, BORDER_RADIUS } from '../constants/theme';
import { subscribeToTechnicianLocation, TechnicianLocation } from '../services/locationTrackingService';

interface Props {
  orderId: string;
  customerLat?: number;
  customerLng?: number;
  height?: number;
}

export default function LiveTrackingMap({ orderId, customerLat, customerLng, height = 240 }: Props) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const [techLoc, setTechLoc] = useState<TechnicianLocation | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const unsub = subscribeToTechnicianLocation(orderId, (loc) => setTechLoc(loc));
    return unsub;
  }, [orderId]);

  useEffect(() => {
    if (!mapRef.current || !techLoc || !customerLat || !customerLng) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: techLoc.latitude, longitude: techLoc.longitude },
        { latitude: customerLat, longitude: customerLng },
      ],
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
    );
  }, [techLoc?.latitude, techLoc?.longitude, customerLat, customerLng]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.placeholder, { backgroundColor: COLORS.card, height }]}>
        <Text style={{ color: COLORS.textSecondary }}>
          {isRTL ? 'الخريطة غير متاحة على المتصفح' : 'Map not available on web'}
        </Text>
      </View>
    );
  }

  if (!techLoc) {
    return (
      <View style={[styles.placeholder, { backgroundColor: COLORS.card, height, borderColor: COLORS.border }]}>
        <MaterialCommunityIcons name="map-marker-radius" size={36} color={COLORS.textSecondary} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' }}>
          {isRTL ? 'بانتظار إشارة موقع الفني...' : 'Waiting for technician location...'}
        </Text>
      </View>
    );
  }

  const initialRegion = {
    latitude: techLoc.latitude,
    longitude: techLoc.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={[styles.wrap, { height, borderColor: COLORS.border }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
      >
        <Marker
          coordinate={{ latitude: techLoc.latitude, longitude: techLoc.longitude }}
          title={isRTL ? 'الفني' : 'Technician'}
          pinColor="green"
        />
        {customerLat && customerLng && (
          <Marker
            coordinate={{ latitude: customerLat, longitude: customerLng }}
            title={isRTL ? 'موقعك' : 'You'}
            pinColor="red"
          />
        )}
      </MapView>
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>{isRTL ? 'مباشر' : 'LIVE'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  placeholder: {
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
