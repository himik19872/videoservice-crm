import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  primary: string;
  inputBg: string;
  headerBg: string;
  headerTint: string;
  statusBar: 'dark' | 'light';
  danger: string;
  success: string;
  warning: string;
  chipBg: string;
  chipActiveBg: string;
  overlay: string;
}

export const lightTheme: ThemeColors = {
  background: '#f0f2f5',
  card: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  border: '#d9d9d9',
  primary: '#1677ff',
  inputBg: '#ffffff',
  headerBg: '#1677ff',
  headerTint: '#ffffff',
  statusBar: 'dark' as const,
  danger: '#ff4d4f',
  success: '#52c41a',
  warning: '#fa8c16',
  chipBg: '#ffffff',
  chipActiveBg: '#1677ff',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkTheme: ThemeColors = {
  background: '#141414',
  card: '#1f1f1f',
  text: '#e8e8e8',
  textSecondary: '#a0a0a0',
  textTertiary: '#666666',
  border: '#333333',
  primary: '#1677ff',
  inputBg: '#2a2a2a',
  headerBg: '#1a1a2e',
  headerTint: '#ffffff',
  statusBar: 'light' as const,
  danger: '#ff4d4f',
  success: '#52c41a',
  warning: '#fa8c16',
  chipBg: '#2a2a2a',
  chipActiveBg: '#1677ff',
  overlay: 'rgba(0,0,0,0.7)',
};

interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'theme_preference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === 'dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val !== null) {
        setIsDark(val === 'dark');
      }
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
