import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Button, message, Spin, Switch, Modal, Form, Input, Select, InputNumber } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, UserOutlined, HistoryOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ApartmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apt, setApt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [entrances, setEntrances] = useState<any[]>([]);

  useEffect(() => { fetchApt(); }, [id]);

  const fetchApt = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/apartments/${id}/`);
      setApt(res.data);
    } catch { message.error('Ошибка загрузки'); navigate(-1); }
    finally { setLoading(false); }
  };

  const toggleActive = async (clientId: number, checked: boolean) => {
    try {
      await api.patch(`/clients/${clientId}/`, { is_active: checked });
      message.success(checked ? 'Клиент активен' : 'Клиент помечен неактивным');
      fetchApt();
    } catch { message.error('Ошибка'); }
  };

  const handleAddClient = async (values: any) => {
    setSaving(true);
    try {
      const payload: any = {
        name: values.full_name,
        phone: values.phone || '',
        email: values.email || '',
        personal_account_number: values.personal_account_number || '',
        apartment: apt.number,
        apartment_obj: apt.id,
        building: values.building || apt.building,
        entrance: values.entrance || apt.entrance || undefined,
        address: values.address || apt.building_address,
        management_company: values.management_company || undefined,
        contract_type: values.contract_type || 'erc',
        erc_enabled: values.erc_enabled !== false,
        tariff: values.tariff || undefined,
        monthly_payment: values.monthly_payment ? String(values.monthly_payment) : '0',
        notes: values.notes || '',
        source: 'manual',
        is_active: true,
      };
      await api.post('/clients/', payload);
      message.success('Клиент добавлен');
      setAddModalOpen(false);
      addForm.resetFields();
      fetchApt();
    } catch (e: any) {
      message.error(e?.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    addForm.resetFields();
    addForm.setFieldsValue({
      apartment: apt.number,
      address: apt.building_address,
      contract_type: 'erc',
      erc_enabled: true,
    });
    // Подгружаем справочники
    if (companies.length === 0) {
      api.get('/management-companies/').then(r => setCompanies(r.data.results || r.data || [])).catch(() => {});
    }
    if (tariffs.length === 0) {
      api.get('/tariffs/').then(r => setTariffs(r.data.results || r.data || [])).catch(() => {});
    }
    if (buildings.length === 0) {
      api.get('/buildings/').then(r => setBuildings(r.data.results || r.data || [])).catch(() => {});
    }
    if (apt.building) {
      api.get(`/entrances/?building=${apt.building}`).then(r => setEntrances(r.data.results || r.data || [])).catch(() => {});
    }
    setAddModalOpen(true);
  };

  const handleAddBuildingChange = (bldId: number | undefined) => {
    addForm.setFieldValue('entrance', undefined);
    setEntrances([]);
    if (bldId) {
      api.get(`/entrances/?building=${bldId}`).then(r => setEntrances(r.data.results || r.data || [])).catch(() => {});
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!apt) return null;

  const residents = apt.residents || [];
  const orders = apt.orders || [];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>
          {apt.building_address}, кв. {apt.number}
        </Title>
        {apt.building && (
          <Link to={`/buildings/${apt.building}`}>
            <Button icon={<HomeOutlined />}>Карточка дома</Button>
          </Link>
        )}
      </Space>

      {/* Жители */}
      <Card 
        title={<><UserOutlined /> Жители квартиры ({residents.length})</>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>Добавить клиента</Button>}
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={residents.map((r: any, i: number) => ({ ...r, _k: i }))}
          rowKey="_k"
          size="small"
          pagination={false}
          columns={[
            { title: 'ФИО', dataIndex: 'full_name', key: 'name', width: 250,
              render: (_: any, r: any) => {
                const inactive = r.is_active === false;
                return (
                  <Space>
                    <Link to={`/clients/${r.id}`}>
                      <Text strong delete={inactive} type={inactive ? 'secondary' : undefined}>
                        {r.full_name || r.name}
                      </Text>
                    </Link>
                    {!r.is_active && <Tag color="red">Неактивен</Tag>}
                    {r.is_active !== false && <Tag color="green">Активен</Tag>}
                  </Space>
                );
              },
            },
            { title: 'Л/счёт', dataIndex: 'personal_account_number', key: 'acc', width: 150,
              render: (v: string) => v ? <Text code>{v}</Text> : '—',
            },
            { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 150,
              render: (v: string) => v || '—',
            },
            { title: 'Источник', dataIndex: 'source', key: 'src', width: 130,
              render: (v: string) => {
                const labels: Record<string, string> = { erc: 'ЕРЦ', manual: 'Ручной', excel_import: 'Импорт' };
                return <Tag>{labels[v] || v}</Tag>;
              },
            },
            { title: 'Активен', dataIndex: 'is_active', key: 'active', width: 120,
              render: (v: boolean, r: any) => (
                <Switch
                  checked={v !== false}
                  onChange={(checked) => toggleActive(r.id, checked)}
                  checkedChildren="Да"
                  unCheckedChildren="Нет"
                />
              ),
            },
          ]}
        />
      </Card>

      {/* История заявок */}
      <Card title={<><HistoryOutlined /> История заявок на квартиру ({orders.length})</>}>
        <Table
          dataSource={orders}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          columns={[
            { title: 'Номер', dataIndex: 'number', key: 'num', width: 160,
              render: (n: string, r: any) => <Link to={`/orders/${r.id}`}>#{n}</Link>,
            },
            { title: 'Тип', dataIndex: 'order_type', key: 'type', width: 150 },
            { title: 'Статус', dataIndex: 'status', key: 'st', width: 150,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: 'Дата', dataIndex: 'created_at', key: 'dt', width: 120,
              render: (d: string) => dayjs(d).format('DD.MM.YYYY'),
            },
            { title: 'Описание', dataIndex: 'description', key: 'desc', ellipsis: true },
          ]}
        />
      </Card>

      {/* Модалка добавления клиента */}
      <Modal title="Добавить клиента" open={addModalOpen} onCancel={() => setAddModalOpen(false)} footer={null} width={700}>
        <Form form={addForm} layout="vertical" onFinish={handleAddClient}>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input placeholder="Иванов Иван Иванович" />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input placeholder="+7 999 123-45-67" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="client@example.com" />
          </Form.Item>
          <Form.Item name="personal_account_number" label="Лицевой счёт">
            <Input placeholder="050000000000" />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input placeholder={apt.building_address} />
          </Form.Item>
          <Form.Item name="apartment" label="Квартира">
            <Input disabled />
          </Form.Item>
          <Form.Item name="building" label="Дом">
            <Select
              allowClear showSearch placeholder="Выберите дом"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              onChange={handleAddBuildingChange}
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
              allowClear showSearch placeholder="Выберите УК"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={companies.map((c: any) => ({ label: c.name, value: c.id }))}
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
              allowClear placeholder="Выберите тариф"
              options={tariffs.map((t: any) => ({ label: `${t.name} — ${t.amount} ₽/мес`, value: t.id }))}
            />
          </Form.Item>
          <Form.Item name="monthly_payment" label="Ежемесячный платёж (₽)">
            <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>
            Добавить клиента
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ApartmentDetailPage;
