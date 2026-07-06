import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Input, Space, Popconfirm, message, Row, Col, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

const LegalEntitiesPage: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', short_name: '', inn: '', kpp: '', ogrn: '',
    legal_address: '', actual_address: '', phone: '', email: '',
    bank_name: '', bik: '', corr_account: '', settlement_account: '',
    director: '', is_default: false,
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/legal-entities/');
      setEntities(res.data.results || res.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', short_name: '', inn: '', kpp: '', ogrn: '', legal_address: '', actual_address: '', phone: '', email: '', bank_name: '', bik: '', corr_account: '', settlement_account: '', director: '', is_default: false });
    setModalOpen(true);
  };

  const openEdit = (rec: any) => {
    setEditing(rec);
    setForm({
      name: rec.name, short_name: rec.short_name || '', inn: rec.inn || '', kpp: rec.kpp || '', ogrn: rec.ogrn || '',
      legal_address: rec.legal_address || '', actual_address: rec.actual_address || '', phone: rec.phone || '', email: rec.email || '',
      bank_name: rec.bank_name || '', bik: rec.bik || '', corr_account: rec.corr_account || '', settlement_account: rec.settlement_account || '',
      director: rec.director || '', is_default: rec.is_default,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.error('Введите название'); return; }
    try {
      if (editing) {
        await api.patch(`/legal-entities/${editing.id}/`, form);
        message.success('Обновлено');
      } else {
        await api.post('/legal-entities/', form);
        message.success('Добавлено');
      }
      setModalOpen(false);
      fetch();
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Ошибка'); }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/legal-entities/${id}/`); message.success('Удалено'); fetch(); }
    catch { message.error('Ошибка удаления'); }
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', render: (t: string, r: any) => <strong>{t}{r.is_default ? ' ✅' : ''}</strong> },
    { title: 'ИНН', dataIndex: 'inn', key: 'inn', width: 120 },
    { title: 'Директор', dataIndex: 'director', key: 'director', width: 180 },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 140 },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, r: any) => (
        <Space><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>
      ),
    },
  ];

  return (
    <>
      <Card title="🏢 Юридические лица компании" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>}>
        <Table dataSource={entities} columns={columns} rowKey="id" loading={loading} size="middle" pagination={false} />
      </Card>

      <Modal title={editing ? 'Редактировать юрлицо' : 'Новое юрлицо'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={600}
        okText="Сохранить" cancelText="Отмена">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Row gutter={12}>
            <Col span={12}><label>Полное название *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ООО «Видео Сервис»" /></Col>
            <Col span={12}><label>Краткое название</label><Input value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })} placeholder="Видео Сервис" /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><label>ИНН</label><Input value={form.inn} onChange={e => setForm({ ...form, inn: e.target.value })} maxLength={12} /></Col>
            <Col span={8}><label>КПП</label><Input value={form.kpp} onChange={e => setForm({ ...form, kpp: e.target.value })} maxLength={9} /></Col>
            <Col span={8}><label>ОГРН</label><Input value={form.ogrn} onChange={e => setForm({ ...form, ogrn: e.target.value })} maxLength={15} /></Col>
          </Row>
          <div><label>Юридический адрес</label><Input value={form.legal_address} onChange={e => setForm({ ...form, legal_address: e.target.value })} /></div>
          <div><label>Фактический адрес</label><Input value={form.actual_address} onChange={e => setForm({ ...form, actual_address: e.target.value })} /></div>
          <Row gutter={12}>
            <Col span={12}><label>Телефон</label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Col>
            <Col span={12}><label>Email</label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Col>
          </Row>
          <div><label>Директор</label><Input value={form.director} onChange={e => setForm({ ...form, director: e.target.value })} placeholder="Фамилия И.О." /></div>
          <div style={{ fontWeight: 600, marginTop: 8 }}>Банковские реквизиты</div>
          <Row gutter={12}>
            <Col span={12}><label>Банк</label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></Col>
            <Col span={12}><label>БИК</label><Input value={form.bik} onChange={e => setForm({ ...form, bik: e.target.value })} maxLength={9} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><label>Корр. счёт</label><Input value={form.corr_account} onChange={e => setForm({ ...form, corr_account: e.target.value })} /></Col>
            <Col span={12}><label>Расчётный счёт</label><Input value={form.settlement_account} onChange={e => setForm({ ...form, settlement_account: e.target.value })} /></Col>
          </Row>
          <Checkbox checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })}>Использовать по умолчанию</Checkbox>
        </Space>
      </Modal>
    </>
  );
};

export default LegalEntitiesPage;
