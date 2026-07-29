import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, message, Tag, Popconfirm, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, DollarOutlined } from '@ant-design/icons';
import api from '../services/api';
import { Link } from 'react-router-dom';
import type { ManagementCompany, Tariff } from '../types';

const { Title, Text } = Typography;

const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<ManagementCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagementCompany | null>(null);
  const [form] = Form.useForm();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tariffModalOpen, setTariffModalOpen] = useState(false);
  const [tariffForm] = Form.useForm();
  const [selectedCompany, setSelectedCompany] = useState<ManagementCompany | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cr, tr] = await Promise.all([
        api.get('/management-companies/'),
        api.get('/tariffs/'),
      ]);
      setCompanies(cr.data.results || cr.data);
      setTariffs(tr.data.results || tr.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (rec: ManagementCompany) => { setEditing(rec); form.setFieldsValue(rec); setModalOpen(true); };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/management-companies/${id}/`); message.success('Удалена'); fetchData(); }
    catch (e) { message.error('Ошибка удаления'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) { await api.patch(`/management-companies/${editing.id}/`, values); message.success('Обновлена'); }
      else { await api.post('/management-companies/', values); message.success('Создана'); }
      setModalOpen(false); fetchData();
    } catch (e) { message.error('Ошибка сохранения'); }
  };

  // ── Применить тариф ──
  const openTariffModal = (company: ManagementCompany) => {
    setSelectedCompany(company);
    tariffForm.resetFields();
    setTariffModalOpen(true);
  };

  const handleApplyTariff = async (values: any) => {
    if (!selectedCompany) return;
    try {
      await api.post(`/management-companies/${selectedCompany.id}/apply_tariff/`, values);
      message.success(`Тариф применён к ${selectedCompany.name}`);
      setTariffModalOpen(false);
    } catch (e) { message.error('Ошибка применения тарифа'); }
  };

  // ── Expandable: дома УК ──
  const expandedRowRender = (record: ManagementCompany) => {
    const BuildingsTable: React.FC = () => {
      const [buildings, setBuildings] = useState<any[]>([]);
      const [bLoading, setBLoading] = useState(false);

      useEffect(() => {
        setBLoading(true);
        api.get(`/management-companies/${record.id}/buildings/`)
          .then(r => setBuildings(r.data || []))
          .catch(() => {})
          .finally(() => setBLoading(false));
      }, [record.id]);

      if (bLoading) return <Text type="secondary">Загрузка...</Text>;
      if (!buildings.length) return <Text type="secondary">Нет домов</Text>;

      return (
        <Table
          dataSource={buildings}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: 'Адрес', key: 'address', render: (_: any, b: any) =>
              `г. ${b.city}, ${b.street_name}, д. ${b.house_number}${b.building_number ? ' корп. ' + b.building_number : ''}`
            },
            { title: 'Квартир', dataIndex: 'clients_count', key: 'cl', align: 'right' as const, width: 80,
              render: (v: number) => <Tag color="blue">{v}</Tag> },
          ]}
        />
      );
    };
    return <BuildingsTable />;
  };

  const paymentColors: Record<string, string> = { contract: 'green', erc: 'orange', mixed: 'purple' };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', width: 220, ellipsis: true,
      render: (n: string, rec: ManagementCompany) => <Link to={`/management-companies/${rec.id}`}>{n}</Link> },
    { title: 'Оплата', dataIndex: 'payment_method_display', key: 'pm', width: 140,
      render: (v: string, rec: ManagementCompany) => v ? <Tag color={paymentColors[rec.payment_method || ''] || 'default'}>{v}</Tag> : <Tag>По договору</Tag>
    },
    { title: 'ИНН', dataIndex: 'inn', key: 'inn', width: 120 },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: 'Клиентов', dataIndex: 'clients_count', key: 'count', width: 85, align: 'right' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag> },
    {
      title: '', key: 'actions', width: 140,
      render: (_: any, rec: ManagementCompany) => (
        <Space size="small">
          <Button size="small" title="Применить тариф" icon={<DollarOutlined />} onClick={() => openTariffModal(rec)} />
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(rec.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>🏢 Управляющие компании / ТСЖ</Title>
        <Space>
          <Link to="/management-companies/create">
            <Button type="primary" icon={<PlusOutlined />}>Создать с домами</Button>
          </Link>
          <Button icon={<PlusOutlined />} onClick={openCreate}>Быстрое добавление</Button>
        </Space>
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={companies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="small"
          expandable={{
            expandedRowRender,
            rowExpandable: (rec) => (rec.clients_count || 0) > 0,
          }}
        />
      </Card>

      {/* Модалка создания/редактирования */}
      <Modal title={editing ? 'Редактировать УК' : 'Новая УК'} open={modalOpen}
        onCancel={() => setModalOpen(false)} footer={null} width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Полное название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="short_name" label="Короткое название"><Input /></Form.Item>
          <Form.Item name="inn" label="ИНН"><Input maxLength={12} /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="payment_method" label="Способ оплаты за домофон">
            <Select allowClear placeholder="По договору" options={[
              { label: 'По договору с УК/ТСЖ', value: 'contract' },
              { label: 'Через ЕРЦ (прямые платежи жителей)', value: 'erc' },
              { label: 'Смешанная', value: 'mixed' },
            ]} />
          </Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>

      {/* Модалка применения тарифа */}
      <Modal title={`Применить тариф: ${selectedCompany?.name}`} open={tariffModalOpen}
        onCancel={() => setTariffModalOpen(false)} footer={null} width={400}
      >
        <Form form={tariffForm} layout="vertical" onFinish={handleApplyTariff}>
          <Form.Item name="tariff_id" label="Тариф" rules={[{ required: true, message: 'Выберите тариф' }]}>
            <Select
              placeholder="Выберите тариф"
              options={tariffs.map(t => ({ label: `${t.name} — ${t.amount} ₽/мес`, value: t.id }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<DollarOutlined />}>Применить ко всем квартирам</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default CompaniesPage;
