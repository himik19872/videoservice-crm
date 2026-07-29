import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
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
  supplier: string;
  warranty_months: number;
  notes: string;
  created_at: string;
}

interface Movement {
  id: number;
  movement_type_display: string;
  item_name: string;
  master_name: string;
  order_number: string;
  performed_by_name: string;
  quantity: number;
  notes: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  in_stock: '#52c41a', with_master: '#fa8c16', installed: '#1677ff',
  returned: '#722ed1', defective: '#f5222d', written_off: '#d9d9d9',
};

const InventoryDetailScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { id } = route.params;
  const { theme } = useTheme();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      const [itemRes, movRes] = await Promise.all([
        api.get(`/inventory/${id}/`),
        api.get(`/inventory-movements/?item=${id}&page_size=50`),
      ]);
      setItem(itemRes.data);
      setMovements(movRes.data.results || movRes.data);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }
  if (!item) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#d9d9d9' }]}>
            <Text style={styles.statusText}>{item.status_display}</Text>
          </View>
          <Text style={[styles.typeLabel, { color: theme.textSecondary }]}>{item.item_type_display}</Text>
        </View>
        <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>

        <View style={styles.infoGrid}>
          <InfoRow label="Штрих-код" value={item.barcode || '—'} theme={theme} />
          <InfoRow label="Модель" value={item.model_name || '—'} theme={theme} />
          <InfoRow label="S/N" value={item.serial_number || '—'} theme={theme} />
          <InfoRow label="Количество" value={`${item.quantity} ${item.unit}`} theme={theme} />
          <InfoRow label="Место" value={item.location || '—'} theme={theme} />
          <InfoRow label="Поставщик" value={item.supplier || '—'} theme={theme} />
          <InfoRow label="Гарантия" value={`${item.warranty_months} мес.`} theme={theme} />
          {item.cost_price != null && (
            <InfoRow label="Закупка" value={`${item.cost_price} ₽`} theme={theme} />
          )}
          {item.sale_price != null && (
            <InfoRow label="Продажа" value={`${item.sale_price} ₽`} theme={theme} />
          )}
        </View>
        {item.notes ? (
          <Text style={[styles.notes, { color: theme.textSecondary }]}>{item.notes}</Text>
        ) : null}
      </View>

      {movements.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>📦 История движений</Text>
          {movements.map((m) => (
            <View key={m.id} style={[styles.movementRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.movementType, { color: theme.text }]}>{m.movement_type_display}</Text>
              <Text style={[styles.movementMeta, { color: theme.textSecondary }]}>
                Кол-во: {m.quantity}{m.master_name ? ` · Мастер: ${m.master_name}` : ''}
              </Text>
              {m.order_number ? (
                <Text style={[styles.movementMeta, { color: theme.textTertiary }]}>Заявка: {m.order_number}</Text>
              ) : null}
              {m.notes ? <Text style={[styles.movementNotes, { color: theme.textTertiary }]}>{m.notes}</Text> : null}
              <Text style={[styles.movementDate, { color: theme.textTertiary }]}>
                {new Date(m.created_at).toLocaleString('ru-RU')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const InfoRow: React.FC<{ label: string; value: string; theme: any }> = ({ label, value, theme }) => (
  <View style={styles.infoRow}>
    <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 10, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  typeLabel: { fontSize: 13 },
  name: { fontSize: 20, fontWeight: '800', marginBottom: 14 },
  infoGrid: { gap: 8, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },
  notes: { fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: 10 },
  movementRow: { paddingVertical: 8, borderBottomWidth: 1 },
  movementType: { fontSize: 14, fontWeight: '600' },
  movementMeta: { fontSize: 12, marginTop: 2 },
  movementNotes: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  movementDate: { fontSize: 10, marginTop: 2 },
});

export default InventoryDetailScreen;
