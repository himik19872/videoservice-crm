import React, { useState } from 'react';
import { Table, Tag, Button, Space, Typography, Modal, Form, Input, Select, message, Card, Row, Col } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import AddressSuggest from '../../components/AddressSuggest';
import type { Order, OrderFormValues, Region, Client } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;

const OrdersPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [regions, setRegions] = useState<Region[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
      fetchRegions();
      fetchClients();
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders/');
      setOrders(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки заявок');
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

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients/');
      setClients(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  };

  const handleCreateOrder = async (values: OrderFormValues) => {
    try {
      const response = await api.post('/orders/', values);
      setOrders([response.data, ...orders]);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Заявка создана');
    } catch (error) {
      message.error('Ошибка создания заявки');
    }
  };

  const handleEditOrder = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleViewOrder = (order: Order) => {
    navigate(`/orders/${order.id}`);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = !searchText || (
      order.address?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.street_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.city?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.number?.toLowerCase().includes(searchText.toLowerCase()) ||
      order.client_info?.full_name?.toLowerCase().includes(searchText.toLowerCase())
    );
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Новая', assigned: 'Назначена', accepted: 'Принята',
      in_progress: 'В работе', paused: 'На паузе', need_help: 'Требуется помощь',
      completed: 'Выполнена', confirmed: 'Подтверждена', cancelled: 'Отменена',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'blue', assigned: 'purple', accepted: 'cyan',
      in_progress: 'orange', paused: 'gold', need_help: 'red',
      completed: 'green', confirmed: 'green', cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      repair: 'blue',
      connection: 'purple',
      sale: 'green',
    };
    return colors[type] || 'default';
  };

  const columns = [
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      width: 100,
      fixed: 'left',
    },
    {
      title: 'Клиент',
      dataIndex: 'client_info',
      key: 'client',
      width: 150,
      render: (client: any) => client?.full_name || '-',
    },
    {
      title: 'Район',
      dataIndex: 'region_info',
      key: 'region',
      width: 120,
      render: (region: any) => region?.name || '-',
    },
    {
      title: 'Тип',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 100,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>
          {type === 'repair' ? 'Ремонт' : type === 'connection' ? 'Подключение' : 'Продажа'}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => {
        const priorities: Record<string, string> = {
          low: 'Низкий',
          medium: 'Средний',
          high: 'Высокий',
          urgent: 'Срочный',
        };
        return priorities[priority] || priority;
      },
    },
    {
      title: 'Мастер',
      dataIndex: 'master_info',
      key: 'master',
      width: 150,
      render: (master: any) => master?.full_name || '-',
    },
    {
      title: 'Создано',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: any, record: Order) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewOrder(record)}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditOrder(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Title level={3}>Заявки</Title>

      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Новая заявка
        </Button>
        <Button icon={<FilterOutlined />} onClick={() => {}}>
          Фильтры
        </Button>
      </Space>

      <Input.Search
        placeholder="Поиск по адресу, улице, городу, клиенту..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => handleSearch(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredOrders}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
        }}
      />

      <Modal
        title="Создать новую заявку"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateOrder}
        >
          <Form.Item
            name="client_id"
            label="Клиент"
            rules={[{ required: true }]}
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
            name="region_id"
            label="Район"
            rules={[{ required: true }]}
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
            name="order_type"
            label="Тип заявки"
            rules={[{ required: true }]}
          >
            <Select placeholder="Выберите тип">
              <Select.Option value="repair">Ремонт</Select.Option>
              <Select.Option value="connection">Подключение</Select.Option>
              <Select.Option value="sale">Продажа</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Адрес" help="Начните вводить — подставится из DaData">
            <AddressSuggest
              onSelect={(addr) => {
                form.setFieldsValue({
                  city: addr.city,
                  street_name: addr.street_name,
                  house_number: addr.house_number,
                  building_number: addr.building_number,
                  apartment: addr.apartment,
                  entrance: addr.entrance,
                });
              }}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="city" label="Город">
                <Input placeholder="Москва" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="street_name" label="Улица">
                <Input placeholder="Ленина" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="house_number" label="Дом">
                <Input placeholder="10" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="building_number" label="Корпус">
                <Input placeholder="2" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="apartment" label="Квартира">
                <Input placeholder="42" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="entrance" label="Подъезд">
            <Input placeholder="3" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Описание"
            rules={[{ required: true }]}
          >
            <TextArea rows={4} placeholder="Опишите проблему" />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Приоритет"
            initialValue="medium"
          >
            <Select>
              <Select.Option value="low">Низкий</Select.Option>
              <Select.Option value="medium">Средний</Select.Option>
              <Select.Option value="high">Высокий</Select.Option>
              <Select.Option value="urgent">Срочный</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="photo_report_required"
            label="Требуется фото/видео отчёт"
          >
            <Select placeholder="Обязательность отчёта">
              <Select.Option value={false}>Не требуется</Select.Option>
              <Select.Option value={true}>Обязателен</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Button onClick={() => setIsModalOpen(false)}>Отмена</Button>
            <Button type="primary" htmlType="submit" style={{ marginLeft: 8 }}>
              Создать
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default OrdersPage;
