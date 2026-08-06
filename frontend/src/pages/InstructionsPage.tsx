import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Modal, Input, Select, Upload, message, Space, Tag, Popconfirm, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import api from '../services/api';

const CATEGORIES: Record<string, string> = {
  equipment: 'Оборудование',
  installation: 'Монтаж',
  setup: 'Настройка',
  repair: 'Ремонт',
  safety: 'Техника безопасности',
  other: 'Другое',
};

const InstructionsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', category: 'other', description: '', order_num: 0, is_active: true });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/instructions/');
      setItems(res.data.results || res.data || []);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', category: 'other', description: '', order_num: 0, is_active: true });
    setFile(null);
    setModalOpen(true);
  };

  const openEdit = (rec: any) => {
    setEditing(rec);
    setForm({ title: rec.title, category: rec.category, description: rec.description || '', order_num: rec.order_num || 0, is_active: rec.is_active });
    setFile(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { message.warning('Введите название'); return; }
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (file) fd.append('pdf_file', file);
      const token = localStorage.getItem('token');
      const headers: any = { 'Content-Type': 'multipart/form-data' };
      if (token) headers['Authorization'] = `Token ${token}`;

      if (editing) {
        await api.patch(`/instructions/${editing.id}/`, fd, { headers });
        message.success('Обновлено');
      } else {
        if (!file) { message.warning('Загрузите PDF-файл'); return; }
        await api.post('/instructions/', fd, { headers });
        message.success('Добавлено');
      }
      setModalOpen(false);
      fetchData();
    } catch { message.error('Ошибка сохранения'); }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/instructions/${id}/`); message.success('Удалено'); fetchData(); }
    catch { message.error('Ошибка'); }
  };

  const formatBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : b > 1024 ? `${(b / 1024).toFixed(0)} КБ` : `${b} Б`;

  const columns = [
    { title: 'Название', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Категория', dataIndex: 'category_display', key: 'cat', width: 140, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Файл', key: 'size', width: 90, render: (_: any, r: any) => r.file_size ? formatBytes(r.file_size) : '—' },
    {
      title: '', key: 'actions', width: 140,
      render: (_: any, r: any) => (
        <Space size={4}>
          {r.pdf_file && (
            <Button size="small" icon={<DownloadOutlined />} href={r.pdf_file} target="_blank">PDF</Button>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="📚 Инструкции (Wiki)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Добавить</Button>}>
      <Table dataSource={items} columns={columns} rowKey="id" loading={loading} size="small" pagination={false}
        locale={{ emptyText: 'Нет инструкций. Загрузите первую PDF-инструкцию.' }} />

      <Modal title={editing ? 'Редактировать' : 'Добавить инструкцию'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="Сохранить" cancelText="Отмена" width={500}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div><label>Название *</label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><label>Категория</label>
            <Select value={form.category} onChange={v => setForm({ ...form, category: v })} style={{ width: '100%' }}
              options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v }))} />
          </div>
          <div><label>Описание</label><Input.TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div>
            <label>PDF-файл {!editing && '*'}</label>
            <Upload beforeUpload={f => { setFile(f); return false; }} showUploadList={true} accept=".pdf" maxCount={1}>
              <Button icon={<UploadOutlined />}>{file ? file.name : 'Выбрать файл'}</Button>
            </Upload>
            {editing?.pdf_file && !file && <span style={{ fontSize: 11, color: '#888' }}>Текущий: {editing.pdf_file.split('/').pop()}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={form.is_active} onChange={v => setForm({ ...form, is_active: v })} /> Активна
          </div>
        </Space>
      </Modal>
    </Card>
  );
};

export default InstructionsPage;
