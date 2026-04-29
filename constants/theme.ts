// Neumorphism Design System - Inspired by Web Version with Dark Mode Support

// Light Mode Colors
const LIGHT_COLORS = {
  primary: '#10B981',
  primaryLight: '#ECFDF5',
  primaryDark: '#059669',
  primaryForeground: '#FFFFFF',
  
  background: '#F3F4F6',
  surface: '#F3F4F6',
  card: '#F3F4F6',
  
  text: '#1F2937',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  foreground: '#1F2937',
  
  white: '#FFFFFF',
  black: '#000000',
  border: '#E5E7EB',
  input: '#E5E7EB',
  
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  blue: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F59E0B',
  
  gradientStart: '#10B981',
  gradientEnd: '#059669',
  
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadowDark: '#D1D5DB',
  shadowLight: '#FFFFFF',
};

// Dark Mode Colors
const DARK_COLORS = {
  primary: '#10B981',
  primaryLight: '#064E3B',
  primaryDark: '#34D399',
  primaryForeground: '#FFFFFF',
  
  background: '#111827',
  surface: '#1F2937',
  card: '#1F2937',
  
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textLight: '#6B7280',
  foreground: '#F9FAFB',
  
  white: '#FFFFFF',
  black: '#000000',
  border: '#374151',
  input: '#374151',
  
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  blue: '#60A5FA',
  purple: '#A78BFA',
  pink: '#F472B6',
  orange: '#FB923C',
  
  gradientStart: '#10B981',
  gradientEnd: '#059669',
  
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadowDark: '#000000',
  shadowLight: '#374151',
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
};

export const FONTS = {
  regular: 'Cairo_400Regular',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
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
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// Light Mode Shadows
const LIGHT_SHADOWS = {
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

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const ANIMATIONS = {
  duration: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
};
