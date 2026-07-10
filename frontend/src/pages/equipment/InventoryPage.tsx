import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Modal, InputNumber, Select, Statistic, Form, Input, Tooltip, Popconfirm, Switch } from 'antd';
import { PlusOutlined, ReloadOutlined, ExportOutlined, BarcodeOutlined, ShopOutlined, FileTextOutlined, SendOutlined, ShoppingCartOutlined, EditOutlined, EnvironmentOutlined, DeleteOutlined, CheckCircleOutlined, PrinterOutlined, ScanOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import BarcodeScanner from '../../components/BarcodeScanner';
import type { InventoryItem, InventoryMovement, StorageLocation } from '../../types';
import JsBarcode from 'jsbarcode';
import OutgoingInvoiceModal from './OutgoingInvoiceModal';

const { Title, Text } = Typography;

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
  const [editModal, setEditModal] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [tab, setTab] = useState<'items' | 'movements' | 'upd' | 'settings'>('items');
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [locEditModal, setLocEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [locForm] = Form.useForm();
  const [printModal, setPrintModal] = useState(false);
  const [printLocation, setPrintLocation] = useState<StorageLocation | null>(null);
  const [printBarcodeDataUrl, setPrintBarcodeDataUrl] = useState<string>('');
  const [locScannerVisible, setLocScannerVisible] = useState(false);
  const [updModalVisible, setUpdModalVisible] = useState(false);
  const [updList, setUpdList] = useState<any[]>([]);
  const [updPrintData, setUpdPrintData] = useState<any>(null);
  const [updPrintVisible, setUpdPrintVisible] = useState(false);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  const statusColors: Record<string, string> = {
    in_stock: 'green', with_master: 'blue', installed: 'purple',
    returned: 'orange', defective: 'red', written_off: 'default',
  };

  useEffect(() => { fetchAll(); fetchStorageLocations(); }, []);

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

  const fetchStorageLocations = async () => {
    try {
      const res = await api.get('/storage-locations/', { params: { page_size: 500, is_active: true } });
      setStorageLocations(res.data.results || res.data);
    } catch {}
  };

  // ── Управление ячейками (Настройки склада) ──
  const openLocCreate = () => {
    setEditingLocation(null);
    locForm.resetFields();
    locForm.setFieldsValue({ is_active: true, capacity: 0 });
    setLocEditModal(true);
  };

  const openLocEdit = (loc: StorageLocation) => {
    setEditingLocation(loc);
    locForm.setFieldsValue(loc);
    setLocEditModal(true);
  };

  const handleLocSave = async () => {
    try {
      const values = await locForm.validateFields();
      if (editingLocation) {
        await api.put(`/storage-locations/${editingLocation.id}/`, values);
        message.success('Ячейка обновлена');
      } else {
        await api.post('/storage-locations/', values);
        message.success('Ячейка создана');
      }
      setLocEditModal(false);
      fetchStorageLocations();
    } catch (err: any) {
      if (err.response?.data) message.error(JSON.stringify(err.response.data));
    }
  };

  const handleLocDelete = async (id: number) => {
    await api.delete(`/storage-locations/${id}/`);
    message.success('Ячейка удалена');
    fetchStorageLocations();
  };

  const handleLocToggle = async (loc: StorageLocation) => {
    await api.patch(`/storage-locations/${loc.id}/`, { is_active: !loc.is_active });
    fetchStorageLocations();
  };

  const handleAutoCode = () => {
    const zone = locForm.getFieldValue('zone') || 'A';
    const rack = locForm.getFieldValue('rack') || '01';
    const shelf = locForm.getFieldValue('shelf') || '01';
    locForm.setFieldsValue({ code: `${zone}-${rack}-${shelf}`.replace(/\s+/g, '-') });
  };

  // ── Печать таблички ──
  const openPrint = (loc: StorageLocation) => {
    setPrintLocation(loc);
    setPrintBarcodeDataUrl('');
    setPrintModal(true);
    // Рисуем штрихкод через canvas → data URL (надёжнее, чем SVG в DOM)
    setTimeout(() => {
      if (printCanvasRef.current) {
        try {
          JsBarcode(printCanvasRef.current, loc.barcode || loc.code, {
            format: 'CODE128',
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            margin: 5,
          });
          setPrintBarcodeDataUrl(printCanvasRef.current.toDataURL('image/png'));
        } catch {}
      }
    }, 100);
  };

  const handlePrint = () => {
    if (!printLocation) return;
    const win = window.open('', '_blank', 'width=400,height=350');
    if (!win) return;
    const imgSrc = printBarcodeDataUrl;
    win.document.write(`
      <html><head><title>Табличка: ${printLocation.code}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 10px; margin: 0; }
        .label-card { border: 2px dashed #000; border-radius: 8px; padding: 15px; width: 280px; margin: 0 auto; }
        .zone-line { font-size: 12px; color: #555; margin-bottom: 6px; }
        .code-big { font-size: 30px; font-weight: bold; margin: 8px 0; }
        .barcode-img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
        .barcode-num { font-size: 10px; color: #999; margin-top: 4px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="label-card">
        <div class="zone-line">
          ${printLocation.zone ? 'Зона: ' + printLocation.zone : 'Склад'}
          ${printLocation.rack ? ' / Стеллаж: ' + printLocation.rack : ''}
          ${printLocation.shelf ? ' / Полка: ' + printLocation.shelf : ''}
        </div>
        <div class="code-big">${printLocation.code}</div>
        ${imgSrc ? '<img class="barcode-img" src="' + imgSrc + '" alt="barcode" />' : '<p>Штрихкод не сгенерирован</p>'}
        <div class="barcode-num">${printLocation.barcode || ''}</div>
      </div>
      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  // ── Сканер ячейки ──
  const handleLocBarcodeScanned = async (code: string) => {
    setLocScannerVisible(false);
    try {
      const res = await api.get('/storage-locations/by_barcode/', { params: { code } });
      const loc = res.data;
      message.success(`Найдена ячейка: [${loc.code}] ${loc.zone || ''}`);
      setEditingLocation(loc);
      locForm.setFieldsValue(loc);
      setLocEditModal(true);
    } catch {
      message.error(`Ячейка «${code}» не найдена`);
    }
  };

  // ── УПД: список + печать ──
  const fetchUpdList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/outgoing-invoices/', { params: { page_size: 200 } });
      setUpdList(res.data.results || res.data);
    } catch { message.error('Ошибка загрузки УПД'); }
    finally { setLoading(false); }
  };

  const handleUpdPrint = async (inv: any) => {
    try {
      const res = await api.get('/outgoing-invoices/print/', { params: { id: inv.id } });
      setUpdPrintData(res.data);
      setUpdPrintVisible(true);
    } catch { message.error('Ошибка загрузки УПД для печати'); }
  };

  const doUpdPrint = () => {
    if (!updPrintData) return;
    const d = updPrintData;
    const itemsHtml = (d.items || []).map((it: any) =>
      `<tr><td>${it.name}</td><td>${it.unit}</td><td>${it.quantity}</td><td>${it.unit_price}</td><td>${it.amount}</td><td>${it.vat_rate}</td></tr>`
    ).join('');
    const win = window.open('', '_blank', 'width=750,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>УПД №${d.number}</title>
      <style>body{font-family:Arial;padding:30px;font-size:12px}.header{text-align:center;margin-bottom:20px}.header h2{margin:0 0 5px}.parties{display:flex;justify-content:space-between;margin-bottom:20px}.party{width:48%;border:1px solid #000;padding:10px}.party h4{margin:0 0 5px}table{width:100%;border-collapse:collapse;margin:15px 0}table th,table td{border:1px solid #000;padding:5px;text-align:left}table th{background:#f0f0f0}.total{text-align:right;font-size:14px;margin-top:10px}.signatures{display:flex;justify-content:space-between;margin-top:40px}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body>
      <div class="header"><h2>УПД №${d.number}</h2><p>от ${d.date}</p></div>
      <div class="parties"><div class="party"><h4>Продавец:</h4><p>${d.from_legal.name}</p><p>ИНН: ${d.from_legal.inn}</p></div><div class="party"><h4>Покупатель:</h4><p>${d.to_client.name}</p>${d.to_client.inn?'<p>ИНН: '+d.to_client.inn+'</p>':''}</div></div>
      ${d.basis?'<p><strong>Основание:</strong> '+d.basis+'</p>':''}
      <table><thead><tr><th>Товар</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>НДС</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div class="total"><strong>Итого: ${Number(d.total_amount).toFixed(2)} ₽</strong><br/>В т.ч. НДС: ${Number(d.total_vat).toFixed(2)} ₽</div>
      <div class="signatures"><div>Отпустил: _________________</div><div>Получил: ${d.received_by_name||'_________________'}</div></div>
      <script>window.onload=function(){window.print();window.close()}<\\/script></body></html>
    `);
    win.document.close();
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
      // Авто-размещение: если не указана ячейка — берём первую свободную
      const payload = { ...values };
      if (!payload.storage_location && storageLocations.length > 0) {
        const freeLoc = storageLocations.find(l => !l.is_full && l.is_active);
        if (freeLoc) payload.storage_location = freeLoc.id;
      }
      await api.post('/inventory/', payload);
      message.success(payload.storage_location
        ? 'Позиция создана и размещена в ячейке'
        : 'Позиция создана');
      setCreateModal(false);
      createForm.resetFields();
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const openEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    editForm.setFieldsValue({
      name: item.name,
      item_type: item.item_type,
      barcode: item.barcode,
      serial_number: item.serial_number,
      model_name: item.model_name,
      quantity: item.quantity,
      cost_price: item.cost_price,
      sale_price: item.sale_price,
      supplier: item.supplier,
      storage_location: item.storage_location,
      warranty_months: item.warranty_months,
      notes: item.notes,
    });
    fetchStorageLocations();
    setEditModal(true);
  };

  const handleEditItem = async (values: any) => {
    if (!selectedItem) return;
    try {
      await api.put(`/inventory/${selectedItem.id}/`, values);
      message.success('Позиция обновлена');
      setEditModal(false);
      setSelectedItem(null);
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
      title: 'Ячейка', dataIndex: 'storage_location_info', key: 'loc', width: 110,
      render: (info: any) => info ? (
        <Tooltip title={`${info.zone || ''} / стеллаж ${info.rack || '—'} / полка ${info.shelf || '—'}`}>
          <Tag color="blue">{info.code}</Tag>
        </Tooltip>
      ) : <Tag color="default">—</Tag>
    },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 110, render: (_: any, r: InventoryItem) => <Tag color={statusColors[r.status]}>{r.status_display}</Tag>
    },
    {
      title: 'Действия', key: 'actions', width: 300, render: (_: any, r: InventoryItem) => (
        <Space size="small" wrap>
          <Button size="small" icon={<PlusOutlined />} onClick={() => { setSelectedItem(r); setAddModal(true); }}>Приход</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => { setSelectedItem(r); setIssueModal(true); }}>Выдать</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} title="Редактировать">Изменить</Button>
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
        <Button type={tab === 'upd' ? 'primary' : 'default'} icon={<FileTextOutlined />} onClick={() => { setTab('upd'); fetchUpdList(); }}>УПД</Button>
        <Button type={tab === 'settings' ? 'primary' : 'default'} icon={<EnvironmentOutlined />} onClick={() => { setTab('settings'); fetchStorageLocations(); }}>Настройки склада</Button>
        {tab === 'items' && (
          <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); fetchStorageLocations(); setCreateModal(true); }}>
              Новая позиция
            </Button>
            <Button icon={<FileTextOutlined />} onClick={() => setUpdModalVisible(true)}>Выдать по накладной (УПД)</Button>
            <Button icon={<BarcodeOutlined />} onClick={() => setScannerVisible(true)}>Сканер</Button>
          </>
        )}
        <Button icon={<ReloadOutlined />} onClick={tab === 'settings' ? fetchStorageLocations : fetchAll}>Обновить</Button>
        {tab !== 'settings' && (
          <>
            <Button icon={<ShopOutlined />} onClick={() => navigate('/suppliers')}>Поставщики</Button>
            <Button icon={<FileTextOutlined />} onClick={() => navigate('/supply-invoices')}>Накладные</Button>
            <Button icon={<SendOutlined />} onClick={() => navigate('/issue-orders')}>Расходные ордера</Button>
            <Button icon={<ShoppingCartOutlined />} onClick={() => navigate('/purchase-requests')}>Заявки на закупку</Button>
          </>
        )}
      </Space>

      {tab === 'items' ? (
        <Table columns={columns} dataSource={items} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />
      ) : tab === 'movements' ? (
        <Table columns={movColumns} dataSource={movements} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />
      ) : tab === 'upd' ? (
        /* ═══════════ Вкладка: УПД ═══════════ */
        <div>
          <Card style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={5} style={{ margin: 0 }}><FileTextOutlined /> Исходящие накладные (УПД)</Title>
                <Text type="secondary">История выдачи товаров по накладным</Text>
              </Col>
              <Col>
                <Button type="primary" icon={<FileTextOutlined />} onClick={() => setUpdModalVisible(true)}>
                  Создать УПД
                </Button>
              </Col>
            </Row>
          </Card>
          <Table
            dataSource={updList}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 30 }}
            size="middle"
            columns={[
              { title: '№ УПД', dataIndex: 'number', key: 'number', width: 160, render: (v: string) => <Text strong>{v}</Text> },
              { title: 'Дата', dataIndex: 'date', key: 'date', width: 110 },
              {
                title: 'Статус', dataIndex: 'status_display', key: 'status', width: 110,
                render: (s: string, r: any) => {
                  const color = r.status === 'draft' ? 'orange' : r.status === 'issued' ? 'green' : 'default';
                  return <Tag color={color}>{s}</Tag>;
                },
              },
              {
                title: 'От юр. лица', dataIndex: 'from_legal_name', key: 'from', width: 200, ellipsis: true,
              },
              {
                title: 'Получатель', dataIndex: 'to_client_name', key: 'to', width: 200, ellipsis: true,
              },
              {
                title: 'Сумма', key: 'amount', width: 120,
                render: (_: any, r: any) => `${Number(r.total_amount || 0).toFixed(0)} ₽`,
              },
              {
                title: 'Основание', dataIndex: 'basis', key: 'basis', width: 180, ellipsis: true,
                render: (v: string) => v || '—',
              },
              {
                title: 'Принял', dataIndex: 'received_by_name', key: 'recv', width: 150, ellipsis: true,
                render: (v: string) => v || '—',
              },
              {
                title: '', key: 'actions', width: 80,
                render: (_: any, r: any) => (
                  <Button size="small" icon={<PrinterOutlined />} onClick={() => handleUpdPrint(r)}>
                    Печать
                  </Button>
                ),
              },
            ]}
          />
        </div>
      ) : (
        /* ═══════════ Вкладка: Настройки склада ═══════════ */
        <div>
          <Card style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={5} style={{ margin: 0 }}><EnvironmentOutlined /> Ячейки хранения</Title>
                <Text type="secondary">Распечатайте таблички со штрихкодом и наклейте на стеллажи/полки</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<ScanOutlined />} onClick={() => setLocScannerVisible(true)}>
                    Сканировать ячейку
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openLocCreate}>
                    Добавить ячейку
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          <Table
            dataSource={storageLocations}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="middle"
            columns={[
              {
                title: 'Код',
                dataIndex: 'code',
                key: 'code',
                width: 110,
                sorter: (a: StorageLocation, b: StorageLocation) => a.code.localeCompare(b.code),
                render: (c: string, r: StorageLocation) => (
                  <a onClick={() => { navigate(`/storage-locations/${r.id}`); }}>
                    <Text strong style={{ fontSize: 16 }}>{c}</Text>
                  </a>
                ),
              },
              {
                title: 'Штрихкод',
                dataIndex: 'barcode',
                key: 'barcode',
                width: 150,
                render: (b: string) => <Text code style={{ fontSize: 13 }}>{b}</Text>,
              },
              { title: 'Зона', dataIndex: 'zone', key: 'zone', width: 120 },
              { title: 'Стеллаж', dataIndex: 'rack', key: 'rack', width: 80 },
              { title: 'Полка', dataIndex: 'shelf', key: 'shelf', width: 70 },
              {
                title: 'Вмест.',
                dataIndex: 'capacity',
                key: 'capacity',
                width: 70,
                render: (c: number) => c > 0 ? c : '∞',
              },
              {
                title: 'Заполнено',
                key: 'fill',
                width: 100,
                render: (_: any, r: StorageLocation) => (
                  <Space>
                    <Tag color={r.is_full ? 'red' : 'green'}>{r.items_count}</Tag>
                    {r.capacity > 0 && <Text type="secondary">/ {r.capacity}</Text>}
                  </Space>
                ),
              },
              {
                title: 'Акт.',
                dataIndex: 'is_active',
                key: 'is_active',
                width: 55,
                render: (active: boolean, r: StorageLocation) => (
                  <Switch size="small" checked={active} onChange={() => handleLocToggle(r)} />
                ),
              },
              {
                title: '',
                key: 'actions',
                width: 120,
                render: (_: any, r: StorageLocation) => (
                  <Space size="small">
                    <Tooltip title="Печать таблички">
                      <Button size="small" icon={<PrinterOutlined />} onClick={() => openPrint(r)} />
                    </Tooltip>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openLocEdit(r)} />
                    <Popconfirm title="Удалить ячейку?" onConfirm={() => handleLocDelete(r.id)} okText="Да" cancelText="Нет">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Модалка: создание/редактирование ячейки */}
      <Modal
        title={editingLocation ? 'Редактировать ячейку' : 'Новая ячейка хранения'}
        open={locEditModal}
        onOk={handleLocSave}
        onCancel={() => setLocEditModal(false)}
        okText="Сохранить"
        cancelText="Отмена"
        width={500}
      >
        <Form form={locForm} layout="vertical">
          <Button size="small" onClick={handleAutoCode} style={{ marginBottom: 12 }}>
            🔄 Сгенерировать код
          </Button>
          <Form.Item name="code" label="Код места" rules={[{ required: true, message: 'Введите код' }]}>
            <Input placeholder="Например: A-03-12" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="zone" label="Зона"><Input placeholder="Склад А" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="rack" label="Стеллаж"><Input placeholder="03" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shelf" label="Полка"><Input placeholder="12" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="capacity" label="Вместимость (0 = безлимит)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активно" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Модалка: печать таблички */}
      <Modal
        title="🖨️ Табличка для печати"
        open={printModal}
        onCancel={() => setPrintModal(false)}
        footer={<Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={!printBarcodeDataUrl}>Печать</Button>}
        width={350}
      >
        {printLocation && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ border: '2px dashed #999', borderRadius: 8, padding: 15 }}>
              <div style={{ fontSize: 12, color: '#888' }}>
                {printLocation.zone ? `Зона: ${printLocation.zone}` : 'Склад'}
                {printLocation.rack ? ` / Стеллаж: ${printLocation.rack}` : ''}
                {printLocation.shelf ? ` / Полка: ${printLocation.shelf}` : ''}
              </div>
              <div style={{ fontSize: 32, fontWeight: 'bold', margin: '10px 0' }}>
                {printLocation.code}
              </div>
              {/* Скрытый canvas для рендера JsBarcode */}
              <canvas ref={printCanvasRef} style={{ display: 'none' }} />
              {printBarcodeDataUrl ? (
                <img src={printBarcodeDataUrl} alt="barcode" style={{ maxWidth: '100%', margin: '0 auto' }} />
              ) : (
                <div style={{ padding: 20, color: '#aaa' }}>Генерация штрихкода...</div>
              )}
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>
                {printLocation.barcode}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Сканер ячейки */}
      <BarcodeScanner
        visible={locScannerVisible}
        onClose={() => setLocScannerVisible(false)}
        onScanned={handleLocBarcodeScanned}
        title="Сканировать штрихкод ячейки"
      />

      {/* Модалка: УПД (выдача по накладной) */}
      <OutgoingInvoiceModal
        open={updModalVisible}
        onClose={() => setUpdModalVisible(false)}
        onDone={() => { fetchAll(); fetchUpdList(); }}
        items={items}
      />

      {/* Модалка: печать УПД */}
      <Modal title="🖨️ Печать УПД" open={updPrintVisible} onCancel={() => setUpdPrintVisible(false)}
        footer={<Button type="primary" icon={<PrinterOutlined />} onClick={doUpdPrint}>Печать</Button>} width={700}>
        {updPrintData && (
          <div style={{ fontSize: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Title level={4} style={{ margin: 0 }}>УПД №{updPrintData.number}</Title>
              <Text type="secondary">от {updPrintData.date}</Text>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ flex: 1, border: '1px solid #ddd', padding: 8 }}>
                <Text strong>От: </Text>{updPrintData.from_legal?.name}<br/>
                <Text type="secondary">ИНН: {updPrintData.from_legal?.inn}</Text>
              </div>
              <div style={{ flex: 1, border: '1px solid #ddd', padding: 8 }}>
                <Text strong>Кому: </Text>{updPrintData.to_client?.name}
                {updPrintData.to_client?.inn && <><br/><Text type="secondary">ИНН: {updPrintData.to_client.inn}</Text></>}
              </div>
            </div>
            <Table dataSource={updPrintData.items || []} rowKey="name" size="small" pagination={false}
              columns={[
                { title: 'Товар', dataIndex: 'name' }, { title: 'Ед.', dataIndex: 'unit', width: 50 },
                { title: 'Кол-во', dataIndex: 'quantity', width: 60 }, { title: 'Цена', dataIndex: 'unit_price', width: 80 },
                { title: 'Сумма', dataIndex: 'amount', width: 80 }, { title: 'НДС', dataIndex: 'vat_rate', width: 70 },
              ]} />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Text strong>Итого: {Number(updPrintData.total_amount).toFixed(2)} ₽</Text><br/>
              <Text type="secondary">В т.ч. НДС: {Number(updPrintData.total_vat).toFixed(2)} ₽</Text>
            </div>
          </div>
        )}
      </Modal>

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
          <Form.Item name="storage_location" label="Ячейка хранения" help="Авто — первая свободная">
            <Select
              allowClear
              showSearch
              placeholder="Авто-размещение"
              optionFilterProp="label"
              options={storageLocations.map(l => ({
                value: l.id,
                label: `[${l.code}] ${l.zone || ''} / ст.${l.rack || '—'} / п.${l.shelf || '—'} (своб. ${l.free_space === null ? '∞' : l.free_space})`,
                disabled: l.is_full,
              }))}
            />
          </Form.Item>
          <Form.Item name="warranty_months" label="Гарантия (мес.)" initialValue={12}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit" block>Создать</Button>
        </Form>
      </Modal>

      {/* Модалка редактирования */}
      <Modal title="Редактировать позицию" open={editModal} onCancel={() => { setEditModal(false); setSelectedItem(null); }} footer={null} width={500}>
        <Form form={editForm} layout="vertical" onFinish={handleEditItem}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="item_type" label="Тип" rules={[{ required: true }]}>
            <Select options={ITEM_TYPES} />
          </Form.Item>
          <Form.Item name="barcode" label="Штрих-код (SKU)"><Input /></Form.Item>
          <Form.Item name="serial_number" label="Серийный номер"><Input /></Form.Item>
          <Form.Item name="model_name" label="Модель"><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="quantity" label="Кол-во"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="cost_price" label="Закупка (₽)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="sale_price" label="Продажа (₽)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="supplier" label="Поставщик"><Input placeholder="Название поставщика" /></Form.Item>
          <Form.Item name="storage_location" label="Ячейка хранения">
            <Select
              allowClear
              showSearch
              placeholder="Выберите ячейку"
              optionFilterProp="label"
              options={storageLocations.map(l => ({
                value: l.id,
                label: `[${l.code}] ${l.zone || ''} / ст.${l.rack || '—'} / п.${l.shelf || '—'} (своб. ${l.free_space === null ? '∞' : l.free_space})`,
                disabled: l.is_full && selectedItem?.storage_location !== l.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="warranty_months" label="Гарантия (мес.)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit" block>Сохранить</Button>
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
