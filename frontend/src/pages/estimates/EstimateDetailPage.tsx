import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, Modal, Input, Select, InputNumber, Space, Popconfirm, Tag, message, Row, Col, Statistic, Divider, Spin, Descriptions } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined, EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../services/api';

const ITEM_TYPES = [
  { value: 'material', label: '📦 Со склада' },
  { value: 'service', label: '🔧 Услуга (справочник)' },
  { value: 'custom_material', label: '✏️ Произвольный материал' },
  { value: 'custom_service', label: '✏️ Произвольная услуга/работа' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Черновик' },
  sent: { color: 'blue', label: 'Отправлено' },
  approved: { color: 'green', label: 'Согласовано' },
  rejected: { color: 'red', label: 'Отклонено' },
  in_work: { color: 'orange', label: 'В работе' },
  completed: { color: 'green', label: 'Завершено' },
};

const EstimateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Модалка редактирования параметров сметы
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});

  // Модалка добавления позиции
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({
    item_type: 'material', inventory_item_id: undefined as number | undefined,
    service_id: undefined as number | undefined,
    name: '', unit: 'шт', quantity: 1, cost_price: 0, sale_price: 0, discount: 0,
  });

  const fetchEstimate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/estimates/${id}/`);
      setEstimate(res.data);
      setSettingsForm({
        discount: res.data.discount, commission: res.data.commission,
        dealer_fee: res.data.dealer_fee, unexpected_costs: res.data.unexpected_costs,
        delivery_type: res.data.delivery_type, delivery_cost: res.data.delivery_cost,
        tax_type: res.data.tax_type, tax_rate: res.data.tax_rate,
        status: res.data.status,
      });
    } catch (e) { message.error('Смета не найдена'); navigate('/estimates'); }
    finally { setLoading(false); }
  };

  const fetchRefs = async () => {
    try {
      const [iRes, sRes] = await Promise.all([
        api.get('/inventory/?page_size=500&status=in_stock'),
        api.get('/estimate-services/?page_size=200'),
      ]);
      setInventory(iRes.data.results || iRes.data || []);
      setServices(sRes.data.results || sRes.data || []);
    } catch (e) {}
  };

  useEffect(() => { fetchEstimate(); fetchRefs(); }, [id]);

  // Добавление позиции
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({
      item_type: 'material', inventory_item_id: undefined, service_id: undefined,
      name: '', unit: 'шт', quantity: 1, cost_price: 0, sale_price: 0, discount: 0,
    });
    setItemModalOpen(true);
  };

  const openEditItem = (record: any) => {
    setEditingItem(record);
    setItemForm({
      item_type: record.item_type,
      inventory_item_id: record.inventory_item || undefined,
      service_id: record.service || undefined,
      name: record.name, unit: record.unit,
      quantity: record.quantity, cost_price: record.cost_price,
      sale_price: record.sale_price, discount: record.discount,
    });
    setItemModalOpen(true);
  };

  const handleItemTypeChange = (v: string) => {
    setItemForm({ ...itemForm, item_type: v, inventory_item_id: undefined, service_id: undefined, name: '', unit: 'шт', cost_price: 0, sale_price: 0 });
    if (v === 'material') setItemForm(prev => ({ ...prev, item_type: v }));
    if (v === 'service') setItemForm(prev => ({ ...prev, item_type: v }));
  };

  const handleInventorySelect = (invId: number | undefined) => {
    if (!invId) return;
    const inv = inventory.find((i: any) => i.id === invId);
    if (inv) {
      setItemForm(prev => ({
        ...prev, inventory_item_id: invId,
        name: inv.name, unit: inv.unit || 'шт',
        cost_price: Number(inv.cost_price || 0), sale_price: Number(inv.sale_price || 0),
      }));
    }
  };

  const handleServiceSelect = (svcId: number | undefined) => {
    if (!svcId) return;
    const svc = services.find((s: any) => s.id === svcId);
    if (svc) {
      setItemForm(prev => ({
        ...prev, service_id: svcId, name: svc.name, unit: svc.unit || 'шт',
        cost_price: Number(svc.cost_price || 0), sale_price: Number(svc.sale_price || 0),
      }));
    }
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) { message.error('Введите название позиции'); return; }
    try {
      if (editingItem) {
        await api.post(`/estimates/${id}/update_item/`, {
          item_id: editingItem.id,
          name: itemForm.name, unit: itemForm.unit,
          quantity: itemForm.quantity, cost_price: itemForm.cost_price,
          sale_price: itemForm.sale_price, discount: itemForm.discount,
        });
        message.success('Позиция обновлена');
      } else {
        await api.post(`/estimates/${id}/add_item/`, {
          item_type: itemForm.item_type,
          inventory_item_id: itemForm.inventory_item_id,
          service_id: itemForm.service_id,
          name: itemForm.name, unit: itemForm.unit,
          quantity: itemForm.quantity, cost_price: itemForm.cost_price,
          sale_price: itemForm.sale_price, discount: itemForm.discount,
        });
        message.success('Позиция добавлена');
      }
      setItemModalOpen(false);
      fetchEstimate();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      await api.post(`/estimates/${id}/remove_item/`, { item_id: itemId });
      message.success('Позиция удалена');
      fetchEstimate();
    } catch (e) { message.error('Ошибка удаления'); }
  };

  const updateSettings = async () => {
    try {
      await api.patch(`/estimates/${id}/`, settingsForm);
      message.success('Обновлено');
      setSettingsOpen(false);
      fetchEstimate();
    } catch (e: any) { message.error('Ошибка'); }
  };

  const recalc = async () => {
    try {
      await api.post(`/estimates/${id}/recalc/`);
      message.success('Пересчитано');
      fetchEstimate();
    } catch (e) { message.error('Ошибка пересчёта'); }
  };

  const handlePrintPdf = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/estimates/${id}/pdf/`, {
        headers: { 'Authorization': `Token ${token}` },
      });
      if (!response.ok) throw new Error('Ошибка загрузки');
      const html = await response.text();
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch (e) {
      message.error('Ошибка генерации печатной формы');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!estimate) return null;

  const itemColumns = [
    { title: '#', key: 'idx', width: 40, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Наименование', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Тип', dataIndex: 'item_type_display', key: 'type', width: 130 },
    { title: 'Ед.', dataIndex: 'unit', key: 'unit', width: 50 },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 80, render: (v: any) => Number(v).toFixed(1) },
    { title: 'Себест.', dataIndex: 'cost_price', key: 'cost', width: 100, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Цена', dataIndex: 'sale_price', key: 'price', width: 100, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Скидка', dataIndex: 'discount', key: 'disc', width: 70, render: (v: any) => v ? `${v}%` : '—' },
    { title: 'Сумма', dataIndex: 'total_price', key: 'total', width: 110, render: (v: any) => <strong>{Number(v).toLocaleString()} ₽</strong> },
    {
      title: '', key: 'actions', width: 80,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(record)} />
          <Popconfirm title="Удалить позицию?" onConfirm={() => removeItem(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/estimates')}>Назад</Button>
          <h2 style={{ margin: 0 }}>📊 {estimate.number} — {estimate.name}</h2>
          <Tag color={STATUS_MAP[estimate.status]?.color}>{STATUS_MAP[estimate.status]?.label}</Tag>
        </Space>
        <Space>
          <Button onClick={() => setSettingsOpen(true)}>⚙️ Параметры</Button>
          <Button onClick={handlePrintPdf}>🖨️ Печать PDF</Button>
          <Button icon={<CalculatorOutlined />} onClick={recalc}>🔄 Пересчитать</Button>
        </Space>
      </div>

      {/* Клиент и юрлицо */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}><strong>Клиент:</strong> {estimate.client_name || '—'}</Col>
          <Col span={8}><strong>Наше юрлицо:</strong> {estimate.legal_entity_name || '—'}</Col>
          <Col span={8}><strong>Заявка:</strong> {estimate.order ? `#${estimate.order}` : '—'}</Col>
        </Row>
      </Card>

      {/* Позиции сметы */}
      <Card title="📋 Позиции сметы"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>Добавить позицию</Button>}
        style={{ marginBottom: 16 }}>
        <Table dataSource={estimate.items || []} columns={itemColumns} rowKey="id" size="middle"
          pagination={false} locale={{ emptyText: 'Смета пуста. Добавьте позиции выше.' }} />
      </Card>

      {/* Итоги */}
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="💰 Итоги">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Материалы">{Number(estimate.total_materials).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Услуги">{Number(estimate.total_services).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Подытог"><strong>{Number(estimate.subtotal).toLocaleString()} ₽</strong></Descriptions.Item>
              {estimate.discount > 0 && <Descriptions.Item label="Скидка">-{estimate.discount}%</Descriptions.Item>}
              {estimate.commission > 0 && <Descriptions.Item label="Комиссионные">+{estimate.commission}%</Descriptions.Item>}
              {estimate.dealer_fee > 0 && <Descriptions.Item label="Дилерская наценка">+{estimate.dealer_fee}%</Descriptions.Item>}
              {estimate.unexpected_costs > 0 && <Descriptions.Item label="Непредв. расходы">{Number(estimate.unexpected_costs).toLocaleString()} ₽</Descriptions.Item>}
              {estimate.delivery_cost > 0 && <Descriptions.Item label="Доставка">{Number(estimate.delivery_cost).toLocaleString()} ₽</Descriptions.Item>}
              <Descriptions.Item label={<strong>ИТОГО</strong>}><strong style={{ fontSize: 18, color: '#1677ff' }}>{Number(estimate.total).toLocaleString()} ₽</strong></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="📈 Маржинальность">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Себестоимость">{Number(estimate.total_cost).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Выручка">{Number(estimate.total).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label={<strong>Прибыль</strong>}>
                <strong style={{ fontSize: 18, color: Number(estimate.profit) > 0 ? '#52c41a' : '#ff4d4f' }}>
                  {Number(estimate.profit).toLocaleString()} ₽
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Рентабельность">
                {estimate.total > 0 ? ((Number(estimate.profit) / Number(estimate.total)) * 100).toFixed(1) : 0}%
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Модалка: параметры сметы */}
      <Modal title="⚙️ Параметры сметы" open={settingsOpen} onOk={updateSettings} onCancel={() => setSettingsOpen(false)} width={450}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Row gutter={12}>
            <Col span={12}><label>Скидка (%)</label><InputNumber value={settingsForm.discount} onChange={v => setSettingsForm({ ...settingsForm, discount: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={12}><label>Комиссионные (%)</label><InputNumber value={settingsForm.commission} onChange={v => setSettingsForm({ ...settingsForm, commission: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><label>Дилер. наценка (%)</label><InputNumber value={settingsForm.dealer_fee} onChange={v => setSettingsForm({ ...settingsForm, dealer_fee: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={12}><label>Непредв. расходы (₽)</label><InputNumber value={settingsForm.unexpected_costs} onChange={v => setSettingsForm({ ...settingsForm, unexpected_costs: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><label>Доставка (₽)</label><InputNumber value={settingsForm.delivery_cost} onChange={v => setSettingsForm({ ...settingsForm, delivery_cost: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={12}><label>Статус</label><Select value={settingsForm.status} onChange={v => setSettingsForm({ ...settingsForm, status: v })} style={{ width: '100%' }}
              options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} /></Col>
          </Row>
        </Space>
      </Modal>

      {/* Модалка: добавление/редактирование позиции */}
      <Modal title={editingItem ? 'Редактировать позицию' : 'Добавить позицию'} open={itemModalOpen}
        onOk={saveItem} onCancel={() => setItemModalOpen(false)} width={550} okText="Сохранить" cancelText="Отмена">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <label>Тип позиции</label>
            <Select value={itemForm.item_type} onChange={handleItemTypeChange} style={{ width: '100%' }} options={ITEM_TYPES} />
          </div>

          {itemForm.item_type === 'material' && (
            <div>
              <label>Выберите со склада</label>
              <Select allowClear showSearch placeholder="Поиск по названию..." value={itemForm.inventory_item_id}
                onChange={handleInventorySelect} style={{ width: '100%' }}
                options={inventory.map((inv: any) => ({ value: inv.id, label: `📦 ${inv.name} — ${Number(inv.sale_price || 0).toLocaleString()} ₽/${inv.unit || 'шт'} (на складе: ${inv.quantity})` }))}
                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())} />
            </div>
          )}

          {itemForm.item_type === 'service' && (
            <div>
              <label>Выберите услугу</label>
              <Select allowClear showSearch placeholder="Поиск услуги..." value={itemForm.service_id}
                onChange={handleServiceSelect} style={{ width: '100%' }}
                options={services.map((s: any) => ({ value: s.id, label: `🔧 ${s.name} — ${Number(s.sale_price).toLocaleString()} ₽/${s.unit}` }))}
                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())} />
            </div>
          )}

          <div>
            <label>Наименование *</label>
            <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
          </div>

          <Row gutter={12}>
            <Col span={6}><label>Кол-во</label><InputNumber value={itemForm.quantity} onChange={v => setItemForm({ ...itemForm, quantity: v || 1 })} min={0.01} step={0.5} style={{ width: '100%' }} /></Col>
            <Col span={6}><label>Ед.</label><Input value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} /></Col>
            <Col span={6}><label>Себест. (₽)</label><InputNumber value={itemForm.cost_price} onChange={v => setItemForm({ ...itemForm, cost_price: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={6}><label>Цена (₽)</label><InputNumber value={itemForm.sale_price} onChange={v => setItemForm({ ...itemForm, sale_price: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
          </Row>

          <div>
            <label>Скидка на позицию (%)</label>
            <InputNumber value={itemForm.discount} onChange={v => setItemForm({ ...itemForm, discount: v || 0 })} min={0} max={100} style={{ width: 120 }} />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default EstimateDetailPage;
