/**
 * Контекст уведомлений — WS + Background Fetch + локальные уведомления.
 *
 * Когда приложение открыто: WebSocket → мгновенные уведомления
 * Когда приложение в фоне: Background Fetch → проверка новых заявок → локальное уведомление
 */
import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import api from '../services/api';
import { connectWs, disconnectWs, onWsMessage } from '../services/wsService';
import { showLocalNotification } from '../services/notificationsService';
import { useAuth } from './AuthContext';

const BG_TASK = 'videoservice.background.fetch';

// Регистрируем фоновую задачу
TaskManager.defineTask(BG_TASK, async () => {
  try {
    // Запрашиваем новые заявки для текущего пользователя
    const res = await api.get('/orders/?status=assigned&limit=5');
    const orders = res.data.results || res.data || [];
    for (const o of orders) {
      await showLocalNotification(
        '🔧 Новая заявка',
        `#${o.number} — ${o.order_type_display || o.order_type}, ${o.address}`,
        { order_id: o.id },
      );
    }
    return orders.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e: any) {
    console.log('[BG] Fetch error:', e?.message);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

interface NotifContextType {}

const NotifContext = createContext<NotifContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const { user } = useAuth();

  // === WebSocket: подключаемся при старте ===
  useEffect(() => {
    if (!user) return;

    // Обработчик сообщений из WS
    onWsMessage((msg) => {
      showLocalNotification(msg.title, msg.body, msg.data);
    });

    connectWs();

    // Переподключаем WS при возврате из фона
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        connectWs();
      }
      if (nextState.match(/inactive|background/)) {
        // Не отключаем — пусть WS висит, ОС сама закроет
      }
      appState.current = nextState;
    });

    return () => {
      sub.remove();
      disconnectWs();
    };
  }, [user]);

  // === Background Fetch: регистрируем при старте ===
  useEffect(() => {
    if (!user) return;

    const registerBg = async () => {
      try {
        const status = await BackgroundFetch.getStatusAsync();
        if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
          console.log('[BG] Background fetch denied');
          return;
        }

        const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
        if (!isRegistered) {
          await BackgroundFetch.registerTaskAsync(BG_TASK, {
            minimumInterval: 15 * 60, // 15 минут минимум
            stopOnTerminate: false,
            startOnBoot: true,
          });
          console.log('[BG] Task registered');
        } else {
          console.log('[BG] Task already registered');
        }
      } catch (e: any) {
        console.log('[BG] Register error:', e?.message);
      }
    };

    registerBg();

    return () => {
      // Не анрегистрируем — пусть работает в фоне
    };
  }, [user]);

  return (
    <NotifContext.Provider value={{}}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error('useNotifications must be within NotificationsProvider');
  return ctx;
}
