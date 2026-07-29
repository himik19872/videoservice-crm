import React, { useState } from 'react';
import { Table, Tag, Button, Space, Typography, Modal, Form, Input, Select, message, Card } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  SortAscendingOutlined,
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
  const [masters, setMasters] = useState<any[]>([]);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('descend');

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
      fetchRegions();
      fetchClients();
      fetchMasters();
    }
  }, [isAuthenticated]);

  const fetchMasters = async () => {
    try {
      const response = await api.get('/masters/');
      setMasters(response.data.results || response.data);
    } catch (e) { console.error('Ошибка загрузки мастеров:', e); }
  };

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
    } catch (error) { console.error('Ошибка загрузки районов:', error); }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients/');
      setClients(response.data.results || response.data);
    } catch (error) { console.error('Ошибка загрузки клиентов:', error); }
  };

  const handleCreateOrder = async (values: OrderFormValues) => {
    try {
      const response = await api.post('/orders/', values);
      setOrders([response.data, ...orders]);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Заявка создана');
    } catch (error) { message.error('Ошибка создания заявки'); }
  };

  const handleViewOrder = (order: Order) => { navigate(`/orders/${order.id}`); };

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
      repair: 'blue', connection: 'purple', sale: 'green',
      installation: 'cyan', maintenance: 'orange', inspection: 'geekblue',
      contract_install: 'volcano', contract_service: 'gold',
    };
    return colors[type] || 'default';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      repair: 'Ремонт', connection: 'Подключение', sale: 'Продажа',
      installation: 'Монтаж', maintenance: 'ТО', inspection: 'Обследование',
      contract_install: 'Договор монтажа', contract_service: 'Договор ТО',
    };
    return labels[type] || type;
  };

  // Фильтрация + сортировка
  const filteredOrders = orders
    .filter((order) => {
      const matchesSearch = !searchText || (
        order.address?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.street_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.city?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.number?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.client_info?.full_name?.toLowerCase().includes(searchText.toLowerCase())
      );
      const matchesStatus = statusFilter ? order.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      const desc = sortOrder === 'descend';
      let va: any, vb: any;

      switch (sortField) {
        case 'cost': va = a.cost || 0; vb = b.cost || 0; break;
        case 'master': va = a.master_info?.full_name || ''; vb = b.master_info?.full_name || ''; break;
        case 'region': va = a.region_info?.name || ''; vb = b.region_info?.name || ''; break;
        case 'address': va = a.address || ''; vb = b.address || ''; break;
        case 'number': va = a.number || ''; vb = b.number || ''; break;
        case 'client': va = a.client_info?.full_name || ''; vb = b.client_info?.full_name || ''; break;
        case 'priority':
          const prio = { urgent: 4, high: 3, medium: 2, low: 1 };
          va = prio[a.priority] || 0; vb = prio[b.priority] || 0;
          break;
        case 'created_at':
        default:
          va = new Date(a.created_at || 0).getTime();
          vb = new Date(b.created_at || 0).getTime();
          break;
      }

      if (typeof va === 'string') {
        return desc ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      return desc ? vb - va : va - vb;
    });

  const columns = [
    {
      title: 'Номер', dataIndex: 'number', key: 'number', width: 100, fixed: 'left' as const,
      sorter: true,
    },
    {
      title: 'Клиент', dataIndex: 'client_info', key: 'client', width: 140,
      render: (c: any) => c?.full_name || '-',
      sorter: true,
    },
    {
      title: 'Район', dataIndex: 'region_info', key: 'region', width: 110,
      render: (r: any) => r?.name || '-',
      sorter: true,
    },
    {
      title: 'Адрес', dataIndex: 'address', key: 'address', width: 160, ellipsis: true,
      sorter: true,
    },
    {
      title: 'Тип', dataIndex: 'order_type', key: 'order_type', width: 100,
      render: (type: string) => <Tag color={getTypeColor(type)}>{getTypeLabel(type)}</Tag>,
    },
    {
      title: 'Статус', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>,
    },
    {
      title: 'Приоритет', dataIndex: 'priority', key: 'priority', width: 90,
      render: (priority: string) => {
        const p: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочный' };
        return p[priority] || priority;
      },
      sorter: true,
    },
    {
      title: 'Мастер', dataIndex: 'master_info', key: 'master', width: 130,
      render: (m: any) => m?.full_name || <Tag color="default">не назначен</Tag>,
      sorter: true,
    },
    {
      title: 'Стоимость', dataIndex: 'cost', key: 'cost', width: 90,
      render: (c: number | null) => c != null ? <span style={{ fontWeight: 600 }}>{c} ₽</span> : <span style={{ color: '#ccc' }}>—</span>,
      sorter: true,
    },
    {
      title: 'Создано', dataIndex: 'created_at', key: 'created_at', width: 100,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
      sorter: true, defaultSortOrder: 'descend' as const,
    },
    {
      title: '', key: 'actions', width: 80, fixed: 'right' as const,
      render: (_: any, record: Order) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewOrder(record)} />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/orders/${record.id}/edit`)} />
        </Space>
      ),
    },
  ];

  const statusOptions = [
    { value: 'new', label: '🆕 Новая' }, { value: 'assigned', label: '📌 Назначена' },
    { value: 'accepted', label: '✅ Принята' }, { value: 'in_progress', label: '▶️ В работе' },
    { value: 'paused', label: '⏸️ На паузе' }, { value: 'need_help', label: '🆘 Нужна помощь' },
    { value: 'completed', label: '🏁 Выполнена' }, { value: 'confirmed', label: '✔️ Подтверждена' },
    { value: 'cancelled', label: '❌ Отменена' },
  ];

  return (
    <Card>
      <Title level={3}>Заявки</Title>

      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }} size={8}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          Новая заявка
        </Button>
        <Select
          allowClear
          placeholder="🏷️ Статус"
          style={{ minWidth: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <Select
          allowClear
          placeholder="📊 Сортировка"
          style={{ minWidth: 170 }}
          value={sortField}
          onChange={setSortField}
          options={[
            { value: 'created_at', label: '📅 По дате' },
            { value: 'master', label: '👤 По мастеру' },
            { value: 'region', label: '📍 По району' },
            { value: 'address', label: '🏠 По адресу' },
            { value: 'cost', label: '💰 По стоимости' },
            { value: 'priority', label: '🔴 По приоритету' },
            { value: 'number', label: '🔢 По номеру' },
            { value: 'client', label: '🧑 По клиенту' },
          ]}
        />
        <Button
          icon={<SortAscendingOutlined />}
          type={sortOrder === 'ascend' ? 'primary' : 'default'}
          onClick={() => setSortOrder(sortOrder === 'ascend' ? 'descend' : 'ascend')}
        >
          {sortOrder === 'ascend' ? '↑ Возр.' : '↓ Убыв.'}
        </Button>
        <Input.Search
          placeholder="Поиск по адресу, клиенту, номеру..."
          style={{ width: 280 }}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <Tag style={{ marginLeft: 8 }}>Найдено: {filteredOrders.length}</Tag>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredOrders}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1300 }}
        size="middle"
        onChange={(_pagination, _filters, sorter: any) => {
          if (sorter.field) {
            setSortField(sorter.field);
            setSortOrder(sorter.order || 'descend');
          }
        }}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['10', '15', '25', '50'],
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
        <Form form={form} layout="vertical" onFinish={handleCreateOrder}>
          <Form.Item name="client_id" label="Клиент" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Выберите клиента"
              optionFilterProp="children"
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={clients.map((c) => ({ value: c.id, label: `${c.full_name} (${c.phone})` }))}
            />
          </Form.Item>
          <Form.Item name="region_id" label="Район" rules={[{ required: true }]}>
            <Select placeholder="Выберите район" options={regions.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item name="order_type" label="Тип заявки" rules={[{ required: true }]}>
            <Select placeholder="Выберите тип">
              <Select.Option value="repair">Ремонт</Select.Option>
              <Select.Option value="connection">Подключение</Select.Option>
              <Select.Option value="installation">Монтаж</Select.Option>
              <Select.Option value="maintenance">Сервисное ТО</Select.Option>
              <Select.Option value="sale">Продажа</Select.Option>
              <Select.Option value="inspection">Обследование</Select.Option>
            </Select>
          </Form.Item>
          <AddressSuggest form={form} />
          <Form.Item name="description" label="Описание" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Опишите проблему или задачу" />
          </Form.Item>
          <Form.Item name="priority" label="Приоритет">
            <Select defaultValue="medium">
              <Select.Option value="low">Низкий</Select.Option>
              <Select.Option value="medium">Средний</Select.Option>
              <Select.Option value="high">Высокий</Select.Option>
              <Select.Option value="urgent">Срочный</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Создать заявку</Button>
        </Form>
      </Modal>
    </Card>
  );
};

export default OrdersPage;
