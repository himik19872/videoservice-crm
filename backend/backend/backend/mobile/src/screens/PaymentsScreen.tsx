import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Payment {
  id: number;
  order: number;
  order_number: string;
  amount: string | number;
  payment_method: string;
  payment_method_display: string;
  is_received: boolean;
  paid_at: string;
  received_by_name: string;
  notes: string;
}

const methodIcons: Record<string, string> = {
  cash: '💰',
  card: '💳',
  transfer: '🏦',
  online: '🌐',
};

const PaymentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [])
  );

  const fetchPayments = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/payments/?page_size=200');
      setPayments(res.data.results || res.data);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить оплаты');
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = payments.filter((p) =>
    p.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.received_by_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = payments
    .filter((p) => p.is_received)
    .reduce((sum, p) => sum + (typeof p.amount === 'string' ? parseFloat(p.amount) : p.amount), 0);

  const renderPayment = ({ item }: { item: Payment }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('OrderDetail', { id: item.order })}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.orderNumber, { color: theme.primary }]}>{item.order_number}</Text>
        <Text style={[styles.amount, { color: item.is_received ? theme.success : theme.danger }]}>
          {item.is_received ? '' : '❌ '}{typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount} ₽
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={[styles.method, { color: theme.textSecondary }]}>
          {methodIcons[item.payment_method] || '💵'} {item.payment_method_display}
        </Text>
        <Text style={[styles.received, { color: theme.textTertiary }]}>
          {item.received_by_name ? `Принял: ${item.received_by_name}` : ''}
        </Text>
      </View>
      {item.notes ? (
        <Text style={[styles.notes, { color: theme.textTertiary }]}>{item.notes}</Text>
      ) : null}
      <Text style={[styles.date, { color: theme.textTertiary }]}>
        {new Date(item.paid_at).toLocaleString('ru-RU')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.summary, { backgroundColor: theme.card }]}>
        <Text style={[styles.summaryTitle, { color: theme.textSecondary }]}>Получено оплат</Text>
        <Text style={[styles.summaryAmount, { color: theme.success }]}>{totalReceived.toLocaleString('ru-RU')} ₽</Text>
        <Text style={[styles.summaryCount, { color: theme.textTertiary }]}>
          {payments.filter((p) => p.is_received).length} из {payments.length}
        </Text>
      </View>
      <TextInput
        style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Поиск по номеру заявки..."
        placeholderTextColor={theme.textTertiary}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPayment}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchPayments} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.textTertiary }]}>Нет оплат</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  summary: { padding: 16, borderRadius: 10, marginBottom: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  summaryTitle: { fontSize: 13, fontWeight: '600' },
  summaryAmount: { fontSize: 28, fontWeight: '800', marginVertical: 4 },
  summaryCount: { fontSize: 12 },
  search: { borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 12, borderWidth: 1 },
  card: { borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontSize: 14, fontWeight: '700' },
  amount: { fontSize: 16, fontWeight: '800' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  method: { fontSize: 13 },
  received: { fontSize: 11 },
  notes: { fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  date: { fontSize: 10 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
});

export default PaymentsScreen;
