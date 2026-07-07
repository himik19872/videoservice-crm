import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Statistic, Modal, Form, Input, InputNumber, Select, DatePicker, Descriptions, Divider } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import BarcodeScanner from '../../components/BarcodeScanner';
import type { SupplyInvoice, Supplier, InventoryItem } from '../../types';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  draft: 'default', received: 'green', partial: 'orange', cancelled: 'red',
};

const SupplyInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<SupplyInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplyInvoice | null>(null);
  const [createForm] = Form.useForm();
  const [itemForm] = Form.useForm();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [invRes, supRes, itemsRes] = await Promise.all([
        api.get('/supply-invoices/?page_size=50'),
        api.get('/suppliers/?page_size=200'),
        api.get('/inventory/?page_size=200'),
      ]);
      setInvoices(invRes.data.results || invRes.data);
      setSuppliers(supRes.data.results || supRes.data);
      setInventoryItems(itemsRes.data.results || itemsRes.data);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const handleCreateInvoice = async (values: any) => {
    try {
      // Собираем позиции из формы (добавлены вручную или через сканер)
      const items = createForm.getFieldValue('_items') || [];
      if (items.length === 0) {
        message.warning('Добавьте хотя бы одну позицию (кнопка «Добавить позицию»)');
        return;
      }
      await api.post('/supply-invoices/', {
        supplier_id: values.supplier_id,
        invoice_number: values.invoice_number,
        invoice_date: values.invoice_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        notes: values.notes || '',
        items: items.map((i: any) => ({
          inventory_item_id: i.inventory_item_id,
          quantity_ordered: i.quantity_ordered || 1,
          quantity_received: i.quantity_received || 0,
          unit_price: i.unit_price || 0,
          notes: i.notes || '',
        })),
      });
      message.success('Накладная создана');
      setCreateModal(false);
      createForm.resetFields();
      fetchAll();
    } catch (e: any) {
      message.error(e.response?.data?.detail || e.response?.data?.error || 'Ошибка');
    }
  };

  const handleReceive = async (values: any) => {
    if (!selectedInvoice) return;
    try {
      const receiveItems = selectedInvoice.items.map((item) => ({
        inventory_item_id: item.inventory_item,
        quantity_received: values[`received_${item.id}`] ?? item.quantity_received,
      }));
      await api.post(`/supply-invoices/${selectedInvoice.id}/receive/`, { items: receiveItems });
      message.success('Товар оприходован!');
      setReceiveModal(false);
      setSelectedInvoice(null);
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      await api.post(`/supply-invoices/${selectedInvoice.id}/cancel/`);
      message.success('Накладная отменена');
      setDetailModal(false);
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    // Ищем товар по штрих-коду и добавляем в «черновик» накладной
    try {
      const res = await api.get(`/inventory/by_barcode/?code=${encodeURIComponent(barcode)}`);
      const item = res.data;
      message.success(`Найдено: ${item.name}`);

      // Добавляем позицию в форму накладной
      const existingItems: any[] = createForm.getFieldValue('_items') || [];
      const existing = existingItems.find((i: any) => i.inventory_item_id === item.id);
      if (existing) {
        existing.quantity_ordered += 1;
        createForm.setFieldValue('_items', [...existingItems]);
      } else {
        createForm.setFieldValue('_items', [...existingItems, {
          inventory_item_id: item.id,
          quantity_ordered: 1,
          quantity_received: 0,
          unit_price: item.cost_price || 0,
          notes: '',
          _name: item.name,
          _barcode: item.barcode,
        }]);
      }
      setScannerVisible(false);
    } catch (e: any) {
      message.error(`Товар со штрих-кодом «${barcode}» не найден в каталоге. Сначала создайте позицию на складе.`);
    }
  };

  const columns = [
    { title: 'Накладная №', dataIndex: 'invoice_number', key: 'number', width: 140 },
    { title: 'Поставщик', dataIndex: 'supplier_name', key: 'supplier', width: 200 },
    { title: 'Дата', dataIndex: 'invoice_date', key: 'date', width: 110 },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 140,
      render: (_: any, r: SupplyInvoice) => <Tag color={statusColors[r.status]}>{r.status_display}</Tag>
    },
    { title: 'Заказано', dataIndex: 'total_ordered', key: 'ord', width: 100, render: (v: number) => `${v} ₽` },
    { title: 'Принято', dataIndex: 'total_received', key: 'rec', width: 100, render: (v: number) => `${v} ₽` },
    { title: 'Позиций', key: 'items', width: 70, render: (_: any, r: SupplyInvoice) => r.items?.length || 0 },
    {
      title: '', key: 'actions', width: 240, render: (_: any, r: SupplyInvoice) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedInvoice(r); setDetailModal(true); }}>Детали</Button>
          {r.status === 'draft' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => { setSelectedInvoice(r); setReceiveModal(true); }}>Принять</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>📋 Накладные поставщиков</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Всего накладных" value={invoices.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Принято" value={invoices.filter(i => i.status === 'received').length} valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Частично" value={invoices.filter(i => i.status === 'partial').length} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Черновики" value={invoices.filter(i => i.status === 'draft').length} /></Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); createForm.setFieldValue('_items', []); setCreateModal(true); }}>
          Создать накладную
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Обновить</Button>
      </Space>

      <Table columns={columns} dataSource={invoices} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />

      {/* Модалка создания накладной */}
      <Modal title="Новая накладная" open={createModal} onCancel={() => setCreateModal(false)} width={750} footer={null}>
        <Form form={createForm} layout="vertical" onFinish={handleCreateInvoice}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Поставщик" rules={[{ required: true }]}>
                <Select options={suppliers.map(s => ({ value: s.id, label: s.name }))} placeholder="Выберите поставщика" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoice_number" label="Номер накладной" rules={[{ required: true }]}>
                <Input placeholder="№ от поставщика" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="invoice_date" label="Дата накладной" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12} style={{ marginTop: 30 }}>
              <Button icon={<ReloadOutlined />} onClick={() => setScannerVisible(true)}>Сканер</Button>
            </Col>
          </Row>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>

          {/* Быстрое добавление позиции из каталога */}
          <Card size="small" title="➕ Добавить позицию вручную" style={{ marginBottom: 12 }}>
            <Form form={itemForm} layout="inline" style={{ flexWrap: 'wrap', gap: 8 }}>
              <Form.Item name="_pick_item" style={{ minWidth: 250 }}>
                <Select
                  showSearch
                  placeholder="Выберите товар из каталога"
                  optionFilterProp="label"
                  filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                  options={inventoryItems.map(i => ({
                    value: i.id,
                    label: `${i.name}${i.barcode ? ` [${i.barcode}]` : ''}${i.model_name ? ` (${i.model_name})` : ''} — ${i.sale_price ? i.sale_price + ' ₽' : ''}`,
                    _name: i.name,
                    _barcode: i.barcode || '',
                    _price: i.cost_price || 0,
                  }))}
                />
              </Form.Item>
              <Form.Item name="_pick_qty" initialValue={1}><InputNumber min={1} placeholder="Кол-во" style={{ width: 80 }} /></Form.Item>
              <Form.Item name="_pick_price"><InputNumber min={0} placeholder="Цена" style={{ width: 100 }} /></Form.Item>
              <Button type="primary" onClick={() => {
                const sel = itemForm.getFieldValue('_pick_item');
                if (!sel) { message.warning('Выберите товар'); return; }
                const opt = inventoryItems.find(i => i.id === sel);
                if (!opt) return;
                const name = opt.name;
                const barcode = opt.barcode || '';
                const price = itemForm.getFieldValue('_pick_price') || opt.cost_price || 0;
                const qty = itemForm.getFieldValue('_pick_qty') || 1;

                const existing = createForm.getFieldValue('_items') || [];
                const idx = existing.findIndex((i: any) => i.inventory_item_id === opt.id);
                if (idx >= 0) {
                  existing[idx].quantity_ordered += qty;
                  if (!existing[idx].unit_price) existing[idx].unit_price = price;
                } else {
                  existing.push({
                    inventory_item_id: opt.id,
                    quantity_ordered: qty,
                    quantity_received: 0,
                    unit_price: price,
                    notes: '',
                    _name: name,
                    _barcode: barcode,
                  });
                }
                createForm.setFieldValue('_items', [...existing]);
                itemForm.resetFields(['_pick_item', '_pick_qty', '_pick_price']);
                itemForm.setFieldValue('_pick_qty', 1);
              }}>
                Добавить позицию
              </Button>
            </Form>
          </Card>

          {/* Список позиций */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev._items !== cur._items}>
            {({ getFieldValue }) => {
              const items = getFieldValue('_items') || [];
              return items.length > 0 ? (
                <Card title={`Позиции (${items.length})`} size="small" style={{ marginBottom: 16 }}>
                  {items.map((item: any, idx: number) => (
                    <Row key={idx} gutter={8} style={{ marginBottom: 8 }} align="middle">
                      <Col span={10}><Text strong>{item._name}</Text></Col>
                      <Col span={3}>
                        <InputNumber size="small" min={1} value={item.quantity_ordered}
                          onChange={v => { item.quantity_ordered = v || 1; createForm.setFieldValue('_items', [...items]); }}
                          style={{ width: '100%' }} placeholder="Кол-во" />
                      </Col>
                      <Col span={3}>
                        <InputNumber size="small" min={0} value={item.unit_price}
                          onChange={v => { item.unit_price = v || 0; createForm.setFieldValue('_items', [...items]); }}
                          style={{ width: '100%' }} placeholder="Цена" />
                      </Col>
                      <Col span={3}>
                        <InputNumber size="small" min={0} value={item.quantity_received}
                          onChange={v => { item.quantity_received = v || 0; createForm.setFieldValue('_items', [...items]); }}
                          style={{ width: '100%' }} placeholder="Принято" />
                      </Col>
                      <Col span={3}>
                        {item._barcode ? <Tag color="geekblue" style={{ fontSize: 11 }}>{item._barcode}</Tag> : <Tag>—</Tag>}
                      </Col>
                      <Col span={2}>
                        <Button size="small" danger onClick={() => { items.splice(idx, 1); createForm.setFieldValue('_items', [...items]); }}>✕</Button>
                      </Col>
                    </Row>
                  ))}
                </Card>
              ) : (
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Text type="secondary">Добавьте позиции: выберите товар из выпадающего списка выше или используйте сканер штрих-кода</Text>
                </Card>
              );
            }}
          </Form.Item>

          <Button type="primary" htmlType="submit" block>Создать накладную</Button>
        </Form>
      </Modal>

      {/* Модалка приёмки товара */}
      <Modal title={`Приёмка: ${selectedInvoice?.invoice_number || ''}`} open={receiveModal} onCancel={() => setReceiveModal(false)} width={700} footer={null}>
        <Form layout="vertical" onFinish={handleReceive}>
          <Text type="secondary">Укажите фактически принятое количество по каждой позиции</Text>
          <Divider />
          {selectedInvoice?.items?.map(item => (
            <Row key={item.id} gutter={12} style={{ marginBottom: 12 }} align="middle">
              <Col span={10}>
                <Text strong>{item.item_name}</Text>
                <br /><Text type="secondary">Заказано: {item.quantity_ordered} шт.</Text>
              </Col>
              <Col span={6}>
                <Form.Item name={`received_${item.id}`} label="Принято" initialValue={item.quantity_received || item.quantity_ordered} style={{ marginBottom: 0 }}>
                  <InputNumber min={0} max={item.quantity_ordered} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}><Text type="secondary">{item.unit_price} ₽/шт.</Text></Col>
              <Col span={4}>
                {item.quantity_received < item.quantity_ordered && item.quantity_received > 0 && (
                  <Tag color="orange">Недопоставка: {item.shortage}</Tag>
                )}
              </Col>
            </Row>
          ))}
          <Divider />
          <Button type="primary" htmlType="submit" block icon={<CheckOutlined />}>Оприходовать товар</Button>
        </Form>
      </Modal>

      {/* Модалка просмотра деталей */}
      <Modal title={`Накладная №${selectedInvoice?.invoice_number || ''}`} open={detailModal} onCancel={() => setDetailModal(false)} width={700} footer={null}>
        {selectedInvoice && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Поставщик">{selectedInvoice.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="Статус"><Tag color={statusColors[selectedInvoice.status]}>{selectedInvoice.status_display}</Tag></Descriptions.Item>
              <Descriptions.Item label="Дата">{selectedInvoice.invoice_date}</Descriptions.Item>
              <Descriptions.Item label="Принял">{selectedInvoice.received_by_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Заказано на">{selectedInvoice.total_ordered} ₽</Descriptions.Item>
              <Descriptions.Item label="Принято на">{selectedInvoice.total_received} ₽</Descriptions.Item>
            </Descriptions>
            <Table
              dataSource={selectedInvoice.items}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Товар', dataIndex: 'item_name', width: 250 },
                { title: 'Штрих-код', dataIndex: 'item_barcode', width: 110, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '—' },
                { title: 'Заказано', dataIndex: 'quantity_ordered', width: 80 },
                { title: 'Принято', dataIndex: 'quantity_received', width: 80,
                  render: (v: number, r: any) => (
                    <Text style={{ color: v < r.quantity_ordered ? '#fa8c16' : '#3f8600' }}>{v}</Text>
                  )
                },
                { title: 'Недопоставка', dataIndex: 'shortage', width: 100, render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : '—' },
                { title: 'Цена', dataIndex: 'unit_price', width: 80, render: (v: number) => `${v} ₽` },
                { title: 'Сумма', dataIndex: 'received_total', width: 80, render: (v: number) => `${v} ₽` },
              ]}
            />
            {selectedInvoice.status === 'draft' && (
              <Space style={{ marginTop: 16 }}>
                <Button danger icon={<CloseOutlined />} onClick={handleCancelInvoice}>Отменить накладную</Button>
              </Space>
            )}
          </>
        )}
      </Modal>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
        title="Сканировать товар для накладной"
      />
    </div>
  );
};

export default SupplyInvoicesPage;
