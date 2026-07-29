import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { Region, RegionFormValues } from '../../types';

const { Title } = Typography;

const RegionsPage: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/regions/');
      setRegions(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки районов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegion = async (values: RegionFormValues) => {
    setSaving(true);
    try {
      if (editingRegion) {
        const response = await api.put(`/regions/${editingRegion.id}/`, values);
        setRegions(regions.map(r => r.id === editingRegion.id ? response.data : r));
        message.success('Район обновлён');
      } else {
        const response = await api.post('/regions/', values);
        setRegions([response.data, ...regions]);
        message.success('Район добавлен');
      }
      setIsModalOpen(false);
      setEditingRegion(null);
      form.resetFields();
    } catch (error) {
      message.error('Ошибка сохранения района');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingRegion(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (region: Region) => {
    setEditingRegion(region);
    form.setFieldsValue({ name: region.name, description: region.description || '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/regions/${id}/`);
      setRegions(regions.filter(r => r.id !== id));
      message.success('Район удалён');
    } catch (error) {
      message.error('Ошибка удаления района');
    }
  };

  const filteredRegions = regions.filter((region) => {
    return region.name?.toLowerCase().includes(searchText.toLowerCase());
  });

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: 300,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_: any, record: Region) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Удалить район?" onConfirm={() => handleDelete(record.id)} okText="Да" cancelText="Нет">
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Районы</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
        >
          Новый район
        </Button>
      </Space>

      <Input.Search
        placeholder="Поиск по названию..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredRegions}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
        }}
      />

      <Modal
        title={editingRegion ? 'Редактировать район' : 'Добавить район'}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setEditingRegion(null); }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateRegion}
        >
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Введите название" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Описание"
          >
            <Input.TextArea rows={3} placeholder="Описание района" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Button icon={<CloseOutlined />} onClick={() => { setIsModalOpen(false); setEditingRegion(null); }}>Отмена</Button>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" style={{ marginLeft: 8 }} loading={saving}>
              {editingRegion ? 'Сохранить' : 'Добавить'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RegionsPage;
