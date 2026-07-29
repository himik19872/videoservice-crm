import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Modal, Form, Input, Card } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import api from '../../services/api';
import InnSuggest from '../../components/InnSuggest';
import type { Supplier } from '../../types';

const { Title } = Typography;

const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form] = Form.useForm();

  const handleInnFound = (company: any) => {
    form.setFieldsValue({
      name: company.name || company.short_name,
      inn: company.inn,
      kpp: company.kpp,
      ogrn: company.ogrn,
      legal_address: company.legal_address,
    });
    message.success(company.short_name || company.name);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers/?page_size=100');
      setSuppliers(res.data.results || res.data);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (values: any) => {
    try {
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}/`, values);
        message.success('Поставщик обновлён');
      } else {
        await api.post('/suppliers/', values);
        message.success('Поставщик создан');
      }
      setModalVisible(false);
      setEditingSupplier(null);
      form.resetFields();
      fetchSuppliers();
    } catch (e: any) { message.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    form.setFieldsValue(s);
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingSupplier(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', width: 250 },
    { title: 'ИНН', dataIndex: 'inn', key: 'inn', width: 120 },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 150 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 200 },
    { title: 'Контакт', dataIndex: 'contact_person', key: 'contact', width: 150 },
    {
      title: '', key: 'actions', width: 80, render: (_: any, r: Supplier) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>🏢 Поставщики</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить поставщика</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchSuppliers}>Обновить</Button>
      </Space>

      <Table columns={columns} dataSource={suppliers} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />

      <Modal
        title={editingSupplier ? 'Редактировать поставщика' : 'Новый поставщик'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingSupplier(null); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="inn" label="ИНН">
            <InnSuggest onFound={handleInnFound} />
          </Form.Item>
          <Form.Item name="kpp" label="КПП"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="contact_person" label="Контактное лицо"><Input /></Form.Item>
          <Form.Item name="legal_address" label="Юр. адрес"><Input /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" block>
            {editingSupplier ? 'Сохранить' : 'Создать'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default SuppliersPage;
