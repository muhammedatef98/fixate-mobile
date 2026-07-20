import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BORDER_RADIUS } from '../constants/theme';

// Fixate service center — 26°32'41.5"N 50°01'15.4"E
const CENTER_LAT = 26.544861;
const CENTER_LNG = 50.020944;
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${CENTER_LAT},${CENTER_LNG}`;

interface ServiceCenterCardProps {
  isRTL: boolean;
  COLORS: any;
  /** Optional context line shown under the title. */
  subtitle?: string;
}

/**
 * Shows the Fixate service-center location with a CTA that opens Google Maps.
 * Used in the pickup / personal-handoff repair flow and after order completion.
 */
export default function ServiceCenterCard({
  isRTL,
  COLORS,
  subtitle,
}: ServiceCenterCardProps) {
  const styles = createStyles(COLORS, isRTL);

  const openMaps = () => {
    Linking.openURL(MAPS_URL).catch(() => undefined);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="storefront" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{isRTL ? 'عنوان مركزنا' : 'Our service center'}</Text>
          <Text style={styles.subtitle}>
            {subtitle ??
              (isRTL
                ? 'يمكنك تسليم واستلام جهازك من مركز Fixate'
                : 'Drop off and collect your device at the Fixate center')}
          </Text>
        </View>
      </View>

      <View style={styles.coordRow}>
        <Ionicons name="location-outline" size={15} color={COLORS.textSecondary} />
        <Text style={styles.coordText}>{'26°32\'41.5"N 50°01\'15.4"E'}</Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={openMaps} activeOpacity={0.85}>
        <Ionicons name="navigate" size={18} color="#fff" />
        <Text style={styles.ctaText}>
          {isRTL ? 'تفضل بزيارتنا في هذا الموقع' : 'Open in Google Maps'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg ?? 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      gap: 12,
    },
    headerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: (C.primary ?? '#10B981') + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: C.text,
      fontSize: 15,
      fontWeight: '800',
      textAlign: isRTL ? 'right' : 'left',
    },
    subtitle: {
      color: C.textSecondary ?? C.gray,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 17,
      textAlign: isRTL ? 'right' : 'left',
    },
    coordRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.background,
      borderRadius: BORDER_RADIUS.md ?? 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    coordText: {
      color: C.textSecondary ?? C.gray,
      fontSize: 12,
      fontWeight: '600',
    },
    cta: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary ?? '#10B981',
      borderRadius: BORDER_RADIUS.md ?? 12,
      paddingVertical: 13,
    },
    ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  });
