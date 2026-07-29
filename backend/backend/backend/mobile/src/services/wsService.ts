/**
 * WebSocket сервис для мгновенных уведомлений.
 * Подключается к ws://SERVER:8000/ws/notifications/?token=...
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SERVER = '@videoservice_server_ip';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let onMessageCallback: ((msg: { title: string; body: string; data?: any }) => void) | null = null;

export function onWsMessage(cb: (msg: { title: string; body: string; data?: any }) => void) {
  onMessageCallback = cb;
}

export async function connectWs(): Promise<void> {
  const token = await AsyncStorage.getItem('token');
  if (!token) {
    console.log('[WS] No token, skipping');
    return;
  }

  const ip = (await AsyncStorage.getItem(STORAGE_KEY_SERVER)) || '83.243.73.86';
  // Порт 3000 — единая точка входа (Express проксирует WS → Daphne :8000)
  const url = `ws://${ip}:3000/ws/notifications/?token=${token}`;

  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[WS] Already connected');
    return;
  }

  console.log('[WS] Connecting:', url);
  disconnectWs();

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] Message:', msg.type);
        if (msg.type === 'notification' && onMessageCallback) {
          onMessageCallback({
            title: msg.title,
            body: msg.body,
            data: msg.data,
          });
        }
      } catch (e) {
        console.log('[WS] Parse error:', e);
      }
    };

    ws.onerror = (err) => {
      console.log('[WS] Error:', (err as any)?.message || 'unknown');
    };

    ws.onclose = () => {
      console.log('[WS] Closed, reconnecting in 10s...');
      scheduleReconnect();
    };
  } catch (e) {
    console.log('[WS] Connect error:', e);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connectWs(), 10_000);
}

export function disconnectWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
}
