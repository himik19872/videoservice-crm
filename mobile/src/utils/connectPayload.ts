/**
 * Разбор QR-кода подключения к CRM.
 * Формат (генерируется в CRM): {"app":"vscrm","host":"...","port":"443","user":"ivanov","pass":"..."}
 * Дополнительно поддерживаются ссылка и адрес вида host:port.
 */
export interface ConnectPayload {
  host: string;
  port: string;
  user?: string;
  pass?: string;
}

export const parseConnectPayload = (raw: string): ConnectPayload | null => {
  const text = (raw || '').trim();
  if (!text) return null;

  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (obj && (obj.app === 'vscrm' || obj.host)) {
        return {
          host: String(obj.host || '').trim(),
          port: String(obj.port || '').trim(),
          user: obj.user ? String(obj.user) : undefined,
          pass: obj.pass ? String(obj.pass) : undefined,
        };
      }
    } catch {}
  }

  try {
    const u = new URL(text);
    if (u.hostname) {
      return {
        host: u.hostname,
        port: u.port || (u.protocol === 'https:' ? '443' : '80'),
      };
    }
  } catch {}

  const withPort = text.match(/^([^\s/:]+):(\d{2,5})$/);
  if (withPort) return { host: withPort[1], port: withPort[2] };

  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text) || /^\d{1,3}(\.\d{1,3}){3}$/.test(text)) {
    return { host: text, port: '' };
  }

  return null;
};

/** Порт по умолчанию: домен → 443 (HTTPS), IP → 3000 (локальная сеть) */
export const resolvePort = (host: string, port?: string): string => {
  const p = (port || '').trim();
  if (p) return p;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  return isIp ? '3000' : '443';
};
