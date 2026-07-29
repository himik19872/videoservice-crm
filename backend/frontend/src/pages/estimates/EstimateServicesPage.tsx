import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Input, Select, InputNumber, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

const SERVICE_CATEGORIES = [
  { value: 'installation', label: '🏗️ Монтаж' },
  { value: 'setup', label: '⚙️ Настройка/Пусконаладка' },
  { value: 'design', label: '📐 Проектирование' },
  { value: 'maintenance', label: '🔄 Обслуживание/ТО' },
  { value: 'repair', label: '🔧 Ремонт' },
  { value: 'consulting', label: '💬 Консультация' },
  { value: 'other', label: '📦 Другое' },
];

const EstimateServicesPage: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', category: 'installation', unit: 'шт',
    cost_price: 0, sale_price: 0, installer_salary: 0, notes: '',
  });

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/estimate-services/?page_size=200');
      setServices(res.data.results || res.data);
    } catch (e) {
      message.error('Ошибка загрузки услуг');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', category: 'installation', unit: 'шт', cost_price: 0, sale_price: 0, installer_salary: 0, notes: '' });
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditing(record);
    setFormData({
      name: record.name, category: record.category, unit: record.unit,
      cost_price: record.cost_price, sale_price: record.sale_price,
      installer_salary: record.installer_salary || 0, notes: record.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { message.error('Введите название'); return; }
    try {
      if (editing) {
        await api.patch(`/estimate-services/${editing.id}/`, formData);
        message.success('Услуга обновлена');
      } else {
        await api.post('/estimate-services/', formData);
        message.success('Услуга добавлена');
      }
      setModalOpen(false);
      fetchServices();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/estimate-services/${id}/`);
      message.success('Удалено');
      fetchServices();
    } catch (e) {
      message.error('Ошибка удаления');
    }
  };

  const columns = [
    { title: 'Наименование', dataIndex: 'name', key: 'name', render: (t: string, r: any) => <strong>{t}{r.is_active ? '' : ' (неактивна)'}</strong> },
    { title: 'Категория', dataIndex: 'category_display', key: 'category', width: 150 },
    { title: 'Себестоимость', dataIndex: 'cost_price', key: 'cost_price', width: 130, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Цена клиенту', dataIndex: 'sale_price', key: 'sale_price', width: 130, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Маржа %', dataIndex: 'margin_percent', key: 'margin', width: 90, render: (v: number) => <span style={{ color: v > 50 ? '#52c41a' : '#fa8c16' }}>{v}%</span> },
    { title: 'ЗП монтаж.', dataIndex: 'installer_salary', key: 'salary', width: 110, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Ед.', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Удалить услугу?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title="🔧 Справочник услуг и работ" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить услугу</Button>}>
        <Table dataSource={services} columns={columns} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 50 }} />
      </Card>

      <Modal title={editing ? 'Редактировать услугу' : 'Новая услуга'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} width={500} okText="Сохранить" cancelText="Отмена">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label>Наименование *</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Монтаж видеокамеры" />
          </div>
          <div>
            <label>Категория</label>
            <Select value={formData.category} onChange={v => setFormData({ ...formData, category: v })} style={{ width: '100%' }} options={SERVICE_CATEGORIES} />
          </div>
          <Space>
            <div>
              <label>Себестоимость (₽)</label>
              <InputNumber value={formData.cost_price} onChange={v => setFormData({ ...formData, cost_price: v || 0 })} min={0} style={{ width: 140 }} />
            </div>
            <div>
              <label>Цена клиенту (₽)</label>
              <InputNumber value={formData.sale_price} onChange={v => setFormData({ ...formData, sale_price: v || 0 })} min={0} style={{ width: 140 }} />
            </div>
          </Space>
          <Space>
            <div>
              <label>ЗП монтажникам (₽)</label>
              <InputNumber value={formData.installer_salary} onChange={v => setFormData({ ...formData, installer_salary: v || 0 })} min={0} style={{ width: 140 }} />
            </div>
            <div>
              <label>Ед. изм.</label>
              <Input value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} style={{ width: 80 }} />
            </div>
          </Space>
          <div>
            <label>Описание</label>
            <Input.TextArea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default EstimateServicesPage;
