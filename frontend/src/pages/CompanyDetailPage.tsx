import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Descriptions, Tag, Space, Button, Divider, Table, List,
  message, Spin, Modal, Form, Input, InputNumber, Select, Popconfirm, Tabs, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PhoneOutlined, MailOutlined, DollarOutlined, CommentOutlined,
  HomeOutlined, StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const COMMENT_TYPES: Record<string, string> = {
  call: 'Звонок', email: 'Письмо', complaint: 'Жалоба',
  request: 'Запрос', meeting: 'Встреча', note: 'Заметка',
};

const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Подчинённые данные
  const [buildings, setBuildings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allBuildings, setAllBuildings] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);

  // Модалки
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [addBldOpen, setAddBldOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cRes, bRes, oRes, ctRes, cmRes, pRes, abRes, tRes] = await Promise.all([
        api.get(`/management-companies/${id}/`),
        api.get(`/management-companies/${id}/buildings/`),
        api.get(`/management-companies/${id}/orders/`),
        api.get(`/management-companies/${id}/contacts/`),
        api.get(`/management-companies/${id}/comments/`),
        api.get(`/management-companies/${id}/payments/`),
        api.get('/buildings/'),
        api.get('/tariffs/'),
      ]);
      setCompany(cRes.data);
      setBuildings(bRes.data || []);
      setOrders(oRes.data || []);
      setContacts(ctRes.data || []);
      setComments(cmRes.data || []);
      setPayments(pRes.data || []);
      setAllBuildings(abRes.data.results || abRes.data || []);
      setTariffs(tRes.data.results || tRes.data || []);
    } catch { message.error('Ошибка загрузки'); navigate('/management-companies'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const openEdit = () => { form.setFieldsValue(company); setEditOpen(true); };
  const handleEdit = async (v: any) => {
    await api.patch(`/management-companies/${id}/`, v);
    message.success('Сохранено'); setEditOpen(false); fetchAll();
  };

  const handleToggleActive = () => {
    if (company.is_active) {
      setTerminateOpen(true);
    } else {
      api.post(`/management-companies/${id}/toggle_active/`, {}).then(() => fetchAll());
    }
  };
  const handleTerminate = async (v: any) => {
    await api.post(`/management-companies/${id}/toggle_active/`, { reason: v.reason });
    message.success('УК снята с обслуживания'); setTerminateOpen(false); fetchAll();
  };

  const handleAddBuilding = async (v: any) => {
    await api.post(`/management-companies/${id}/add_building/`, v);
    message.success('Дом добавлен'); setAddBldOpen(false); fetchAll();
  };
  const handleGenerateClients = async (bldId: number) => {
    await api.post(`/management-companies/${id}/generate_clients/`, { building_id: bldId });
    message.success('Квартиры созданы'); fetchAll();
  };
  const handleRemoveBuilding = async (bldId: number) => {
    await api.post(`/management-companies/${id}/remove_building/`, { building_id: bldId });
    message.success('Дом отвязан'); fetchAll();
  };

  const handleAddContact = async (v: any) => {
    await api.post(`/management-companies/${id}/contacts/`, v);
    message.success('Контакт добавлен'); setContactOpen(false); fetchAll();
  };
  const handleDeleteContact = async (cid: number) => {
    await api.delete(`/management-companies/${id}/contacts/${cid}/`);
    message.success('Удалён'); fetchAll();
  };

  const handleAddComment = async (v: any) => {
    await api.post(`/management-companies/${id}/comments/`, v);
    message.success('Добавлено'); setCommentOpen(false); fetchAll();
  };

  const handleAddPayment = async (v: any) => {
    await api.post(`/management-companies/${id}/payments/`, v);
    message.success('Начисление добавлено'); setPaymentOpen(false); fetchAll();
  };
  const handleConfirmPayment = async (pid: number) => {
    await api.post(`/management-companies/${id}/confirm_payment/`, { payment_id: pid });
    message.success('Оплата подтверждена'); fetchAll();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!company) return null;

  const isTerminated = !company.is_active;

  const totalApartments = buildings.reduce((s: number, b: any) => s + (b.apartments_count || 0), 0);
  const totalClients = buildings.reduce((s: number, b: any) => s + (b.clients_count || 0), 0);

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/management-companies')}>Назад</Button>
          <Title level={3} style={{ margin: 0 }}>
            {company.short_name || company.name}
            {isTerminated && <Tag color="red" style={{ marginLeft: 8 }}>Снята с обслуживания</Tag>}
          </Title>
        </Space>
        <Space>
          <Button icon={<StopOutlined />} danger={company.is_active}
            onClick={handleToggleActive}
            type={company.is_active ? 'default' : 'primary'}>
            {company.is_active ? 'Снять с обслуживания' : 'Вернуть на обслуживание'}
          </Button>
          <Button icon={<EditOutlined />} onClick={openEdit}>Редактировать</Button>
        </Space>
      </Space>

      {/* Основная карточка */}
      <Card>
        <Descriptions column={4} size="small">
          <Descriptions.Item label="Полное название" span={2}>{company.name}</Descriptions.Item>
          <Descriptions.Item label="ИНН">{company.inn || '—'}</Descriptions.Item>
          <Descriptions.Item label="Телефон">{company.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Оплата домофона">
            <Tag color={company.payment_method === 'erc' ? 'orange' : company.payment_method === 'mixed' ? 'purple' : 'green'}>
              {company.payment_method_display || '—'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="№ договора">{company.contract_number || '—'}</Descriptions.Item>
          <Descriptions.Item label="Дата договора">{company.contract_date ? dayjs(company.contract_date).format('DD.MM.YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Сумма/мес">{company.contract_amount ? `${company.contract_amount} ₽` : '—'}</Descriptions.Item>
          {isTerminated && (
            <>
              <Descriptions.Item label="Дата расторжения">{company.terminated_at ? dayjs(company.terminated_at).format('DD.MM.YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Причина" span={3}>{company.termination_reason}</Descriptions.Item>
            </>
          )}
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />
        <Space size="large">
          <Text><HomeOutlined /> <strong>{buildings.length}</strong> домов</Text>
          <Text><strong>{totalApartments}</strong> квартир</Text>
          <Text>👥 <strong>{totalClients}</strong> клиентов</Text>
          <Text>📋 <strong>{orders.length}</strong> заявок</Text>
        </Space>
      </Card>

      <Tabs defaultActiveKey="buildings" style={{ marginTop: 16 }} items={[
        // ═══ Дома ═══
        {
          key: 'buildings', label: `🏠 Дома (${buildings.length})`,
          children: <div>
            <Space style={{ marginBottom: 12 }}>
              <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setAddBldOpen(true); }}>Привязать дом</Button>
            </Space>
            <Table dataSource={buildings} rowKey="id" size="small" pagination={{ pageSize: 20 }}
              columns={[
                { title: 'Адрес', key: 'addr', render: (_: any, b: any) =>
                  <Link to={`/buildings/${b.id}`}>{b.street_name}, д. {b.house_number}{b.building_number ? ` корп. ${b.building_number}` : ''}</Link> },
                { title: 'Квартир', dataIndex: 'apartments_count', width: 80, align: 'right' as const },
                { title: 'Клиентов', dataIndex: 'clients_count', width: 80, align: 'right' as const,
                  render: (v: number) => <Tag color="blue">{v}</Tag> },
                { title: '', width: 140, render: (_: any, b: any) =>
                  <Space size="small">
                    {b.clients_count === 0 && (
                      <Popconfirm title="Создать квартиры из подъездов?" onConfirm={() => handleGenerateClients(b.id)}>
                        <Button size="small" type="primary" ghost>Создать квартиры</Button>
                      </Popconfirm>
                    )}
                    <Popconfirm title="Отвязать дом от УК?" onConfirm={() => handleRemoveBuilding(b.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space> },
              ]} locale={{ emptyText: 'Нет привязанных домов' }} />
          </div>
        },

        // ═══ Заявки ═══
        {
          key: 'orders', label: `📋 Заявки (${orders.length})`,
          children: <Table dataSource={orders} rowKey="id" size="small" pagination={{ pageSize: 20 }}
            columns={[
              { title: 'Номер', dataIndex: 'number', width: 150, render: (n: string, r: any) => <Link to={`/orders/${r.id}`}>#{n}</Link> },
              { title: 'Тип', dataIndex: 'order_type_display', width: 140, render: (t: string) => <Tag>{t}</Tag> },
              { title: 'Статус', dataIndex: 'status_display', width: 130, render: (t: string) => <Tag>{t}</Tag> },
              { title: 'Мастер', dataIndex: 'master_name', width: 160 },
              { title: 'Дата', dataIndex: 'created_at', width: 120, render: (d: string) => dayjs(d).format('DD.MM.YYYY') },
            ]} locale={{ emptyText: 'Заявок нет' }} />
        },

        // ═══ Контакты ═══
        {
          key: 'contacts', label: `📞 Контакты (${contacts.length})`,
          children: <div>
            <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setContactOpen(true); }} style={{ marginBottom: 12 }}>Добавить</Button>
            <List dataSource={contacts} renderItem={(c: any) => (
              <List.Item actions={[
                <Popconfirm title="Удалить?" onConfirm={() => handleDeleteContact(c.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ]}>
                <List.Item.Meta title={`${c.name}${c.position ? ` — ${c.position}` : ''}`}
                  description={<Space>{c.phone && <><PhoneOutlined /> {c.phone}</>}{c.email && <><MailOutlined /> {c.email}</>}{c.notes}</Space>} />
              </List.Item>
            )} locale={{ emptyText: 'Нет контактов' }} />
          </div>
        },

        // ═══ История обращений ═══
        {
          key: 'comments', label: `💬 Обращения (${comments.length})`,
          children: <div>
            <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCommentOpen(true); }} style={{ marginBottom: 12 }}>Добавить</Button>
            <List dataSource={comments} renderItem={(c: any) => (
              <List.Item>
                <List.Item.Meta
                  title={<Space>{c.author_name && <Tag>{c.author_name}</Tag>}<Tag color="blue">{COMMENT_TYPES[c.comment_type] || c.comment_type}</Tag><Text type="secondary">{dayjs(c.created_at).format('DD.MM.YYYY HH:mm')}</Text></Space>}
                  description={<Text style={{ whiteSpace: 'pre-wrap' }}>{c.text}</Text>} />
              </List.Item>
            )} locale={{ emptyText: 'Нет обращений' }} />
          </div>
        },

        // ═══ Бухгалтерия ═══
        {
          key: 'payments', label: `💰 Начисления (${payments.length})`,
          children: <div>
            <Button icon={<PlusOutlined />} onClick={() => { form.resetFields(); setPaymentOpen(true); }} style={{ marginBottom: 12 }}>Добавить период</Button>
            <Table dataSource={payments} rowKey="id" size="small" pagination={false}
              columns={[
                { title: 'Период', dataIndex: 'period', width: 100, render: (d: string) => dayjs(d).format('MM.YYYY') },
                { title: 'Начислено', dataIndex: 'amount_charged', width: 110, align: 'right' as const, render: (v: string) => `${v} ₽` },
                { title: 'Оплачено', dataIndex: 'amount_paid', width: 110, align: 'right' as const, render: (v: string) => `${v} ₽` },
                { title: 'Статус', dataIndex: 'is_confirmed', width: 130,
                  render: (v: boolean, r: any) => v
                    ? <Tag color="green">✅ Подтверждено</Tag>
                    : <Button size="small" type="primary" ghost onClick={() => handleConfirmPayment(r.id)}>Подтвердить</Button> },
                { title: 'Прим.', dataIndex: 'notes', ellipsis: true },
              ]} locale={{ emptyText: 'Нет начислений' }} />
          </div>
        },
      ]} />

      {/* Модалки */}
      <Modal title="Редактировать УК" open={editOpen} onCancel={() => setEditOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="Полное название"><Input /></Form.Item>
          <Form.Item name="short_name" label="Короткое"><Input /></Form.Item>
          <Form.Item name="payment_method" label="Способ оплаты">
            <Select options={[{ label: 'По договору', value: 'contract' }, { label: 'Через ЕРЦ', value: 'erc' }, { label: 'Смешанная', value: 'mixed' }]} />
          </Form.Item>
          <Form.Item name="contract_number" label="№ договора"><Input /></Form.Item>
          <Form.Item name="contract_date" label="Дата договора"><Input type="date" /></Form.Item>
          <Form.Item name="contract_amount" label="Сумма/мес"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="inn" label="ИНН"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" block>Сохранить</Button>
        </Form>
      </Modal>

      <Modal title="Снять с обслуживания" open={terminateOpen} onCancel={() => setTerminateOpen(false)} footer={null}>
        <Form layout="vertical" onFinish={handleTerminate}>
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message="Клиенты этой УК будут помечены как снятые с обслуживания" />
          <Form.Item name="reason" label="Причина расторжения" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input.TextArea rows={4} placeholder="Укажите причину..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" danger block>Подтвердить снятие</Button>
        </Form>
      </Modal>

      <Modal title="Привязать дом" open={addBldOpen} onCancel={() => setAddBldOpen(false)} footer={null}>
        <Form layout="vertical" onFinish={handleAddBuilding}>
          <Form.Item name="building_id" label="Дом" rules={[{ required: true }]}>
            <Select showSearch placeholder="Выберите дом" filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={allBuildings.map((b: any) => ({
                label: `${b.street_name}, д. ${b.house_number}${b.building_number ? ' корп. ' + b.building_number : ''} (${b.city})`,
                value: b.id,
              }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Привязать</Button>
        </Form>
      </Modal>

      <Modal title="Добавить контакт" open={contactOpen} onCancel={() => setContactOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddContact}>
          <Form.Item name="name" label="ФИО" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="position" label="Должность"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit">Добавить</Button>
        </Form>
      </Modal>

      <Modal title="Добавить обращение" open={commentOpen} onCancel={() => setCommentOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddComment}>
          <Form.Item name="comment_type" label="Тип" initialValue="note">
            <Select options={Object.entries(COMMENT_TYPES).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Form.Item name="text" label="Текст" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          <Button type="primary" htmlType="submit">Добавить</Button>
        </Form>
      </Modal>

      <Modal title="Добавить начисление" open={paymentOpen} onCancel={() => setPaymentOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddPayment}>
          <Form.Item name="period" label="Период (месяц)" rules={[{ required: true }]}>
            <Input type="month" />
          </Form.Item>
          <Form.Item name="amount_charged" label="Начислено (₽)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="amount_paid" label="Оплачено (₽)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit">Добавить</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default CompanyDetailPage;
