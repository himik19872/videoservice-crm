import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Input, Select, Space, Tag, message, Popconfirm, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

const TAX_SYSTEMS = [
  { value: 'usn', label: 'УСН (доходы)' },
  { value: 'usn_dr', label: 'УСН (доходы-расходы)' },
  { value: 'osno', label: 'ОСНО (с НДС)' },
  { value: 'patent', label: 'Патент' },
  { value: 'none', label: 'Без налога' },
];

const TAX_COLORS: Record<string, string> = {
  usn: 'green', usn_dr: 'cyan', osno: 'orange', patent: 'purple', none: 'default',
};

const LegalEntitiesManager: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', short_name: '', inn: '', kpp: '', ogrn: '',
    legal_address: '', actual_address: '', phone: '', email: '',
    bank_name: '', bik: '', corr_account: '', settlement_account: '',
    director: '', tax_system: 'usn', is_default: false, vat_rate: 0,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/legal-entities/');
      // API возвращает {count, results} — берём results
      setItems(res.data.results || res.data || []);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({
      name: '', short_name: '', inn: '', kpp: '', ogrn: '',
      legal_address: '', actual_address: '', phone: '', email: '',
      bank_name: '', bik: '', corr_account: '', settlement_account: '',
      director: '', tax_system: 'usn', is_default: false, vat_rate: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (rec: any) => {
    setEditing(rec);
    setFormData({
      name: rec.name || '', short_name: rec.short_name || '',
      inn: rec.inn || '', kpp: rec.kpp || '', ogrn: rec.ogrn || '',
      legal_address: rec.legal_address || '', actual_address: rec.actual_address || '',
      phone: rec.phone || '', email: rec.email || '',
      bank_name: rec.bank_name || '', bik: rec.bik || '',
      corr_account: rec.corr_account || '', settlement_account: rec.settlement_account || '',
      director: rec.director || '', tax_system: rec.tax_system || 'usn',
      is_default: rec.is_default || false, vat_rate: rec.vat_rate || 0,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { message.warning('Название обязательно'); return; }
    try {
      if (editing) {
        await api.patch(`/legal-entities/${editing.id}/`, formData);
        message.success('Обновлено');
      } else {
        await api.post('/legal-entities/', formData);
        message.success('Создано');
      }
      setModalOpen(false);
      fetchData();
    } catch { message.error('Ошибка сохранения'); }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/legal-entities/${id}/`); message.success('Удалено'); fetchData(); }
    catch { message.error('Ошибка'); }
  };

  const columns = [
    {
      title: 'Название', dataIndex: 'name', key: 'name', width: 200, ellipsis: true,
      render: (n: string, r: any) => r.short_name ? <span>{r.short_name} <span style={{ color: '#888', fontSize: 11 }}>({n})</span></span> : n,
    },
    { title: 'ИНН', dataIndex: 'inn', key: 'inn', width: 110 },
    { title: 'КПП', dataIndex: 'kpp', key: 'kpp', width: 100, render: (v: string) => v || '—' },
    {
      title: 'Налог', dataIndex: 'tax_system', key: 'tax', width: 150,
      render: (v: string) => <Tag color={TAX_COLORS[v] || 'default'}>{TAX_SYSTEMS.find(t => t.value === v)?.label || v}</Tag>,
    },
    {
      title: 'По умол.', dataIndex: 'is_default', key: 'def', width: 70,
      render: (v: boolean) => v ? <Tag color="green">Да</Tag> : '',
    },
    {
      title: '', key: 'actions', width: 80,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title={<span>🏢 Юридические лица компании</span>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>}>
      <Table
        dataSource={items} columns={columns} rowKey="id"
        loading={loading} size="small" pagination={false}
        locale={{ emptyText: 'Нет юрлиц. Добавьте вашу компанию (ООО, ИП).' }}
      />
      <Divider style={{ marginTop: 12, marginBottom: 4 }} />
      <span style={{ color: '#888', fontSize: 11 }}>
        Юрлица используются в шаблоне КП (коммерческого предложения) как реквизиты исполнителя.
        При создании сметы можно выбрать юрлицо, от которого выставляется КП.
      </span>

      <Modal
        title={editing ? 'Редактировать юрлицо' : 'Новое юрлицо'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Сохранить"
        cancelText="Отмена"
        width={550}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <label>Полное название *</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="ООО «Видео Сервис»" />
          </div>
          <div>
            <label>Краткое название</label>
            <Input value={formData.short_name} onChange={e => setFormData({ ...formData, short_name: e.target.value })} placeholder="Видео Сервис" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><label>ИНН</label><Input value={formData.inn} onChange={e => setFormData({ ...formData, inn: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>КПП</label><Input value={formData.kpp} onChange={e => setFormData({ ...formData, kpp: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>ОГРН</label><Input value={formData.ogrn} onChange={e => setFormData({ ...formData, ogrn: e.target.value })} /></div>
          </div>
          <div>
            <label>Система налогообложения</label>
            <Select value={formData.tax_system} onChange={v => setFormData({ ...formData, tax_system: v })} options={TAX_SYSTEMS} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Ставка НДС (%) — 0 если без НДС</label>
            <Input type="number" value={formData.vat_rate} onChange={e => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })} placeholder="20" />
          </div>
          <div>
            <label>Юридический адрес</label>
            <Input value={formData.legal_address} onChange={e => setFormData({ ...formData, legal_address: e.target.value })} />
          </div>
          <div>
            <label>Фактический адрес</label>
            <Input value={formData.actual_address} onChange={e => setFormData({ ...formData, actual_address: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><label>Телефон</label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Email</label><Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
          </div>
          <div>
            <label>Банк</label>
            <Input value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><label>БИК</label><Input value={formData.bik} onChange={e => setFormData({ ...formData, bik: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Корр. счёт</label><Input value={formData.corr_account} onChange={e => setFormData({ ...formData, corr_account: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Расчётный счёт</label><Input value={formData.settlement_account} onChange={e => setFormData({ ...formData, settlement_account: e.target.value })} /></div>
          </div>
          <div>
            <label>Директор</label>
            <Input value={formData.director} onChange={e => setFormData({ ...formData, director: e.target.value })} />
          </div>
        </Space>
      </Modal>
    </Card>
  );
};

export default LegalEntitiesManager;
