import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api from '../services/api';
import type { Order } from '../types';

interface Props {
  route: { params: { id: number } };
  navigation: any;
}

const statusLabels: Record<string, string> = {
  new: 'Новая', assigned: 'Назначена', accepted: 'Принята',
  in_progress: 'В работе', paused: 'На паузе', need_help: 'Требуется помощь',
  completed: 'Выполнена', confirmed: 'Подтверждена', cancelled: 'Отменена',
};

const statusColors: Record<string, string> = {
  new: '#1677ff', assigned: '#722ed1', accepted: '#13c2c2',
  in_progress: '#fa8c16', paused: '#faad14', need_help: '#f5222d',
  completed: '#52c41a', confirmed: '#52c41a', cancelled: '#d9d9d9',
};

const OrderDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [media, setMedia] = useState<any[]>([]);

  useEffect(() => {
    fetchOrder();
    fetchMedia();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}/`);
      setOrder(res.data);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить заявку');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchMedia = async () => {
    try {
      const res = await api.get(`/order-media/?order=${id}`);
      setMedia(res.data.results || res.data);
    } catch (e) {}
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Нет доступа к камере'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) await uploadMedia(result.assets[0].uri, 'image');
  };

  const takeVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (!result.canceled) await uploadMedia(result.assets[0].uri, 'video');
  };

  const uploadMedia = async (uri: string, fileType: string) => {
    const formData = new FormData();
    const ext = uri.split('.').pop() || 'jpg';
    formData.append('file', { uri, name: `media.${ext}`, type: fileType === 'image' ? 'image/jpeg' : 'video/mp4' } as any);
    formData.append('order_id', String(id));
    formData.append('file_type', fileType);
    try {
      await api.post('/order-media/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Готово', fileType === 'image' ? 'Фото загружено' : 'Видео загружено');
      fetchMedia();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось загрузить');
    }
  };

  const callClient = () => {
    const phone = order?.client_info?.phone || order?.client?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('Нет номера');
  };

  const changeStatus = async (status: string, notes = '') => {
    setUpdating(true);
    try {
      let gps: any = {};
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { master_lat: pos.coords.latitude, master_lon: pos.coords.longitude };
        }
      } catch (e) {}

      const res = await api.patch(`/orders/${id}/`, { status, notes, ...gps });
      setOrder(res.data);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.error || 'Не удалось изменить статус');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#1677ff" /></View>;
  if (!order) return null;

  const s = order.status;
  const canAct = !['completed', 'confirmed', 'cancelled'].includes(s);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] }]}>
          <Text style={styles.statusText}>{statusLabels[order.status]}</Text>
        </View>
        {order.photo_report_required && <Text style={styles.requiredBadge}>📸 Фотоотчёт</Text>}
      </View>

      <Text style={styles.orderNum}>{order.number}</Text>
      <Text style={styles.client}>{order.client_info?.full_name || '—'}</Text>
      <Text style={styles.phone}>📞 {order.client_info?.phone || order.client?.phone || '—'}</Text>
      <TouchableOpacity onPress={() => {
        const city = order.city || '';
        const street = order.street_name || '';
        const house = order.house_number || '';
        const build = order.building_number || '';
        const apart = order.apartment || '';
        // Правильный формат: "Город, улица, дом"
        const parts = [city, street].filter(Boolean);
        if (house) parts.push('д.' + house + (build ? ' к' + build : ''));
        if (apart) parts.push('кв.' + apart);
        const addr = parts.join(', ') || order.address || '';

        if (!addr) return;
        const encoded = encodeURIComponent(addr);
        // Открываем Яндекс.Карты с построением маршрута (работает всегда)
        Linking.openURL(`https://yandex.ru/maps/?rtext=~${encoded}&rtt=auto`);
      }}>
        <Text style={styles.address}>📍 {order.address || [order.city, order.street_name, 'д.' + order.house_number].filter(Boolean).join(', ')}</Text>
        <Text style={styles.navHint}>🚗 Нажмите, чтобы построить маршрут</Text>
      </TouchableOpacity>
      <Text style={styles.desc}>{order.description}</Text>

      {/* GPS-история мастера */}
      {order.history && order.history.filter((h: any) => h.master_lat && h.master_lon).length > 0 && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>📍 GPS-история мастера</Text>
          {order.history.filter((h: any) => h.master_lat && h.master_lon).map((h: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={styles.gpsPoint}
              onPress={() => {
                Linking.openURL(
                  `https://yandex.ru/maps/?pt=${h.master_lon},${h.master_lat}&z=16`
                );
              }}
            >
              <Text style={styles.gpsStatus}>
                {statusLabels[h.new_status] || h.new_status}: {h.master_lat.toFixed(4)}, {h.master_lon.toFixed(4)}
              </Text>
              <Text style={styles.gpsTime}>{h.changed_at ? new Date(h.changed_at).toLocaleString('ru-RU') : ''}</Text>
              <Text style={{ fontSize: 10, color: '#1677ff' }}>🗺️ Открыть на карте</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={takePhoto}>
          <Text style={styles.toolText}>📷 Фото</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={takeVideo}>
          <Text style={styles.toolText}>🎥 Видео</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={callClient}>
          <Text style={styles.toolText}>📞 Позвонить</Text>
        </TouchableOpacity>
      </View>

      {media.length > 0 && (
        <View style={styles.mediaRow}>
          {media.map((m: any) => m.file_type === 'image' ? (
            <Image key={m.id} source={{ uri: m.file }} style={styles.thumb} />
          ) : (
            <View key={m.id} style={styles.videoTag}><Text>🎬 Видео</Text></View>
          ))}
        </View>
      )}

      {canAct && (
        <View style={styles.actions}>
          {s === 'assigned' && (
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#13c2c2' }]} onPress={() => changeStatus('accepted')}>
              <Text style={styles.btnText}>✅ Принять</Text>
            </TouchableOpacity>
          )}
          {s === 'accepted' && (
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#fa8c16' }]} onPress={() => changeStatus('in_progress')}>
              <Text style={styles.btnText}>▶️ Начать</Text>
            </TouchableOpacity>
          )}
          {s === 'in_progress' && (
            <>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#52c41a' }]} onPress={() => changeStatus('completed')}>
                <Text style={styles.btnText}>✅ Выполнено</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: '#faad14' }]} onPress={() => changeStatus('paused')}>
                <Text style={styles.btnText}>⏸ Пауза</Text>
              </TouchableOpacity>
            </>
          )}
          {s === 'paused' && (
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#fa8c16' }]} onPress={() => changeStatus('in_progress')}>
              <Text style={styles.btnText}>▶️ Продолжить</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ff4d4f' }]} onPress={() => changeStatus('cancelled')}>
            <Text style={styles.btnText}>❌ Отменить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!canAct && (
        <View style={styles.doneBlock}>
          <Text style={styles.doneText}>✅ Заявка {statusLabels[order.status].toLowerCase()}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  requiredBadge: { color: '#fa8c16', fontSize: 12, fontWeight: '600' },
  orderNum: { fontSize: 22, fontWeight: '800', color: '#333', marginBottom: 8 },
  client: { fontSize: 18, color: '#333', marginBottom: 4 },
  phone: { fontSize: 15, color: '#1677ff', marginBottom: 4 },
  address: { fontSize: 15, color: '#666', marginBottom: 4 },
  desc: { fontSize: 14, color: '#444', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  navHint: { fontSize: 11, color: '#1677ff', marginBottom: 4 },
  mapContainer: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  mapTitle: { fontWeight: '700', fontSize: 14, marginBottom: 8, color: '#1677ff' },
  gpsPoint: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  gpsStatus: { fontSize: 12, color: '#333' },
  gpsTime: { fontSize: 10, color: '#999' },
  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toolBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, elevation: 1 },
  toolText: { fontSize: 14 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#ddd' },
  videoTag: { padding: 8, backgroundColor: '#e6f7ff', borderRadius: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  doneBlock: { backgroundColor: '#f6ffed', padding: 20, borderRadius: 10, borderWidth: 1, borderColor: '#b7eb8f', alignItems: 'center' },
  doneText: { color: '#52c41a', fontSize: 16, fontWeight: '600' },
});

export default OrderDetailScreen;
