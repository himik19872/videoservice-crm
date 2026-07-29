import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Master, MasterFormValues, Region } from '../../types';

const { Title } = Typography;

const MastersPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [regions, setRegions] = useState<Region[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchMasters();
      fetchRegions();
    }
  }, [isAuthenticated]);

  const fetchMasters = async () => {
    setLoading(true);
    try {
      const response = await api.get('/masters/');
      setMasters(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки мастеров');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions/');
      setRegions(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки районов:', error);
    }
  };

  const handleCreateMaster = async (values: MasterFormValues) => {
    try {
      const response = await api.post('/masters/', values);
      setMasters([response.data, ...masters]);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Мастер добавлен');
    } catch (error) {
      message.error('Ошибка добавления мастера');
    }
  };

  const handleEditMaster = (master: Master) => {
    navigate(`/masters/${master.id}`);
  };

  const handleViewMaster = (master: Master) => {
    navigate(`/masters/${master.id}`);
  };

  const filteredMasters = masters.filter((master) => {
    return (
      master.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      master.phone?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const columns = [
    {
      title: 'ФИО',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
    },
    {
      title: 'Район',
      dataIndex: 'region',
      key: 'region',
      width: 150,
      render: (region: any) => region?.name || '-',
    },
    {
      title: 'Доступен',
      dataIndex: 'is_available',
      key: 'is_available',
      width: 100,
      render: (available: boolean) => (
        <Tag color={available ? 'green' : 'red'}>
          {available ? 'Да' : 'Нет'}
        </Tag>
      ),
    },
    {
      title: 'Дата регистрации',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_: any, record: Master) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewMaster(record)}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditMaster(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Мастера</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Новый мастер
        </Button>
      </Space>

      <Input.Search
        placeholder="Поиск по ФИО, телефону..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredMasters}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
        }}
      />

      <Modal
        title="Добавить мастера"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateMaster}
        >
          <Form.Item
            name="full_name"
            label="ФИО"
            rules={[{ required: true, message: 'Введите ФИО' }]}
          >
            <Input placeholder="Введите ФИО" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Телефон"
            rules={[{ required: true, message: 'Введите телефон' }]}
          >
            <Input placeholder="Введите телефон" />
          </Form.Item>

          <Form.Item
            name="region_id"
            label="Район"
            rules={[{ required: true, message: 'Выберите район' }]}
          >
            <Select
              placeholder="Выберите район"
              options={regions.map((region) => ({
                value: region.id,
                label: region.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="is_available"
            label="Доступен"
            initialValue={true}
          >
            <Select>
              <Select.Option value={true}>Да</Select.Option>
              <Select.Option value={false}>Нет</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Button onClick={() => setIsModalOpen(false)}>Отмена</Button>
            <Button type="primary" htmlType="submit" style={{ marginLeft: 8 }}>
              Добавить
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MastersPage;
