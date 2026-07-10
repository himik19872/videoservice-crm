import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Modal, InputNumber, Select, Statistic, Form, Input } from 'antd';
import { PlusOutlined, ReloadOutlined, ExportOutlined, BarcodeOutlined, ShopOutlined, FileTextOutlined, SendOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import BarcodeScanner from '../../components/BarcodeScanner';
import type { InventoryItem, InventoryMovement } from '../../types';

const { Title } = Typography;

const ITEM_TYPES = [
  { value: 'intercom', label: 'Домофон' }, { value: 'video_intercom', label: 'Видеодомофон' },
  { value: 'camera', label: 'Камера' }, { value: 'call_panel', label: 'Вызывная панель' },
  { value: 'door_lock', label: 'Дверной замок' }, { value: 'monitor', label: 'Монитор' },
  { value: 'power_supply', label: 'Блок питания' }, { value: 'cable', label: 'Кабель' },
  { value: 'mounting_kit', label: 'Монтажный комплект' }, { value: 'other', label: 'Другое' },
];

const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>({});
  const [issueModal, setIssueModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [tab, setTab] = useState<'items' | 'movements'>('items');
  const [createForm] = Form.useForm();
  const navigate = useNavigate();

  const statusColors: Record<string, string> = {
    in_stock: 'green', with_master: 'blue', installed: 'purple',
    returned: 'orange', defective: 'red', written_off: 'default',
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes, movRes] = await Promise.all([
        api.get('/inventory/?page_size=200'),
        api.get('/inventory/summary/'),
        api.get('/inventory-movements/?page_size=100'),
      ]);
      setItems(itemsRes.data.results || itemsRes.data);
      setSummary(summaryRes.data);
      setMovements(movRes.data.results || movRes.data);
    } catch (e) { message.error('Ошибка загрузки склада'); }
    finally { setLoading(false); }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const res = await api.get(`/inventory/by_barcode/?code=${encodeURIComponent(barcode)}`);
      const item = res.data;
      message.success(`Найдено: ${item.name} (${item.quantity} шт.)`);
      setSelectedItem(item);
    } catch (e: any) {
      message.error(`Штрих-код «${barcode}» не найден на складе`);
    }
  };

  const generateBarcode = async (item: InventoryItem) => {
    try {
      const res = await api.post(`/inventory/${item.id}/generate_barcode/`);
      message.success(`Штрихкод: ${res.data.barcode}`);
      fetchAll();
    } catch (e: any) { message.error('Ошибка генерации штрихкода'); }
  };

  const handleAddStock = async (qty: number) => {
    if (!selectedItem) return;
    try {
      await api.post(`/inventory/${selectedItem.id}/add_stock/`, { quantity: qty });
      message.success(`Приход: +${qty} шт.`);
      setAddModal(false);
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const handleCreateItem = async (values: any) => {
    try {
      await api.post('/inventory/', values);
      message.success('Позиция создана');
      setCreateModal(false);
      createForm.resetFields();
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const handleIssue = async (masterId: number, qty: number) => {
    if (!selectedItem) return;
    try {
      await api.post(`/inventory/${selectedItem.id}/issue_to_master/`, { master_id: masterId, quantity: qty, notes: 'Выдано со склада' });
      message.success(`Выдано мастеру: ${qty} шт.`);
      setIssueModal(false);
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', width: 250 },
    { title: 'Штрих-код', dataIndex: 'barcode', key: 'barcode', width: 130, render: (v: string | null) => v ? <Tag color="geekblue">{v}</Tag> : <Tag color="default">—</Tag> },
    { title: 'Тип', dataIndex: 'item_type_display', key: 'type', width: 130 },
    { title: 'S/N', dataIndex: 'serial_number', key: 'sn', width: 140 },
    { title: 'Модель', dataIndex: 'model_name', key: 'model', width: 120 },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 70 },
    { title: 'Цена', key: 'price', width: 100, render: (_: any, r: InventoryItem) => r.sale_price ? `${r.sale_price} ₽` : '—' },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 110, render: (_: any, r: InventoryItem) => <Tag color={statusColors[r.status]}>{r.status_display}</Tag>
    },
    {
      title: 'Действия', key: 'actions', width: 240, render: (_: any, r: InventoryItem) => (
        <Space size="small" wrap>
          <Button size="small" icon={<PlusOutlined />} onClick={() => { setSelectedItem(r); setAddModal(true); }}>Приход</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => { setSelectedItem(r); setIssueModal(true); }}>Выдать</Button>
          <Button size="small" icon={<BarcodeOutlined />} onClick={() => generateBarcode(r)} title="Сгенерировать штрихкод">SKU</Button>
        </Space>
      ),
    },
  ];

  const movColumns = [
    { title: 'Дата', dataIndex: 'created_at', key: 'date', width: 160, render: (v: string) => new Date(v).toLocaleString('ru') },
    { title: 'Тип', dataIndex: 'movement_type_display', key: 'type', width: 130 },
    { title: 'Оборудование', dataIndex: 'item_name', key: 'item', width: 280, ellipsis: true },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 60 },
    { title: 'Мастер', dataIndex: 'master_name', key: 'master', width: 130 },
    { title: 'Накладная', key: 'invoice', width: 120, render: (_: any, r: InventoryMovement) =>
      r.supply_invoice_info ? <Tag color="blue">{r.supply_invoice_info.invoice_number}</Tag> : '—'
    },
    { title: 'Кто выдал', dataIndex: 'performed_by_name', key: 'by', width: 130 },
  ];

  return (
    <div>
      <Title level={3}>📦 Склад</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="Всего позиций" value={summary.total_items || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="На складе" value={summary.in_stock || 0} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="У мастеров" value={summary.with_masters || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="Стоимость" value={summary.total_value || 0} suffix="₽" /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button type={tab === 'items' ? 'primary' : 'default'} onClick={() => setTab('items')}>Оборудование</Button>
        <Button type={tab === 'movements' ? 'primary' : 'default'} onClick={() => setTab('movements')}>Движения</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateModal(true); }}>Новая позиция</Button>
        <Button icon={<BarcodeOutlined />} onClick={() => setScannerVisible(true)}>Сканер</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Обновить</Button>
        <Button icon={<ShopOutlined />} onClick={() => navigate('/suppliers')}>Поставщики</Button>
        <Button icon={<FileTextOutlined />} onClick={() => navigate('/supply-invoices')}>Накладные</Button>
        <Button icon={<SendOutlined />} onClick={() => navigate('/issue-orders')}>Расходные ордера</Button>
        <Button icon={<ShoppingCartOutlined />} onClick={() => navigate('/purchase-requests')}>Заявки на закупку</Button>
      </Space>

      {tab === 'items' ? (
        <Table columns={columns} dataSource={items} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />
      ) : (
        <Table columns={movColumns} dataSource={movements} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />
      )}

      <Modal title="Приход на склад" open={addModal} onCancel={() => setAddModal(false)} footer={null}>
        <StockForm item={selectedItem} onSubmit={handleAddStock} mode="add" />
      </Modal>

      <Modal title="Выдать мастеру" open={issueModal} onCancel={() => setIssueModal(false)} footer={null}>
        <IssueForm item={selectedItem} onSubmit={handleIssue} />
      </Modal>

      <Modal title="Новая позиция на складе" open={createModal} onCancel={() => setCreateModal(false)} footer={null}>
        <Form form={createForm} layout="vertical" onFinish={handleCreateItem}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="item_type" label="Тип" rules={[{ required: true }]}>
            <Select options={ITEM_TYPES} />
          </Form.Item>
          <Form.Item name="barcode" label="Штрих-код (SKU)" help="Оставьте пустым — сгенерируется автоматически">
            <Input placeholder="или авто" prefix={<BarcodeOutlined />} />
          </Form.Item>
          <Form.Item name="serial_number" label="Серийный номер"><Input /></Form.Item>
          <Form.Item name="model_name" label="Модель"><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="quantity" label="Кол-во" initialValue={1}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="cost_price" label="Закупка (₽)" help="Продажа: +25% авто"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="sale_price" label="Продажа (₽)" help="Авто если пусто"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="supplier" label="Поставщик"><Input placeholder="Название поставщика" /></Form.Item>
          <Form.Item name="location" label="Место хранения"><Input placeholder="Склад А, полка 3" /></Form.Item>
          <Form.Item name="warranty_months" label="Гарантия (мес.)" initialValue={12}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Button type="primary" htmlType="submit" block>Создать</Button>
        </Form>
      </Modal>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
      />
    </div>
  );
};

