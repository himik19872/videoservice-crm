import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Client, ClientFormValues, Region } from '../../types';

const { Title } = Typography;

const ClientsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [regions, setRegions] = useState<Region[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchClients();
      fetchRegions();
    }
  }, [isAuthenticated]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clients/');
      setClients(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки клиентов');
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

  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      const response = await api.post('/clients/', values);
      setClients([response.data, ...clients]);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Клиент создан');
    } catch (error) {
      message.error('Ошибка создания клиента');
    }
  };

  const handleEditClient = (client: Client) => {
    navigate(`/clients/${client.id}`);
  };

  const handleViewClient = (client: Client) => {
    navigate(`/clients/${client.id}`);
  };

  const filteredClients = clients.filter((client) => {
    return (
      client.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      client.phone?.toLowerCase().includes(searchText.toLowerCase()) ||
      client.address?.toLowerCase().includes(searchText.toLowerCase())
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
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      width: 250,
    },
    {
      title: 'Район',
      dataIndex: 'region',
      key: 'region',
      width: 150,
      render: (region: any) => region?.name || '-',
    },
    {
      title: 'Дата добавления',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_: any, record: Client) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewClient(record)}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditClient(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Клиенты</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Новый клиент
        </Button>
      </Space>

      <Input.Search
        placeholder="Поиск по ФИО, телефону, адресу..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredClients}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
        }}
      />

      <Modal
        title="Создать нового клиента"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateClient}
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
            name="email"
            label="Email"
          >
            <Input placeholder="Введите email" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Адрес"
            rules={[{ required: true, message: 'Введите адрес' }]}
          >
            <Input placeholder="Введите адрес" />
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
            name="notes"
            label="Примечания"
          >
            <Input.TextArea rows={3} placeholder="Дополнительная информация" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Button onClick={() => setIsModalOpen(false)}>Отмена</Button>
            <Button type="primary" htmlType="submit" style={{ marginLeft: 8 }}>
              Создать
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientsPage;
