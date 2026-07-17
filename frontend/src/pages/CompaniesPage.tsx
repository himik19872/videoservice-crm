import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, message, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { ManagementCompany } from '../types';

const { Title } = Typography;

const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<ManagementCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagementCompany | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get('/management-companies/');
      setCompanies(r.data.results || r.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: ManagementCompany) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/management-companies/${id}/`);
      message.success('Удалена');
      fetchData();
    } catch (e) { message.error('Ошибка удаления'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await api.put(`/management-companies/${editing.id}/`, values);
        message.success('Обновлена');
      } else {
        await api.post('/management-companies/', values);
        message.success('Создана');
      }
      setModalOpen(false);
      fetchData();
    } catch (e) { message.error('Ошибка сохранения'); }
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', width: 260, ellipsis: true },
    { title: 'Короткое', dataIndex: 'short_name', key: 'short_name', width: 130 },
    { title: 'ИНН', dataIndex: 'inn', key: 'inn', width: 130 },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: 'Клиентов', dataIndex: 'clients_count', key: 'count', width: 90, align: 'right' as const },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, rec: ManagementCompany) => (
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
        <Title level={3} style={{ margin: 0 }}>🏢 Управляющие компании / ТСЖ</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
      </Space>

      <Card>
        <Table columns={columns} dataSource={companies} rowKey="id" loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }} size="small" />
      </Card>

      <Modal title={editing ? 'Редактировать УК' : 'Новая УК'} open={modalOpen}
        onCancel={() => setModalOpen(false)} footer={null} width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Полное название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="short_name" label="Короткое название">
            <Input />
          </Form.Item>
          <Form.Item name="inn" label="ИНН">
            <Input maxLength={12} />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default CompaniesPage;
