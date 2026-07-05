import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Tabs, Table, message, Spin } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { Client, Order } from '../../types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ClientsDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchClient();
    fetchOrders();
  }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/clients/${id}/`);
      setClient(response.data);
    } catch (error) {
      message.error('Ошибка загрузки клиента');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders/', {
        params: { client: id },
      });
      setOrders(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

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
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'new' ? 'blue' : status === 'assigned' ? 'purple' : status === 'in_progress' ? 'orange' : status === 'completed' ? 'green' : 'red'}>
          {status === 'new' ? 'Новая' : status === 'assigned' ? 'Назначена' : status === 'in_progress' ? 'В работе' : status === 'completed' ? 'Выполнена' : 'Отменена'}
        </Tag>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: 300,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>
          Назад
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {client.full_name}
        </Title>
      </Space>

      <Card>
        <Descriptions title="Информация о клиенте" column={2} size="small">
          <Descriptions.Item label="ФИО">{client.full_name}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{client.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{client.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Адрес">{client.address}</Descriptions.Item>
          <Descriptions.Item label="Район">{client.region?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Дата добавления">
            {new Date(client.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>

        {client.notes && (
          <>
            <Divider />
            <Descriptions title="Примечания" column={1}>
              <Descriptions.Item>{client.notes}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Card>

      <div style={{ marginTop: 24 }}>
        <Title level={4}>Заявки клиента</Title>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </div>
    </div>
  );
};

export default ClientsDetailPage;
