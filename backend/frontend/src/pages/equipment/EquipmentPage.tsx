import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Equipment, EquipmentFormValues, Client } from '../../types';

const { Title } = Typography;

const EquipmentPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchEquipment();
      fetchClients();
    }
  }, [isAuthenticated]);

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const response = await api.get('/equipment/');
      setEquipment(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки оборудования');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients/');
      setClients(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  };

  const handleCreateEquipment = async (values: EquipmentFormValues) => {
    try {
      const response = await api.post('/equipment/', values);
      setEquipment([response.data, ...equipment]);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Оборудование добавлено');
    } catch (error) {
      message.error('Ошибка добавления оборудования');
    }
  };

  const handleEditEquipment = (item: Equipment) => {
    navigate(`/equipment/${item.id}`);
  };

  const handleViewEquipment = (item: Equipment) => {
    navigate(`/equipment/${item.id}`);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      intercom: 'blue',
      camera: 'green',
      call_panel: 'orange',
      door_lock: 'purple',
      other: 'default',
    };
    return colors[type] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      working: 'green',
      broken: 'red',
      under_repair: 'orange',
      decommissioned: 'gray',
    };
    return colors[status] || 'default';
  };

  const filteredEquipment = equipment.filter((item) => {
    return (
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'Тип',
      dataIndex: 'equipment_type',
      key: 'equipment_type',
      width: 100,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>
          {type === 'intercom' ? 'Домофон' : type === 'camera' ? 'Камера' : type === 'call_panel' ? 'Вызывная панель' : type === 'door_lock' ? 'Дверной замок' : 'Другое'}
        </Tag>
      ),
    },
    {
      title: 'Серийный номер',
      dataIndex: 'serial_number',
      key: 'serial_number',
      width: 150,
    },
    {
      title: 'Клиент',
      dataIndex: 'client',
      key: 'client',
      width: 200,
      render: (client: any) => client?.full_name || '-',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'working' ? 'Работает' : status === 'broken' ? 'Не работает' : status === 'under_repair' ? 'На ремонте' : 'Выбыл'}
        </Tag>
      ),
    },
    {
      title: 'Гарантия до',
      dataIndex: 'warranty_until',
      key: 'warranty_until',
      width: 120,
      render: (date: string | null) => date ? new Date(date).toLocaleDateString('ru-RU') : '-',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_: any, record: Equipment) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewEquipment(record)}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditEquipment(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Оборудование</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Новое оборудование
        </Button>
      </Space>

      <Input.Search
        placeholder="Поиск по названию, серийному номеру..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredEquipment}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
        }}
      />

      <Modal
        title="Добавить оборудование"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateEquipment}
        >
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Введите название" />
          </Form.Item>

          <Form.Item
            name="equipment_type"
            label="Тип"
            rules={[{ required: true, message: 'Выберите тип' }]}
          >
            <Select placeholder="Выберите тип">
              <Select.Option value="intercom">Домофон</Select.Option>
              <Select.Option value="camera">Камера</Select.Option>
              <Select.Option value="call_panel">Вызывная панель</Select.Option>
              <Select.Option value="door_lock">Дверной замок</Select.Option>
              <Select.Option value="other">Другое</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="serial_number"
            label="Серийный номер"
            rules={[{ required: true, message: 'Введите серийный номер' }]}
          >
            <Input placeholder="Введите серийный номер" />
          </Form.Item>

          <Form.Item
            name="client_id"
            label="Клиент"
            rules={[{ required: true, message: 'Выберите клиента' }]}
          >
            <Select
              showSearch
              placeholder="Выберите клиента"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={clients.map((client) => ({
                value: client.id,
                label: `${client.full_name} (${client.phone})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="Статус"
            initialValue="working"
          >
            <Select>
              <Select.Option value="working">Работает</Select.Option>
              <Select.Option value="broken">Не работает</Select.Option>
              <Select.Option value="under_repair">На ремонте</Select.Option>
              <Select.Option value="decommissioned">Выбыл</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="warranty_until"
            label="Гарантия до"
          >
            <Input type="date" />
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

export default EquipmentPage;
