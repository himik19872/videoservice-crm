import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Statistic, Modal, Form, Input, InputNumber, Select, Descriptions } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { IssueOrder, InventoryItem } from '../../types';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  pending: 'default', received: 'blue', partially_used: 'orange', fully_used: 'green', returned: 'purple',
};

const IssueOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<IssueOrder[]>([]);
  const [masters, setMasters] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IssueOrder | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ordersRes, mastersRes, itemsRes] = await Promise.all([
        api.get('/issue-orders/?page_size=100'),
        api.get('/masters/?page_size=200'),
        api.get('/inventory/?page_size=200'),
      ]);
      setOrders(ordersRes.data.results || ordersRes.data);
      setMasters(mastersRes.data.results || mastersRes.data);
      setInventoryItems(itemsRes.data.results || itemsRes.data);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (values: any) => {
    const items = form.getFieldValue('_items') || [];
    if (items.length === 0) { message.warning('Добавьте хотя бы одну позицию'); return; }
    try {
      await api.post('/issue-orders/', {
        order_id: values.order_id,
        master_id: values.master_id,
        notes: values.notes || '',
        items: items.map((i: any) => ({
          inventory_item_id: i.inventory_item_id,
          quantity_issued: i.quantity_issued || 1,
          need_return_old: i.need_return_old || false,
          old_item_description: i.old_item_description || '',
          notes: i.notes || '',
        })),
      });
      message.success('Ордер создан');
      setCreateModal(false);
      form.resetFields();
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const handleReceive = async () => {
    if (!selectedOrder) return;
    try {
      await api.post(`/issue-orders/${selectedOrder.id}/receive/`);
      message.success('Получение подтверждено');
      setDetailModal(false);
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const columns = [
    { title: 'Ордер №', dataIndex: 'id', key: 'id', width: 80 },
    { title: 'Заявка', dataIndex: 'order_number', key: 'order', width: 130 },
    { title: 'Сотрудник', dataIndex: 'master_name', key: 'master', width: 180 },
    { title: 'Позиций', key: 'items', width: 70, render: (_: any, r: IssueOrder) => r.items?.length || 0 },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 150,
      render: (_: any, r: IssueOrder) => <Tag color={statusColors[r.status]}>{r.status_display}</Tag>
    },
    { title: 'Выдан', dataIndex: 'issued_at', key: 'issued', width: 150, render: (v: string) => new Date(v).toLocaleString('ru') },
    {
      title: '', key: 'actions', width: 150, render: (_: any, r: IssueOrder) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedOrder(r); setDetailModal(true); }}>Детали</Button>
          {r.status === 'pending' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={async () => { await api.post(`/issue-orders/${r.id}/receive/`); fetchAll(); }}>Получить</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>📦 Расходные ордера</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldValue('_items', []); setCreateModal(true); }}>
          Создать ордер
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Обновить</Button>
      </Space>

      <Table columns={columns} dataSource={orders} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />

      {/* Модалка создания */}
      <Modal title="Новый расходный ордер" open={createModal} onCancel={() => setCreateModal(false)} width={700} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="order_id" label="Заявка" rules={[{ required: true }]}>
                <Input placeholder="ID заявки (можно доработать поиск)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="master_id" label="Сотрудник" rules={[{ required: true }]}>
                <Select showSearch placeholder="Выберите" optionFilterProp="label"
                  options={masters.map((m: any) => ({ value: m.id, label: `${m.full_name || m.user?.username} (${m.region?.name || '—'})` }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Добавление позиций */}
          <Card size="small" title="➕ Добавить позицию" style={{ marginBottom: 12 }}>
            <Form.Item name="_pick_item" style={{ marginBottom: 8 }}>
              <Select showSearch placeholder="Выберите товар" optionFilterProp="label"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={inventoryItems.map(i => ({ value: i.id, label: `${i.name} [в наличии: ${i.quantity}]` }))}
              />
            </Form.Item>
            <Space>
              <Form.Item name="_pick_qty" initialValue={1} style={{ marginBottom: 0 }}><InputNumber min={1} placeholder="Кол-во" style={{ width: 80 }} /></Form.Item>
              <Button type="primary" onClick={() => {
                const id = form.getFieldValue('_pick_item');
                if (!id) { message.warning('Выберите товар'); return; }
                const item = inventoryItems.find(i => i.id === id);
                if (!item) return;
                const qty = form.getFieldValue('_pick_qty') || 1;
                const existing = form.getFieldValue('_items') || [];
                existing.push({ inventory_item_id: id, quantity_issued: qty, need_return_old: false, _name: item.name });
                form.setFieldValue('_items', [...existing]);
                form.resetFields(['_pick_item', '_pick_qty']);
                form.setFieldValue('_pick_qty', 1);
              }}>Добавить</Button>
            </Space>
          </Card>

          {/* Позиции */}
          <Form.Item noStyle shouldUpdate={(p, c) => p._items !== c._items}>
            {({ getFieldValue }) => {
              const items = getFieldValue('_items') || [];
              return items.length > 0 ? (
                <Card title={`Позиции (${items.length})`} size="small" style={{ marginBottom: 16 }}>
                  {items.map((item: any, idx: number) => (
                    <Row key={idx} gutter={8} style={{ marginBottom: 6 }} align="middle">
                      <Col span={12}><Text>{item._name}</Text></Col>
                      <Col span={4}><Text>× {item.quantity_issued}</Text></Col>
                      <Col span={4}>
                        <Input size="small" placeholder="Что вернуть" value={item.old_item_description || ''}
                          onChange={e => { item.old_item_description = e.target.value; form.setFieldValue('_items', [...items]); }}
                        />
                      </Col>
                      <Col span={4}>
                        <Button size="small" danger onClick={() => { items.splice(idx, 1); form.setFieldValue('_items', [...items]); }}>✕</Button>
                      </Col>
                    </Row>
                  ))}
                </Card>
              ) : null;
            }}
          </Form.Item>

          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit" block>Создать ордер</Button>
        </Form>
      </Modal>

      {/* Модалка деталей */}
      <Modal title={`Ордер №${selectedOrder?.id || ''}`} open={detailModal} onCancel={() => setDetailModal(false)} width={700} footer={null}>
        {selectedOrder && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Заявка">{selectedOrder.order_number}</Descriptions.Item>
              <Descriptions.Item label="Статус"><Tag color={statusColors[selectedOrder.status]}>{selectedOrder.status_display}</Tag></Descriptions.Item>
              <Descriptions.Item label="Сотрудник">{selectedOrder.master_name}</Descriptions.Item>
              <Descriptions.Item label="Выдал">{selectedOrder.issued_by_name}</Descriptions.Item>
              <Descriptions.Item label="Выдан">{new Date(selectedOrder.issued_at).toLocaleString('ru')}</Descriptions.Item>
              <Descriptions.Item label="Получен">{selectedOrder.received_at ? new Date(selectedOrder.received_at).toLocaleString('ru') : '—'}</Descriptions.Item>
            </Descriptions>
            <Table dataSource={selectedOrder.items} rowKey="id" size="small" pagination={false}
              columns={[
                { title: 'Товар', dataIndex: 'item_name', width: 220 },
                { title: 'Выдано', dataIndex: 'quantity_issued', width: 70 },
                { title: 'Исп.', dataIndex: 'quantity_used', width: 60 },
                { title: 'Возвр.', dataIndex: 'quantity_returned', width: 60 },
                { title: 'Остаток', dataIndex: 'remaining', width: 70, render: (v: number) => <Text style={{ color: v > 0 ? '#fa8c16' : '#3f8600' }}>{v}</Text> },
                { title: 'Возврат старого', key: 'old', width: 100, render: (_: any, r: any) => r.need_return_old ? (r.old_item_returned ? '✅' : '❌') : '—' },
              ]}
            />
            {selectedOrder.status === 'pending' && (
              <Button type="primary" icon={<CheckOutlined />} onClick={handleReceive} style={{ marginTop: 16 }} block>
                Подтвердить получение
              </Button>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default IssueOrdersPage;
