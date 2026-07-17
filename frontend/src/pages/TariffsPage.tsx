import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, InputNumber, message, Tag, Popconfirm, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { Tariff } from '../types';

const { Title } = Typography;

const TariffsPage: React.FC = () => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tariff | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get('/tariffs/');
      setTariffs(r.data.results || r.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ is_active: true, amount: 0 }); setModalOpen(true); };
  const openEdit = (rec: Tariff) => { setEditing(rec); form.setFieldsValue(rec); setModalOpen(true); };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/tariffs/${id}/`); message.success('Удалён'); fetchData(); }
    catch (e) { message.error('Ошибка'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) { await api.put(`/tariffs/${editing.id}/`, values); message.success('Обновлён'); }
      else { await api.post('/tariffs/', values); message.success('Создан'); }
      setModalOpen(false); fetchData();
    } catch (e) { message.error('Ошибка сохранения'); }
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    { title: 'Сумма (₽/мес)', dataIndex: 'amount', key: 'amount', width: 130, align: 'right' as const,
      render: (v: string) => <strong style={{ fontSize: 15 }}>{parseFloat(v).toFixed(2)}</strong> },
    { title: 'Активен', dataIndex: 'is_active', key: 'active', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Да' : 'Нет'}</Tag> },
    { title: 'Описание', dataIndex: 'description', key: 'desc', ellipsis: true },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, rec: Tariff) => (
        <Space size="small">
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
        <Title level={3} style={{ margin: 0 }}>💰 Тарифы</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
      </Space>

      <Card>
        <Table columns={columns} dataSource={tariffs} rowKey="id" loading={loading}
          pagination={{ pageSize: 20 }} size="small" />
      </Card>

      <Modal title={editing ? 'Редактировать тариф' : 'Новый тариф'} open={modalOpen}
        onCancel={() => setModalOpen(false)} footer={null} width={450}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Напр. Стандарт 65₽" />
          </Form.Item>
          <Form.Item name="amount" label="Сумма (₽/мес)" rules={[{ required: true }]}>
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default TariffsPage;
