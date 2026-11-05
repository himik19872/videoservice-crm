import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  PREFILL_USER_KEY, PREFILL_PASS_KEY, STORAGE_KEY_SERVER, STORAGE_KEY_PORT,
} from '../services/api';
import { ConnectPayload, resolvePort } from '../utils/connectPayload';
import QrConnectScanner from '../components/QrConnectScanner';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Логин и пароль, полученные из QR-кода при настройке подключения
  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedPass] = await Promise.all([
          AsyncStorage.getItem(PREFILL_USER_KEY),
          AsyncStorage.getItem(PREFILL_PASS_KEY),
        ]);
        if (savedUser) setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
      } catch {}
    })();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите логин и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      // Пароль из QR больше не нужен
      try { await AsyncStorage.removeItem(PREFILL_PASS_KEY); } catch {}
    } catch (error: any) {
      if (error?.response) {
        // Сервер ответил, но с ошибкой
        const msg = error.response.data?.error || error.response.data?.detail || 'Неверный логин или пароль';
        Alert.alert('Ошибка входа', msg);
      } else if (error?.request) {
        // Нет ответа от сервера — проблема с сетью
        Alert.alert(
          'Сервер недоступен',
          'Не удалось подключиться к серверу.\n\n' +
          'Проверьте:\n' +
          '• Телефон в той же Wi-Fi сети или есть интернет?\n' +
          '• Сервер включён?\n' +
          '• Адрес сервера в настройках подключения?'
        );
      } else {
        Alert.alert('Ошибка', 'Ошибка входа: ' + (error.message || 'неизвестная'));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Вход по QR-коду без знания пароля:
   * сохраняем адрес сервера из кода, подставляем логин и сразу входим.
   */
  const handleQrPayload = async (p: ConnectPayload) => {
    setScanning(false);
    const portValue = resolvePort(p.host, p.port);

    try {
      await AsyncStorage.setItem(STORAGE_KEY_SERVER, p.host);
      await AsyncStorage.setItem(STORAGE_KEY_PORT, portValue);
    } catch {}

    if (p.user) setUsername(p.user);

    if (p.user && p.pass) {
      setPassword(p.pass);
      setLoading(true);
      try {
        await login(p.user, p.pass);
        try { await AsyncStorage.removeItem(PREFILL_PASS_KEY); } catch {}
      } catch (e: any) {
        Alert.alert(
          'Не удалось войти',
          'Пароль из QR-кода не подошёл.\nПопросите администратора выдать новый QR-код.',
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    Alert.alert(
      'Сервер подключён',
      p.user
        ? `Логин «${p.user}» подставлен. Введите пароль, чтобы войти.`
        : 'Адрес сервера сохранён. Введите логин и пароль.',
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={styles.title}>CRM Система</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Вход в систему управления</Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="Имя пользователя"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="Пароль"
          placeholderTextColor={theme.textTertiary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.qrButton, { borderColor: theme.border }]}
          onPress={() => setScanning(true)}
          disabled={loading}
        >
          <Text style={[styles.qrButtonText, { color: theme.text }]}>📷 Войти по QR-коду</Text>
        </TouchableOpacity>
        <Text style={[styles.hint, { color: theme.textTertiary }]}>
          Забыли пароль? Попросите администратора выдать QR-код заново.
        </Text>
      </View>

      <QrConnectScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onPayload={handleQrPayload}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderRadius: 12, padding: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#1677ff', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: '#1677ff', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrButton: { borderWidth: 1.5, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 10 },
  qrButtonText: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 11, textAlign: 'center', marginTop: 12 },
});

export default LoginScreen;