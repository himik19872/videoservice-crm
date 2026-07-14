import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_SERVER, STORAGE_KEY_PORT, DEFAULT_IP, DEFAULT_PORT } from '../services/api';

interface Props {
  onConfigured: () => void;
}

const ServerSetupScreen: React.FC<Props> = ({ onConfigured }) => {
  const [ip, setIp] = useState(DEFAULT_IP);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    const trimmedIp = ip.trim();
    const trimmedPort = port.trim() || '3000';

    if (!trimmedIp) {
      Alert.alert('Ошибка', 'Введите IP-адрес или домен сервера');
      return;
    }

    setTesting(true);
    try {
      // Пробуем подключиться
      const url = `http://${trimmedIp}:${trimmedPort}/api/system-settings/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok || response.status === 401) {
        // 200 или 401 (не авторизован) — сервер доступен
        await AsyncStorage.setItem(STORAGE_KEY_SERVER, trimmedIp);
        await AsyncStorage.setItem(STORAGE_KEY_PORT, trimmedPort);
        Alert.alert('✅ Подключено', `Сервер ${trimmedIp}:${trimmedPort} доступен`, [
          { text: 'OK', onPress: onConfigured },
        ]);
      } else {
        Alert.alert('❌ Ошибка', `Сервер ответил: ${response.status}. Проверьте адрес и порт.`);
      }
    } catch (e: any) {
      Alert.alert(
        '❌ Нет соединения',
        `Не удалось подключиться к ${trimmedIp}:${trimmedPort}\n\n${e.message || 'Проверьте адрес и сеть'}`,
      );
    } finally {
      setTesting(false);
    }
  };

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

        <Text style={styles.hint}>
          Укажите адрес сервера CRM.{'\n'}
          По умолчанию: {DEFAULT_IP}:{DEFAULT_PORT}
        </Text>
      </View>
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
});

export default ServerSetupScreen;
