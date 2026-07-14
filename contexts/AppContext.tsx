import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTextDirection } from '../utils/applyFont';

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

  // Keep the global text-direction flag in step with the language. The <Text> /
  // <TextInput> wrappers in utils/applyFont read it to decide default alignment
  // and caret side, and they render as part of this same pass — so it is set
  // during render, not in an effect, which would leave the first frame (and
  // every frame right after a language switch) aligned the old way.
  setTextDirection(language === 'ar');

  // Push-token registration now lives in AuthContext (fires reliably once the
  // user is authenticated, on every launch) — see registerPushForUser there.

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
