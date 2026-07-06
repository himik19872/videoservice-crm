import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '../services/api';
import type { User } from '../types';

// Ленивый импорт — expo-notifications не работает в Expo Go с SDK 53+
let Notifications: any = null;
let Device: any = null;

const loadNotifications = async () => {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch {}
    return true;
  } catch {
    return false;
  }
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    restoreSession();
    setupNotifications();
    return () => {
      if (Notifications && notificationListener.current) {
        try { Notifications.removeNotificationSubscription(notificationListener.current); } catch {}
      }
      if (Notifications && responseListener.current) {
        try { Notifications.removeNotificationSubscription(responseListener.current); } catch {}
      }
    };
  }, []);

  const setupNotifications = async () => {
    const ok = await loadNotifications();
    if (!ok) return;
    if (!Device.isDevice) return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
    } catch { return; }

    try {
      notificationListener.current = Notifications.addNotificationReceivedListener((_event: any) => {});
      responseListener.current = Notifications.addNotificationResponseReceivedListener((_event: any) => {});
    } catch {}

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Заявки',
          importance: Notifications.AndroidImportance?.HIGH ?? 5,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      } catch {}
    }
  };

  const registerPushToken = async () => {
    if (!Notifications) return;
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await api.post('/push-tokens/', { token, platform: Platform.OS });
    } catch (e) {
      console.log('Push register error (ignored in Expo Go):', e);
    }
  };

  const restoreSession = async () => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/users/me/');
        setUser(res.data);
        await registerPushToken();
      } catch {
        await AsyncStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  };

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login/', { username, password });
    const { token, user: userData } = res.data;
    await AsyncStorage.setItem('token', token);
    setUser(userData);
    await registerPushToken();
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthContext');
  return ctx;
}
