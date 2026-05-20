import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationManager } from '../lib/notifications';
import { auth } from '../lib/supabase-api';

type Language = 'en' | 'ar';
type Theme = 'light' | 'dark';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LANG_KEY = '@fixate/lang';
const THEME_KEY = '@fixate/theme';

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Default language is Arabic (RTL). Loaded from AsyncStorage on mount so
  // a user's choice survives a restart — otherwise switching to English
  // would silently revert every time the app re-opens.
  const [language, setLanguageState] = useState<Language>('ar');
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    (async () => {
      try {
        const [savedLang, savedTheme] = await Promise.all([
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(THEME_KEY),
        ]);
        if (savedLang === 'ar' || savedLang === 'en') setLanguageState(savedLang);
        if (savedTheme === 'light' || savedTheme === 'dark') setThemeState(savedTheme);
      } catch {
        // Defaults are fine if storage is unavailable.
      }
    })();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_KEY, lang).catch(() => undefined);
  };
  const setTheme = (t: Theme) => {
    setThemeState(t);
    AsyncStorage.setItem(THEME_KEY, t).catch(() => undefined);
  };
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const isDark = theme === 'dark';

  useEffect(() => {
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    const user = await auth.getCurrentUser();
    if (user) {
      const token = await notificationManager.registerForPushNotificationsAsync();
      if (token) {
        await notificationManager.saveTokenToProfile(user.id, token);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        toggleTheme,
        isDark,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
