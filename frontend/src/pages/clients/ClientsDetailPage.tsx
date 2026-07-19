import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Tabs, Table, message, Spin, Empty, Modal, Form, Input, Select, Switch, InputNumber } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined, DollarOutlined, HomeOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import type { Client, Order, ErcBillingRecord, ManagementCompany, Tariff, PaymentRecord } from '../../types';

const { Title, Text } = Typography;

const sourceLabels: Record<string, { label: string; color: string }> = {
  manual: { label: 'Ручной ввод', color: 'default' },
  excel_import: { label: 'Импорт (ТСЖ/УК)', color: 'blue' },
  erc: { label: 'ЕРЦ', color: 'green' },
};

const contractTypeLabels: Record<string, string> = {
  erc: 'ЕРЦ',
  uk_tszh: 'УК / ТСЖ',
  one_time: 'Разовый выезд',
};

const contractTypeColors: Record<string, string> = {
  erc: 'green',
  uk_tszh: 'blue',
  one_time: 'orange',
};

const ClientsDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ercPayments, setErcPayments] = useState<ErcBillingRecord[]>([]);
  const [internalPayments, setInternalPayments] = useState<PaymentRecord[]>([]);
  const [ercLoading, setErcLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [companies, setCompanies] = useState<ManagementCompany[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);

  useEffect(() => {
    fetchClient();
    fetchOrders();
    fetchCompanies();
    fetchTariffs();
  }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/clients/${id}/`);
      setClient(response.data);
      if (response.data.personal_account_number) fetchErcPayments();
      fetchInternalPayments();
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
    } catch (error) { console.error('Ошибка загрузки заявок:', error); }
  };

  const fetchErcPayments = async () => {
    setErcLoading(true);
    try {
      const response = await api.get(`/clients/${id}/erc_payments/`);
      setErcPayments(response.data || []);
    } catch (error) { console.error('Ошибка загрузки ЕРЦ:', error); }
    finally { setErcLoading(false); }
  };

  const fetchInternalPayments = async () => {
    try {
      const response = await api.get('/payment-records/', { params: { client: id } });
      setInternalPayments(response.data.results || response.data);
    } catch (error) { /* не критично */ }
  };

  const fetchCompanies = async () => {
    try {
      const r = await api.get('/management-companies/');
      setCompanies(r.data.results || r.data);
    } catch (e) {}
  };

  const fetchTariffs = async () => {
    try {
      const r = await api.get('/tariffs/');
      setTariffs(r.data.results || r.data);
    } catch (e) {}
  };

  const [buildings, setBuildings] = useState<any[]>([]);
  const [entrances, setEntrances] = useState<any[]>([]);

  const openEditModal = () => {
    if (!client) return;
    editForm.setFieldsValue({
      full_name: client.full_name,
      phone: client.phone,
      email: client.email,
      management_company: client.management_company || undefined,
      building: client.building || undefined,
      entrance: client.entrance || undefined,
      contract_type: client.contract_type || 'erc',
      erc_enabled: client.erc_enabled,
      tariff: client.tariff || undefined,
      monthly_payment: parseFloat(client.monthly_payment) || 0,
      notes: client.notes,
    });
    // Загружаем дома и подъезды если ещё не загружены
    if (buildings.length === 0) {
      api.get('/buildings/').then(r => setBuildings(r.data.results || r.data || [])).catch(() => {});
    }
    if (client.building) {
      api.get(`/entrances/?building=${client.building}`).then(r => setEntrances(r.data.results || r.data || [])).catch(() => {});
    }
    setEditModalOpen(true);
  };

  const handleBuildingChange = (bldId: number | undefined) => {
    editForm.setFieldValue('entrance', undefined);
    setEntrances([]);
    if (bldId) {
      api.get(`/entrances/?building=${bldId}`).then(r => setEntrances(r.data.results || r.data || [])).catch(() => {});
    }
  };

  const handleEditClient = async (values: any) => {
    try {
      // building и entrance уже в правильном формате (ID)
      const res = await api.patch(`/clients/${id}/`, values);
      setEditModalOpen(false);
      message.success('Клиент обновлён');
      fetchClient();
    } catch (error: any) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      message.error('Ошибка обновления: ' + msg.substring(0, 150));
    }
  };

  const handleCreateOrder = () => navigate(`/orders/create?client_id=${id}`);

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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOrder}>Создать заявку</Button>
          <Button icon={<EditOutlined />} onClick={openEditModal}>Редактировать</Button>
        </Space>
      </Space>

      {/* Основная карточка */}
      <Card>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="ФИО">{client.full_name}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{client.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Email">{client.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Адрес" span={2}>
            <Space>
              <span>{client.address}</span>
              {client.building && <Link to={`/buildings/${client.building}`}><Button size="small" icon={<HomeOutlined />} title="Карточка дома">Дом</Button></Link>}
              {client.entrance && <Link to={`/entrances/${client.entrance}`}><Button size="small" icon={<ApartmentOutlined />} title="Карточка подъезда">Подъезд</Button></Link>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="УК / ТСЖ">{client.management_company_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="№ парадной / подъезда">{client.entrance_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="Лицевой счёт">{client.personal_account_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="Квартира">{client.apartment || '-'}</Descriptions.Item>
          <Descriptions.Item label="Район (мун.)">{client.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Тип договора">
            <Tag color={contractTypeColors[client.contract_type] || 'default'}>
              {contractTypeLabels[client.contract_type] || client.contract_type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="ЕРЦ">
            <Tag color={client.erc_enabled ? 'green' : 'default'}>{client.erc_enabled ? 'Да' : 'Нет'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Тариф">{client.tariff_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ежемес. платёж">
            <Text strong style={{ color: '#1677ff', fontSize: 16 }}>
              {parseFloat(client.monthly_payment || '0').toFixed(2)} ₽
            </Text>
          </Descriptions.Item>
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

      {/* Платежи ЕРЦ */}
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
              ]}
            />
          ) : !ercLoading && <Empty description="Нет данных ЕРЦ. Загрузите файл через раздел Импорт." />}
        </Card>
      )}

      {/* Заявки */}
      <div style={{ marginTop: 24 }}>
        <Title level={4}>Заявки клиента</Title>
        <Table columns={orderColumns} dataSource={orders} rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          onRow={(rec) => ({ onClick: () => navigate(`/orders/${rec.id}`), style: { cursor: 'pointer' } })}
        />
      </div>

      {/* Модалка редактирования */}
      <Modal title="Редактировать клиента" open={editModalOpen} onCancel={() => setEditModalOpen(false)}
        footer={null} width={700}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditClient}>
          <Form.Item name="full_name" label="ФИО"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="building" label="Дом">
            <Select
              allowClear showSearch placeholder="Выберите дом"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              onChange={handleBuildingChange}
              options={buildings.map((b: any) => ({
                label: `${b.street_name}, д. ${b.house_number}${b.building_number ? ' корп. ' + b.building_number : ''} (${b.city})`,
                value: b.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="entrance" label="Подъезд">
            <Select
              allowClear showSearch placeholder="Сначала выберите дом"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={entrances.map((e: any) => ({
                label: `Подъезд №${e.number} (кв. ${e.apartment_from || '?'}–${e.apartment_to || '?'})`,
                value: e.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="management_company" label="УК / ТСЖ">
            <Select
              allowClear
              showSearch
              placeholder="Выберите УК"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={companies.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="contract_type" label="Тип договора">
            <Select
              options={[
                { label: 'ЕРЦ', value: 'erc' },
                { label: 'УК / ТСЖ', value: 'uk_tszh' },
                { label: 'Разовый платный выезд', value: 'one_time' },
              ]}
            />
          </Form.Item>
          <Form.Item name="erc_enabled" label="ЕРЦ (да/нет)" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="tariff" label="Тариф">
            <Select
              allowClear
              placeholder="Выберите тариф"
              options={tariffs.map((t) => ({ label: `${t.name} — ${t.amount} ₽/мес`, value: t.id }))}
            />
          </Form.Item>
          <Form.Item name="monthly_payment" label="Ежемесячный платёж (₽)">
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit">Сохранить</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientsDetailPage;
