import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Типы для офлайн-очереди
export interface PendingAction {
  id: string;
  method: 'PATCH' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  timestamp: number;
  description: string;
}

interface OfflineContextType {
  isOnline: boolean;
  pendingActions: PendingAction[];
  addPendingAction: (action: Omit<PendingAction, 'id' | 'timestamp'>) => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  syncPendingActions: () => Promise<{ success: number; failed: number }>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const PENDING_KEY = 'offline_pending_actions';

// Импорт api будет динамическим, чтобы избежать циклических зависимостей
let _api: any = null;

export function setOfflineApi(api: any) {
  _api = api;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Загружаем сохранённые действия при старте
    AsyncStorage.getItem(PENDING_KEY).then((val) => {
      if (val) {
        try {
          setPendingActions(JSON.parse(val));
        } catch {}
      }
    });

    // Подписываемся на изменения сети
    // NetInfo.addEventListener возвращает unsubscribe
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      // Авто-синхронизация при восстановлении связи
      if (online && pendingActions.length > 0) {
        syncPendingActions();
      }
    });
    unsubscribeRef.current = unsub;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const savePendingActions = async (actions: PendingAction[]) => {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(actions));
  };

  const addPendingAction = async (action: Omit<PendingAction, 'id' | 'timestamp'>) => {
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    const updated = [...pendingActions, newAction];
    setPendingActions(updated);
    await savePendingActions(updated);
  };

  const removePendingAction = async (id: string) => {
    const updated = pendingActions.filter((a) => a.id !== id);
    setPendingActions(updated);
    await savePendingActions(updated);
  };

  const syncPendingActions = async (): Promise<{ success: number; failed: number }> => {
    if (!_api) return { success: 0, failed: pendingActions.length };

    let success = 0;
    let failed = 0;
    const remaining: PendingAction[] = [...pendingActions];

    for (const action of pendingActions) {
      try {
        if (action.method === 'PATCH') {
          await _api.patch(action.url, action.body);
        } else if (action.method === 'POST') {
          await _api.post(action.url, action.body);
        } else if (action.method === 'PUT') {
          await _api.put(action.url, action.body);
        } else if (action.method === 'DELETE') {
          await _api.delete(action.url);
        }
        const idx = remaining.findIndex((a) => a.id === action.id);
        if (idx >= 0) remaining.splice(idx, 1);
        success++;
      } catch {
        failed++;
      }
    }

    setPendingActions(remaining);
    await savePendingActions(remaining);
    return { success, failed };
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingActions,
        addPendingAction,
        removePendingAction,
        syncPendingActions,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

// ═══ Утилиты для офлайн-кеша заявок ═══

const ORDERS_CACHE_KEY = 'offline_orders_cache';
const ORDERS_CACHE_TIME_KEY = 'offline_orders_cache_time';

/** Сохранить заявки локально */
export async function cacheOrders(orders: any[]) {
  await AsyncStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(orders));
  await AsyncStorage.setItem(ORDERS_CACHE_TIME_KEY, Date.now().toString());
}

/** Загрузить заявки из локального кеша */
export async function getCachedOrders(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(ORDERS_CACHE_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

/** Получить время последнего кеширования */
export async function getCacheTime(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(ORDERS_CACHE_TIME_KEY);
  return raw ? parseInt(raw, 10) : null;
}

/** Обновить одну заявку в кеше (офлайн-смена статуса) */
export async function updateCachedOrder(orderId: number, updates: Record<string, any>): Promise<any[]> {
  const orders = await getCachedOrders();
  const idx = orders.findIndex((o: any) => o.id === orderId);
  if (idx >= 0) {
    orders[idx] = { ...orders[idx], ...updates, _offline_updated: true };
    await cacheOrders(orders);
  }
  return orders;
}

/** Сохранить одну заявку в кеш (после загрузки) */
export async function cacheSingleOrder(order: any) {
  const orders = await getCachedOrders();
  const idx = orders.findIndex((o: any) => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = { ...orders[idx], ...order, _offline_updated: false };
  } else {
    orders.unshift(order);
  }
  await cacheOrders(orders);
}

export function useOffline(): OfflineContextType {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
