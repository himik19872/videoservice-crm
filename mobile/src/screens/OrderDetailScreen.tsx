import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, Image, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline, cacheSingleOrder, getCachedOrders } from '../contexts/OfflineContext';
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
  const { theme, isDark } = useTheme();
  const { isOnline, addPendingAction } = useOffline();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [media, setMedia] = useState<any[]>([]);
  const [issueOrders, setIssueOrders] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Состояние для модального окна комментария
  const [commentModal, setCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');

  // Состояние для модалки «Отчитаться об использовании материалов»
  const [usageModal, setUsageModal] = useState<any>(null); // io
  const [usageItems, setUsageItems] = useState<Record<number, { used: number; returned: number; returnType: string; oldReturned: boolean }>>({});

  useEffect(() => {
    fetchOrder();
    fetchMedia();
    fetchIssueOrders();
    fetchComments();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}/`);
      setOrder(res.data);
      // Кешируем заявку для офлайн-режима
      await cacheSingleOrder(res.data);
    } catch (e) {
      // При ошибке сети — пробуем загрузить из кеша
      const cached = await getCachedOrders();
      const cachedOrder = cached.find((o: any) => o.id === id);
      if (cachedOrder) {
        setOrder(cachedOrder);
        console.log('[Offline] Order loaded from cache:', id);
      } else {
        Alert.alert('Ошибка', 'Нет сети и заявка не найдена в кеше');
        navigation.goBack();
      }
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

  const fetchIssueOrders = async () => {
    try {
      const res = await api.get(`/issue-orders/?order=${id}`);
      setIssueOrders(res.data.results || res.data || []);
    } catch (e) {}
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/orders/${id}/comments/`);
      setComments(res.data || []);
    } catch (e) {}
  };

  const sendComment = async () => {
    if (!commentInput.trim()) return;
    setSendingComment(true);
    try {
      await api.post(`/orders/${id}/comments/`, { text: commentInput.trim() });
      setCommentInput('');
      fetchComments();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось отправить');
    } finally {
      setSendingComment(false);
    }
  };

  const receiveMaterials = async (issueOrderId: number) => {
    Alert.alert(
      'Подтверждение',
      'Вы подтверждаете получение материалов?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: '✅ Подтверждаю',
          onPress: async () => {
            try {
              await api.post(`/issue-orders/${issueOrderId}/receive/`);
              Alert.alert('Готово', 'Материалы получены');
              fetchIssueOrders();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось');
            }
          },
        },
      ],
    );
  };

  const openUsageModal = (io: any) => {
    const init: Record<number, any> = {};
    io.items.forEach((item: any) => {
      init[item.inventory_item_id] = {
        used: item.quantity_used || 0,
        returned: item.quantity_returned || 0,
        returnType: item.return_type || 'working',
        oldReturned: item.old_item_returned || false,
      };
    });
    setUsageItems(init);
    setUsageModal(io);
  };

  const submitUsage = async () => {
    if (!usageModal) return;
    setUpdating(true);
    try {
      const items = Object.entries(usageItems).map(([itemId, v]) => ({
        item_id: parseInt(itemId),
        quantity_used: v.used,
        quantity_returned: v.returned,
        return_type: v.returnType,
        old_item_returned: v.oldReturned,
      }));
      await api.post(`/issue-orders/${usageModal.id}/report_usage/`, { items });
      Alert.alert('Готово', 'Отчёт об использовании отправлен');
      setUsageModal(null);
      fetchIssueOrders();
      fetchOrder();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось');
    } finally {
      setUpdating(false);
    }
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
    // Если закрываем заявку (completed) — требуем комментарий
    if (status === 'completed' && (!notes || !notes.trim())) {
      setPendingStatus('completed');
      setCommentText('');
      setCommentModal(true);
      return;
    }

    await doChangeStatus(status, notes.trim());
  };

  const doChangeStatus = async (status: string, notes: string) => {
    setUpdating(true);
    setCommentModal(false);
    try {
      let gps: any = {};
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { master_lat: pos.coords.latitude, master_lon: pos.coords.longitude };
        }
      } catch (e) {}

      if (!isOnline) {
        await addPendingAction({
          method: 'PATCH',
          url: `/orders/${id}/`,
          body: { status, notes, ...gps },
          description: `Смена статуса на "${statusLabels[status]}" для заявки ${order?.number}`,
        });
        Alert.alert('Сохранено офлайн', 'Изменение будет отправлено при восстановлении связи');
        setOrder((prev) => prev ? { ...prev, status } : prev);
      } else {
        const payload: any = { status, ...gps };
        if (notes) payload.notes = notes;
        const res = await api.patch(`/orders/${id}/`, payload);
        setOrder(res.data);
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || 'Не удалось изменить статус';
      Alert.alert('Ошибка', errMsg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  if (!order) return null;

  const s = order.status;
  const canAct = !['completed', 'confirmed', 'cancelled'].includes(s);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📴 Офлайн-режим — изменения сохранятся локально</Text>
        </View>
      )}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] }]}>
          <Text style={styles.statusText}>{statusLabels[order.status]}</Text>
        </View>
        {order.photo_report_required && <Text style={styles.requiredBadge}>📸 Фотоотчёт</Text>}
      </View>

      <Text style={[styles.orderNum, { color: theme.text }]}>{order.number}</Text>
      <Text style={[styles.client, { color: theme.text }]}>{order.client_info?.full_name || '—'}</Text>
      <Text style={[styles.phone, { color: theme.primary }]}>📞 {order.client_info?.phone || order.client?.phone || '—'}</Text>
      <TouchableOpacity onPress={() => {
        // Собираем адрес из полей
        const parts: string[] = [];
        if (order.city) parts.push(order.city);
        if (order.street_name) parts.push(order.street_name);
        if (order.house_number) {
          let h = 'д.' + order.house_number;
          if (order.building_number) h += ' к' + order.building_number;
          parts.push(h);
        }
        if (order.apartment) parts.push('кв.' + order.apartment);
        const addr = parts.join(', ') || order.address || '';
        if (!addr) return;

        const encoded = encodeURIComponent(addr);

        // Яндекс.Навигатор — правильный формат: только text_to (без lat_to/lon_to)
        const yandexNavi = `yandexnavi://build_route_on_map?text_to=${encoded}`;
        // 2GIS
        const dgis = `dgis://2gis.ru/routeSearch/to/${encoded}/go`;
        // Яндекс.Карты (браузер — запасной)
        const yandexWeb = `https://yandex.ru/maps/?rtext=~${encoded}&rtt=auto`;

        // Пробуем Яндекс.Навигатор → 2GIS → браузер
        Linking.canOpenURL(yandexNavi).then(canNavi => {
          if (canNavi) {
            Linking.openURL(yandexNavi);
          } else {
            Linking.canOpenURL(dgis).then(can2gis => {
              if (can2gis) {
                Linking.openURL(dgis);
              } else {
                Linking.openURL(yandexWeb);
              }
            }).catch(() => Linking.openURL(yandexWeb));
          }
        }).catch(() => Linking.openURL(yandexWeb));
      }}>
        <Text style={[styles.address, { color: theme.textSecondary }]}>📍 {order.address || [order.city, order.street_name, 'д.' + order.house_number].filter(Boolean).join(', ')}</Text>
        <Text style={[styles.navHint, { color: theme.primary }]}>🚗 Нажмите, чтобы построить маршрут</Text>
      </TouchableOpacity>

      {/* Время визита клиента */}
      {(order.client_available_from || order.client_available_to) && (
        <Text style={[styles.desc, { backgroundColor: '#fff7e6', borderLeftWidth: 3, borderLeftColor: '#fa8c16', marginTop: 10 }]}>
          🏠 Клиент дома: {order.client_available_from || '09:00'} – {order.client_available_to || '18:00'}
        </Text>
      )}

      {order.description ? (
        <Text style={[styles.desc, { color: theme.text, backgroundColor: theme.inputBg }]}>{order.description}</Text>
      ) : null}

      {/* Умный домофон: IP и коды */}
      {(order.entrance_ip || order.entrance_access_code || order.entrance_programming_code) && (
        <View style={[styles.desc, { backgroundColor: '#e6f7ff', borderLeftWidth: 3, borderLeftColor: '#1890ff' }]}>
          {order.entrance_ip ? (
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
              🔌 IP панели: <Text style={{ color: '#1890ff' }}>{order.entrance_ip}</Text>
            </Text>
          ) : null}
          {order.entrance_access_code ? (
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginTop: 4 }}>
              🔑 Код доступа: <Text style={{ color: '#52c41a' }}>{order.entrance_access_code}</Text>
            </Text>
          ) : null}
          {order.entrance_programming_code ? (
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, marginTop: 4 }}>
              ⚙️ Код программирования: <Text style={{ color: '#fa8c16' }}>{order.entrance_programming_code}</Text>
            </Text>
          ) : null}
        </View>
      )}

      {/* Финансовая информация */}
      {order.cost != null && (
        <View style={[styles.financeRow, { backgroundColor: theme.card }]}>
          <Text style={[styles.costLabel, { color: theme.textSecondary }]}>
            💰 Стоимость: <Text style={{ color: theme.text, fontWeight: '700' }}>{order.cost} ₽</Text>
          </Text>
          {order.payment_type && (
            <Text style={[styles.paymentType, { color: theme.textTertiary }]}>
              {order.payment_type === 'cash' ? '💵 Наличные' : order.payment_type === 'cashless' ? '🏦 Безналичные' : order.payment_type}
            </Text>
          )}
          <Text style={{ color: order.is_paid ? theme.success : theme.warning, fontWeight: '600', fontSize: 13 }}>
            {order.is_paid ? '✅ Оплачено' : '⚠️ Не оплачено'}
          </Text>
        </View>
      )}

      {/* GPS-история мастера */}
      {order.history && order.history.filter((h: any) => h.master_lat && h.master_lon).length > 0 && (
        <View style={[styles.mapContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.mapTitle, { color: theme.primary }]}>📍 GPS-история мастера</Text>
          {order.history.filter((h: any) => h.master_lat && h.master_lon).map((h: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={[styles.gpsPoint, { borderBottomColor: theme.border }]}
              onPress={() => {
                Linking.openURL(
                  `https://yandex.ru/maps/?pt=${h.master_lon},${h.master_lat}&z=16`
                );
              }}
            >
              <Text style={[styles.gpsStatus, { color: theme.text }]}>
                {statusLabels[h.new_status] || h.new_status}: {h.master_lat.toFixed(4)}, {h.master_lon.toFixed(4)}
              </Text>
              <Text style={[styles.gpsTime, { color: theme.textTertiary }]}>{h.changed_at ? new Date(h.changed_at).toLocaleString('ru-RU') : ''}</Text>
              <Text style={{ fontSize: 10, color: theme.primary }}>🗺️ Открыть на карте</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Материалы со склада */}
      {issueOrders.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>📦 Материалы со склада</Text>
          {issueOrders.map((io: any) => (
            <View key={io.id} style={[styles.materialCard, { backgroundColor: theme.card }]}>
              <View style={styles.materialCardHeader}>
                <Text style={[styles.materialCardTitle, { color: theme.text }]}>
                  Ордер №{io.id}
                </Text>
                <View style={[styles.miniBadge, { backgroundColor: io.status === 'pending' ? '#fa8c16' : io.status === 'received' ? '#13c2c2' : '#52c41a' }]}>
                  <Text style={styles.miniBadgeText}>{io.status_display}</Text>
                </View>
              </View>
              <Text style={[styles.materialMaster, { color: theme.textSecondary }]}>
                {io.master_name} · {new Date(io.issued_at).toLocaleDateString('ru-RU')}
              </Text>
              {io.items.map((item: any) => (
                <View key={item.id} style={[styles.materialItem, { borderBottomColor: theme.border }]}>
                  <View style={styles.materialItemHeader}>
                    <Text style={[styles.materialItemName, { color: theme.text }]}>{item.item_name}</Text>
                    {item.source === 'master_zip' ? (
                      <View style={[styles.sourceBadge, { backgroundColor: '#f9f0ff', borderColor: '#d3adf7' }]}>
                        <Text style={[styles.sourceBadgeText, { color: '#722ed1' }]}>🎒 ЗИП</Text>
                      </View>
                    ) : (
                      <View style={[styles.sourceBadge, { backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }]}>
                        <Text style={[styles.sourceBadgeText, { color: '#1677ff' }]}>🏭 Склад</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.materialItemRow}>
                    <Text style={[styles.materialQty, { color: theme.textSecondary }]}>Выдано: {item.quantity_issued}</Text>
                    <Text style={[styles.materialQty, { color: theme.textSecondary }]}>Остаток: {item.remaining}</Text>
                  </View>
                  {item.barcode ? <Text style={[styles.materialBarcode, { color: theme.textTertiary }]}>🏷️ {item.barcode}</Text> : null}
                </View>
              ))}
              {io.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.receiveBtn, { backgroundColor: theme.primary }]}
                  onPress={() => receiveMaterials(io.id)}
                >
                  <Text style={styles.receiveBtnText}>✅ Подтвердить получение</Text>
                </TouchableOpacity>
              )}
              {io.status === 'received' && (
                <TouchableOpacity
                  style={[styles.receiveBtn, { backgroundColor: '#fa8c16' }]}
                  onPress={() => openUsageModal(io)}
                >
                  <Text style={styles.receiveBtnText}>📝 Отчитаться об использовании</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Модалка: отчёт об использовании материалов */}
      {usageModal && (
        <Modal
          visible={!!usageModal}
          animationType="slide"
          transparent
          onRequestClose={() => setUsageModal(null)}
        >
          <View style={[styles.usageOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.usageModal, { backgroundColor: theme.card }]}>
              <Text style={[styles.usageTitle, { color: theme.text }]}>📝 Использование материалов</Text>
              <Text style={[styles.usageSubtitle, { color: theme.textSecondary }]}>
                Ордер №{usageModal.id} — укажите, сколько использовано и что вернуть
              </Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {usageModal.items.map((item: any) => {
                  const u = usageItems[item.inventory_item_id];
                  if (!u) return null;
                  return (
                    <View key={item.id} style={[styles.usageItem, { borderBottomColor: theme.border }]}>
                      <Text style={[styles.usageItemName, { color: theme.text }]}>{item.item_name}</Text>
                      <Text style={[styles.usageItemMeta, { color: theme.textTertiary }]}>
                        Выдано: {item.quantity_issued} · Остаток: {item.remaining}
                      </Text>
                      <View style={styles.usageRow}>
                        <View style={styles.usageField}>
                          <Text style={[styles.usageLabel, { color: theme.textSecondary }]}>Использовано</Text>
                          <View style={styles.usageCounter}>
                            <TouchableOpacity style={styles.usageCounterBtn} onPress={() => setUsageItems(prev => ({ ...prev, [item.inventory_item_id]: { ...prev[item.inventory_item_id], used: Math.max(0, prev[item.inventory_item_id].used - 1) } }))}>
                              <Text style={styles.usageCounterBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={[styles.usageCounterValue, { color: theme.text }]}>{u.used}</Text>
                            <TouchableOpacity style={styles.usageCounterBtn} onPress={() => setUsageItems(prev => ({ ...prev, [item.inventory_item_id]: { ...prev[item.inventory_item_id], used: Math.min(item.remaining + prev[item.inventory_item_id].returned, prev[item.inventory_item_id].used + 1) } }))}>
                              <Text style={styles.usageCounterBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.usageField}>
                          <Text style={[styles.usageLabel, { color: theme.textSecondary }]}>Возврат</Text>
                          <View style={styles.usageCounter}>
                            <TouchableOpacity style={styles.usageCounterBtn} onPress={() => setUsageItems(prev => ({ ...prev, [item.inventory_item_id]: { ...prev[item.inventory_item_id], returned: Math.max(0, prev[item.inventory_item_id].returned - 1) } }))}>
                              <Text style={styles.usageCounterBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={[styles.usageCounterValue, { color: theme.text }]}>{u.returned}</Text>
                            <TouchableOpacity style={styles.usageCounterBtn} onPress={() => setUsageItems(prev => ({ ...prev, [item.inventory_item_id]: { ...prev[item.inventory_item_id], returned: Math.min(item.remaining - prev[item.inventory_item_id].used, prev[item.inventory_item_id].returned + 1) } }))}>
                              <Text style={styles.usageCounterBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      {/* Тип возврата */}
                      <View style={styles.usageReturnRow}>
                        <Text style={[styles.usageLabel, { color: theme.textSecondary }]}>Куда сдать:</Text>
                        <View style={styles.usageReturnTypes}>
                          {[
                            { v: 'working', l: '✅ Рабочее' },
                            { v: 'repair', l: '🔧 В ремонт' },
                            { v: 'defect', l: '🗑 Брак' },
                          ].map(rt => (
                            <TouchableOpacity
                              key={rt.v}
                              style={[styles.usageReturnType, { borderColor: theme.border }, u.returnType === rt.v && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                              onPress={() => setUsageItems(prev => ({ ...prev, [item.inventory_item_id]: { ...prev[item.inventory_item_id], returnType: rt.v } }))}
                            >
                              <Text style={[styles.usageReturnTypeText, { color: u.returnType === rt.v ? '#fff' : theme.textSecondary }]}>{rt.l}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.usageModalButtons}>
                <TouchableOpacity style={[styles.usageCancelBtn, { borderColor: theme.border }]} onPress={() => setUsageModal(null)}>
                  <Text style={{ color: theme.textSecondary }}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.usageSubmitBtn, { backgroundColor: theme.primary }]} onPress={submitUsage}>
                  <Text style={styles.usageSubmitText}>Отправить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Комментарии / диалог */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>💬 Обсуждение</Text>
        {comments.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textTertiary }]}>Пока нет комментариев</Text>
        ) : (
          comments.slice(-20).map((c: any) => (
            <View key={c.id} style={[styles.commentItem, { backgroundColor: theme.card }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: theme.primary }]}>{c.author_name}</Text>
                <Text style={[styles.commentTime, { color: theme.textTertiary }]}>
                  {new Date(c.created_at).toLocaleString('ru-RU')}
                </Text>
              </View>
              <Text style={[styles.commentText, { color: theme.text }]}>{c.text}</Text>
            </View>
          ))
        )}
        <View style={styles.commentInputRow}>
          <TextInput
            style={[styles.commentInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            placeholder="Комментарий..."
            placeholderTextColor={theme.textTertiary}
            value={commentInput}
            onChangeText={setCommentInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendComment}
          />
          <TouchableOpacity
            style={[styles.commentSendBtn, { backgroundColor: theme.primary, opacity: commentInput.trim() ? 1 : 0.5 }]}
            onPress={sendComment}
            disabled={!commentInput.trim() || sendingComment}
          >
            <Text style={styles.commentSendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.toolBtn, { backgroundColor: theme.card }]} onPress={takePhoto}>
          <Text style={[styles.toolText, { color: theme.text }]}>📷 Фото</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toolBtn, { backgroundColor: theme.card }]} onPress={takeVideo}>
          <Text style={[styles.toolText, { color: theme.text }]}>🎥 Видео</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toolBtn, { backgroundColor: theme.card }]} onPress={callClient}>
          <Text style={[styles.toolText, { color: theme.text }]}>📞 Позвонить</Text>
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

      {/* Кнопка приёма оплаты */}
      {canAct && order.cost != null && !order.is_paid && (
        <TouchableOpacity
          style={[styles.payBtn, { backgroundColor: theme.warning }]}
          onPress={() => navigation.navigate('AddPayment', { orderId: order.id, orderNumber: order.number, orderCost: order.cost })}
        >
          <Text style={styles.payBtnText}>💰 Принять оплату</Text>
        </TouchableOpacity>
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
        <View style={[styles.doneBlock, { backgroundColor: isDark ? '#1a3a1a' : '#f6ffed', borderColor: isDark ? '#2d6a2d' : '#b7eb8f' }]}>
          <Text style={[styles.doneText, { color: theme.success }]}>✅ Заявка {statusLabels[order.status].toLowerCase()}</Text>
        </View>
      )}

      {/* Модальное окно для комментария при закрытии заявки */}
      <Modal
        visible={commentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📝 Комментарий обязателен</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Опишите выполненные работы для заявки #{order?.number}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                color: theme.text,
              }]}
              placeholder="Что было сделано, какие материалы использованы..."
              placeholderTextColor={theme.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.border }]}
                onPress={() => { setCommentModal(false); setCommentText(''); }}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#52c41a', opacity: commentText.trim() ? 1 : 0.5 }]}
                onPress={() => {
                  if (commentText.trim()) {
                    doChangeStatus(pendingStatus, commentText.trim());
                    setCommentText('');
                  }
                }}
                disabled={!commentText.trim()}
              >
                <Text style={styles.modalBtnTextWhite}>✅ Завершить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  offlineBanner: { backgroundColor: '#ff4d4f', padding: 8, borderRadius: 8, marginBottom: 10 },
  offlineBannerText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  requiredBadge: { color: '#fa8c16', fontSize: 12, fontWeight: '600' },
  orderNum: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  client: { fontSize: 18, marginBottom: 4 },
  phone: { fontSize: 15, marginBottom: 4 },
  address: { fontSize: 15, marginBottom: 4 },
  desc: { fontSize: 14, padding: 12, borderRadius: 8, marginBottom: 12 },
  navHint: { fontSize: 11, marginBottom: 4 },
  financeRow: { padding: 12, borderRadius: 8, marginBottom: 12, elevation: 1 },
  costLabel: { fontSize: 14, marginBottom: 2 },
  paymentType: { fontSize: 12, marginBottom: 2 },
  payBtn: { padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  mapContainer: { padding: 12, borderRadius: 8, marginBottom: 12 },
  mapTitle: { fontWeight: '700', fontSize: 14, marginBottom: 8 },
  gpsPoint: { paddingVertical: 4, borderBottomWidth: 1 },
  gpsStatus: { fontSize: 12 },
  gpsTime: { fontSize: 10 },
  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toolBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, elevation: 1 },
  toolText: { fontSize: 14 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#ddd' },
  videoTag: { padding: 8, backgroundColor: '#e6f7ff', borderRadius: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  doneBlock: { padding: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  doneText: { fontSize: 16, fontWeight: '600' },
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%', borderRadius: 14, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderRadius: 10,
    padding: 12, fontSize: 15,
    minHeight: 100, marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  modalBtnText: { fontSize: 14, fontWeight: '600' },
  modalBtnTextWhite: { color: '#fff', fontSize: 14, fontWeight: '700' },
  // Материалы
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8 },
  emptyText: { fontSize: 13, fontStyle: 'italic' },
  materialCard: { borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1 },
  materialCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  materialCardTitle: { fontWeight: '700', fontSize: 14 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  miniBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  materialMaster: { fontSize: 12, marginBottom: 8 },
  materialItem: { paddingVertical: 6, borderBottomWidth: 1 },
  materialItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  materialItemName: { fontSize: 13, fontWeight: '600', flex: 1 },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
  materialItemRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  materialQty: { fontSize: 12 },
  materialBarcode: { fontSize: 11 },
  receiveBtn: { marginTop: 10, padding: 10, borderRadius: 8, alignItems: 'center' },
  receiveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Отчёт об использовании
  usageOverlay: { flex: 1, justifyContent: 'center', padding: 16 },
  usageModal: { borderRadius: 14, padding: 16, maxHeight: '80%' },
  usageTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  usageSubtitle: { fontSize: 12, marginBottom: 12 },
  usageItem: { paddingVertical: 10, borderBottomWidth: 1 },
  usageItemName: { fontSize: 14, fontWeight: '600' },
  usageItemMeta: { fontSize: 11, marginTop: 2 },
  usageRow: { flexDirection: 'row', gap: 24, marginTop: 8 },
  usageField: {},
  usageLabel: { fontSize: 11 },
  usageCounter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  usageCounterBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  usageCounterBtnText: { fontSize: 18, fontWeight: '700', color: '#555' },
  usageCounterValue: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  usageReturnRow: { marginTop: 10 },
  usageReturnTypes: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  usageReturnType: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  usageReturnTypeText: { fontSize: 11, fontWeight: '600' },
  usageModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  usageCancelBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  usageSubmitBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  usageSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Комментарии
  commentItem: { borderRadius: 8, padding: 10, marginBottom: 6 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontWeight: '700', fontSize: 13 },
  commentTime: { fontSize: 10 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, maxHeight: 80 },
  commentSendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  commentSendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

export default OrderDetailScreen;
