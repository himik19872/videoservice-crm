import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Statistic, Tag, List, Space, Button } from 'antd';
import {
  OrderedListOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type { Order, Client, Equipment } from '../../types';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    orders: 0,
    clients: 0,
    equipment: 0,
    newOrders: 0,
    inProgress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [ordersRes, clientsRes, equipmentRes] = await Promise.all([
        api.get('/orders/'),
        api.get('/clients/'),
        api.get('/equipment/'),
      ]);

      const orders = ordersRes.data.results || ordersRes.data;
      const clients = clientsRes.data.results || clientsRes.data;
      const equipment = equipmentRes.data.results || equipmentRes.data;

      setStats({
        orders: orders.length,
        clients: clients.length,
        equipment: equipment.length,
        newOrders: orders.filter((o: Order) => o.status === 'new').length,
        inProgress: orders.filter((o: Order) => o.status === 'in_progress').length,
        completed: orders.filter((o: Order) => o.status === 'completed').length,
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <div>
      <Title level={3}>Добро пожаловать, {user?.first_name || user?.username}!</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего заявок"
              value={stats.orders}
              prefix={<OrderedListOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Клиенты"
              value={stats.clients}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Оборудование"
              value={stats.equipment}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
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
        <Col span={12}>
          <Card title="Текущий статус заявок">
            <List
              itemLayout="horizontal"
              dataSource={[
                {
                  title: 'Новые',
                  value: stats.newOrders,
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
        <Col span={12}>
          <Card title="Быстрые действия">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block>
                Создать заявку
              </Button>
              <Button size="large" block>
                Добавить клиента
              </Button>
              <Button size="large" block>
                Добавить оборудование
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
