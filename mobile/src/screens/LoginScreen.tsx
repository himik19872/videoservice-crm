import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите логин и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
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
          '• Телефон в той же Wi-Fi сети?\n' +
          '• Сервер включён?\n' +
          '• Адрес: http://83.243.73.86:3000'
        );
      } else {
        Alert.alert('Ошибка', 'Ошибка входа: ' + (error.message || 'неизвестная'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>CRM Система</Text>
        <Text style={styles.subtitle}>Вход в систему управления</Text>

        <TextInput
          style={styles.input}
          placeholder="Имя пользователя"
          placeholderTextColor="#999"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#999"
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
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#f0f2f5', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#1677ff', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, color: '#333' },
  button: { backgroundColor: '#1677ff', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default LoginScreen;