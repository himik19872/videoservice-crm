import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useAuth } from '../contexts/AuthContext';
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
  const { theme } = useTheme();
  const { isOnline } = useOffline();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'dispatcher';
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
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('OrderDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.orderNumber, { color: theme.text }]}>{item.number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#d9d9d9' }]}>
          <Text style={styles.statusText}>{statusLabels[item.status] || item.status}</Text>
        </View>
      </View>
      <Text style={[styles.clientName, { color: theme.text }]}>{item.client_info?.full_name || '—'}</Text>
      <Text style={[styles.address, { color: theme.textSecondary }]}>{item.address}</Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.type, { color: theme.textTertiary }]}>
          {item.order_type === 'repair' ? '🔧 Ремонт' : item.order_type === 'connection' ? '🔌 Подключение' : item.order_type === 'installation' ? '🏗️ Монтаж' : item.order_type === 'maintenance' ? '🔄 ТО' : '💰 Продажа'}
        </Text>
        <Text style={[styles.priority, { color: theme.textTertiary }]}>
          {item.priority === 'urgent' ? '🔴 Срочно' : item.priority === 'high' ? '🟠 Высокий' : item.priority === 'medium' ? '🟡 Средний' : '🟢 Низкий'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📴 Офлайн-режим — данные могут быть неактуальны</Text>
        </View>
      )}
      <TextInput
        style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Поиск по номеру или клиенту..."
        placeholderTextColor={theme.textTertiary}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: theme.chipBg, borderColor: theme.border }, statusFilter === 'active' && { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg }]}
          onPress={() => setStatusFilter('active')}
        >
          <Text style={[styles.filterChipText, { color: theme.textSecondary }, statusFilter === 'active' && styles.filterChipTextActive]}>
            🔄 Активные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: theme.chipBg, borderColor: theme.border }, statusFilter === 'all' && { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg }]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterChipText, { color: theme.textSecondary }, statusFilter === 'all' && styles.filterChipTextActive]}>
            📋 Все
          </Text>
        </TouchableOpacity>
      </View>

      {/* Быстрая навигация */}
      <View style={styles.navRow}>
        {isStaff && (
          <>
            <TouchableOpacity
              style={[styles.navChip, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
              onPress={() => navigation.navigate('Inventory')}
            >
              <Text style={[styles.navChipText, { color: theme.textSecondary }]}>📦 Склад</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navChip, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
              onPress={() => navigation.navigate('Payments')}
            >
              <Text style={[styles.navChipText, { color: theme.textSecondary }]}>💰 Оплаты</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={[styles.navChip, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
          onPress={() => navigation.navigate('Messages')}
        >
          <Text style={[styles.navChipText, { color: theme.textSecondary }]}>💬 Чат</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchOrders} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.textTertiary }]}>Нет заявок</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  offlineBanner: { backgroundColor: '#ff4d4f', padding: 8, borderRadius: 8, marginBottom: 10 },
  offlineBannerText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  search: { borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 12, borderWidth: 1 },
  card: { borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  clientName: { fontSize: 15, marginBottom: 2 },
  address: { fontSize: 13, marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { fontSize: 12 },
  priority: { fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13 },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  navChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  navChipText: { fontSize: 13, fontWeight: '500' },
});

export default OrdersListScreen;