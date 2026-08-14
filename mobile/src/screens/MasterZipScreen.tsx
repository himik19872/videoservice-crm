import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface ZipItem {
  inventory_item_id: number;
  item_name: string;
  item_barcode: string | null;
  item_type: string;
  unit: string;
  quantity_issued: number;
  quantity_used: number;
  quantity_returned: number;
  remaining: number;
  source_display: string;
  source: string;
}

interface ZipOrder {
  id: number;
  order_number: string;
  order_id: number;
  issued_at: string;
  items: ZipItem[];
}

const MasterZipScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [items, setItems] = useState<ZipItem[]>([]);
  const [orders, setOrders] = useState<ZipOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'balance' | 'orders'>('balance');

  const masterId = user?.master_profile?.id;

  const fetchData = useCallback(async () => {
    if (!masterId) {
      setLoading(false);
      return;
    }
    try {
      const [invRes, ordersRes] = await Promise.all([
        api.get(`/masters/${masterId}/inventory/`),
        api.get(`/masters/${masterId}/zip_orders/`),
      ]);
      setItems(invRes.data.items || []);
      setOrders(ordersRes.data || []);
    } catch (e) {
      console.error('ZIP load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [masterId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const returnMaterial = (item: ZipItem) => {
    Alert.alert(
      'Возврат на склад',
      `Вернуть «${item.item_name}» (остаток: ${item.remaining})?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: '↩ Вернуть',
          onPress: async () => {
            try {
              const res = await api.post(`/masters/${masterId}/return_zip/`, {
                inventory_item_id: item.inventory_item_id,
                quantity: 1,
              });
              Alert.alert('Готово', res.data?.message || 'Материал возвращён на склад');
              fetchData();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось вернуть');
            }
          },
        },
      ],
    );
  };

  const totalRemaining = items.reduce((s, i) => s + (i.remaining || 0), 0);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  if (!masterId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>У вас нет профиля мастера</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Сводка */}
      <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>🎒 Мой ЗИП</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{items.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>позиций</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#fa8c16' }]}>{totalRemaining}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>единиц остаток</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#1677ff' }]}>{orders.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>накладных</Text>
          </View>
        </View>
      </View>

      {/* Табы */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'balance' && { backgroundColor: theme.primary }]}
          onPress={() => setTab('balance')}
        >
          <Text style={[styles.tabText, tab === 'balance' && { color: '#fff' }]}>📦 Остатки</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'orders' && { backgroundColor: theme.primary }]}
          onPress={() => setTab('orders')}
        >
          <Text style={[styles.tabText, tab === 'orders' && { color: '#fff' }]}>📋 Накладные</Text>
        </TouchableOpacity>
      </View>

      {tab === 'balance' ? (
        <FlatList
          data={items}
          keyExtractor={(item, i) => `${item.inventory_item_id}-${i}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textTertiary }]}>У вас нет материалов в ЗИПе</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>{item.item_name}</Text>
                <View style={[
                  styles.sourceBadge,
                  item.source === 'master_zip'
                    ? { backgroundColor: '#f9f0ff', borderColor: '#d3adf7' }
                    : { backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }
                ]}>
                  <Text style={[
                    styles.sourceBadgeText,
                    { color: item.source === 'master_zip' ? '#722ed1' : '#1677ff' }
                  ]}>
                    {item.source === 'master_zip' ? '🎒 ЗИП' : '🏭 Склад'}
                  </Text>
                </View>
              </View>
              {item.item_barcode ? (
                <Text style={[styles.barcode, { color: theme.textTertiary }]}>🏷️ {item.item_barcode}</Text>
              ) : null}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{item.quantity_issued}</Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>выдано</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{item.quantity_used}</Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>использовано</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: item.remaining > 0 ? '#fa8c16' : '#52c41a' }]}>
                    {item.remaining}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>остаток</Text>
                </View>
              </View>
              {item.remaining > 0 && (
                <TouchableOpacity
                  style={[styles.returnBtn, { backgroundColor: '#fa8c16' }]}
                  onPress={() => returnMaterial(item)}
                >
                  <Text style={styles.returnBtnText}>↩ Вернуть на склад</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textTertiary }]}>Нет накладных</Text>
          }
          renderItem={({ item: ord }) => (
            <View style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.orderHeader}>
                <Text style={[styles.orderTitle, { color: theme.text }]}>Накладная №{ord.id}</Text>
                <View style={[styles.miniBadge, { backgroundColor: ord.status === 'pending' ? '#fa8c16' : ord.status === 'received' ? '#13c2c2' : '#52c41a' }]}>
                  <Text style={styles.miniBadgeText}>{ord.status_display}</Text>
                </View>
              </View>
              <Text style={[styles.orderMeta, { color: theme.textSecondary }]}>
                Заявка: {ord.order_number} · {new Date(ord.issued_at).toLocaleDateString('ru-RU')}
              </Text>
              {ord.items.map((it: any) => (
                <View key={it.inventory_item_id} style={[styles.orderItem, { borderBottomColor: theme.border }]}>
                  <View style={styles.orderItemHeader}>
                    <Text style={[styles.orderItemName, { color: theme.text }]} numberOfLines={1}>{it.item_name}</Text>
                    {it.source === 'master_zip'
                      ? <Text style={[styles.orderItemSource, { color: '#722ed1' }]}>🎒</Text>
                      : <Text style={[styles.orderItemSource, { color: '#1677ff' }]}>🏭</Text>}
                  </View>
                  <Text style={[styles.orderItemMeta, { color: theme.textTertiary }]}>
                    Выдано {it.quantity_issued} · Исп. {it.quantity_used} · Ост. {it.remaining}
                  </Text>
                  {it.need_return_old && (
                    <Text style={[styles.orderItemReturn, { color: '#fa8c16' }]}>
                      {it.old_item_returned ? '✅' : '⚠️'} Возврат старого: {it.old_item_description || '—'}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { borderRadius: 10, padding: 14, marginHorizontal: 12, marginTop: 12, marginBottom: 8 },
  summaryTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', gap: 24 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  summaryLabel: { fontSize: 12 },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  card: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '600', flex: 1 },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
  barcode: { fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 10 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 10 },
  returnBtn: { marginTop: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  returnBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#f0f0f0' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#555' },
  orderCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTitle: { fontSize: 14, fontWeight: '700' },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  miniBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  orderMeta: { fontSize: 12, marginTop: 4, marginBottom: 6 },
  orderItem: { paddingVertical: 6, borderBottomWidth: 1 },
  orderItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderItemName: { fontSize: 13, fontWeight: '600', flex: 1, marginRight: 6 },
  orderItemSource: { fontSize: 14 },
  orderItemMeta: { fontSize: 11, marginTop: 2 },
  orderItemReturn: { fontSize: 11, marginTop: 2 },
});

export default MasterZipScreen;
