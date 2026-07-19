import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, InputNumber, message, Select, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { BuildingEntrance } from '../types';

const { Title } = Typography;

const EntrancesPage: React.FC = () => {
  const [entrances, setEntrances] = useState<BuildingEntrance[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingEntrance | null>(null);
  const [form] = Form.useForm();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [buildingSearch, setBuildingSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [er, br] = await Promise.all([
        api.get('/entrances/'),
        api.get('/buildings/', { params: { page_size: 2000 } }),
      ]);
      setEntrances(er.data.results || er.data);
      setBuildings(br.data.results || br.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (rec: BuildingEntrance) => { setEditing(rec); form.setFieldsValue(rec); setModalOpen(true); };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/entrances/${id}/`); message.success('Удалён'); fetchData(); }
    catch (e) { message.error('Ошибка'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) { await api.patch(`/entrances/${editing.id}/`, values); message.success('Обновлён'); }
      else { await api.post('/entrances/', values); message.success('Создан'); }
      setModalOpen(false); fetchData();
    } catch (e) { message.error('Ошибка сохранения'); }
  };

  const columns = [
    { title: 'Дом', key: 'building', width: 280, ellipsis: true,
      render: (_: any, rec: BuildingEntrance) => {
        if (rec.building_address) return rec.building_address;
        const b = buildings.find(b => b.id === rec.building);
        return b ? `${b.street_name}, д. ${b.house_number}${b.building_number ? ' корп. ' + b.building_number : ''}` : `Дом #${rec.building}`;
      }
    },
    { title: 'Подъезд №', dataIndex: 'number', key: 'number', width: 90 },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip', width: 130, ellipsis: true },
    { title: 'Код доступа', dataIndex: 'access_code', key: 'access_code', width: 110,
      render: (c: string) => c ? <Tag color="green">{c}</Tag> : ''
    },
    { title: 'Код прогр.', dataIndex: 'programming_code', key: 'prog_code', width: 100,
      render: (c: string) => c ? <Tag color="orange">{c}</Tag> : ''
    },
    { title: 'Кв. с', dataIndex: 'apartment_from', key: 'from', width: 70, align: 'right' as const },
    { title: 'Кв. по', dataIndex: 'apartment_to', key: 'to', width: 70, align: 'right' as const },
    { title: 'Кол-во кв.', dataIndex: 'apartments_count', key: 'count', width: 90, align: 'right' as const },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, rec: BuildingEntrance) => (
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
        <Title level={3} style={{ margin: 0 }}>🚪 Подъезды домов</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
      </Space>

      <Card>
        <Table columns={columns} dataSource={entrances} rowKey="id" loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }} size="small" />
      </Card>

      <Modal title={editing ? 'Редактировать подъезд' : 'Новый подъезд'} open={modalOpen}
        onCancel={() => setModalOpen(false)} footer={null} width={450}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="building" label="Дом" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Выберите дом"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={buildings.map((b: any) => ({
                label: `${b.street_name}, д. ${b.house_number}${b.building_number ? ' корп. ' + b.building_number : ''} (${b.city})`,
                value: b.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="number" label="Номер подъезда" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ip_address" label="IP-адрес панели">
            <Input placeholder="10.80.0.20" />
          </Form.Item>
          <Form.Item name="access_code" label="Код открытия двери">
            <Input placeholder="77780" />
          </Form.Item>
          <Form.Item name="programming_code" label="Код программирования ключей">
            <Input placeholder="18684" />
          </Form.Item>
          <Form.Item name="apartment_from" label="Квартиры с №">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="apartment_to" label="Квартиры по №">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="apartments_count" label="Кол-во квартир">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default EntrancesPage;
