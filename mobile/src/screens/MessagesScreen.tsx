import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView,
  Platform, ScrollView, RefreshControl, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync, createAudioPlayer,
} from 'expo-audio';
import api, { getServerBaseUrl } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────────
interface Msg {
  id: number;
  sender: number;
  sender_name: string;
  recipient: number | null;
  recipient_name: string;
  is_broadcast: boolean;
  text: string;
  created_at: string;
  unread: boolean;
  attachment_url?: string;
  attachment_type?: '' | 'image' | 'file' | 'audio';
  attachment_name?: string;
  attachment_size?: number;
  attachment_duration?: number;
}

interface ChatUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  role: string;
  role_label?: string;
}

interface Conversation {
  user_id: number;
  full_name: string;
  username: string;
  role: string;
  last_text: string;
  last_at: string | null;
  last_is_mine?: boolean;
  unread: number;
}

interface ActiveChat {
  id: number;        // 0 = общий чат
  name: string;
  role: string;
}

// ─────────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  admin: '#ff4d4f', dispatcher: '#1677ff', master: '#52c41a',
  installer: '#13c2c2', clerk: '#722ed1', accountant: '#fa8c16',
  cashier: '#eb2f96', engineer: '#2f54eb', supervisor: '#fa541c',
  broadcast: '#1677ff',
};

