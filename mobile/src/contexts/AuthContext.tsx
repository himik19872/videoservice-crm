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
  const notifReady = useRef(false);

  useEffect(() => {
    initApp();
    return () => {
      if (Notifications && notificationListener.current) {
        try { Notifications.removeNotificationSubscription(notificationListener.current); } catch {}
      }
      if (Notifications && responseListener.current) {
        try { Notifications.removeNotificationSubscription(responseListener.current); } catch {}
      }
    };
  }, []);

  // Последовательная инициализация: сначала нотификации, потом сессия
  const initApp = async () => {
    await setupNotifications();
    await restoreSession();
  };

  const setupNotifications = async () => {
    const ok = await loadNotifications();
    if (!ok) {
      console.log('[Push] expo-notifications not available');
      return;
    }

    // Проверяем, что это физическое устройство (не эмулятор/Expo Go)
    try {
      if (!Device.isDevice) {
        console.log('[Push] Not a physical device, skipping push setup');
        return;
      }
    } catch (e) {
      console.log('[Push] Device check failed:', e);
      return;
    }

    // Запрашиваем разрешение на уведомления
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('[Push] Permission denied');
          return;
        }
      }
    } catch (e) {
      console.log('[Push] Permission error:', e);
      return;
    }

    // Настраиваем канал для Android
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Заявки',
          importance: Notifications.AndroidImportance?.HIGH ?? 5,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      } catch (e) {
        console.log('[Push] Channel error:', e);
      }
    }

    // Слушатели уведомлений
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(
        (notification: any) => {
          console.log('[Push] Received:', notification?.request?.content?.title);
        }
      );
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response: any) => {
          console.log('[Push] Tapped:', response?.notification?.request?.content?.title);
        }
      );
    } catch (e) {
      console.log('[Push] Listener error:', e);
    }

    notifReady.current = true;
    console.log('[Push] Setup complete, ready to register token');
  };

  const registerPushToken = async () => {
    if (!notifReady.current || !Notifications) {
      console.log('[Push] Not ready, skipping token registration');
      return;
    }
    try {
      const expoPushToken = await Notifications.getExpoPushTokenAsync();
      const token = expoPushToken.data;
      console.log('[Push] Token obtained:', token.slice(0, 20) + '...');
      await api.post('/push-tokens/', { token, platform: Platform.OS });
      console.log('[Push] Token registered on server');
    } catch (e: any) {
      console.log('[Push] Register error:', e?.message || e);
    }
  };

  const restoreSession = async () => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/users/me/');
        setUser(res.data);
        // Теперь notifReady гарантированно true — setupNotifications уже завершился
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
    // При входе тоже регистрируем токен (setup уже должен быть готов)
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
