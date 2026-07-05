import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import type { Order } from '../types';

interface Props {
  navigation: any;
  isMaster?: boolean;
}

const statusColors: Record<string, string> = {
  new: '#1677ff', assigned: '#722ed1', accepted: '#13c2c2',
  in_progress: '#fa8c16', paused: '#faad14', need_help: '#f5222d',
  completed: '#52c41a', confirmed: '#52c41a', cancelled: '#d9d9d9',
};

const statusLabels: Record<string, string> = {
  new: 'Новая', assigned: 'Назначена', accepted: 'Принята',
  in_progress: 'В работе', paused: 'На паузе', need_help: 'Требуется помощь',
  completed: 'Выполнена', confirmed: 'Подтверждена', cancelled: 'Отменена',
};

const OrdersListScreen: React.FC<Props> = ({ navigation, isMaster }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const fetchOrders = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/orders/?page_size=100');
      setOrders(res.data.results || res.data);
    } catch (e) {
      console.error('Fetch orders error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = orders
    .filter(o => statusFilter === 'all' || !['completed', 'confirmed', 'cancelled'].includes(o.status))
    .filter(o =>
      o.number?.toLowerCase().includes(search.toLowerCase()) ||
      o.client_info?.full_name?.toLowerCase().includes(search.toLowerCase())
    );

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('OrderDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{item.number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#d9d9d9' }]}>
          <Text style={styles.statusText}>{statusLabels[item.status] || item.status}</Text>
        </View>
      </View>
      <Text style={styles.clientName}>{item.client_info?.full_name || '—'}</Text>
      <Text style={styles.address}>{item.address}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.type}>
          {item.order_type === 'repair' ? '🔧 Ремонт' : item.order_type === 'connection' ? '🔌 Подключение' : '💰 Продажа'}
        </Text>
        <Text style={styles.priority}>
          {item.priority === 'urgent' ? '🔴 Срочно' : item.priority === 'high' ? '🟠 Высокий' : item.priority === 'medium' ? '🟡 Средний' : '🟢 Низкий'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Поиск по номеру или клиенту..."
        placeholderTextColor="#999"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
          onPress={() => setStatusFilter('active')}
        >
          <Text style={[styles.filterChipText, statusFilter === 'active' && styles.filterChipTextActive]}>
            🔄 Активные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
            📋 Все
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchOrders} />}
        ListEmptyComponent={<Text style={styles.empty}>Нет заявок</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 12 },
  search: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#d9d9d9' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontSize: 14, fontWeight: '700', color: '#333' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  clientName: { fontSize: 15, color: '#333', marginBottom: 2 },
  address: { fontSize: 13, color: '#666', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { fontSize: 12, color: '#888' },
  priority: { fontSize: 12, color: '#888' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9d9d9' },
  filterChipActive: { backgroundColor: '#1677ff', borderColor: '#1677ff' },
  filterChipText: { fontSize: 13, color: '#666' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
});

export default OrdersListScreen;