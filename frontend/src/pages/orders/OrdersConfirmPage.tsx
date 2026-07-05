import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Typography, Card, message, Modal, Input } from 'antd';
import { CheckOutlined, UndoOutlined, EyeOutlined, PhoneOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { Order } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

const OrdersConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [reworkModalOpen, setReworkModalOpen] = useState(false);
  const [reworkOrderId, setReworkOrderId] = useState<number | null>(null);
  const [reworkReason, setReworkReason] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Получаем выполненные заявки, ожидающие подтверждения
      const response = await api.get('/orders/?status=completed');
      setOrders(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (orderId: number) => {
    setConfirming(orderId);
    try {
      await api.post(`/orders/${orderId}/confirm/`, { notes: 'Заявка подтверждена диспетчером' });
      message.success('Заявка подтверждена');
      fetchOrders();
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'Ошибка подтверждения');
    } finally {
      setConfirming(null);
    }
  };

  const openReworkModal = (orderId: number) => {
    setReworkOrderId(orderId);
    setReworkReason('');
    setReworkModalOpen(true);
  };

  const handleRework = async () => {
    if (!reworkOrderId || !reworkReason.trim()) {
      message.warning('Укажите причину возврата');
      return;
    }
    try {
      await api.post(`/orders/${reworkOrderId}/rework/`, { notes: reworkReason });
      message.success('Заявка возвращена в работу');
      setReworkModalOpen(false);
      fetchOrders();
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'Ошибка');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'green', confirmed: 'green', cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      repair: 'blue', connection: 'purple', sale: 'green',
    };
    return colors[type] || 'default';
  };

  const columns = [
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      width: 100,
      render: (num: string, record: Order) => (
        <a onClick={() => navigate(`/orders/${record.id}`)}>{num}</a>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 100,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>
          {type === 'repair' ? 'Ремонт' : type === 'connection' ? 'Подключение' : 'Продажа'}
        </Tag>
      ),
    },
    {
      title: 'Клиент',
      key: 'client',
      width: 150,
      render: (_: any, record: Order) => record.client_info?.full_name || record.client?.full_name || '-',
    },
    {
      title: 'Телефон',
      key: 'phone',
      width: 140,
      render: (_: any, record: Order) => {
        const phone = record.client_info?.phone || record.client?.phone || '';
        return phone ? (
          <Space>
            <PhoneOutlined />
            <span>{phone}</span>
          </Space>
        ) : '-';
      },
    },
    {
      title: 'Мастер',
      key: 'master',
      width: 150,
      render: (_: any, record: Order) => record.master_info?.full_name || record.master?.full_name || '-',
    },
    {
      title: 'Район',
      key: 'region',
      width: 100,
      render: (_: any, record: Order) => record.region_info?.name || record.region?.name || '-',
    },
    {
      title: 'Выполнено',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 130,
      render: (date: string) => date ? dayjs(date).format('DD.MM.YYYY HH:mm') : '-',
    },
    {
      title: 'Стоимость',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
      render: (cost: number | null) => cost ? `${cost} ₽` : '-',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_: any, record: Order) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleConfirm(record.id)}
            loading={confirming === record.id}
          >
            Подтвердить
          </Button>
          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={() => openReworkModal(record.id)}
          >
            Вернуть
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <CheckOutlined /> Подтверждение выполненных заявок
      </Title>
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'Нет заявок, ожидающих подтверждения' }}
        />
      </Card>

      <Modal
        title="Вернуть заявку в работу"
        open={reworkModalOpen}
        onOk={handleRework}
        onCancel={() => setReworkModalOpen(false)}
        okText="Вернуть"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <p>Опишите причину возврата (что нужно доделать мастеру):</p>
        <TextArea
          rows={3}
          value={reworkReason}
          onChange={(e) => setReworkReason(e.target.value)}
          placeholder="Клиент сообщил, что..."
        />
      </Modal>
    </div>
  );
};

export default OrdersConfirmPage;
