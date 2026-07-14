import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SERVER = '@videoservice_server_ip';
const STORAGE_KEY_PORT = '@videoservice_server_port';

const DEFAULT_IP = '83.243.73.86';
const DEFAULT_PORT = '3000';

// Динамический baseURL — вычисляется при каждом запросе
const getBaseUrl = async (): Promise<string> => {
  try {
    const [ip, port] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_SERVER),
      AsyncStorage.getItem(STORAGE_KEY_PORT),
    ]);
    const resolvedIp = ip || DEFAULT_IP;
    const resolvedPort = port || DEFAULT_PORT;
    return `http://${resolvedIp}:${resolvedPort}/api`;
  } catch {
    return `http://${DEFAULT_IP}:${DEFAULT_PORT}/api`;
  }
};

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

// Перехватчик: при 401 — сбрасываем токен
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  },
);

export default api;
export { getBaseUrl, STORAGE_KEY_SERVER, STORAGE_KEY_PORT, DEFAULT_IP, DEFAULT_PORT };