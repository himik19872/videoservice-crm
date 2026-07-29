import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Typography, Card, Input, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Order } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;

const MasterOrdersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders/');
      setOrders(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.number?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.description?.toLowerCase().includes(searchText.toLowerCase());
    return matchesSearch;
  });

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

  const columns = [
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      width: 100,
    },
    {
      title: 'Тип',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'repair' ? 'blue' : type === 'connection' ? 'purple' : 'green'}>
          {type === 'repair' ? 'Ремонт' : type === 'connection' ? 'Подключение' : 'Продажа'}
        </Tag>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'client_info',
      key: 'client',
      width: 150,
      render: (client: any) => client?.full_name || '-',
    },
    {
      title: 'Район',
      dataIndex: 'region_info',
      key: 'region',
      width: 120,
      render: (region: any) => region?.name || '-',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'new' ? 'Новая' : status === 'assigned' ? 'Назначена' : status === 'in_progress' ? 'В работе' : status === 'completed' ? 'Выполнена' : 'Отменена'}
        </Tag>
      ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => {
        const priorities: Record<string, string> = {
          low: 'Низкий',
          medium: 'Средний',
          high: 'Высокий',
          urgent: 'Срочный',
        };
        return priorities[priority] || priority;
      },
    },
    {
      title: 'Создано',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: any, record: Order) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewOrder(record)}
        />
      ),
    },
  ];

  return (
    <Card>
      <Title level={3}>Мои заявки</Title>

      <Input.Search
        placeholder="Поиск по номеру, описанию..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => handleSearch(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredOrders}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1000 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
        }}
      />
    </Card>
  );
};

export default MasterOrdersPage;
