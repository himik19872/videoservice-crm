import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, List, Button, Space, Select, Spin, Empty, Badge } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ScheduleOrder {
  id: number;
  number: string;
  order_type: string;
  status: string;
  address: string;
  master: string;
  client: string;
  scheduled_at: string;
  priority: string;
}

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ScheduleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchScheduledOrders();
  }, []);

  const fetchScheduledOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/calendar/');
      setOrders(res.data || []);
    } catch (e) {
      // fallback: filter orders with scheduled_at
      try {
        const res = await api.get('/orders/?page_size=200&scheduled=true');
        const all = res.data.results || res.data || [];
        setOrders(all.filter((o: any) => o.scheduled_at));
      } catch {
        console.error('Calendar error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const getDatesForView = (): string[] => {
    const dates: string[] = [];
    const start = dayjs(selectedDate).startOf(viewMode === 'day' ? 'day' : viewMode === 'week' ? 'week' : 'month');
    const end = start.add(viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : dayjs(selectedDate).daysInMonth(), 'day');

    let current = start;
    while (current.isBefore(end)) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }
    return dates;
  };

  const dates = getDatesForView();
  const today = dayjs().format('YYYY-MM-DD');

  const getOrdersForDate = (date: string) =>
    orders.filter(o => dayjs(o.scheduled_at).format('YYYY-MM-DD') === date);

  const getStatusColor = (s: string) => {
    const colors: Record<string, string> = {
      new: 'blue', assigned: 'purple', accepted: 'cyan',
      in_progress: 'orange', paused: 'gold', need_help: 'red',
      completed: 'green', confirmed: 'green', cancelled: 'default',
    };
    return colors[s] || 'default';
  };

  const getStatusLabel = (s: string) => {
    const labels: Record<string, string> = {
      new: 'Новая', assigned: 'Назначена', accepted: 'Принята',
      in_progress: 'В работе', paused: 'На паузе', need_help: 'Помощь',
      completed: 'Выполнена', confirmed: 'Подтверждена', cancelled: 'Отменена',
    };
    return labels[s] || s;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      <Title level={3}><CalendarOutlined /> Календарь назначений</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => setSelectedDate(dayjs().subtract(1, viewMode).format('YYYY-MM-DD'))}>◀</Button>
        <Select
          value={viewMode}
          onChange={(v: 'day' | 'week' | 'month') => setViewMode(v)}
          style={{ width: 120 }}
          options={[
            { value: 'day', label: '📅 День' },
            { value: 'week', label: '📆 Неделя' },
            { value: 'month', label: '🗓️ Месяц' },
          ]}
        />
        <Button onClick={() => setSelectedDate(today)}>Сегодня</Button>
        <Button onClick={() => setSelectedDate(dayjs().add(1, viewMode).format('YYYY-MM-DD'))}>▶</Button>
        <Text strong style={{ marginLeft: 12 }}>
          {viewMode === 'day'
            ? dayjs(selectedDate).format('DD MMMM YYYY')
            : `${dayjs(dates[0]).format('DD.MM')} — ${dayjs(dates[dates.length - 1]).format('DD.MM.YYYY')}`}
        </Text>
        <Tag style={{ marginLeft: 8 }}>
          Всего назначено: {orders.filter(o => o.scheduled_at).length}
        </Tag>
      </Space>

      {viewMode === 'day' ? (
        // Режим дня
        <Card title={dayjs(selectedDate).format('DD MMMM YYYY (dddd)')}>
          {getOrdersForDate(selectedDate).length === 0 ? (
            <Empty description="Нет заявок на этот день" />
          ) : (
            <List
              dataSource={getOrdersForDate(selectedDate)}
              renderItem={(order) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <List.Item.Meta
                    avatar={<CalendarOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                    title={
                      <Space>
                        <Text strong>{order.number}</Text>
                        <Tag color={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Tag>
                        {order.priority === 'urgent' && <Tag color="red">Срочно</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <Text><UserOutlined /> {order.client} {' · '} 👨‍🔧 {order.master || 'не назначен'}</Text>
                        <br />
                        <Text type="secondary"><EnvironmentOutlined /> {order.address}</Text>
                        <br />
                        <Text type="secondary"><ClockCircleOutlined /> {dayjs(order.scheduled_at).format('HH:mm')}</Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      ) : (
        // Режим недели / месяца
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 600, padding: 4, background: '#f0f0f0', borderRadius: 4 }}>
              {d}
            </div>
          ))}
          {dates.map(date => {
            const dayOrders = getOrdersForDate(date);
            const isToday = date === today;
            return (
              <div
                key={date}
                onClick={() => { setSelectedDate(date); setViewMode('day'); }}
                style={{
                  border: isToday ? '2px solid #1677ff' : '1px solid #f0f0f0',
                  borderRadius: 6,
                  padding: 4,
                  minHeight: viewMode === 'month' ? 60 : 100,
                  background: isToday ? '#e6f7ff' : '#fff',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? '#1677ff' : '#666', marginBottom: 2 }}>
                  {dayjs(date).format('D')}
                  {dayOrders.length > 0 && <Badge count={dayOrders.length} size="small" style={{ marginLeft: 4, backgroundColor: '#1677ff' }} />}
                </div>
                {dayOrders.slice(0, viewMode === 'month' ? 2 : 5).map(o => (
                  <div
                    key={o.id}
                    onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.id}`); }}
                    style={{
                      fontSize: 10,
                      padding: '1px 3px',
                      marginBottom: 1,
                      borderRadius: 3,
                      background: getStatusColor(o.status),
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                    }}
                    title={`${o.number} — ${o.client}\n${o.address}\n${dayjs(o.scheduled_at).format('HH:mm')}`}
                  >
                    {dayjs(o.scheduled_at).format('HH:mm')} {o.number.slice(-4)}
                  </div>
                ))}
                {dayOrders.length > (viewMode === 'month' ? 2 : 5) && (
                  <div style={{ fontSize: 10, color: '#999' }}>
                    +{dayOrders.length - (viewMode === 'month' ? 2 : 5)} ещё
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
