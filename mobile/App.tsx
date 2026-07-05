import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import api from './src/services/api';
import LoginScreen from './src/screens/LoginScreen';
import OrdersListScreen from './src/screens/OrdersListScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import SignatureScreen from './src/screens/SignatureScreen';
import MasterMapScreen from './src/screens/MasterMapScreen';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function AppStack() {
  const { user, logout } = useAuth();
  const [shiftActive, setShiftActive] = React.useState(false);

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

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="OrdersList"
        component={OrdersListScreen}
        options={{
          title: 'Заявки',
          headerStyle: { backgroundColor: '#1677ff' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={toggleShift} style={[styles.shiftBtn, { backgroundColor: shiftActive ? '#52c41a' : '#fa8c16' }]}>
                <Text style={styles.shiftBtnText}>{shiftActive ? '🟢 Смена' : '▶ Старт'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                <Text style={styles.logoutText}>{roleLabel} · Выйти</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          title: 'Детали заявки',
          headerStyle: { backgroundColor: '#1677ff' },
          headerTintColor: '#fff',
        }}
      />
      {isStaff && (
        <Stack.Screen
          name="Map"
          component={MasterMapScreen}
          options={{
            title: 'Карта мастеров',
            headerStyle: { backgroundColor: '#1677ff' },
            headerTintColor: '#fff',
          }}
        />
      )}
      <Stack.Screen
        name="Signature"
        component={SignatureScreen}
        options={{
          title: 'Подпись клиента',
          headerStyle: { backgroundColor: '#1677ff' },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}

function Root() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1677ff" />
        <Text style={styles.splashText}>CRM Система</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  splashText: { marginTop: 12, fontSize: 18, color: '#1677ff', fontWeight: '600' },
  logoutBtn: { marginRight: 8 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  shiftBtn: { marginRight: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  shiftBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});