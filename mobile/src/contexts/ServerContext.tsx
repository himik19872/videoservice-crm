import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SERVER = '@videoservice_server_ip';
const STORAGE_KEY_PORT = '@videoservice_server_port';

interface ServerContextType {
  serverUrl: string;       // полный URL: http://IP:PORT/api
  serverIp: string;        // IP или хост
  serverPort: string;      // порт
  setServer: (ip: string, port: string) => Promise<void>;
  isConfigured: boolean;
  loading: boolean;
}

const ServerContext = createContext<ServerContextType>({
  serverUrl: 'http://83.243.73.86:3000/api',
  serverIp: '83.243.73.86',
  serverPort: '3000',
  setServer: async () => {},
  isConfigured: true,
  loading: true,
});

export const useServer = () => useContext(ServerContext);

interface Props { children: ReactNode; }

export const ServerProvider: React.FC<Props> = ({ children }) => {
  const [serverIp, setServerIp] = useState('83.243.73.86');
  const [serverPort, setServerPort] = useState('3000');
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedIp = await AsyncStorage.getItem(STORAGE_KEY_SERVER);
        const savedPort = await AsyncStorage.getItem(STORAGE_KEY_PORT);
        if (savedIp) setServerIp(savedIp);
        if (savedPort) setServerPort(savedPort);
        // Сервер считается настроенным только если есть сохранённые значения
        setConfigured(!!(savedIp && savedPort));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const setServer = async (ip: string, port: string) => {
    const normalizedIp = ip.trim();
    const normalizedPort = port.trim() || '3000';
    setServerIp(normalizedIp);
    setServerPort(normalizedPort);
    setConfigured(true);
    await AsyncStorage.setItem(STORAGE_KEY_SERVER, normalizedIp);
    await AsyncStorage.setItem(STORAGE_KEY_PORT, normalizedPort);
  };

  const serverUrl = serverIp && serverPort
    ? `http://${serverIp}:${serverPort}/api`
    : 'http://83.243.73.86:3000/api';

  return (
    <ServerContext.Provider value={{
      serverUrl,
      serverIp,
      serverPort,
      setServer,
      isConfigured: !!(serverIp && serverPort),
      loading,
    }}>
      {children}
    </ServerContext.Provider>
  );
};
