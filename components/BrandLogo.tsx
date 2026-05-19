import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface BrandLogoProps {
  brandId: string;
  /** Used for a clean monogram when the brand has no dedicated mark. */
  name?: string;
  size?: number;
}

// Brand chip definitions: solid brand colour + a wordmark or vector icon.
// Keyed by the *base* brand id (suffixes like -tablet/-laptop/-watch are
// stripped first), so every device category renders consistently.
type Chip = { bg: string; fg: string; text?: string; icon?: string; weight?: any };

const BRAND_CHIPS: Record<string, Chip> = {
  apple: { bg: '#000000', fg: '#FFFFFF', icon: 'apple' },
  samsung: { bg: '#1428A0', fg: '#FFFFFF', text: 'SAMSUNG' },
  huawei: { bg: '#CF0A2C', fg: '#FFFFFF', text: 'HUAWEI' },
  xiaomi: { bg: '#FF6900', fg: '#FFFFFF', text: 'MI', weight: '800' },
  redmi: { bg: '#FF6900', fg: '#FFFFFF', text: 'Redmi' },
  poco: { bg: '#FFD500', fg: '#000000', text: 'POCO', weight: '800' },
  oppo: { bg: '#00A368', fg: '#FFFFFF', text: 'OPPO' },
  vivo: { bg: '#415FFF', fg: '#FFFFFF', text: 'vivo' },
  realme: { bg: '#FFC915', fg: '#000000', text: 'realme' },
  oneplus: { bg: '#EB0029', fg: '#FFFFFF', text: '1+', weight: '800' },
  nokia: { bg: '#124191', fg: '#FFFFFF', text: 'NOKIA' },
  motorola: { bg: '#000000', fg: '#FFFFFF', icon: 'alpha-m-circle' },
  sony: { bg: '#000000', fg: '#FFFFFF', text: 'SONY' },
  lg: { bg: '#A50034', fg: '#FFFFFF', text: 'LG', weight: '800' },
  google: { bg: '#1A73E8', fg: '#FFFFFF', icon: 'google' },
  honor: { bg: '#0A6CFF', fg: '#FFFFFF', text: 'HONOR' },
  infinix: { bg: '#1FB25A', fg: '#FFFFFF', text: 'Infinix' },
  tecno: { bg: '#0A4DA1', fg: '#FFFFFF', text: 'TECNO' },
  nothing: { bg: '#000000', fg: '#FFFFFF', icon: 'circle-outline' },
  zte: { bg: '#0046BE', fg: '#FFFFFF', text: 'ZTE', weight: '800' },
  lenovo: { bg: '#E2001A', fg: '#FFFFFF', text: 'Lenovo', weight: '700' },
  hp: { bg: '#0096D6', fg: '#FFFFFF', text: 'hp', weight: '800' },
  dell: { bg: '#0085C3', fg: '#FFFFFF', text: 'DELL', weight: '800' },
  asus: { bg: '#000000', fg: '#FFFFFF', text: 'ASUS', weight: '800' },
  acer: { bg: '#83B81A', fg: '#FFFFFF', text: 'acer', weight: '700' },
  msi: { bg: '#000000', fg: '#FF0000', text: 'MSI', weight: '800' },
  microsoft: { bg: '#0067B8', fg: '#FFFFFF', icon: 'microsoft' },
  razer: { bg: '#000000', fg: '#44D62C', icon: 'snake' },
  gigabyte: { bg: '#E60012', fg: '#FFFFFF', text: 'GB', weight: '800' },
  canon: { bg: '#CC0000', fg: '#FFFFFF', text: 'Canon', weight: '700' },
  epson: { bg: '#003DA5', fg: '#FFFFFF', text: 'EPSON', weight: '700' },
  brother: { bg: '#FFD100', fg: '#000000', text: 'Brother', weight: '700' },
  // Gaming
  playstation: { bg: '#0070D1', fg: '#FFFFFF', icon: 'sony-playstation' },
  xbox: { bg: '#107C10', fg: '#FFFFFF', icon: 'microsoft-xbox' },
  nintendo: { bg: '#E60012', fg: '#FFFFFF', icon: 'nintendo-switch' },
  steam: { bg: '#1B2838', fg: '#FFFFFF', icon: 'steam' },
  // Wearables
  garmin: { bg: '#000000', fg: '#FFFFFF', text: 'GARMIN', weight: '700' },
  amazfit: { bg: '#16A34A', fg: '#FFFFFF', text: 'Amazfit', weight: '700' },
  fitbit: { bg: '#00B0B9', fg: '#FFFFFF', icon: 'heart-pulse' },
};

// Strip device-category suffixes so apple-watch / samsung-laptop / etc.
// resolve to the same branded chip as the phone entry.
const baseId = (id: string) =>
  id.replace(/-(tablet|laptop|watch|printer|phone|gaming|accessories)$/g, '');

const MONOGRAM_COLORS = [
  '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899',
  '#F59E0B', '#10B981', '#14B8A6', '#EF4444',
];

const monogram = (name: string) => {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const colorFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return MONOGRAM_COLORS[h % MONOGRAM_COLORS.length];
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ brandId, name, size = 56 }) => {
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2.6,
  };

  const chip = BRAND_CHIPS[baseId(brandId)] ?? BRAND_CHIPS[brandId];

  if (chip) {
    return (
      <View style={[styles.center, box, { backgroundColor: chip.bg }]}>
        {chip.icon ? (
          <MaterialCommunityIcons name={chip.icon as any} size={size * 0.58} color={chip.fg} />
        ) : (
          <Text
            numberOfLines={1}
            style={{
              color: chip.fg,
              fontWeight: chip.weight ?? '700',
              fontSize: size * (chip.text && chip.text.length > 4 ? 0.2 : 0.34),
              letterSpacing: 0.3,
            }}
          >
            {chip.text}
          </Text>
        )}
      </View>
    );
  }

  // Clean monogram fallback — never a broken/gray placeholder.
  const label = name ? monogram(name) : brandId.slice(0, 2).toUpperCase();
  const tint = colorFor(name || brandId);
  return (
    <View style={[styles.center, box, { backgroundColor: tint + '1F' }]}>
      <Text style={{ color: tint, fontWeight: '800', fontSize: size * 0.34 }}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

export default BrandLogo;
