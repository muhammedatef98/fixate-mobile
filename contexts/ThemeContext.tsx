import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, Platform } from 'react-native';
import { logger } from '../utils/logger';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof lightColors;
}

const lightColors = {
  primary: '#10b981',
  primaryDark: '#059669',
  background: '#ffffff',
  surface: '#f9fafb',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const darkColors = {
  primary: '#10b981',
  primaryDark: '#059669',
  background: '#111827',
  surface: '#1f2937',
  card: '#374151',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  border: '#4b5563',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = '@fixate_theme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    const effectiveTheme = themeMode === 'system' 
      ? (systemColorScheme || 'light')
      : themeMode;
    setTheme(effectiveTheme);
  }, [themeMode, systemColorScheme]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      logger.error('Error loading theme', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      logger.error('Error saving theme', error);
    }
  };

  // Android launcher icon follows the effective theme (iOS 18 handles this
  // natively via the light/dark icon variants in app.json). The change is
  // applied when the app goes to background so the launcher never kills us.
  // require() is lazy on purpose: the native module only exists in builds
  // that include it, and an OTA update reaching an older build must not
  // crash at import time.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const { setAppIcon, getAppIcon } = require('@howincodes/expo-dynamic-app-icon');
        const target = theme === 'dark' ? 'dark' : null;
        const current = await getAppIcon();
        if ((current === 'DEFAULT' ? null : current) !== target) {
          await setAppIcon(target);
        }
      } catch (error) {
        logger.error('Error switching app icon for theme', error);
      }
    })();
  }, [theme]);

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
