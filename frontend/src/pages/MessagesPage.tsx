import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, List, Space, Typography, Tag, Select, Badge, message, Spin, Upload } from 'antd';
import { SendOutlined, MessageOutlined, ReloadOutlined, PaperClipOutlined, FileOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

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

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [recipient]);

  // Мгновенная доставка новых сообщений через WebSocket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}/ws/notifications/?token=${token}`;
    let socket: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'chat_message') {
            fetchMessages();
          }
        } catch (e) { /* ignore */ }
      };
      socket.onclose = () => {
        if (!closed) setTimeout(connect, 5000);
      };
    };
    connect();

    return () => { closed = true; socket?.close(); };
  }, [recipient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const params: any = { page_size: 100 };
      if (recipient) params.recipient = recipient;
      const [msgRes, unreadRes] = await Promise.all([
        api.get('/messages/', { params }),
        api.get('/messages/unread_count/'),
      ]);
      const list: Msg[] = msgRes.data.results || msgRes.data;
      setMessages(list);
      setUnread(unreadRes.data.unread || 0);

      // Помечаем входящие как прочитанные (бейдж непрочитанных гаснет)
      const toRead = list.filter(m => m.unread && m.sender !== user?.id).slice(0, 50);
      if (toRead.length > 0) {
        await Promise.all(toRead.map(m => api.post(`/messages/${m.id}/read/`).catch(() => null)));
        setUnread(prev => Math.max(0, prev - toRead.length));
      }
    } catch (e) {
      console.error('Messages error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (search = '') => {
    try {
      const res = await api.get('/messages/users/', { params: { search } });
      setUsers(res.data || []);
    } catch (e) {}
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      await api.post('/messages/', {
        text: text.trim(),
        recipient: recipient || null,
        is_broadcast: !recipient,
      });
      setText('');
      await fetchMessages();
    } catch (e) {
      message.error('Ошибка отправки');
    }
  };

  /** Загрузка файла в текущий чат */
  const uploadAttachment = async (file: File) => {
    const form = new FormData();
    if (recipient) {
      form.append('recipient', String(recipient));
      form.append('is_broadcast', 'false');
    } else {
      form.append('is_broadcast', 'true');
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const type = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext)
      ? 'image'
      : ['m4a', 'aac', 'mp3', 'wav', 'ogg', 'opus'].includes(ext) ? 'audio' : 'file';
    form.append('attachment_type', type);
    form.append('attachment', file);
    try {
      await api.post('/messages/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      message.success('Файл отправлен');
      await fetchMessages();
    } catch (e) {
      message.error('Не удалось отправить файл');
    }
  };

  return (
    <div>
      <Title level={3}>
        <MessageOutlined /> Сообщения
        <Badge count={unread} style={{ marginLeft: 8 }} />
        <Button icon={<ReloadOutlined />} size="small" onClick={fetchMessages} style={{ marginLeft: 12 }}>Обновить</Button>
      </Title>

      <Card bodyStyle={{ padding: 0, height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
        {/* Выбор получателя */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Select
            showSearch
            allowClear
            placeholder="Общий чат (всем)"
            style={{ minWidth: 280 }}
            value={recipient}
            onChange={setRecipient}
            onSearch={(val) => fetchUsers(val)}
            filterOption={false}
            options={[
              { value: undefined as any, label: '📢 Общий чат (всем)' },
              ...users.filter(u => u.id !== user?.id).map(u => ({
                value: u.id,
                label: `${u.full_name} — ${u.role_label || u.role}`,
              })),
            ]}
          />
        </div>

        {/* Сообщения */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>Нет сообщений</div>
          ) : (
            messages.slice().reverse().map(msg => (
              <div
                key={msg.id}
                style={{
                  marginBottom: 8,
                  textAlign: msg.sender === user?.id ? 'right' : 'left',
                }}
              >
                <div style={{
                  display: 'inline-block',
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: msg.sender === user?.id ? '#1677ff' : msg.is_broadcast ? '#fff7e6' : '#f0f0f0',
                  color: msg.sender === user?.id ? '#fff' : '#333',
                  textAlign: 'left',
                }}>
                  <div style={{ fontSize: 11, marginBottom: 2, opacity: 0.8 }}>
                    <strong>{msg.sender_name}</strong>
                    {msg.is_broadcast ? <Tag color="orange" style={{ marginLeft: 4, fontSize: 9 }}>всем</Tag> : msg.recipient_name !== 'Всем' && msg.recipient ? <Tag color="blue" style={{ marginLeft: 4, fontSize: 9 }}>{msg.recipient_name}</Tag> : null}
                    {' · '}{dayjs(msg.created_at).format('HH:mm')}
                  </div>
                  {msg.attachment_type === 'image' && msg.attachment_url && (
                    <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                      <img
                        src={msg.attachment_url}
                        alt="фото"
                        style={{ maxWidth: 260, maxHeight: 260, borderRadius: 8, cursor: 'pointer' }}
                        onClick={() => window.open(msg.attachment_url, '_blank')}
                      />
                    </div>
                  )}
                  {msg.attachment_type === 'audio' && msg.attachment_url && (
                    <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                      <audio controls src={msg.attachment_url} style={{ maxWidth: 260 }} />
                    </div>
                  )}
                  {msg.attachment_type === 'file' && msg.attachment_url && (
                    <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                      <a href={msg.attachment_url} target="_blank" rel="noreferrer"
                         style={{ color: msg.sender === user?.id ? '#e6f4ff' : '#1677ff' }}>
                        <FileOutlined /> {msg.attachment_name || 'Документ'}
                        {msg.attachment_size ? <span style={{ opacity: 0.7 }}> ({Math.round(msg.attachment_size / 1024)} КБ)</span> : null}
                      </a>
                    </div>
                  )}
                  {!!msg.text && <div>{msg.text}</div>}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Поле ввода */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Upload
            showUploadList={false}
            beforeUpload={(file) => { uploadAttachment(file as File); return false; }}
          >
            <Button icon={<PaperClipOutlined />} title="Прикрепить файл" />
          </Upload>
          <TextArea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Введите сообщение..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ flex: 1 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} disabled={!text.trim()}>Отправить</Button>
        </div>
      </Card>
    </div>
  );
};

export default MessagesPage;
