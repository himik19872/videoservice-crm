import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Tabs, Table, message, Spin, Empty, Modal, Form, Input, Select } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { Client, Order, ErcBillingRecord } from '../../types';

const { Title, Text } = Typography;

const sourceLabels: Record<string, { label: string; color: string }> = {
  manual: { label: 'Ручной ввод', color: 'default' },
  excel_import: { label: 'Импорт (ТСЖ/УК)', color: 'blue' },
  erc: { label: 'ЕРЦ', color: 'green' },
};

const ClientsDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ercPayments, setErcPayments] = useState<ErcBillingRecord[]>([]);
  const [ercLoading, setErcLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [regions, setRegions] = useState<any[]>([]);

  useEffect(() => {
    fetchClient();
    fetchOrders();
    fetchRegions();
  }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/clients/${id}/`);
      setClient(response.data);
      if (response.data.personal_account_number) {
        fetchErcPayments();
      }
    } catch (error) {
      message.error('Ошибка загрузки клиента');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders/', { params: { client: id } });
      setOrders(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
    }
  };

  const fetchErcPayments = async () => {
    setErcLoading(true);
    try {
      const response = await api.get(`/clients/${id}/erc_payments/`);
      setErcPayments(response.data || []);
    } catch (error) { console.error('Ошибка загрузки платежей ЕРЦ:', error); }
    finally { setErcLoading(false); }
  };

  const fetchRegions = async () => {
    try {
      const r = await api.get('/regions/');
      setRegions(r.data.results || r.data);
    } catch (e) {}
  };

  const openEditModal = () => {
    if (!client) return;
    editForm.setFieldsValue({
      full_name: client.full_name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      management_company: client.management_company,
      entrance_number: client.entrance_number,
      notes: client.notes,
    });
    setEditModalOpen(true);
  };

  const handleEditClient = async (values: any) => {
    try {
      await api.put(`/clients/${id}/`, values);
      setEditModalOpen(false);
      message.success('Клиент обновлён');
      fetchClient();
    } catch (error) {
      message.error('Ошибка обновления');
    }
  };

  const handleCreateOrder = () => {
    navigate(`/orders/create?client_id=${id}`);
  };

  const handleViewOrder = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!client) return null;

  const orderColumns = [
    { title: 'Номер', dataIndex: 'number', key: 'number', width: 120,
      render: (n: string, rec: Order) => <a onClick={() => navigate(`/orders/${rec.id}`)}>{n}</a>
    },
    { title: 'Тип', dataIndex: 'order_type', key: 'order_type', width: 120,
      render: (t: string) => {
        const m: Record<string, string> = { repair: 'Ремонт', connection: 'Подключение', sale: 'Продажа',
          installation: 'Монтаж', maintenance: 'ТО', inspection: 'Обследование', contract_install: 'Договор монтаж', contract_service: 'Договор ТО' };
        return <Tag>{m[t] || t}</Tag>;
      }
    },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const m: Record<string, { label: string; color: string }> = {
          new: { label: 'Новая', color: 'blue' }, assigned: { label: 'Назначена', color: 'purple' },
          accepted: { label: 'Принята', color: 'cyan' }, in_progress: { label: 'В работе', color: 'orange' },
          paused: { label: 'На паузе', color: 'gold' }, need_help: { label: 'Помощь', color: 'red' },
          completed: { label: 'Выполнена', color: 'green' }, confirmed: { label: 'Подтверждена', color: 'geekblue' },
          cancelled: { label: 'Отменена', color: 'default' } };
        const i = m[s] || { label: s, color: 'default' };
        return <Tag color={i.color}>{i.label}</Tag>;
      }
    },
    { title: 'Стоимость', dataIndex: 'cost', key: 'cost', width: 100, render: (v: any) => v ? `${v} ₽` : '-' },
    { title: 'Дата', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '-' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>Назад</Button>
          <Title level={3} style={{ margin: 0 }}>{client.full_name}</Title>
        </Space>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOrder}>
            Создать заявку
          </Button>
          <Button icon={<EditOutlined />} onClick={openEditModal}>
            Редактировать
          </Button>
        </Space>
      </Space>

      <Card>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="ФИО">{client.full_name}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{client.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Адрес" span={2}>{client.address}</Descriptions.Item>
          <Descriptions.Item label="УК / ТСЖ">{client.management_company || '-'}</Descriptions.Item>
          <Descriptions.Item label="№ парадной">{client.entrance_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="Лицевой счёт">{client.personal_account_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="Район (мун.)">{client.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Источник">
            {(() => {
              const s = sourceLabels[client.source] || sourceLabels.manual;
              return <Tag color={s.color}>{s.label}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="Дата добавления">
            {new Date(client.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>
        {client.notes && <><Divider /><Text type="secondary">{client.notes}</Text></>}
      </Card>

      {/* Платежи ЕРЦ — показываем для любого клиента с лицевым счётом */}
      {client.personal_account_number && (
        <Card title="📊 История платежей ЕРЦ" style={{ marginTop: 16 }}>
          {ercPayments.length > 0 ? (
            <Table dataSource={ercPayments} rowKey="id" loading={ercLoading} pagination={false} size="small"
              columns={[
                { title: 'Период', dataIndex: 'period', key: 'period',
                  render: (d: string) => { const parts = d.split('-'); return `${parts[1]}.${parts[0]}`; } },
                { title: 'Сальдо нач.', dataIndex: 'balance_start', key: 'bs', align: 'right' as const,
                  render: (v: any) => v != null ? `${parseFloat(v || 0).toFixed(2)} ₽` : '—' },
                { title: 'Начислено', dataIndex: 'charged', key: 'ch', align: 'right' as const,
                  render: (v: any) => v != null ? `${parseFloat(v || 0).toFixed(2)} ₽` : '—' },
                { title: 'Оплачено', dataIndex: 'paid', key: 'pd', align: 'right' as const,
                  render: (v: any) => <Text strong style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{parseFloat(v || 0).toFixed(2)} ₽</Text> },
                { title: '%', dataIndex: 'paid_percent', key: 'pp', align: 'right' as const,
                  render: (v: any) => {
                    const p = parseFloat(v || 0);
                    return <Tag color={p >= 100 ? 'green' : p >= 50 ? 'orange' : 'red'}>{p.toFixed(1)}%</Tag>;
                  } },
                { title: 'Сальдо кон.', dataIndex: 'balance_end', key: 'be', align: 'right' as const,
                  render: (v: any) => v != null ? `${parseFloat(v || 0).toFixed(2)} ₽` : '—' },
                { title: 'Импорт', dataIndex: 'imported_at', key: 'ia',
                  render: (d: string) => d ? new Date(d).toLocaleDateString('ru') : '—' },
              ]}
            />
          ) : !ercLoading && <Empty description="Нет данных ЕРЦ. Загрузите файл ЕРЦ через Импорт." />}
        </Card>
      )}

      <div style={{ marginTop: 24 }}>
        <Title level={4}>Заявки клиента</Title>
        <Table columns={orderColumns} dataSource={orders} rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          onRow={(rec) => ({ onClick: () => navigate(`/orders/${rec.id}`), style: { cursor: 'pointer' } })}
        />
      </div>

      {/* Модалка редактирования */}
      <Modal title="Редактировать клиента" open={editModalOpen} onCancel={() => setEditModalOpen(false)}
        footer={null} width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditClient}>
          <Form.Item name="full_name" label="ФИО"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="address" label="Адрес"><Input /></Form.Item>
          <Form.Item name="management_company" label="УК / ТСЖ"><Input /></Form.Item>
          <Form.Item name="entrance_number" label="№ парадной"><Input /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit">Сохранить</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientsDetailPage;
