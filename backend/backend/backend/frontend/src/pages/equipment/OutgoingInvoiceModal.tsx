import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Form, Select, Input, InputNumber, Button, Space, message, Table,
  Typography, Divider, Radio, Row, Col, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined, FileTextOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { InventoryItem } from '../../types';

const { Text, Title } = Typography;
let debounceTimer: any = null;

function debounce(fn: Function, ms: number) {
  return (...args: any[]) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), ms);
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  items: InventoryItem[];
}

interface InvoiceItem {
  key: string;
  inventory_item: number;
  item_name: string;
  item_barcode: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  vat_rate: string;
  notes: string;
}

const OutgoingInvoiceModal: React.FC<Props> = ({ open, onClose, onDone, items }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [legals, setLegals] = useState<any[]>([]);
  const [clientOptions, setClientOptions] = useState<{value: number; label: string; inn?: string}[]>([]);
  const [innSearch, setInnSearch] = useState('');
  const [innLoading, setInnLoading] = useState(false);
  const [clientType, setClientType] = useState<'all' | 'legal' | 'person'>('all');
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/legal-entities/').then(r => setLegals(r.data.results || r.data)).catch(() => {});
      loadClients('', 'all');
    }
  }, [open]);

  const loadClients = async (search: string, type: string) => {
    const params: any = { page_size: 50 };
    if (search) params.search = search;
    if (type === 'legal') params.is_legal = 'true';
    else if (type === 'person') params.is_legal = 'false';
    try {
      const res = await api.get('/clients/', { params });
      const list = res.data.results || res.data;
      setClientOptions(list.map((c: any) => ({
        value: c.id,
        label: `${c.is_legal ? '🏢' : '👤'} ${c.name}${c.phone ? ' — ' + c.phone : ''}${c.inn ? ' [ИНН:' + c.inn + ']' : ''}`,
        inn: c.inn || '',
      })));
    } catch {}
  };

  const searchClients = debounce((val: string) => loadClients(val, clientType), 350);

  const handleClientTypeChange = (type: 'all' | 'legal' | 'person') => {
    setClientType(type);
    loadClients('', type);
  };

  // Поиск по ИНН — автоподстановка
  const searchByInn = async () => {
    const inn = innSearch.trim();
    if (!inn || inn.length < 10) {
      message.warning('Введите ИНН (10 или 12 цифр)');
      return;
    }
    setInnLoading(true);
    try {
      const res = await api.get('/clients/', { params: { search: inn, is_legal: 'true', page_size: 10 } });
      const found = (res.data.results || []).find((c: any) => c.inn && c.inn === inn);
      if (found) {
        form.setFieldsValue({ to_client_id: found.id });
        message.success(`Выбрано: ${found.name} (ИНН: ${found.inn})`);
        setClientOptions([{ value: found.id, label: `🏢 ${found.name} — ${found.phone || '—'} [ИНН:${found.inn}]`, inn: found.inn }]);
      } else {
        message.info(`Организация с ИНН «${inn}» не найдена в базе`);
      }
    } catch {
      message.error('Ошибка поиска');
    } finally {
      setInnLoading(false);
    }
  };

  const addItem = () => {
    setSelectedItems([...selectedItems, {
      key: `${Date.now()}`,
      inventory_item: 0, item_name: '', item_barcode: null,
      quantity: 1, unit_price: 0, amount: 0, vat_rate: '20%', notes: '',
    }]);
  };

  const updateItem = (key: string, field: string, value: any) => {
    setSelectedItems(prev => prev.map(it => {
      if (it.key !== key) return it;
      const updated = { ...it, [field]: value };
      if (field === 'inventory_item') {
        const found = items.find(i => i.id === value);
        if (found) {
          updated.item_name = found.name;
          updated.item_barcode = found.barcode;
          updated.unit_price = found.sale_price || 0;
        }
      }
      updated.amount = updated.quantity * updated.unit_price;
      return updated;
    }));
  };

  const removeItem = (key: string) => { setSelectedItems(prev => prev.filter(it => it.key !== key)); };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const toClientId = values.to_client_id;
      if (!toClientId || typeof toClientId !== 'number') {
        message.error('Выберите получателя из списка');
        return;
      }
      if (selectedItems.length === 0) { message.warning('Добавьте хотя бы одну позицию'); return; }
      if (selectedItems.some(it => !it.inventory_item)) { message.warning('Выберите товары во всех позициях'); return; }

      setLoading(true);
      const payload = {
        from_legal_id: values.from_legal_id,
        to_client_id: toClientId,
        basis: values.basis || '',
        received_by_name: values.received_by_name || '',
        notes: '',
        items: selectedItems.map(it => ({
          inventory_item: it.inventory_item, quantity: it.quantity,
          unit_price: it.unit_price, vat_rate: it.vat_rate, notes: it.notes,
        })),
      };

      const res = await api.post('/outgoing-invoices/', payload);
      message.success(`УПД №${res.data.invoice.number} создана`);
      onDone(); onClose(); setSelectedItems([]); form.resetFields();
    } catch (err: any) {
      if (err.response?.data) {
        const msg = err.response.data.error || err.response.data.detail || JSON.stringify(err.response.data);
        message.error(typeof msg === 'string' ? msg : msg);
      } else if (err.errorFields) {
        message.error('Заполните обязательные поля');
      } else {
        message.error('Ошибка создания УПД');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=750,height=600');
    if (!win || !previewInvoice) return;
    const d = previewInvoice;
    const itemsHtml = d.items.map((it: any) => `
      <tr><td>${it.name}</td><td>${it.unit}</td><td>${it.quantity}</td><td>${Number(it.unit_price).toFixed(2)}</td><td>${Number(it.amount).toFixed(2)}</td><td>${it.vat_rate}</td></tr>
    `).join('');
    win.document.write(`
      <html><head><title>УПД №${d.number}</title>
      <style>body{font-family:Arial;padding:30px;font-size:12px}.header{text-align:center;margin-bottom:20px}.parties{display:flex;justify-content:space-between;margin-bottom:20px}.party{width:48%;border:1px solid #000;padding:10px}table{width:100%;border-collapse:collapse;margin:15px 0}table th,table td{border:1px solid #000;padding:5px;text-align:left}table th{background:#f0f0f0}.total{text-align:right;font-size:14px;margin-top:10px}.signatures{display:flex;justify-content:space-between;margin-top:40px}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body>
      <div class="header"><h2>УПД №${d.number}</h2><p>от ${d.date}</p></div>
      <div class="parties"><div class="party"><h4>Продавец:</h4><p>${d.from_legal.name}</p><p>ИНН: ${d.from_legal.inn}</p></div><div class="party"><h4>Покупатель:</h4><p>${d.to_client.name}</p>${d.to_client.inn?'<p>ИНН: '+d.to_client.inn+'</p>':''}</div></div>
      <table><thead><tr><th>Товар</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>НДС</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div class="total"><strong>Итого: ${Number(d.total_amount).toFixed(2)} ₽</strong><br/>В т.ч. НДС: ${Number(d.total_vat).toFixed(2)} ₽</div>
      <div class="signatures"><div>Отпустил: _________________</div><div>Получил: ${d.received_by_name||'_________________'}</div></div>
      <script>window.onload=function(){window.print();window.close()}<\\/script></body></html>
    `);
    win.document.close();
  };

  return (
    <>
      <Modal title={<><FileTextOutlined /> Создать накладную (УПД)</>} open={open}
        onCancel={() => { onClose(); setSelectedItems([]); form.resetFields(); }} footer={null} width={800}>
        <Form form={form} layout="vertical">
          <Form.Item name="from_legal_id" label="От юр. лица (продавец)" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
            <Select showSearch placeholder="Выберите юрлицо" optionFilterProp="label"
              options={legals.map((l: any) => ({ value: l.id, label: `${l.short_name || l.name} (ИНН: ${l.inn || '—'})` }))} />
          </Form.Item>

          <Divider>Кому (получатель)</Divider>

          <Form.Item label="Тип получателя" style={{ marginBottom: 8 }}>
            <Radio.Group value={clientType} onChange={e => handleClientTypeChange(e.target.value)} optionType="button" buttonStyle="solid">
              <Radio.Button value="all">Все</Radio.Button>
              <Radio.Button value="legal">🏢 Юр. лица</Radio.Button>
              <Radio.Button value="person">👤 Физ. лица</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="to_client_id" label="Поиск получателя" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
            <Select showSearch placeholder="Введите название / телефон / ИНН..." filterOption={false}
              onSearch={searchClients} notFoundContent="Ничего не найдено" options={clientOptions} />
          </Form.Item>

          {clientType !== 'person' && (
            <Alert type="info" message={
              <Space wrap>
                <Text strong>🔍 Быстрый поиск по ИНН:</Text>
                <Input placeholder="10 или 12 цифр" value={innSearch} onChange={e => setInnSearch(e.target.value)}
                  style={{ width: 150 }} maxLength={12} onPressEnter={searchByInn} />
                <Button icon={<SearchOutlined />} loading={innLoading} onClick={searchByInn}>Найти и выбрать</Button>
              </Space>
            } style={{ marginBottom: 12 }} />
          )}

          <Row gutter={16}>
            <Col span={12}><Form.Item name="basis" label="Основание"><Input placeholder="Договор №5 от 01.01.2026" /></Form.Item></Col>
            <Col span={12}><Form.Item name="received_by_name" label="Принял (ФИО)"><Input placeholder="Кто расписался" /></Form.Item></Col>
          </Row>
        </Form>

        <Divider>Товарные позиции</Divider>
        <Button icon={<PlusOutlined />} onClick={addItem} style={{ marginBottom: 12 }}>Добавить позицию</Button>
        <Table dataSource={selectedItems} rowKey="key" size="small" pagination={false}
          columns={[
            { title: 'Товар', key: 'item', width: 220, render: (_: any, r: InvoiceItem) => (
              <Select showSearch value={r.inventory_item || undefined} placeholder="Выберите товар" style={{ width: '100%' }} optionFilterProp="label"
                onChange={v => updateItem(r.key, 'inventory_item', v)}
                options={items.filter(i => i.status === 'in_stock').map(i => ({ value: i.id, label: `${i.name} (${i.quantity} шт., ${i.sale_price || '—'} ₽)` }))} />
            )},
            { title: 'Кол-во', key: 'qty', width: 80, render: (_: any, r: InvoiceItem) => (
              <InputNumber min={1} value={r.quantity} onChange={v => updateItem(r.key, 'quantity', v || 1)} style={{ width: '100%' }} />)},
            { title: 'Цена', key: 'price', width: 100, render: (_: any, r: InvoiceItem) => (
              <InputNumber min={0} value={r.unit_price} onChange={v => updateItem(r.key, 'unit_price', v || 0)} style={{ width: '100%' }} prefix="₽" />)},
            { title: 'Сумма', key: 'amount', width: 100, render: (_: any, r: InvoiceItem) => (<Text strong>{(r.quantity * r.unit_price).toFixed(0)} ₽</Text>)},
            { title: 'НДС', key: 'vat', width: 80, render: (_: any, r: InvoiceItem) => (
              <Select value={r.vat_rate} onChange={v => updateItem(r.key, 'vat_rate', v)} style={{ width: '100%' }}
                options={[{ value: '20%', label: '20%' }, { value: '10%', label: '10%' }, { value: '0%', label: '0%' }, { value: 'без НДС', label: 'без НДС' }]} />)},
            { title: '', key: 'del', width: 40, render: (_: any, r: InvoiceItem) => (<Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} />)},
          ]} />
        <Divider />
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Text type="secondary">Позиций: {selectedItems.length} | Сумма: {selectedItems.reduce((s, it) => s + it.quantity * it.unit_price, 0).toFixed(2)} ₽</Text>
          <Button onClick={() => { onClose(); form.resetFields(); setSelectedItems([]); }}>Отмена</Button>
          <Button type="primary" icon={<FileTextOutlined />} loading={loading} onClick={handleCreate}>Создать УПД</Button>
        </Space>
      </Modal>

      <Modal title="🖨️ Печать УПД" open={previewVisible} onCancel={() => setPreviewVisible(false)}
        footer={<Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>} width={700}>
        {previewInvoice && (
          <div style={{ fontSize: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Title level={4} style={{ margin: 0 }}>УПД №{previewInvoice.number}</Title>
              <Text type="secondary">от {previewInvoice.date}</Text>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ flex: 1, border: '1px solid #ddd', padding: 8 }}>
                <Text strong>От: </Text>{previewInvoice.from_legal.name}<br/><Text type="secondary">ИНН: {previewInvoice.from_legal.inn}</Text>
              </div>
              <div style={{ flex: 1, border: '1px solid #ddd', padding: 8 }}>
                <Text strong>Кому: </Text>{previewInvoice.to_client.name}
                {previewInvoice.to_client.inn && <><br/><Text type="secondary">ИНН: {previewInvoice.to_client.inn}</Text></>}
              </div>
            </div>
            <Table dataSource={previewInvoice.items} rowKey="name" size="small" pagination={false}
              columns={[
                { title: 'Товар', dataIndex: 'name' }, { title: 'Ед.', dataIndex: 'unit', width: 50 },
                { title: 'Кол-во', dataIndex: 'quantity', width: 60 }, { title: 'Цена', dataIndex: 'unit_price', width: 80 },
                { title: 'Сумма', dataIndex: 'amount', width: 80 }, { title: 'НДС', dataIndex: 'vat_rate', width: 70 },
              ]} />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Text strong>Итого: {Number(previewInvoice.total_amount).toFixed(2)} ₽</Text><br/>
              <Text type="secondary">В т.ч. НДС: {Number(previewInvoice.total_vat).toFixed(2)} ₽</Text>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default OutgoingInvoiceModal;
