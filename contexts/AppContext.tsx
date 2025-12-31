import React, { createContext, useContext, useState, useEffect } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  // Default language is Arabic (RTL)
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('light');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
