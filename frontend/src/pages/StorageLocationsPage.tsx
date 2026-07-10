import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Typography, message, Tag, Modal, Form, Input, InputNumber,
  Select, Switch, Card, Row, Col, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, BarcodeOutlined, SearchOutlined,
  EnvironmentOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BarcodeScanner from '../components/BarcodeScanner';
import type { StorageLocation } from '../types';

const { Title, Text } = Typography;

const StorageLocationsPage: React.FC = () => {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string | undefined>(undefined);
  const [editModal, setEditModal] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (search) params.search = search;
      if (zoneFilter) params.zone = zoneFilter;
      const res = await api.get('/storage-locations/', { params });
      setLocations(res.data.results || res.data);
      setTotal(res.data.count || 0);
      // Collect zones for filter
      const allZones: string[] = [...new Set((res.data.results || res.data || []).map((l: StorageLocation) => l.zone).filter(Boolean))];
      setZones(allZones);
    } catch (err: any) {
      message.error('Ошибка загрузки мест хранения');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, zoneFilter]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const openCreate = () => {
    setEditingLocation(null);
    form.resetFields();
    setEditModal(true);
  };

  const openEdit = (loc: StorageLocation) => {
    setEditingLocation(loc);
    form.setFieldsValue(loc);
    setEditModal(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingLocation) {
        await api.put(`/storage-locations/${editingLocation.id}/`, values);
        message.success('Место обновлено');
      } else {
        await api.post('/storage-locations/', values);
        message.success('Место создано');
      }
      setEditModal(false);
      fetchLocations();
    } catch (err: any) {
      if (err.response?.data) {
        const data = err.response.data;
        const msg = typeof data === 'string' ? data : JSON.stringify(data);
        message.error(msg);
      }
    }
  };

  const handleDelete = async (loc: StorageLocation) => {
    Modal.confirm({
      title: 'Удалить место хранения?',
      content: `Код: ${loc.code}. Товары в ячейке не будут удалены.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        await api.delete(`/storage-locations/${loc.id}/`);
        message.success('Место удалено');
        fetchLocations();
      },
    });
  };

  const handleBarcodeScanned = async (code: string) => {
    setScannerVisible(false);
    try {
      const res = await api.get('/storage-locations/by_barcode/', { params: { code } });
      navigate(`/storage-locations/${res.data.id}`);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Место не найдено');
    }
  };

  const columns = [
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
      render: (code: string, record: StorageLocation) => (
        <a onClick={() => navigate(`/storage-locations/${record.id}`)}>
          <Text strong>{code}</Text>
        </a>
      ),
      sorter: (a: StorageLocation, b: StorageLocation) => a.code.localeCompare(b.code),
    },
    {
      title: 'Штрихкод',
      dataIndex: 'barcode',
      key: 'barcode',
      render: (barcode: string) => barcode ? <Text code>{barcode}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Зона',
      dataIndex: 'zone',
      key: 'zone',
      render: (zone: string) => zone || <Text type="secondary">—</Text>,
    },
    {
      title: 'Стеллаж',
      dataIndex: 'rack',
      key: 'rack',
    },
    {
      title: 'Полка',
      dataIndex: 'shelf',
      key: 'shelf',
    },
    {
      title: 'Позиций',
      dataIndex: 'items_count',
      key: 'items_count',
      sorter: (a: StorageLocation, b: StorageLocation) => a.items_count - b.items_count,
      render: (count: number, record: StorageLocation) => (
        <Space>
          <Tag color={record.is_full ? 'red' : 'green'}>{count}</Tag>
          {record.capacity > 0 && <Text type="secondary">/ {record.capacity}</Text>}
        </Space>
      ),
    },
    {
      title: 'Свободно',
      dataIndex: 'free_space',
      key: 'free_space',
      render: (free: number | null) => free === null ? '∞' : free,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => active ? <Tag color="green">Активно</Tag> : <Tag color="default">Неактивно</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: any, record: StorageLocation) => (
        <Space>
          <Tooltip title="Редактировать">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <EnvironmentOutlined /> Места хранения
            </Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Поиск по коду, штрихкоду…"
                allowClear
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: 280 }}
              />
              <Button icon={<BarcodeOutlined />} onClick={() => setScannerVisible(true)}>
                Сканер места
              </Button>
              <Button icon={<ReloadOutlined />} onClick={fetchLocations} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Добавить место
              </Button>
            </Space>
          </Col>
        </Row>
        {zones.length > 0 && (
          <Row style={{ marginTop: 12 }}>
            <Space>
              <Text type="secondary">Зона:</Text>
              <Select
                allowClear
                placeholder="Все зоны"
                style={{ width: 180 }}
                value={zoneFilter}
                onChange={(v) => { setZoneFilter(v); setPage(1); }}
                options={zones.map(z => ({ value: z, label: z }))}
              />
            </Space>
          </Row>
        )}
      </Card>

      <Table
        dataSource={locations}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Всего: ${t}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      {/* Модалка создания/редактирования */}
      <Modal
        title={editingLocation ? 'Редактировать место' : 'Новое место хранения'}
        open={editModal}
        onOk={handleSave}
        onCancel={() => setEditModal(false)}
        okText="Сохранить"
        cancelText="Отмена"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="Код места"
            rules={[{ required: true, message: 'Введите код места' }]}
          >
            <Input placeholder="Например: A-03-12" />
          </Form.Item>
          <Form.Item name="zone" label="Зона">
            <Input placeholder="Например: Склад А" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rack" label="Стеллаж">
                <Input placeholder="Номер стеллажа" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shelf" label="Полка">
                <Input placeholder="Номер полки" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="capacity" label="Вместимость (0 = без ограничений)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активно" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Сканер штрихкодов мест */}
      <BarcodeScanner
        visible={scannerVisible}
        onScanned={handleBarcodeScanned}
        onClose={() => setScannerVisible(false)}
        title="Сканировать место хранения"
      />
    </div>
  );
};

export default StorageLocationsPage;
