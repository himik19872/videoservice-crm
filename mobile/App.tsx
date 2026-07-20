import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { OfflineProvider, setOfflineApi, useOffline } from './src/contexts/OfflineContext';
import { ServerProvider, useServer } from './src/contexts/ServerContext';
import { NotificationsProvider } from './src/contexts/NotificationsContext';
import api from './src/services/api';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import OrdersListScreen from './src/screens/OrdersListScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import SignatureScreen from './src/screens/SignatureScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import InventoryDetailScreen from './src/screens/InventoryDetailScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import AddPaymentScreen from './src/screens/AddPaymentScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ServerSetupScreen from './src/screens/ServerSetupScreen';

const Stack = createNativeStackNavigator();

// Прокидываем api в OfflineContext
setOfflineApi(api);

function AuthStack() {
  const { theme } = useTheme();
  const { isConfigured, loading } = useServer();
  const [showSetup, setShowSetup] = React.useState(false);

  React.useEffect(() => {
    // Если сервер не настроен, показываем экран настройки
    if (!loading && !isConfigured) {
      setShowSetup(true);
    }
  }, [loading, isConfigured]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' }}>
        <ActivityIndicator size="large" color="#1677ff" />
        <Text style={{ marginTop: 12, color: '#888' }}>Загрузка...</Text>
      </View>
    );
  }

  if (showSetup || !isConfigured) {
    return <ServerSetupScreen onConfigured={() => setShowSetup(false)} />;
  }

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function AppStack() {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { isOnline, pendingActions } = useOffline();
  const [shiftActive, setShiftActive] = React.useState(false);
  const navigationRef = React.useRef<any>(null);

  const checkShift = async () => {
    try {
      const res = await api.get('/users/me/');
      setShiftActive(res.data?.profile?.is_on_shift || false);
    } catch {}
  };
  React.useEffect(() => { checkShift(); }, []);

  const isStaff = user?.role === 'admin' || user?.role === 'dispatcher';
  const roleLabel = user?.role === 'admin' ? 'Админ' : user?.role === 'dispatcher' ? 'Диспетчер' : 'Мастер';

  const toggleShift = async () => {
    try {
      if (shiftActive) {
        await api.post('/shifts/end/');
        setShiftActive(false);
        Alert.alert('Смена закрыта', 'До встречи!');
      } else {
        await api.post('/shifts/start/');
        setShiftActive(true);
        Alert.alert('Смена открыта', 'Удачного дня!');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось');
    }
  };

  const headerStyle = { backgroundColor: theme.headerBg };
  const headerTintColor = theme.headerTint;

  const commonHeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {!isOnline && <Text style={{ color: '#ff4d4f', marginRight: 6, fontSize: 14 }}>📴</Text>}
      {pendingActions.length > 0 && (
        <Text style={{ color: '#fa8c16', marginRight: 6, fontSize: 12 }}>{pendingActions.length}⚡</Text>
      )}
      <TouchableOpacity onPress={() => navigationRef.current?.navigate('ServerSetup')} style={styles.themeBtn}>
        <Text style={{ fontSize: 16 }}>⚙️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
        <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={toggleShift} style={[styles.shiftBtn, { backgroundColor: shiftActive ? '#52c41a' : '#fa8c16' }]}>
        <Text style={styles.shiftBtnText}>{shiftActive ? '🟢 Смена' : '▶ Старт'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>{roleLabel} · Выйти</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Stack.Navigator>
      {/* Основные экраны */}
      <Stack.Screen
        name="OrdersList"
        component={OrdersListScreen}
        options={{
          title: 'Заявки',
          headerStyle,
          headerTintColor,
          headerTitleStyle: { fontWeight: '600' },
          headerRight: commonHeaderRight,
        }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen as any}
        options={{
          title: 'Детали заявки',
          headerStyle,
          headerTintColor,
        }}
      />
      <Stack.Screen
        name="AddPayment"
        component={AddPaymentScreen as any}
        options={{
          title: 'Приём оплаты',
          headerStyle,
          headerTintColor,
        }}
      />

      {/* Склад (только staff) */}
      {isStaff && (
        <>
          <Stack.Screen
            name="Inventory"
            component={InventoryScreen}
            options={{
              title: '📦 Склад',
              headerStyle,
              headerTintColor,
            }}
          />
          <Stack.Screen
            name="InventoryDetail"
            component={InventoryDetailScreen}
            options={{
              title: 'Детали оборудования',
              headerStyle,
              headerTintColor,
            }}
          />
        </>
      )}

      {/* Сообщения */}
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: '💬 Сообщения',
          headerStyle,
          headerTintColor,
        }}
      />

      {/* Настройки сервера */}
      <Stack.Screen
        name="ServerSetup"
        component={ServerSetupScreen as any}
        options={{
          title: '⚙️ Настройки сервера',
          headerStyle,
          headerTintColor,
        }}
      />

      {/* Оплаты (только staff) */}
      {isStaff && (
        <Stack.Screen
          name="Payments"
          component={PaymentsScreen}
          options={{
            title: '💰 Оплаты',
            headerStyle,
            headerTintColor,
          }}
        />
      )}

      {/* Подпись */}
      <Stack.Screen
        name="Signature"
        component={SignatureScreen as any}
        options={{
          title: 'Подпись клиента',
          headerStyle,
          headerTintColor,
        }}
      />
    </Stack.Navigator>
  );
}

function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, isDark } = useTheme();

  // Кастомная тема для навигации (тёмный фон для тем)
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      primary: theme.primary,
    },
  };

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.splashText, { color: theme.primary }]}>CRM Система</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ServerProvider>
      <ThemeProvider>
        <OfflineProvider>
          <AuthProvider>
            <NotificationsProvider>
              <Root />
            </NotificationsProvider>
          </AuthProvider>
        </OfflineProvider>
      </ThemeProvider>
    </ServerProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashText: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  themeBtn: { marginRight: 8, paddingHorizontal: 4 },
  logoutBtn: { marginRight: 8 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  shiftBtn: { marginRight: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  shiftBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});