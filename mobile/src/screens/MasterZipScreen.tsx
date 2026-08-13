import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
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

const MasterZipScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [items, setItems] = useState<ZipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const masterId = user?.master_profile?.id;

  const fetchData = useCallback(async () => {
    if (!masterId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/masters/${masterId}/inventory/`);
      setItems(res.data.items || []);
    } catch (e) {
      console.error('ZIP load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [masterId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

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
        <Text style={[styles.summaryTitle, { color: theme.text }]}>🎒 Мой ЗИП (материалы на руках)</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{items.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>позиций</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#fa8c16' }]}>{totalRemaining}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>единиц остаток</Text>
          </View>
        </View>
      </View>

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
          </View>
        )}
      />
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
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

export default MasterZipScreen;