const StockForm: React.FC<{ item: InventoryItem | null; onSubmit: (qty: number) => void; mode: string }> = ({ item, onSubmit }) => {
  const [qty, setQty] = useState(1);
  if (!item) return null;
  return (
    <div>
      <p><b>{item.name}</b> (сейчас: {item.quantity} шт.)</p>
      <InputNumber min={1} value={qty} onChange={v => setQty(v || 1)} style={{ width: '100%' }} placeholder="Количество" />
      <Button type="primary" style={{ marginTop: 16 }} block onClick={() => onSubmit(qty)}>Добавить</Button>
    </div>
  );
};

const IssueForm: React.FC<{ item: InventoryItem | null; onSubmit: (masterId: number, qty: number) => void }> = ({ item, onSubmit }) => {
  const [qty, setQty] = useState(1);
  const [masterId, setMasterId] = useState<number | null>(null);
  const [masters, setMasters] = useState<any[]>([]);
  useEffect(() => { api.get('/masters/').then(r => setMasters(r.data.results || r.data)).catch(() => {}); }, []);
  if (!item) return null;
  return (
    <div>
      <p><b>{item.name}</b> (доступно: {item.quantity} шт.)</p>
      <Select style={{ width: '100%' }} placeholder="Выберите мастера" value={masterId} onChange={setMasterId}
        options={masters.map((m: any) => ({ value: m.id, label: `${m.full_name || m.user?.username} (${m.region?.name || '—'})` }))}
      />
      <InputNumber min={1} max={item.quantity} value={qty} onChange={v => setQty(v || 1)} style={{ width: '100%', marginTop: 12 }} placeholder="Количество" />
      <Button type="primary" style={{ marginTop: 16 }} block disabled={!masterId} onClick={() => masterId && onSubmit(masterId, qty)}>Выдать</Button>
    </div>
  );
};

export default InventoryPage;
