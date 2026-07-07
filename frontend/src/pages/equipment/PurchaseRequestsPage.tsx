import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Statistic, Modal, Form, Input, InputNumber, Select, Descriptions } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, EyeOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { PurchaseRequest, InventoryItem, Supplier } from '../../types';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  draft: 'default', pending: 'orange', ordered: 'blue', received: 'green', cancelled: 'red',
};

const PurchaseRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState<PurchaseRequest | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [reqRes, itemsRes, supRes] = await Promise.all([
        api.get('/purchase-requests/?page_size=100'),
        api.get('/inventory/?page_size=200'),
        api.get('/suppliers/?page_size=100'),
      ]);
      setRequests(reqRes.data.results || reqRes.data);
      setInventoryItems(itemsRes.data.results || itemsRes.data);
      setSuppliers(supRes.data.results || supRes.data);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (values: any) => {
    const items = form.getFieldValue('_items') || [];
    if (items.length === 0) { message.warning('Добавьте хотя бы одну позицию'); return; }
    try {
      await api.post('/purchase-requests/', {
        notes: values.notes || '',
        items: items.map((i: any) => ({
          inventory_item_id: i.inventory_item_id || undefined,
          name: i.name || 'Товар',
          quantity: i.quantity || 1,
          unit: i.unit || 'шт.',
          estimated_price: i.estimated_price || undefined,
          supplier_id: i.supplier_id || undefined,
          notes: i.notes || '',
        })),
      });
      message.success('Заявка создана');
      setCreateModal(false);
      form.resetFields();
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const columns = [
    { title: 'Заявка №', dataIndex: 'number', key: 'number', width: 160 },
    { title: 'Позиций', key: 'items', width: 70, render: (_: any, r: PurchaseRequest) => r.items?.length || 0 },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 140,
      render: (_: any, r: PurchaseRequest) => <Tag color={statusColors[r.status]}>{r.status_display}</Tag>
    },
    { title: 'Создал', dataIndex: 'created_by_name', key: 'by', width: 150 },
    { title: 'Дата', dataIndex: 'created_at', key: 'date', width: 150, render: (v: string) => new Date(v).toLocaleString('ru') },
    {
      title: '', key: 'actions', width: 180, render: (_: any, r: PurchaseRequest) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModal(true); }}>Детали</Button>
          {r.status === 'pending' && <Button size="small" type="primary" icon={<ShoppingCartOutlined />}
            onClick={async () => { await api.post(`/purchase-requests/${r.id}/mark_ordered/`); fetchAll(); }}>В закупку</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>🛒 Заявки на закупку</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="Всего" value={requests.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="Ожидает" value={requests.filter(r => r.status === 'pending').length} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="Заказано" value={requests.filter(r => r.status === 'ordered').length} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="Получено" value={requests.filter(r => r.status === 'received').length} valueStyle={{ color: '#3f8600' }} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldValue('_items', []); setCreateModal(true); }}>
          Создать заявку
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Обновить</Button>
      </Space>

      <Table columns={columns} dataSource={requests} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />

      {/* Модалка создания */}
      <Modal title="Новая заявка на закупку" open={createModal} onCancel={() => setCreateModal(false)} width={700} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {/* Быстрое добавление */}
          <Card size="small" title="➕ Добавить позицию" style={{ marginBottom: 12 }}>
            <Row gutter={8} align="middle">
              <Col span={8}>
                <Form.Item name="_pick_item" style={{ marginBottom: 0 }}>
                  <Select showSearch placeholder="Из каталога (необязательно)" allowClear optionFilterProp="label"
                    filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                    options={inventoryItems.map(i => ({ value: i.id, label: `${i.name}` }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="_pick_name" style={{ marginBottom: 0 }}>
                  <Input placeholder="Или введите название" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="_pick_qty" initialValue={1} style={{ marginBottom: 0 }}><InputNumber min={1} placeholder="Кол-во" style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col span={4}>
                <Button type="primary" onClick={() => {
                  const id = form.getFieldValue('_pick_item');
                  const name = form.getFieldValue('_pick_name') || (id ? inventoryItems.find(i => i.id === id)?.name : '') || 'Товар';
                  const qty = form.getFieldValue('_pick_qty') || 1;
                  const existing = form.getFieldValue('_items') || [];
                  existing.push({ inventory_item_id: id || undefined, name, quantity: qty, unit: 'шт.', _display: name });
                  form.setFieldValue('_items', [...existing]);
                  form.resetFields(['_pick_item', '_pick_name', '_pick_qty']);
                  form.setFieldValue('_pick_qty', 1);
                }}>Добавить</Button>
              </Col>
            </Row>
          </Card>

          <Form.Item noStyle shouldUpdate={(p, c) => p._items !== c._items}>
            {({ getFieldValue }) => {
              const items = getFieldValue('_items') || [];
              return items.length > 0 ? (
                <Card title={`Позиции (${items.length})`} size="small" style={{ marginBottom: 16 }}>
                  {items.map((item: any, idx: number) => (
                    <Row key={idx} gutter={8} style={{ marginBottom: 6 }} align="middle">
                      <Col span={10}><Text>{item._display || item.name}</Text></Col>
                      <Col span={3}><Text>× {item.quantity}</Text></Col>
                      <Col span={5}>
                        <Select size="small" placeholder="Поставщик" allowClear style={{ width: '100%' }}
                          value={item.supplier_id} onChange={v => { item.supplier_id = v; form.setFieldValue('_items', [...items]); }}
                          options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                        />
                      </Col>
                      <Col span={4}>
                        <InputNumber size="small" placeholder="Цена" style={{ width: '100%' }}
                          value={item.estimated_price} onChange={v => { item.estimated_price = v; form.setFieldValue('_items', [...items]); }}
                        />
                      </Col>
                      <Col span={2}>
                        <Button size="small" danger onClick={() => { items.splice(idx, 1); form.setFieldValue('_items', [...items]); }}>✕</Button>
                      </Col>
                    </Row>
                  ))}
                </Card>
              ) : null;
            }}
          </Form.Item>

          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} placeholder="Основание: КП №... от ..." /></Form.Item>
          <Button type="primary" htmlType="submit" block>Создать заявку на закупку</Button>
        </Form>
      </Modal>

      {/* Модалка деталей */}
      <Modal title={`Заявка №${selected?.number || ''}`} open={detailModal} onCancel={() => setDetailModal(false)} width={700} footer={null}>
        {selected && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Статус"><Tag color={statusColors[selected.status]}>{selected.status_display}</Tag></Descriptions.Item>
              <Descriptions.Item label="Создал">{selected.created_by_name}</Descriptions.Item>
              <Descriptions.Item label="Дата">{new Date(selected.created_at).toLocaleString('ru')}</Descriptions.Item>
              <Descriptions.Item label="Примечания">{selected.notes || '—'}</Descriptions.Item>
            </Descriptions>
            <Table dataSource={selected.items} rowKey="id" size="small" pagination={false}
              columns={[
                { title: 'Товар', dataIndex: 'name', width: 220 },
                { title: 'Кол-во', dataIndex: 'quantity', width: 70 },
                { title: 'Ед.', dataIndex: 'unit', width: 50 },
                { title: 'Цена', dataIndex: 'estimated_price', width: 90, render: (v: number) => v ? `${v} ₽` : '—' },
              ]}
            />
            {selected.status === 'pending' && (
              <Space style={{ marginTop: 16 }}>
                <Button type="primary" icon={<ShoppingCartOutlined />}
                  onClick={async () => { await api.post(`/purchase-requests/${selected.id}/mark_ordered/`); setDetailModal(false); fetchAll(); }}>
                  Отправить в закупку
                </Button>
              </Space>
            )}
            {selected.status === 'ordered' && (
              <Button type="primary" icon={<CheckOutlined />} style={{ marginTop: 16 }} block
                onClick={async () => { await api.post(`/purchase-requests/${selected.id}/mark_received/`); setDetailModal(false); fetchAll(); }}>
                Отметить как полученное
              </Button>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseRequestsPage;
