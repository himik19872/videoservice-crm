import { useEffect, useRef, useCallback } from 'react';

function showBrowserNotification(title: string, body: string, data: any) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: data?.order_number || data?.type || 'crm', requireInteraction: data?.important || false });
  n.onclick = () => { window.focus(); n.close(); if (data?.order_id) window.location.href = '/orders/' + data.order_id; };
}

export function useNotifications() {
  const token = localStorage.getItem('token');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (!token || isConnecting.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    isConnecting.current = true;
    const p = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = p + '//' + window.location.host + '/ws/notifications/?token=' + token;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { console.log('[WS] Connected'); isConnecting.current = false; };
      ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'notification') showBrowserNotification(m.title, m.body, m.data); } catch {} };
      ws.onclose = () => { isConnecting.current = false; wsRef.current = null; reconnectTimer.current = setTimeout(connect, 5000); };
      ws.onerror = () => { ws.close(); };
    } catch { isConnecting.current = false; }
  }, [token]);

  useEffect(() => {
    console.log('[Notif] Init: token=' + (!!token) + ', Notification=' + ('Notification' in window) + ', perm=' + (window.Notification?.permission || 'N/A'));
    
    let bannerEl: HTMLDivElement | null = null;
    if (token && 'Notification' in window && Notification.permission === 'default') {
      console.log('[Notif] Showing permission banner');
      bannerEl = document.createElement('div');
      bannerEl.id = 'notif-banner';
      bannerEl.innerHTML = '<div style="background:#faad14;color:#000;padding:10px 20px;text-align:center;font-size:14px;display:flex;justify-content:center;align-items:center;gap:12px"><span>🔔 Включите уведомления, чтобы получать оповещения о заявках и статусах</span><button id="notif-enable-btn" style="background:#fff;color:#000;border:1px solid #d9bd6a;padding:4px 16px;border-radius:4px;cursor:pointer;font-weight:bold">Включить</button><button id="notif-dismiss-btn" style="background:none;border:none;cursor:pointer;font-size:18px;margin-left:8px">✕</button></div>';
      document.body.prepend(bannerEl);
      document.getElementById('notif-enable-btn')?.addEventListener('click', () => { Notification.requestPermission(); removeBanner(); });
      document.getElementById('notif-dismiss-btn')?.addEventListener('click', removeBanner);
    }
    function removeBanner() { var e = document.getElementById('notif-banner'); if (e) e.remove(); }
    connect();
    return () => { removeBanner(); if (reconnectTimer.current) clearTimeout(reconnectTimer.current); if (wsRef.current) wsRef.current.close(); };
  }, [token, connect]);
}
