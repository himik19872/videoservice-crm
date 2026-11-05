import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  STORAGE_KEY_SERVER, STORAGE_KEY_PORT, PREFILL_USER_KEY, PREFILL_PASS_KEY,
  DEFAULT_IP, DEFAULT_PORT, buildServerBaseUrl,
} from '../services/api';
import { parseConnectPayload, resolvePort } from '../utils/connectPayload';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onConfigured: () => void;
}

const ServerSetupScreen: React.FC<Props> = ({ onConfigured }) => {
  const { login } = useAuth();
  const [ip, setIp] = useState(DEFAULT_IP);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const connectTo = async (
    hostRaw: string,
    portRaw: string,
    credentials?: { user?: string; password?: string },
  ) => {
    const host = (hostRaw || '').trim();
    const portValue = (portRaw || '').trim() || DEFAULT_PORT;

    if (!host) {
      Alert.alert('Ошибка', 'Введите IP-адрес или домен сервера');
      return;
    }

    setTesting(true);
    try {
      // Проверяем доступность сервера (учитываем домен/HTTPS)
      const url = `${buildServerBaseUrl(host, portValue)}/api/system-settings/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok || response.status === 401 || response.status === 403) {
        // 200 или 401/403 (не авторизован) — сервер доступен
        await AsyncStorage.setItem(STORAGE_KEY_SERVER, host);
        await AsyncStorage.setItem(STORAGE_KEY_PORT, portValue);

        if (credentials?.user) {
          await AsyncStorage.setItem(PREFILL_USER_KEY, credentials.user);
        }
        if (credentials?.password) {
          await AsyncStorage.setItem(PREFILL_PASS_KEY, credentials.password);
        } else {
          await AsyncStorage.removeItem(PREFILL_PASS_KEY);
        }

        // QR с паролем — сразу входим, экран входа не нужен
        if (credentials?.user && credentials?.password) {
          try {
            await login(credentials.user, credentials.password);
            return;
          } catch (err: any) {
            Alert.alert(
              'Сервер подключён',
              'Не удалось войти автоматически.\n' +
              'Логин и пароль подставлены на экране входа — проверьте их или смените пароль в CRM.',
              [{ text: 'OK', onPress: onConfigured }],
            );
            return;
          }
        }

        Alert.alert(
          '✅ Подключено',
          `Сервер ${buildServerBaseUrl(host, portValue)} доступен` +
            (credentials?.user ? `\nЛогин: ${credentials.user}` : ''),
          [{ text: 'OK', onPress: onConfigured }],
        );
      } else {
        Alert.alert('❌ Ошибка', `Сервер ответил: ${response.status}. Проверьте адрес и порт.`);
      }
    } catch (e: any) {
      Alert.alert(
        '❌ Нет соединения',
        `Не удалось подключиться к ${buildServerBaseUrl(host, portValue)}\n\n${e.message || 'Проверьте адрес и сеть'}`,
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => connectTo(ip, port);

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Нет доступа к камере', 'Разрешите доступ к камере в настройках телефона');
        return;
      }
    }
    setScanned(false);
    setScanning(true);
  };

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);

    const parsed = parseConnectPayload(data);
    if (!parsed || !parsed.host) {
      Alert.alert('QR-код не распознан', 'Это не код подключения к CRM.\nОтсканируйте код из карточки сотрудника.');
      return;
    }

    const isDomain = parsed.host.includes('.') && !/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.host);
    const resolvedPort = resolvePort(parsed.host, parsed.port);

    setIp(parsed.host);
    setPort(resolvedPort);
    connectTo(parsed.host, resolvedPort, { user: parsed.user, password: parsed.pass });
  }, [scanned]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>📡</Text>
        <Text style={styles.title}>VideoService CRM</Text>
        <Text style={styles.subtitle}>Настройка подключения к серверу</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>IP-адрес или домен</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder={DEFAULT_IP}
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.label}>Порт</Text>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder={DEFAULT_PORT}
          placeholderTextColor="#999"
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.button, testing && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Подключиться</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scanButton, testing && styles.buttonDisabled]}
          onPress={startScan}
          disabled={testing}
        >
          <Text style={styles.scanButtonText}>📷 Сканировать QR-код</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Укажите адрес вручную или отсканируйте QR-код{'\n'}
          из карточки сотрудника (Настройки → Сотрудники).{'\n'}
          Для HTTPS — домен и порт 443.{'\n'}
          По умолчанию: {DEFAULT_IP}:{DEFAULT_PORT} (локальная сеть)
        </Text>
      </View>

      <Modal
        visible={scanning}
        animationType="slide"
        onRequestClose={() => setScanning(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.scannerCamera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
          />
          <View style={styles.scannerOverlay} pointerEvents="none">
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>Наведите камеру на QR-код</Text>
          </View>
          <TouchableOpacity style={styles.scannerClose} onPress={() => setScanning(false)}>
            <Text style={styles.scannerCloseText}>✕ Закрыть</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1677ff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#1677ff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  scanButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#1677ff',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  scanButtonText: {
    color: '#1677ff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerCamera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#1677ff',
    borderRadius: 16,
  },
  scannerText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
  },
  scannerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
  },
  scannerCloseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ServerSetupScreen;
