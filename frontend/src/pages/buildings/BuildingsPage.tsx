import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, InputNumber, message, Tag } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Building, BuildingFormValues, Region } from '../../types';

const { Title } = Typography;

const STREET_TYPES = [
  { value: 'street', label: 'Улица' },
  { value: 'avenue', label: 'Проспект' },
  { value: 'lane', label: 'Переулок' },
  { value: 'boulevard', label: 'Бульвар' },
  { value: 'highway', label: 'Шоссе' },
  { value: 'square', label: 'Площадь' },
  { value: 'embankment', label: 'Набережная' },
  { value: 'passage', label: 'Проезд' },
  { value: 'alley', label: 'Аллея' },
  { value: 'microdistrict', label: 'Микрорайон' },
  { value: 'other', label: 'Другое' },
];

const EQUIPMENT_TYPES = [
  { value: '', label: '— Не указано —' },
  { value: 'intercom', label: 'Домофон' },
  { value: 'video_intercom', label: 'Видеодомофон' },
  { value: 'camera', label: 'Камера' },
  { value: 'call_panel', label: 'Вызывная панель' },
  { value: 'door_lock', label: 'Дверной замок' },
  { value: 'multi_apartment', label: 'Многоквартирная система' },
  { value: 'other', label: 'Другое' },
];

const BuildingsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [regions, setRegions] = useState<Region[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchBuildings();
      fetchRegions();
      fetchCompanies();
    }
  }, [isAuthenticated]);

  const fetchBuildings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/buildings/');
      setBuildings(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки домов');
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

  const fetchCompanies = async () => {
    try {
      const r = await api.get('/management-companies/');
      setCompanies(r.data.results || r.data || []);
    } catch (e) {}
  };

  const handleCreateBuilding = async (values: BuildingFormValues) => {
    try {
      const response = await api.post('/buildings/', values);
      setBuildings([response.data, ...buildings]);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Дом добавлен');
    } catch (error) {
      message.error('Ошибка добавления дома');
    }
  };

  const handleViewBuilding = (building: Building) => {
    navigate(`/buildings/${building.id}`);
  };

  const filteredBuildings = buildings.filter((b) => {
    const s = searchText.toLowerCase();
    return (
      b.street_name?.toLowerCase().includes(s) ||
      b.house_number?.toLowerCase().includes(s) ||
      b.city?.toLowerCase().includes(s) ||
      (b as any).management_company_name?.toLowerCase().includes(s)
    );
  });

  const columns = [
    {
      title: 'Адрес',
      key: 'address',
      width: 300,
      render: (_: any, record: Building) =>
        `${record.street_type_display} ${record.street_name}, ${record.house_number}${record.building_number ? ' корп.' + record.building_number : ''}`,
    },
    {
      title: 'Город',
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: 'УК / ТСЖ',
      dataIndex: 'management_company_name',
      key: 'mc',
      width: 200,
      ellipsis: true,
      render: (v: string, r: any) => v || r.management_company || '-',
    },
    {
      title: 'Район',
      dataIndex: 'district',
      key: 'district',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: 'Регион',
      dataIndex: 'region',
      key: 'region',
      width: 150,
      render: (region: any) => region?.name || '-',
    },
    {
      title: 'Квартир',
      dataIndex: 'apartments_count',
      key: 'apartments_count',
      width: 80,
    },
    {
      title: 'Подъездов',
      dataIndex: 'entrances_count',
      key: 'entrances_count',
      width: 90,
    },
    {
      title: 'Оборудование',
      dataIndex: 'equipment_type_display',
      key: 'equipment_type',
      width: 180,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 80,
      render: (_: any, record: Building) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewBuilding(record)} />
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Справочник домов</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          Добавить дом
        </Button>
      </Space>

      <Input.Search
        placeholder="Поиск по адресу..."
        style={{ marginBottom: 16, width: 300 }}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={filteredBuildings}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Всего: ${total}` }}
      />

      <Modal
        title="Добавить дом"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={650}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateBuilding} initialValues={{ city: 'Москва', street_type: 'street', apartments_count: 0, entrances_count: 1 }}>
          <Form.Item name="region_id" label="Регион/Район" rules={[{ required: true, message: 'Выберите район' }]}>
            <Select placeholder="Выберите район" options={regions.map((r: any) => ({ value: r.id, label: r.name }))} />
          </Form.Item>

          <Form.Item name="city" label="Город" rules={[{ required: true, message: 'Введите город' }]}>
            <Input placeholder="Город" />
          </Form.Item>

          <Space style={{ display: 'flex' }} size="middle">
            <Form.Item name="street_type" label="Тип улицы" rules={[{ required: true }]}>
              <Select style={{ width: 180 }} options={STREET_TYPES} />
            </Form.Item>
            <Form.Item name="street_name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
              <Input placeholder="Название улицы" style={{ width: 240 }} />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }} size="middle">
            <Form.Item name="house_number" label="Дом" rules={[{ required: true, message: 'Введите номер' }]}>
              <Input placeholder="Номер дома" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="building_number" label="Корпус/строение">
              <Input placeholder="Корпус" style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }} size="middle">
            <Form.Item name="apartments_count" label="Квартир">
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="entrances_count" label="Подъездов">
              <InputNumber min={1} style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item name="management_company_fk" label="УК / ТСЖ">
            <Select
              allowClear showSearch placeholder="Выберите УК"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={companies.map((c: any) => ({ label: c.short_name || c.name, value: c.id }))}
            />
          </Form.Item>

          <Form.Item name="equipment_type" label="Тип оборудования">
            <Select options={EQUIPMENT_TYPES} />
          </Form.Item>

          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={3} placeholder="Произвольный комментарий" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>Добавить дом</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BuildingsPage;
