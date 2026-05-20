import { StyleSheet } from 'react-native';

let _isRTL = true;

export function setTextDirection(isRTL: boolean) {
  _isRTL = isRTL;
}

export function getTajawalFamily(fw?: string | number | null): string {
  switch (String(fw ?? '').toLowerCase()) {
    case '500':
    case '600':
      return 'Tajawal_500Medium';
    case '700':
    case 'bold':
      return 'Tajawal_700Bold';
    case '800':
    case '900':
      return 'Tajawal_800ExtraBold';
    default:
      return 'Tajawal_400Regular';
  }
}

// no-op - font is now applied via fontFamily in StyleSheets directly
export function applyTajawalToText() {}
