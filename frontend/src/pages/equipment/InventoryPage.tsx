import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Modal, InputNumber, Select, Statistic } from 'antd';
import { PlusOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { InventoryItem, InventoryMovement } from '../../types';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  in_stock: 'green',
  with_master: 'blue',
  installed: 'purple',
  returned: 'orange',
  defective: 'red',
  written_off: 'default',
};

const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>({});
  const [issueModal, setIssueModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [tab, setTab] = useState<'items' | 'movements'>('items');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes, movRes] = await Promise.all([
        api.get('/inventory/'),
        api.get('/inventory/summary/'),
        api.get('/inventory-movements/'),
      ]);
      setItems(itemsRes.data.results || itemsRes.data);
      setSummary(summaryRes.data);
      setMovements(movRes.data.results || movRes.data);
    } catch (e) { message.error('Ошибка загрузки склада'); }
    finally { setLoading(false); }
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
    { title: 'Тип', dataIndex: 'item_type_display', key: 'type', width: 130 },
    { title: 'S/N', dataIndex: 'serial_number', key: 'sn', width: 140 },
    { title: 'Модель', dataIndex: 'model_name', key: 'model', width: 120 },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 70 },
    { title: 'Цена', key: 'price', width: 100, render: (_: any, r: InventoryItem) => r.sale_price ? `${r.sale_price} ₽` : '—' },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 110, render: (_: any, r: InventoryItem) => <Tag color={statusColors[r.status]}>{r.status_display}</Tag>
    },
    {
      title: 'Действия', key: 'actions', width: 200, render: (_: any, r: InventoryItem) => (
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => { setSelectedItem(r); setAddModal(true); }}>Приход</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => { setSelectedItem(r); setIssueModal(true); }}>Выдать</Button>
        </Space>
      ),
    },
  ];

  const movColumns = [
    { title: 'Дата', dataIndex: 'created_at', key: 'date', width: 160, render: (v: string) => new Date(v).toLocaleString('ru') },
    { title: 'Тип', dataIndex: 'movement_type_display', key: 'type', width: 130 },
    { title: 'Оборудование', dataIndex: 'item_name', key: 'item', width: 300, ellipsis: true },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 60 },
    { title: 'Мастер', dataIndex: 'master_name', key: 'master', width: 130 },
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

      <Space style={{ marginBottom: 16 }}>
        <Button type={tab === 'items' ? 'primary' : 'default'} onClick={() => setTab('items')}>Оборудование</Button>
        <Button type={tab === 'movements' ? 'primary' : 'default'} onClick={() => setTab('movements')}>Движения</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Обновить</Button>
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
