import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Statistic, Tag, List, Space, Divider } from 'antd';
import {
  OrderedListOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Order } from '../../types';

const { Title, Text } = Typography;

const MasterDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders/');
      setOrders(response.data.results || response.data);
      calculateStats(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersData: Order[]) => {
    setStats({
      total: ordersData.length,
      new: ordersData.filter((o) => o.status === 'new').length,
      inProgress: ordersData.filter((o) => o.status === 'in_progress').length,
      completed: ordersData.filter((o) => o.status === 'completed').length,
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'blue',
      assigned: 'purple',
      in_progress: 'orange',
      completed: 'green',
      cancelled: 'red',
    };
    return colors[status] || 'default';
  };

  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <Title level={3}>Добро пожаловать, {user?.first_name || user?.username}!</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Всего заявок"
              value={stats.total}
              prefix={<OrderedListOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Новых"
              value={stats.new}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Выполнено"
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="Последние заявки">
            {loading ? (
              <Text>Загрузка...</Text>
            ) : recentOrders.length === 0 ? (
              <Text>Нет заявок</Text>
            ) : (
              <List
                dataSource={recentOrders}
                renderItem={(order) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>Заявка #{order.number}</span>
                          <Tag color={getStatusColor(order.status)}>
                            {order.status === 'new' ? 'Новая' : order.status === 'assigned' ? 'Назначена' : order.status === 'in_progress' ? 'В работе' : order.status === 'completed' ? 'Выполнена' : 'Отменена'}
                          </Tag>
                        </Space>
                      }
                      description={`${order.order_type === 'repair' ? 'Ремонт' : order.order_type === 'connection' ? 'Подключение' : 'Продажа'} - ${order.description}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Статистика по статусам">
            <List
              itemLayout="horizontal"
              dataSource={[
                {
                  title: 'Новые',
                  value: stats.new,
                  color: '#faad14',
                },
                {
                  title: 'В работе',
                  value: stats.inProgress,
                  color: '#1890ff',
                },
                {
                  title: 'Выполненные',
                  value: stats.completed,
                  color: '#52c41a',
                },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.title}
                    description={
                      <Space>
                        <Tag color={item.color}>{item.value}</Tag>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MasterDashboardPage;
