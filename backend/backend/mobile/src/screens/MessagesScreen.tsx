import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

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
}

interface ChatUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
}

const MessagesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState<ChatUser | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUsers, setShowUsers] = useState(false);
  const [unread, setUnread] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [recipient]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={fetchMessages} style={{ marginRight: 8 }}>
          <Text style={{ fontSize: 18 }}>🔄</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchMessages = async () => {
    try {
      const params: any = { page_size: 100 };
      if (recipient) params.recipient = recipient.id;
      const [msgRes, unreadRes] = await Promise.all([
        api.get('/messages/', { params }),
        api.get('/messages/unread_count/'),
      ]);
      const msgs = msgRes.data.results || msgRes.data;
      setMessages(Array.isArray(msgs) ? msgs.reverse() : []);
      setUnread(unreadRes.data.unread || 0);
    } catch (e) {
      console.error('Messages error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/messages/users/');
      setUsers(res.data || []);
    } catch (e) {}
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      await api.post('/messages/', {
        text: text.trim(),
        recipient: recipient?.id || null,
        is_broadcast: !recipient,
      });
      setText('');
      await fetchMessages();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось отправить');
    }
  };

  const getUserLabel = (u: ChatUser) => {
    const name = u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username;
    const roleMap: Record<string, string> = {
      admin: 'Админ', dispatcher: 'Диспетчер', master: 'Мастер',
      installer: 'Монтажник', clerk: 'Делопроизводитель',
      accountant: 'Бухгалтер', cashier: 'Кассир', secretary: 'Секретарь',
      engineer: 'Инженер', supervisor: 'Начальник сервиса',
      operator: 'Оператор', sales: 'Менеджер продаж', warehouse: 'Кладовщик',
      tech_support: 'Техподдержка',
    };
    return `${name} (${roleMap[u.role] || u.role})`;
  };

  const renderMessage = ({ item }: { item: Msg }) => {
    const isMine = item.sender === user?.id;
    const time = item.created_at ? new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMine && (
          <Text style={[styles.msgSender, { color: theme.textTertiary }]}>
            {item.sender_name}
          </Text>
        )}
        <View style={[
          styles.msgBubble,
          isMine
            ? { backgroundColor: theme.primary, alignSelf: 'flex-end' }
            : { backgroundColor: theme.card, alignSelf: 'flex-start' },
        ]}>
          {item.is_broadcast && (
            <Text style={[styles.broadcastTag, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
              📢 Всем
            </Text>
          )}
          <Text style={[styles.msgText, { color: isMine ? '#fff' : theme.text }]}>
            {item.text}
          </Text>
          <Text style={[styles.msgTime, { color: isMine ? 'rgba(255,255,255,0.6)' : theme.textTertiary }]}>
            {time} {isMine && (item.unread ? '✓' : '✓✓')}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with recipient selector */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.recipientBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
          onPress={() => setShowUsers(!showUsers)}
        >
          <Text style={{ color: theme.text, fontSize: 14 }}>
            {recipient ? `👤 ${getUserLabel(recipient)}` : '📢 Всем (broadcast)'}
          </Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* User list dropdown */}
      {showUsers && (
        <View style={[styles.userList, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.userItem, !recipient && { backgroundColor: theme.primary + '20' }]}
            onPress={() => { setRecipient(null); setShowUsers(false); }}
          >
            <Text style={{ color: theme.text }}>📢 Всем (broadcast)</Text>
          </TouchableOpacity>
          {users.filter(u => u.id !== user?.id).map(u => (
            <TouchableOpacity
              key={u.id}
              style={[styles.userItem, recipient?.id === u.id && { backgroundColor: theme.primary + '20' }]}
              onPress={() => { setRecipient(u); setShowUsers(false); }}
            >
              <Text style={{ color: theme.text }}>{getUserLabel(u)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => String(item.id)}
        renderItem={renderMessage}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.textTertiary, fontSize: 16 }}>💬 Нет сообщений</Text>
            <Text style={{ color: theme.textTertiary, fontSize: 13, marginTop: 4 }}>
              Напишите первое сообщение
            </Text>
          </View>
        }
      />

      {/* Input area */}
      <View style={[styles.inputRow, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.textInput, {
            backgroundColor: theme.inputBg,
            borderColor: theme.border,
            color: theme.text,
          }]}
          placeholder="Сообщение..."
          placeholderTextColor={theme.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: text.trim() ? 1 : 0.5 }]}
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text style={styles.sendBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 8, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center',
  },
  recipientBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#ff4d4f', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  userList: {
    maxHeight: 300, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    marginHorizontal: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
  },
  userItem: {
    padding: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  messageList: { flex: 1 },
  messageContent: { padding: 10, paddingBottom: 8 },
  msgRow: { marginBottom: 10, maxWidth: '80%' },
  msgRowLeft: { alignSelf: 'flex-start' },
  msgRowRight: { alignSelf: 'flex-end' },
  msgSender: { fontSize: 11, marginBottom: 2, marginLeft: 4 },
  msgBubble: {
    padding: 10, borderRadius: 14,
    minWidth: 60,
  },
  broadcastTag: { fontSize: 10, marginBottom: 2, fontWeight: '600' },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  empty: { alignItems: 'center', padding: 40 },
  inputRow: {
    flexDirection: 'row', padding: 8,
    borderTopWidth: 1, alignItems: 'flex-end',
  },
  textInput: {
    flex: 1, minHeight: 42, maxHeight: 100,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    borderRadius: 21, borderWidth: 1, fontSize: 15,
    marginRight: 8,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default MessagesScreen;
