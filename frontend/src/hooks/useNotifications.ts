import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Хук для получения push-уведомлений через WebSocket.
 * При получении уведомления показывает браузерный Notification
 * и поддерживает переход по клику на заявку/клиента.
 */
export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user || isConnecting.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnecting.current = true;
    const token = localStorage.getItem('token');
    if (!token) { isConnecting.current = false; return; }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/notifications/?token=${token}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to notifications');
        isConnecting.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'notification') {
            showBrowserNotification(msg.title, msg.body, msg.data, navigate);
          }
        } catch {}
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 5s...');
        isConnecting.current = false;
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      isConnecting.current = false;
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    // Запрашиваем разрешение на браузерные уведомления
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isAuthenticated, connect]);
}

function showBrowserNotification(
  title: string,
  body: string,
  data: any,
  navigate: (path: string) => void,
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: data?.order_number || data?.type || 'crm',
    requireInteraction: data?.important || false,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();

    if (data?.order_id) {
      navigate(`/orders/${data.order_id}`);
    } else if (data?.client_id) {
      navigate(`/clients/${data.client_id}`);
    }
  };
}

export default useNotifications;
