import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, List, Space, Typography, Tag, Select, Badge, message, Spin } from 'antd';
import { SendOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons';
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
      setMessages(msgRes.data.results || msgRes.data);
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
        recipient: recipient || null,
        is_broadcast: !recipient,
      });
      setText('');
      await fetchMessages();
    } catch (e) {
      message.error('Ошибка отправки');
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
            allowClear
            placeholder="Всем (broadcast)"
            style={{ minWidth: 200 }}
            value={recipient}
            onChange={setRecipient}
            options={[
              { value: null as any, label: '📢 Всем сотрудникам' },
              ...users.filter(u => u.id !== user?.id).map(u => ({
                value: u.id,
                label: `${u.full_name} (${u.username})`,
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
                  <div>{msg.text}</div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Поле ввода */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
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
