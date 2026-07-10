import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Descriptions, Typography, Table, Button, Space, message, Tag, Modal, Select,
  Row, Col, Statistic, Tooltip, Popconfirm, Result, Spin,
} from 'antd';
import {
  ArrowLeftOutlined, BarcodeOutlined, SwapOutlined, CheckCircleOutlined,
  ReloadOutlined, EnvironmentOutlined, EditOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import BarcodeScanner from '../components/BarcodeScanner';
import type { StorageLocationDetail, InventoryItem } from '../types';

const { Title, Text } = Typography;

const StorageLocationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [location, setLocation] = useState<StorageLocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [moveModal, setMoveModal] = useState(false);
  const [recountModal, setRecountModal] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [targetLocationId, setTargetLocationId] = useState<number | null>(null);
  const [allLocations, setAllLocations] = useState<{ id: number; code: string; zone: string }[]>([]);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/storage-locations/${id}/`);
      setLocation(res.data);
      setNotFound(false);
    } catch (err: any) {
      if (err.response?.status === 404) setNotFound(true);
      else message.error('Ошибка загрузки места');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const fetchAllLocations = async () => {
    try {
      const res = await api.get('/storage-locations/', { params: { page_size: 500, is_active: true } });
      const list = (res.data.results || res.data).filter((l: any) => l.id !== location?.id);
      setAllLocations(list);
    } catch {
      message.error('Не удалось загрузить список мест');
    }
  };

  const openMoveModal = () => {
    fetchAllLocations();
    setSelectedRowKeys([]);
    setTargetLocationId(null);
    setMoveModal(true);
  };

  const handleMove = async () => {
    if (!targetLocationId) {
      message.warning('Выберите целевое место');
      return;
    }
    if (selectedRowKeys.length === 0) {
      message.warning('Выберите товары для перемещения');
      return;
    }
    try {
      const res = await api.post(`/storage-locations/${id}/move_items/`, {
        target_location_id: targetLocationId,
        item_ids: selectedRowKeys.map(Number),
      });
      message.success(`Перемещено: ${res.data.moved_count} позиций`);
      setMoveModal(false);
      fetchLocation();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Ошибка перемещения');
    }
  };

  const handleRecount = async () => {
    try {
      const itemIds = (location?.items || []).map(item => item.id);
      const res = await api.post(`/storage-locations/${id}/recount/`, { item_ids: itemIds });
      const miss = res.data.missing_count;
      if (miss > 0) {
        message.warning(`Расхождение: ${miss} позиций не подтверждены (ID: ${res.data.missing_item_ids?.join(', ')})`);
      } else {
        message.success('Пересчёт выполнен, расхождений нет');
      }
      setRecountModal(false);
    } catch (err: any) {
      message.error('Ошибка пересчёта');
    }
  };

  const handleBarcodeScanned = (code: string) => {
    setScannerVisible(false);
    // Ищем товар в этом месте по штрихкоду
    const item = location?.items.find(i => i.barcode === code);
    if (item) {
      message.info(`Найдено: ${item.name} (${item.barcode})`);
    } else {
      message.warning(`Товар ${code} не найден в этом месте`);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  if (notFound || !location) {
    return (
      <Result
        status="404"
        title="Место не найдено"
        extra={<Button onClick={() => navigate('/storage-locations')}>К списку мест</Button>}
      />
    );
  }

  const itemsColumns = [
    {
      title: 'Штрихкод',
      dataIndex: 'barcode',
      key: 'barcode',
      render: (b: string) => b ? <Text code>{b}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => navigate(`/inventory?search=${encodeURIComponent(record.barcode || record.name)}`)}>
          {name}
        </a>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'item_type_display',
      key: 'item_type',
    },
    {
      title: 'Модель',
      dataIndex: 'model_name',
      key: 'model_name',
      render: (m: string) => m || '—',
    },
    {
      title: 'Серийный №',
      dataIndex: 'serial_number',
      key: 'serial_number',
      render: (s: string) => s || '—',
    },
    {
      title: 'Кол-во',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Цена продажи',
      dataIndex: 'sale_price',
      key: 'sale_price',
      render: (p: string) => p ? `${Number(p).toFixed(0)} ₽` : '—',
    },
    {
      title: 'Статус',
      dataIndex: 'status_display',
      key: 'status',
      render: (s: string) => {
        const color = s === 'На складе' ? 'green' : s === 'У мастера' ? 'blue' : 'default';
        return <Tag color={color}>{s}</Tag>;
      },
    },
  ];

  return (
    <div>
      {/* Хлебные крошки + заголовок */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/storage-locations')}>
          К списку
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          <EnvironmentOutlined /> Место: {location.code}
        </Title>
      </Space>

      {/* Карточка места */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Код">{location.code}</Descriptions.Item>
              <Descriptions.Item label="Штрихкод">
                <Space>
                  <Text code>{location.barcode}</Text>
                  <Button size="small" icon={<BarcodeOutlined />} onClick={() => setScannerVisible(true)}>
                    Сканировать
                  </Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Зона">{location.zone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Стеллаж">{location.rack || '—'}</Descriptions.Item>
              <Descriptions.Item label="Полка">{location.shelf || '—'}</Descriptions.Item>
              <Descriptions.Item label="Вместимость">
                {location.capacity > 0 ? location.capacity : 'Без ограничений'}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Tag color={location.is_active ? 'green' : 'default'}>
                  {location.is_active ? 'Активно' : 'Неактивно'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Примечания">{location.notes || '—'}</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} md={12}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Позиций"
                  value={location.items_count}
                  suffix={location.capacity > 0 ? `/ ${location.capacity}` : ''}
                  valueStyle={{ color: location.is_full ? '#cf1322' : '#3f8600' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Свободно"
                  value={location.free_space === null ? '∞' : location.free_space}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Всего товаров"
                  value={location.items.reduce((sum, i) => sum + i.quantity, 0)}
                />
              </Col>
            </Row>
          </Col>
        </Row>

        {/* Кнопки действий */}
        <Row style={{ marginTop: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              onClick={openMoveModal}
              disabled={location.items.length === 0}
            >
              Переместить товары
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => setRecountModal(true)}
              disabled={location.items.length === 0}
            >
              Пересчёт
            </Button>
            <Button icon={<BarcodeOutlined />} onClick={() => setScannerVisible(true)}>
              Сканер
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchLocation} />
          </Space>
        </Row>
      </Card>

      {/* Таблица товаров в ячейке */}
      <Card title={`Содержимое (${location.items.length} позиций)`}>
        <Table
          dataSource={location.items}
          columns={itemsColumns}
          rowKey="id"
          size="small"
          pagination={false}
          rowSelection={moveModal ? {
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          } : undefined}
          locale={{ emptyText: 'Место пусто' }}
        />
      </Card>

      {/* Модалка перемещения */}
      <Modal
        title="Переместить товары"
        open={moveModal}
        onOk={handleMove}
        onCancel={() => setMoveModal(false)}
        okText="Переместить"
        cancelText="Отмена"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Выбрано позиций: {selectedRowKeys.length}</Text>
          <Text strong>Куда переместить:</Text>
          <Select
            showSearch
            placeholder="Выберите место"
            style={{ width: '100%' }}
            value={targetLocationId}
            onChange={setTargetLocationId}
            optionFilterProp="label"
            options={allLocations.map(l => ({
              value: l.id,
              label: `[${l.code}] ${l.zone || ''}`,
            }))}
          />
        </Space>
      </Modal>

      {/* Модалка пересчёта */}
      <Modal
        title="Пересчёт места"
        open={recountModal}
        onOk={handleRecount}
        onCancel={() => setRecountModal(false)}
        okText="Подтвердить пересчёт"
        cancelText="Отмена"
      >
        <Text>
          Будет подтверждено наличие всех <strong>{location.items.length}</strong> позиций в этом месте.
          Товары, отсутствующие в списке, будут отмечены как расхождение.
        </Text>
      </Modal>

      {/* Сканер */}
      <BarcodeScanner
        visible={scannerVisible}
        onScanned={handleBarcodeScanned}
        onClose={() => setScannerVisible(false)}
        title="Сканировать штрихкод"
      />
    </div>
  );
};

export default StorageLocationDetailPage;
