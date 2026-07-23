import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Button, message, Spin, Switch, Modal, Form, Input } from 'antd';
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
      await api.post('/clients/', {
        name: values.full_name,
        phone: values.phone || '',
        personal_account_number: values.personal_account_number || '',
        apartment: apt.number,
        apartment_obj: apt.id,
        building: apt.building,
        entrance: apt.entrance || undefined,
        address: apt.building_address,
        source: 'manual',
        is_active: true,
      });
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
    addForm.setFieldsValue({ apartment: apt.number });
    setAddModalOpen(true);
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
      <Modal title="Добавить клиента" open={addModalOpen} onCancel={() => setAddModalOpen(false)} footer={null} width={450}>
        <Form form={addForm} layout="vertical" onFinish={handleAddClient}>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input placeholder="Иванов Иван Иванович" />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input placeholder="+7 999 123-45-67" />
          </Form.Item>
          <Form.Item name="personal_account_number" label="Номер лицевого счёта">
            <Input placeholder="050000000000" />
          </Form.Item>
          <Form.Item name="apartment" label="Квартира">
            <Input disabled />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>
            Добавить
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ApartmentDetailPage;
