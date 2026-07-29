import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, message, Select, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { BewardDevice } from '../types';

const { Title } = Typography;

const BewardDevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<BewardDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BewardDevice | null>(null);
  const [form] = Form.useForm();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [entrances, setEntrances] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dr, br, er] = await Promise.all([
        api.get('/beward-devices/'),
        api.get('/buildings/'),
        api.get('/entrances/'),
      ]);
      setDevices(dr.data.results || dr.data);
      setBuildings(br.data.results || br.data);
      setEntrances(er.data.results || er.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (rec: BewardDevice) => { setEditing(rec); form.setFieldsValue(rec); setModalOpen(true); };

  const handleExport = async () => {
    try {
      const res = await api.get('/beward-devices/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'beward_full_export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Файл скачан');
    } catch (e) {
      message.error('Ошибка экспорта');
    }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/beward-devices/${id}/`); message.success('Удалён'); fetchData(); }
    catch (e) { message.error('Ошибка'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await api.patch(`/beward-devices/${editing.id}/`, values);
        message.success('Обновлён');
      } else {
        await api.post('/beward-devices/', values);
        message.success('Создан');
      }
      setModalOpen(false); fetchData();
    } catch (e: any) {
      const err = e?.response?.data;
      const msg = typeof err === 'object' ? JSON.stringify(err) : (err || 'Ошибка сохранения');
      message.error(msg);
    }
  };

  const filtered = devices.filter(d => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (d.ip_address || '').toLowerCase().includes(q)
      || (d.address || '').toLowerCase().includes(q)
      || (d.region || '').toLowerCase().includes(q)
      || (d.notes || '').toLowerCase().includes(q)
      || (d.access_code || '').toLowerCase().includes(q);
  });

  const columns = [
    { title: 'IP', dataIndex: 'ip_address', key: 'ip', width: 135, fixed: 'left' as const,
      render: (ip: string) => <Tag color="blue">{ip}</Tag>
    },
    { title: 'Район', dataIndex: 'region', key: 'region', width: 110, ellipsis: true },
    { title: 'Адрес', dataIndex: 'address', key: 'address', width: 300, ellipsis: true },
    { title: 'Под.', dataIndex: 'entrance_number', key: 'entrance_number', width: 55 },
    { title: 'Код доступа', dataIndex: 'access_code', key: 'access_code', width: 105,
      render: (c: string) => c ? <Tag color="green">{c}</Tag> : ''
    },
    { title: 'Код прогр.', dataIndex: 'programming_code', key: 'prog_code', width: 95,
      render: (c: string) => c ? <Tag color="orange">{c}</Tag> : ''
    },
    { title: 'Квартиры', dataIndex: 'apartment_range', key: 'apartments', width: 90 },
    { title: 'Примечания', dataIndex: 'notes', key: 'notes', ellipsis: true, width: 180 },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, rec: BewardDevice) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(rec.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>🔐 Панели Beward (справочник IP)</Title>
        <Space>
          <Input
            placeholder="Поиск по IP, адресу, коду..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Экспорт Excel</Button>
        </Space>
      </Space>

      <Card>
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
          size="small"
          scroll={{ x: 1200 }}
          locale={{ emptyText: 'Нет данных' }}
        />
      </Card>

      <Modal
        title={editing ? 'Редактировать панель Beward' : 'Новая панель Beward'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="ip_address" label="IP-адрес" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input placeholder="10.80.0.20" />
          </Form.Item>
          <Form.Item name="region" label="Район">
            <Input placeholder="Колпино" />
          </Form.Item>
          <Form.Item name="address" label="Адрес">
            <Input placeholder="Санкт-Петербург, ..." />
          </Form.Item>
          <Form.Item name="entrance_number" label="Номер подъезда">
            <Input placeholder="1" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="access_code" label="Код открытия двери">
              <Input placeholder="77780" />
            </Form.Item>
            <Form.Item name="programming_code" label="Код программирования ключей">
              <Input placeholder="18684" />
            </Form.Item>
            <Form.Item name="door_opening_code" label="Код открытия (доп.)">
              <Input placeholder="" />
            </Form.Item>
          </Space>
          <Form.Item name="apartment_range" label="Нумерация квартир">
            <Input placeholder="1-36" />
          </Form.Item>
          <Form.Item name="building" label="Привязанный дом">
            <Select
              allowClear
              showSearch
              placeholder="Выберите дом"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={buildings.map((b: any) => ({
                label: `${b.street_name}, д. ${b.house_number}${b.building_number ? ' корп. ' + b.building_number : ''} (${b.city})`,
                value: b.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="entrance" label="Привязанный подъезд">
            <Select
              allowClear
              showSearch
              placeholder="Выберите подъезд"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={entrances.map((e: any) => ({
                label: `${e.building_address || 'Дом #' + e.building}, под. ${e.number} (кв. ${e.apartment_from}–${e.apartment_to})`,
                value: e.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large">
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default BewardDevicesPage;
