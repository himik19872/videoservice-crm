import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SERVER = '@videoservice_server_ip';
const STORAGE_KEY_PORT = '@videoservice_server_port';
// Логин, полученный из QR-кода (подставляется на экране входа)
const PREFILL_USER_KEY = '@videoservice_prefill_user';
// Пароль, полученный из QR-кода (только если админ выдал QR с паролем)
const PREFILL_PASS_KEY = '@videoservice_prefill_pass';

const DEFAULT_IP = '83.243.73.86';
const DEFAULT_PORT = '3000';

// Собирает базовый адрес сервера с учётом домена и HTTPS.
// Поддерживаются форматы:
//   ("192.168.1.240", "3000")                 → http://192.168.1.240:3000
//   ("videoservice-crm.duckdns.org", "443")   → https://videoservice-crm.duckdns.org
//   ("https://domain.ru", "")                 → https://domain.ru
//   ("domain.ru", "")                         → http://domain.ru
export const buildServerBaseUrl = (rawHost: string, rawPort?: string): string => {
  const raw = (rawHost || '').trim();
  const schemeMatch = raw.match(/^(https?):\/\//i);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : null;
  const host = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  const port = (rawPort || '').trim();

  if (!host) return '';

  if (port === '443') return `https://${host}`;
  if (port === '80') return `http://${host}`;

  const proto = scheme === 'https' ? 'https' : 'http';
  if (!port) return `${proto}://${host}`;
  return `${proto}://${host}:${port}`;
};

// Базовый адрес сервера (без /api) — тот, на который настроилось приложение.
// Нужен для ссылок на файлы (PDF-инструкции, картинки и т.п.),
// чтобы не было жёсткой привязки к конкретному IP.
const getServerBaseUrl = async (): Promise<string> => {
  try {
    const [ip, port] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_SERVER),
      AsyncStorage.getItem(STORAGE_KEY_PORT),
    ]);
    return buildServerBaseUrl(ip || DEFAULT_IP, port || DEFAULT_PORT);
  } catch {
    return buildServerBaseUrl(DEFAULT_IP, DEFAULT_PORT);
  }
};

// Динамический baseURL — вычисляется при каждом запросе
const getBaseUrl = async (): Promise<string> => `${await getServerBaseUrl()}/api`;

const api: AxiosInstance = axios.create({
  baseURL: `http://${DEFAULT_IP}:${DEFAULT_PORT}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Перехватчик: добавляем токен + динамический baseURL
api.interceptors.request.use(async (config) => {
  // Динамически подставляем baseURL из AsyncStorage
  config.baseURL = await getBaseUrl();

  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Перехватчик: при 401 — сбрасываем токен ТОЛЬКО если сеть доступна
// При ошибке сети (нет ответа от сервера) — не сбрасываем токен
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Если сервер ответил 401 — токен недействителен, сбрасываем
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
    }
    // Если ошибка сети (нет ответа) — не сбрасываем токен, сессия сохраняется
    return Promise.reject(error);
  },
);

export default api;
export { getBaseUrl, getServerBaseUrl, STORAGE_KEY_SERVER, STORAGE_KEY_PORT, PREFILL_USER_KEY, PREFILL_PASS_KEY, DEFAULT_IP, DEFAULT_PORT };