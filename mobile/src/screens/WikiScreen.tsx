import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const CATEGORIES: Record<string, string> = {
  equipment: 'Оборудование',
  installation: 'Монтаж',
  setup: 'Настройка',
  repair: 'Ремонт',
  safety: 'Техника безопасности',
  other: 'Другое',
};

const CATEGORY_ICONS: Record<string, string> = {
  equipment: '🔧',
  installation: '🏗️',
  setup: '⚙️',
  repair: '🔨',
  safety: '🛡️',
  other: '📄',
};

interface Instruction {
  id: number;
  title: string;
  category: string;
  category_display: string;
  description: string;
  pdf_url: string | null;
  file_size: number;
}

const WikiScreen: React.FC = () => {
  const { theme } = useTheme();
  const [items, setItems] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/instructions/');
      setItems(res.data.results || res.data || []);
    } catch (e) {
      console.error('Wiki load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = selectedCat
    ? items.filter(i => i.category === selectedCat)
    : items;

  const categories = [...new Set(items.map(i => i.category))];

  const formatBytes = (b: number) =>
    b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${(b / 1024).toFixed(0)} КБ`;

  const openPdf = async (item: Instruction) => {
    if (!item.pdf_url) return;
    try {
      await Linking.openURL(item.pdf_url);
    } catch (e) {
      console.error('Open PDF error:', e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {categories.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedCat && styles.filterChipActive]}
            onPress={() => setSelectedCat(null)}
          >
            <Text style={[styles.filterText, !selectedCat && styles.filterTextActive]}>📚 Все</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCat === cat && styles.filterChipActive]}
              onPress={() => setSelectedCat(cat)}
            >
              <Text style={[styles.filterText, selectedCat === cat && styles.filterTextActive]}>
                {CATEGORY_ICONS[cat] || '📄'} {CATEGORIES[cat] || cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textTertiary }]}>Нет инструкций</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => openPdf(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.icon}>{CATEGORY_ICONS[item.category] || '📄'}</Text>
            </View>
            {item.description ? (
              <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={[styles.meta, { color: theme.textTertiary }]}>{item.category_display}</Text>
              <Text style={[styles.meta, { color: theme.textTertiary }]}>📎 {formatBytes(item.file_size || 0)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  filterChipActive: { backgroundColor: '#1677ff' },
  filterText: { fontSize: 12, color: '#555' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  card: { borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  icon: { fontSize: 24 },
  desc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { fontSize: 11 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});

export default WikiScreen;
