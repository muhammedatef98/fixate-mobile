// Neumorphism Design System - Inspired by Web Version with Dark Mode Support

// Neutral scale — single source of truth for greys. Used by the new design
// language so spacing/contrast stay consistent app-wide. Adding these is
// purely additive; existing keys below are preserved for back-compat.
const NEUTRAL = {
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E8ECF1',
  gray300: '#D9DFE7',
  gray400: '#B6BFCB',
  gray500: '#8A94A3',
  gray600: '#646E7E',
  gray700: '#48515E',
  gray800: '#2C333D',
  gray900: '#181D24',
};

// Light Mode Colors
const LIGHT_COLORS = {
  primary: '#10B981',
  primaryLight: '#ECFDF5',
  primaryDark: '#059669',
  primaryForeground: '#FFFFFF',
  // Soft brand tint for selected/active surfaces
  primarySoft: '#E7F7F0',

  // Background is a soft warm-cool neutral; cards are clean white so they
  // visibly lift off the page (the old theme made both #F3F4F6 — flat).
  background: '#F6F8FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  // A slightly tinted card for nested/secondary surfaces
  cardAlt: '#F1F4F8',
  cardElevated: '#FFFFFF',

  text: '#10151B',
  textSecondary: '#5B6573',
  textLight: '#9099A6',
  foreground: '#10151B',
  secondary: '#5B6573',
  disabled: '#D1D5DB',

  white: '#FFFFFF',
  black: '#000000',
  border: '#E8ECF1',
  borderStrong: '#D9DFE7',
  input: '#E8ECF1',

  success: '#16A34A',
  successSoft: '#E8F6EC',
  error: '#DC2626',
  errorSoft: '#FCEBEB',
  warning: '#D97706',
  warningSoft: '#FBF0E2',
  info: '#2563EB',
  infoSoft: '#E8F0FE',

  blue: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F59E0B',

  gradientStart: '#10B981',
  gradientEnd: '#059669',

  overlay: 'rgba(15, 23, 32, 0.45)',
  shadowDark: '#D1D5DB',
  shadowLight: '#FFFFFF',

  ...NEUTRAL,
};

// Dark Mode Colors
const DARK_COLORS = {
  primary: '#10B981',
  primaryLight: '#064E3B',
  primaryDark: '#34D399',
  primaryForeground: '#FFFFFF',
  primarySoft: '#0E3A30',

  // Modern slate dark — card lifts clearly off background.
  background: '#0F141A',
  surface: '#181F29',
  card: '#181F29',
  cardAlt: '#212A36',
  cardElevated: '#1E2630',

  text: '#F4F6F8',
  textSecondary: '#9AA5B4',
  textLight: '#6B7686',
  foreground: '#F4F6F8',
  secondary: '#9AA5B4',
  disabled: '#4B5563',

  white: '#FFFFFF',
  black: '#000000',
  border: '#283341',
  borderStrong: '#36424F',
  input: '#283341',

  success: '#22C55E',
  successSoft: '#10291B',
  error: '#F87171',
  errorSoft: '#2E1718',
  warning: '#FBBF24',
  warningSoft: '#2C2310',
  info: '#60A5FA',
  infoSoft: '#13233D',

  blue: '#60A5FA',
  purple: '#A78BFA',
  pink: '#F472B6',
  orange: '#FB923C',

  gradientStart: '#10B981',
  gradientEnd: '#059669',

  overlay: 'rgba(0, 0, 0, 0.7)',
  shadowDark: '#000000',
  shadowLight: '#374151',

  gray50: '#1A212B',
  gray100: '#1F2731',
  gray200: '#283341',
  gray300: '#36424F',
  gray400: '#4B5563',
  gray500: '#6B7686',
  gray600: '#9AA5B4',
  gray700: '#C2CAD4',
  gray800: '#E2E7EC',
  gray900: '#F4F6F8',
};

// Export function to get colors based on theme
export const getColors = (isDark: boolean) => isDark ? DARK_COLORS : LIGHT_COLORS;

// Default export (light mode for backward compatibility)
export const COLORS = LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  s: 8,
  sm: 8,
  m: 16,
  md: 16,
  l: 24,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// IBM Plex Sans Arabic is the brand font. See app/_layout.tsx — weights
// 400 Regular, 500 Medium, 600 SemiBold, and 700 Bold are loaded once at
// boot and applied as the default fontFamily on every Text and TextInput
// so individual screens don't need to set it. There is no 800 weight in
// IBM Plex Sans Arabic, so `extraBold` collapses to 700 Bold.
export const FONTS = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  extraBold: 'IBMPlexSansArabic_700Bold',
};

export const TYPOGRAPHY = {
  h1: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  h2: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 32,
  },
  h3: {
    fontFamily: FONTS.semibold,
    fontSize: 20,
    lineHeight: 28,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
};

export const BORDER_RADIUS = {
  sm: 8,
  s: 8,
  md: 12,
  m: 12,
  lg: 16,
  l: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// Light Mode Shadows
const LIGHT_SHADOWS = {
  neu: {
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 2,
  },
  neuPressed: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  neuFlat: {
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 2,
  },
  neuSmall: {
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 1,
  },
  neuInset: {
    shadowColor: '#000000',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  neuLarge: {
    shadowColor: '#D1D5DB',
    shadowOffset: { width: 12, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  primaryGlow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

// Dark Mode Shadows
const DARK_SHADOWS = {
  neu: {
    shadowColor: '#000000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 0,
  },
  neuPressed: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  neuFlat: {
    shadowColor: '#000000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 0,
  },
  neuSmall: {
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 0,
  },
  neuInset: {
    shadowColor: '#000000',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 1,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  neuLarge: {
    shadowColor: '#000000',
    shadowOffset: { width: 12, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  primaryGlow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
};

// Export function to get shadows based on theme
export const getShadows = (isDark: boolean) => isDark ? DARK_SHADOWS : LIGHT_SHADOWS;

// Default export (light mode for backward compatibility)
export const SHADOWS = LIGHT_SHADOWS;

export const ANIMATIONS = {
  duration: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
};
