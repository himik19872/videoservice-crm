import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, RefreshControl, Modal, Platform, Linking, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import api from '../services/api';
import { DEFAULT_IP, DEFAULT_PORT } from '../services/api';
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
  const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string } | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [cachedFiles, setCachedFiles] = useState<Record<number, string>>({}); // id → локальный путь

  // Загружаем кеш из expo-file-system при старте
  useEffect(() => {
    loadCache();
  }, []);

  const loadCache = async () => {
    try {
      const dir = `${FileSystem.cacheDirectory}wiki/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) return;
      const files = await FileSystem.readDirectoryAsync(dir);
      const cache: Record<number, string> = {};
      for (const f of files) {
        const match = f.match(/^(\d+)_/);
        if (match) {
          cache[parseInt(match[1])] = dir + f;
        }
      }
      setCachedFiles(cache);
    } catch (e) {}
  };

  const isImageFile = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url);

  const downloadAndCache = async (item: Instruction): Promise<string> => {
    // Уже в кеше
    if (cachedFiles[item.id]) return cachedFiles[item.id];

    const url = getExternalUrl(item.pdf_url!);
    const ext = isImageFile(url) ? url.split('.').pop()?.split('?')[0] || 'jpg' : 'pdf';
    const localPath = `${FileSystem.cacheDirectory}wiki/${item.id}_${item.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.${ext}`;

    try {
      await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}wiki/`, { intermediates: true });
      const download = await FileSystem.downloadAsync(url, localPath);
      if (download.status === 200) {
        setCachedFiles(prev => ({ ...prev, [item.id]: localPath }));
        return localPath;
      }
    } catch (e) {
      console.error('download error:', e);
    }
    return url; // fallback — веб-ссылка
  };

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

  const getExternalUrl = (internalUrl: string): string => {
    // Сервер отдаёт pdf_url с внутренним IP (build_absolute_uri).
    // Заменяем на внешний IP, чтобы PDF открывался с телефона.
    // Формат: http://localhost:8000/media/... → http://83.243.73.86:3000/media/...
    try {
      const url = new URL(internalUrl);
      // Меняем хост и порт на внешние
      return `http://${DEFAULT_IP}:${DEFAULT_PORT}${url.pathname}`;
    } catch {
      return internalUrl;
    }
  };

  const openPdf = async (item: Instruction) => {
    if (!item.pdf_url) return;
    const url = getExternalUrl(item.pdf_url);

    // Если файл — изображение, показываем в Image viewer
    if (isImageFile(url)) {
      const localPath = await downloadAndCache(item);
      setViewingImage(localPath);
      return;
    }

    // PDF: скачиваем и показываем через WebView (локально, если закеширован)
    const localPath = await downloadAndCache(item);
    const viewerUrl = localPath.startsWith('file://')
      ? localPath
      : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
    setViewingPdf({ url: viewerUrl, title: item.title });
  };

  const openExternal = async (item: Instruction) => {
    if (!item.pdf_url) return;
    const url = getExternalUrl(item.pdf_url);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Нет приложения', 'Не удалось открыть PDF');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть файл');
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
            onLongPress={() => openExternal(item)}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
                {cachedFiles[item.id] && <Text style={{ marginLeft: 4, fontSize: 12 }}>💾</Text>}
              </View>
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

      {/* Просмотр PDF во встроенном WebView */}
      <Modal
        visible={!!viewingPdf}
        animationType="slide"
        onRequestClose={() => setViewingPdf(null)}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.headerBg }]}>
            <TouchableOpacity onPress={() => setViewingPdf(null)} style={styles.closeBtn}>
              <Text style={{ color: theme.headerTint, fontSize: 16 }}>✕ Закрыть</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.headerTint }]} numberOfLines={1}>
              {viewingPdf?.title}
            </Text>
            <View style={{ width: 70 }} />
          </View>
          {viewingPdf && (
            <WebView
              source={{ uri: viewingPdf.url }}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#1677ff" />
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Просмотр изображений (JPG/PNG) */}
      <Modal
        visible={!!viewingImage}
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
        transparent
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setViewingImage(null)}
          >
            <Text style={{ color: '#fff', fontSize: 24 }}>✕</Text>
          </TouchableOpacity>
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, paddingTop: Platform.OS === 'ios' ? 50 : 12 },
  closeBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
});

export default WikiScreen;
