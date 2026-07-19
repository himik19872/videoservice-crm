import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Table, Button, Space, Tag, message, Popconfirm,
  Modal, Form, Input, Select, Tabs, Descriptions, Divider, List,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined,
  FileTextOutlined, ToolOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const LEGAL_TYPES: Record<string, string> = {
  uk_tszh: 'УК / ТСЖ', developer: 'Застройщик', contractor: 'Подрядчик',
  partner: 'Партнёр', independent: 'Самостоятельное', other: 'Другое',
};
const LEGAL_COLORS: Record<string, string> = {
  uk_tszh: 'purple', developer: 'blue', contractor: 'orange',
  partner: 'cyan', independent: 'green', other: 'default',
};

const LegalEntitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients/?is_legal=true');
      setClients(res.data.results || res.data || []);
    } catch { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (rec: any) => { setEditing(rec); form.setFieldsValue(rec); setModalOpen(true); };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/clients/${id}/`); message.success('Удалён'); fetchData(); }
    catch { message.error('Ошибка'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      values.is_legal = true;
      if (editing) { await api.patch(`/clients/${editing.id}/`, values); message.success('Обновлён'); }
      else { await api.post('/clients/', values); message.success('Создан'); }
      setModalOpen(false); fetchData();
    } catch { message.error('Ошибка сохранения'); }
  };

  const columns = [
    { title: 'Название', dataIndex: 'full_name', key: 'name', width: 250, ellipsis: true,
      render: (n: string, r: any) => <Link to={`/clients/${r.id}`}>{n}</Link> },
    { title: 'ИНН', dataIndex: 'inn', key: 'inn', width: 130 },
    { title: 'Тип', dataIndex: 'legal_type', key: 'lt', width: 150,
      render: (t: string) => t ? <Tag color={LEGAL_COLORS[t] || 'default'}>{LEGAL_TYPES[t] || t}</Tag> : '' },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 180, ellipsis: true },
    { title: 'Адрес', dataIndex: 'legal_address', key: 'addr', ellipsis: true, width: 250 },
    {
      title: '', key: 'act', width: 100,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>🏢 Юридические лица</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
      </Space>

      <Card>
        <Table columns={columns} dataSource={clients} rowKey="id" loading={loading}
          size="small" pagination={{ pageSize: 30, showSizeChanger: true }}
          locale={{ emptyText: 'Нет юрлиц. Добавьте первое через кнопку «Добавить».' }}
        />
      </Card>

      <Modal title={editing ? 'Редактировать юрлицо' : 'Новое юрлицо'} open={modalOpen}
        onCancel={() => setModalOpen(false)} footer={null} width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="full_name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="legal_type" label="Тип юрлица">
            <Select allowClear placeholder="Выберите тип"
              options={Object.entries(LEGAL_TYPES).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Space>
            <Form.Item name="inn" label="ИНН"><Input maxLength={12} style={{ width: 180 }} /></Form.Item>
            <Form.Item name="kpp" label="КПП"><Input maxLength={9} style={{ width: 150 }} /></Form.Item>
            <Form.Item name="ogrn" label="ОГРН"><Input maxLength={15} style={{ width: 180 }} /></Form.Item>
          </Space>
          <Form.Item name="legal_address" label="Юридический адрес"><Input /></Form.Item>
          <Form.Item name="director_name" label="ФИО руководителя"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default LegalEntitiesPage;