const initials = (name: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('') || '?';

const fmtTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const fmtDay = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Сегодня';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const fmtSize = (bytes?: number) => {
  const b = bytes || 0;
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`;
  return `${(b / 1024 / 1024).toFixed(1)} МБ`;
};

const fmtDur = (sec?: number) => {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|heic|bmp)(\?|$)/i.test(url);

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  mp4: 'video/mp4', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
};

const mimeForName = (name?: string) => {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXT[ext] || '*/*';
};

/** Иконка по типу файла */
const fileIcon = (name?: string) => {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return '📕';
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return '📄';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📈';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return '🖼';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎬';
  return '📎';
};

// ─────────────────────────────────────────────────────────────────
// Экран
// ─────────────────────────────────────────────────────────────────
const MessagesScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const playerRef = useRef<any>(null);
  const chatRef = useRef<ActiveChat | null>(null);
  chatRef.current = activeChat;

  // ── Аудио-запись ──
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const recSeconds = Math.round((recState?.durationMillis || 0) / 1000);

  // ── Загрузка данных ──
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations/');
      setConversations(res.data?.conversations || []);
      setTotalUnread(res.data?.total_unread || 0);
    } catch (e) {
      // тихо
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    const chat = chatRef.current;
    try {
      const params: any = { page_size: 100 };
      if (chat && chat.id !== 0) params.recipient = chat.id;
      const res = await api.get('/messages/', { params });
      const raw = res.data.results || res.data;
      const list: Msg[] = Array.isArray(raw) ? raw : [];
      setMessages([...list].reverse());

      const toRead = list.filter(m => m.unread && m.sender !== user?.id).slice(0, 50);
      if (toRead.length > 0) {
        Promise.all(toRead.map(m => api.post(`/messages/${m.id}/read/`).catch(() => null)));
      }
    } catch (e) {
      // тихо
    }
  }, [user?.id]);

  const fetchUsers = useCallback(async (search = '') => {
    try {
      const res = await api.get('/messages/users/', { params: { search } });
      setUsers(res.data || []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, [fetchConversations, fetchUsers]);

  // Открытие чата по параметрам (из уведомления или из заявки)
  useEffect(() => {
    const rid = route?.params?.recipientId;
    if (rid !== undefined && rid !== null) {
      const id = Number(rid);
      const name = route.params?.recipientName || (id === 0 ? 'Общий чат' : 'Сотрудник');
      setActiveChat({ id, name, role: id === 0 ? 'broadcast' : (route.params?.role || 'master') });
      navigation.setParams?.({ recipientId: undefined, recipientName: undefined, role: undefined });
    }
  }, [route?.params?.recipientId]);

  // Периодическое обновление
  useEffect(() => {
    const interval = setInterval(() => {
      if (chatRef.current) fetchMessages();
      else fetchConversations();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchMessages, fetchConversations]);

  // Загрузка сообщений при смене активного чата
  useEffect(() => {
    if (!activeChat) { setMessages([]); return; }
    fetchMessages();
  }, [activeChat?.id, fetchMessages]);

  // WebSocket — мгновенное обновление
  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;

    const connect = async () => {
      try {
        const [token, base] = await Promise.all([
          AsyncStorage.getItem('token'),
          getServerBaseUrl(),
        ]);
        if (!token || !base || closed) return;
        const wsBase = base.replace(/^http/i, 'ws');
        socket = new WebSocket(`${wsBase}/ws/notifications/?token=${token}`);
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'chat_message') {
              if (chatRef.current) fetchMessages();
              else fetchConversations();
            }
          } catch (e) { /* ignore */ }
        };
        socket.onclose = () => { if (!closed) setTimeout(connect, 8000); };
      } catch (e) { /* ignore */ }
    };
    connect();
    return () => { closed = true; socket?.close(); };
  }, [fetchMessages, fetchConversations]);

  // Остановка плеера при уходе с экрана
  useEffect(() => () => { try { playerRef.current?.remove?.(); } catch (e) {} }, []);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ── Отправка текста ──
  const sendMessage = async () => {
    const body = text.trim();
    if (!body || !activeChat) return;
    setSending(true);
    try {
      const payload: any = { text: body };
      if (activeChat.id === 0) {
        payload.is_broadcast = true;
        payload.recipient = null;
      } else {
        payload.recipient = activeChat.id;
        payload.is_broadcast = false;
      }
      await api.post('/messages/', payload);
      setText('');
      await fetchMessages();
    } catch (e: any) {
      const d = e?.response?.data;
      Alert.alert('Ошибка', d?.text?.[0] || d?.error || 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  };

  // ── Отправка файла ──
  const uploadFile = async (asset: { uri: string; name: string; mime: string; type: 'image' | 'file' | 'audio'; duration?: number }) => {
    const chat = chatRef.current;
    if (!chat) return;
    setSending(true);
    try {
      const form = new FormData();
      if (chat.id === 0) {
        form.append('is_broadcast', 'true');
      } else {
        form.append('recipient', String(chat.id));
        form.append('is_broadcast', 'false');
      }
      form.append('attachment_type', asset.type);
      if (asset.duration) form.append('attachment_duration', String(Math.round(asset.duration)));
      form.append('attachment', { uri: asset.uri, name: asset.name, type: asset.mime } as any);

      await api.post('/messages/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });
      await fetchMessages();
    } catch (e: any) {
      const d = e?.response?.data;
      Alert.alert('Ошибка', d?.attachment?.[0] || d?.text?.[0] || d?.detail || 'Не удалось отправить файл');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    try {
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const ext = (a.uri.split('.').pop() || 'jpg').toLowerCase();
      uploadFile({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}.${ext}`,
        mime: a.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        type: 'image',
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось выбрать фото');
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      uploadFile({
        uri: a.uri,
        name: a.name || `file_${Date.now()}`,
        mime: a.mimeType || 'application/octet-stream',
        type: 'file',
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось выбрать файл');
    }
  };

  // ── Голосовое ──
  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Нет доступа к микрофону', 'Разрешите доступ в настройках приложения');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Ошибка записи', e?.message || 'Не удалось начать запись');
      setRecording(false);
    }
  };

  const stopRecording = async (send: boolean) => {
    const dur = Math.max(1, recSeconds);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecording(false);
      if (send && uri) {
        uploadFile({
          uri,
          name: `voice_${Date.now()}.m4a`,
          mime: 'audio/m4a',
          type: 'audio',
          duration: dur,
        });
      }
    } catch (e: any) {
      setRecording(false);
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить запись');
    }
  };

  // ── Воспроизведение ──
  const playAudio = async (msg: Msg) => {
    try {
      if (playingId === msg.id) {
        playerRef.current?.pause();
        setPlayingId(null);
        return;
      }
      if (!playerRef.current) {
        playerRef.current = createAudioPlayer({ uri: msg.attachment_url });
      } else {
        playerRef.current.replace({ uri: msg.attachment_url });
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      playerRef.current.play();
      setPlayingId(msg.id);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось воспроизвести аудио');
    }
  };

  const openChat = (id: number, name: string, role: string) => {
    setActiveChat({ id, name, role });
    setShowPicker(false);
    setSearchUser('');
  };

  /** Открыть документ (PDF и др.) системным просмотрщиком */
  const openDocument = async (msg: Msg) => {
    const url = msg.attachment_url;
    if (!url) return;
    const mime = mimeForName(msg.attachment_name);
    const fallback = async () => {
      try { await Linking.openURL(url); } catch (e) {
        Alert.alert('Не удалось открыть', 'Скопируйте ссылку и откройте в браузере:\n' + url);
      }
    };
    if (Platform.OS !== 'android') {
      await fallback();
      return;
    }
    setOpeningId(msg.id);
    try {
      const safeName = (msg.attachment_name || `file_${msg.id}`).replace(/[^\w.\-]+/g, '_');
      const dest = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;
      const dl = await FileSystem.downloadAsync(url, dest);
      let contentUri = dl.uri;
      try {
        contentUri = await FileSystem.getContentUriAsync(dl.uri);
      } catch (e) { /* оставляем file:// */ }
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: mime,
      });
    } catch (e: any) {
      console.log('[Chat] open document error:', e?.message || e);
      await fallback();
    } finally {
      setOpeningId(null);
    }
  };

  // ── Рендер списка диалогов ──
  const renderConversation = ({ item }: { item: Conversation }) => {
    const color = ROLE_COLORS[item.role] || theme.primary;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openChat(item.user_id, item.full_name, item.role)}
        style={[styles.convRow, { backgroundColor: theme.card, borderColor: theme.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.avatarText, { color }]}>
            {item.role === 'broadcast' ? '📢' : initials(item.full_name)}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text numberOfLines={1} style={[styles.convName, { color: theme.text }]}>
              {item.full_name}
            </Text>
            <Text style={[styles.convTime, { color: theme.textTertiary }]}>{fmtTime(item.last_at)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text
              numberOfLines={1}
              style={[styles.convLast, { color: theme.textSecondary, flex: 1, fontWeight: item.unread ? '600' : '400' }]}
            >
              {item.last_is_mine ? 'Вы: ' : ''}{item.last_text || 'Нет сообщений'}
            </Text>
            {item.unread > 0 && (
              <View style={styles.convBadge}>
                <Text style={styles.convBadgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Рендер сообщения ──
  const renderMessage = ({ item, index }: { item: Msg; index: number }) => {
    const isMine = item.sender === user?.id;
    const prev = messages[index - 1];
    const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
    const time = fmtTime(item.created_at);
    const isImage = item.attachment_type === 'image' && !!item.attachment_url;
    const isAudio = item.attachment_type === 'audio' && !!item.attachment_url;
    const isFile = item.attachment_type === 'file' && !!item.attachment_url;
    const hasMedia = isImage || isAudio || isFile;

    return (
      <View>
        {showDay && (
          <View style={styles.dayWrap}>
            <Text style={[styles.dayText, { color: theme.textTertiary, backgroundColor: theme.chipBg }]}>
              {fmtDay(item.created_at)}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
          {!isMine && (
            <Text style={[styles.msgSender, { color: theme.textTertiary }]}>{item.sender_name}</Text>
          )}
          <View style={[
            styles.msgBubble,
            isMine
              ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: theme.card, borderBottomLeftRadius: 4, borderColor: theme.border, borderWidth: 1 },
          ]}>
            {item.is_broadcast && (
              <Text style={[styles.broadcastTag, { color: isMine ? 'rgba(255,255,255,0.75)' : theme.textTertiary }]}>
                📢 Всем
              </Text>
            )}

            {isImage && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setViewer(item.attachment_url!)}>
                <Image
                  source={{ uri: item.attachment_url }}
                  style={styles.msgImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}

            {isAudio && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => playAudio(item)}
                style={[
                  styles.audioRow,
                  { backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : theme.inputBg },
                ]}
              >
                <Text style={{ fontSize: 18 }}>{playingId === item.id ? '⏸' : '▶️'}</Text>
                <View style={[styles.audioWave, { backgroundColor: isMine ? 'rgba(255,255,255,0.5)' : theme.border }]} />
                <Text style={{ color: isMine ? '#fff' : theme.textSecondary, fontSize: 12 }}>
                  {fmtDur(item.attachment_duration)}
                </Text>
              </TouchableOpacity>
            )}

            {isFile && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openDocument(item)}
                style={[
                  styles.fileRow,
                  { backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : theme.inputBg },
                ]}
              >
                {openingId === item.id ? (
                  <ActivityIndicator size="small" color={isMine ? '#fff' : theme.primary} />
                ) : (
                  <Text style={{ fontSize: 20 }}>{fileIcon(item.attachment_name)}</Text>
                )}
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: isMine ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>
                    {item.attachment_name || 'Документ'}
                  </Text>
                  <Text style={{ color: isMine ? 'rgba(255,255,255,0.7)' : theme.textTertiary, fontSize: 11 }}>
                    {openingId === item.id ? 'Открываю…' : `${fmtSize(item.attachment_size)} · открыть`}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: isMine ? 'rgba(255,255,255,0.85)' : theme.textTertiary, marginLeft: 6 }}>
                  ⤓
                </Text>
              </TouchableOpacity>
            )}

            {!!item.text?.trim() && (
              <Text style={[styles.msgText, { color: isMine ? '#fff' : theme.text, marginTop: hasMedia ? 6 : 0 }]}>
                {item.text}
              </Text>
            )}

            <Text style={[styles.msgTime, { color: isMine ? 'rgba(255,255,255,0.75)' : theme.textTertiary }]}>
              {time}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Верхняя панель
  // ─────────────────────────────────────────────────────────────
  const Header = (
    <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 6 }]}>
      {activeChat ? (
        <>
          <TouchableOpacity onPress={() => setActiveChat(null)} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text numberOfLines={1} style={styles.headerTitle}>{activeChat.name}</Text>
            <Text style={styles.headerSub}>
              {activeChat.id === 0 ? 'Общий чат — всем сотрудникам' : 'Личный диалог'}
            </Text>
          </View>
          <TouchableOpacity onPress={fetchMessages} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerIconSmall}>🔄</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1, marginLeft: 6 }]}>Сообщения</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => { setShowPicker(true); fetchUsers(); }}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.headerIconSmall}>✏️</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        {Header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Экран списка диалогов
  // ─────────────────────────────────────────────────────────────
  if (!activeChat) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        {Header}
        <FlatList
          data={conversations}
          keyExtractor={c => String(c.user_id)}
          renderItem={renderConversation}
          contentContainerStyle={{ padding: 10, paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await fetchConversations(); setRefreshing(false); }}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 8 }}>Пока нет диалогов</Text>
              <TouchableOpacity
                onPress={() => { setShowPicker(true); fetchUsers(); }}
                style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Начать диалог</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Выбор собеседника */}
        <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Новый диалог</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{ color: theme.primary, fontSize: 15 }}>Закрыть</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.searchInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Поиск по имени или должности…"
                placeholderTextColor={theme.textTertiary}
                value={searchUser}
                onChangeText={(v) => { setSearchUser(v); fetchUsers(v); }}
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                <TouchableOpacity
                  onPress={() => openChat(0, 'Общий чат', 'broadcast')}
                  style={[styles.pickerRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <View style={[styles.avatar, { backgroundColor: '#1677ff22', borderColor: '#1677ff' }]}>
                    <Text style={[styles.avatarText, { color: '#1677ff' }]}>📢</Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Общий чат</Text>
                    <Text style={{ color: theme.textTertiary, fontSize: 12 }}>Сообщение всем сотрудникам</Text>
                  </View>
                </TouchableOpacity>
                {users.filter(u => u.id !== user?.id).map(u => {
                  const name = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                  const role = u.role_label || u.role;
                  const color = ROLE_COLORS[u.role] || theme.primary;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => openChat(u.id, name, u.role)}
                      style={[styles.pickerRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                    >
                      <View style={[styles.avatar, { backgroundColor: color + '22', borderColor: color }]}>
                        <Text style={[styles.avatarText, { color }]}>{initials(name)}</Text>
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={{ color: theme.text, fontWeight: '600' }}>{name}</Text>
                        <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{role}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Экран чата
  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {Header}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 10, paddingBottom: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 36 }}>👋</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 14, marginTop: 6 }}>
                Напишите первое сообщение
              </Text>
            </View>
          }
        />

        {/* Панель ввода */}
        <View style={[
          styles.inputBar,
          { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 6) },
        ]}>
          {recording ? (
            <View style={[styles.recBar, { backgroundColor: theme.inputBg, borderColor: theme.danger }]}>
              <View style={styles.recDot} />
              <Text style={{ color: theme.text, flex: 1, marginLeft: 8 }}>
                🎤 {fmtDur(recSeconds)}
              </Text>
              <TouchableOpacity onPress={() => stopRecording(false)} style={[styles.smallBtn, { backgroundColor: theme.border }]}>
                <Text style={{ color: theme.text, fontSize: 13 }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => stopRecording(true)}
                style={[styles.smallBtn, { backgroundColor: theme.primary, marginLeft: 6 }]}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Отправить</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setShowAttach(true)}
                style={[styles.attachBtn, { backgroundColor: theme.inputBg }]}
                disabled={sending}
              >
                <Text style={{ fontSize: 18, color: theme.textSecondary }}>📎</Text>
              </TouchableOpacity>

              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border,
                  color: theme.text,
                }]}
                placeholder="Сообщение…"
                placeholderTextColor={theme.textTertiary}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
                onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 250)}
              />

              {text.trim() ? (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: sending ? 0.6 : 1 }]}
                  onPress={sendMessage}
                  disabled={sending}
                >
                  {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: sending ? 0.6 : 1 }]}
                  onPress={startRecording}
                  disabled={sending}
                >
                  {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 18 }}>🎤</Text>}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Меню вложений */}
      <Modal visible={showAttach} transparent animationType="fade" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <View style={[styles.attachSheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 12 }]}>
            <Text style={[styles.attachTitle, { color: theme.text }]}>Прикрепить</Text>
            <View style={styles.attachGrid}>
              <TouchableOpacity
                style={styles.attachItem}
                onPress={() => { setShowAttach(false); setTimeout(() => pickImage(true), 250); }}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#1677ff18' }]}>
                  <Text style={{ fontSize: 22 }}>📷</Text>
                </View>
                <Text style={[styles.attachLabel, { color: theme.textSecondary }]}>Камера</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachItem}
                onPress={() => { setShowAttach(false); setTimeout(() => pickImage(false), 250); }}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#52c41a18' }]}>
                  <Text style={{ fontSize: 22 }}>🖼</Text>
                </View>
                <Text style={[styles.attachLabel, { color: theme.textSecondary }]}>Галерея</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachItem}
                onPress={() => { setShowAttach(false); setTimeout(() => pickDocument(), 250); }}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#fa8c1618' }]}>
                  <Text style={{ fontSize: 22 }}>📎</Text>
                </View>
                <Text style={[styles.attachLabel, { color: theme.textSecondary }]}>Документ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Просмотр изображения / документа */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Text style={{ color: '#fff', fontSize: 26 }}>✕</Text>
          </TouchableOpacity>
          {viewer && isImageUrl(viewer) ? (
            <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" />
          ) : (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Документ</Text>
              <Text selectable style={{ color: '#8ab4f8', marginTop: 10, fontSize: 12, textAlign: 'center' }}>
                {viewer}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────
// Стили
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  headerIcon: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
  headerIconSmall: { fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
  headerBadge: {
    backgroundColor: '#ff4d4f', borderRadius: 10, minWidth: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 2,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  convRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  convName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  convTime: { fontSize: 11 },
  convLast: { fontSize: 13 },
  convBadge: {
    backgroundColor: '#ff4d4f', borderRadius: 10, minWidth: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 2, marginLeft: 6,
  },
  convBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  avatar: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },

  msgRow: { marginBottom: 8, maxWidth: '82%' },
  msgRowLeft: { alignSelf: 'flex-start' },
  msgRowRight: { alignSelf: 'flex-end' },
  msgSender: { fontSize: 11, marginBottom: 2, marginLeft: 6 },
  msgBubble: { padding: 9, borderRadius: 16, minWidth: 60 },
  broadcastTag: { fontSize: 10, marginBottom: 3, fontWeight: '700' },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  msgImage: { width: 220, height: 220, borderRadius: 12 },
  audioRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 12, minWidth: 150 },
  audioWave: { flex: 1, height: 2, borderRadius: 1, marginHorizontal: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 12, minWidth: 180 },

  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayText: { fontSize: 11, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  textInput: {
    flex: 1, minHeight: 40, maxHeight: 110,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    borderRadius: 20, borderWidth: 1, fontSize: 15,
    marginRight: 6, textAlignVertical: 'center',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  recBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff4d4f' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  attachSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 14, paddingHorizontal: 16 },
  attachTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  attachGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 6 },
  attachItem: { alignItems: 'center', width: 88 },
  attachCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  attachLabel: { fontSize: 12, marginTop: 6 },
  modalSheet: {
    maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  searchInput: {
    height: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginBottom: 8, fontSize: 14,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 44, right: 20, zIndex: 10, padding: 8 },
});

export default MessagesScreen;
