import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface InventoryItem {
  id: number;
  name: string;
  item_type: string;
  item_type_display: string;
  serial_number: string;
  model_name: string;
  barcode: string | null;
  quantity: number;
  unit: string;
  cost_price: number | null;
  sale_price: number | null;
  status: string;
  status_display: string;
  location: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  in_stock: '#52c41a',
  with_master: '#fa8c16',
  installed: '#1677ff',
  returned: '#722ed1',
  defective: '#f5222d',
  written_off: '#d9d9d9',
};

const InventoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [])
  );

  const fetchItems = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/inventory/?page_size=200');
      setItems(res.data.results || res.data);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить склад');
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = items
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.barcode?.toLowerCase().includes(search.toLowerCase())
    );

  const statuses = [
    { key: 'all', label: 'Все' },
    { key: 'in_stock', label: 'На складе' },
    { key: 'with_master', label: 'У мастеров' },
    { key: 'installed', label: 'Установлено' },
  ];

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('InventoryDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#d9d9d9' }]}>
          <Text style={styles.statusText}>{item.status_display}</Text>
        </View>
      </View>
      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
        {item.item_type_display}{item.model_name ? ` · ${item.model_name}` : ''}
      </Text>
      {item.barcode ? (
        <Text style={[styles.barcode, { color: theme.primary }]}>🏷 {item.barcode}</Text>
      ) : null}
      {item.serial_number ? (
        <Text style={[styles.serial, { color: theme.textTertiary }]}>S/N: {item.serial_number}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={[styles.quantity, { color: theme.primary }]}>
          {item.quantity} {item.unit}
        </Text>
        {item.sale_price != null && (
          <Text style={[styles.price, { color: theme.text }]}>{item.sale_price} ₽</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TextInput
        style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
        placeholder="Поиск по названию или серийному номеру..."
        placeholderTextColor={theme.textTertiary}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        horizontal
        data={statuses}
        keyExtractor={(item) => item.key}
        style={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: theme.chipBg, borderColor: theme.border },
              statusFilter === item.key && { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg },
            ]}
            onPress={() => setStatusFilter(item.key)}
          >
            <Text style={[styles.filterChipText, { color: statusFilter === item.key ? '#fff' : theme.textSecondary }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchItems} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.textTertiary }]}>Нет оборудования</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  search: { borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 10, borderWidth: 1 },
  filterRow: { marginBottom: 10, maxHeight: 40 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  card: { borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName: { fontSize: 15, fontWeight: '700', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  itemMeta: { fontSize: 13, marginBottom: 2 },
  serial: { fontSize: 12, marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  quantity: { fontSize: 14, fontWeight: '600' },
  price: { fontSize: 14, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
});

export default InventoryScreen;
