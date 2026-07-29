import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Typography, Card, message, Modal, Form, Input, Select, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

interface Dispatcher {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  role: string;
  phone: string;
  is_on_shift: boolean;
}

const DispatchersPage: React.FC = () => {
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchDispatchers();
  }, []);

  const fetchDispatchers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/?role=dispatcher');
      setDispatchers(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки диспетчеров');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ role: 'dispatcher' });
    setModalOpen(true);
  };

  const openEdit = (dispatcher: Dispatcher) => {
    setEditingId(dispatcher.id);
    form.setFieldsValue({
      username: dispatcher.user.username,
      password: '',
      first_name: dispatcher.user.first_name,
      last_name: dispatcher.user.last_name,
      email: dispatcher.user.email || '',
      phone: dispatcher.phone,
      role: dispatcher.role,
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const payload: any = {
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || '',
        phone: values.phone,
        role: values.role,
      };
      if (values.password) {
        payload.password = values.password;
      }

      if (editingId) {
        await api.put(`/users/${editingId}/`, payload);
        message.success('Диспетчер обновлён');
      } else {
        await api.post('/users/', { ...payload, password: values.password || 'dispatcher123' });
        message.success('Диспетчер создан');
      }
      setModalOpen(false);
      fetchDispatchers();
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.response?.data?.detail || 'Ошибка';
      message.error(typeof msg === 'string' ? msg : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/users/${id}/`);
      message.success('Диспетчер удалён');
      fetchDispatchers();
    } catch (error) {
      message.error('Ошибка удаления');
    }
  };

  const columns = [
    {
      title: 'Логин',
      key: 'username',
      width: 130,
      render: (_: any, r: Dispatcher) => r.user?.username || '-',
    },
    {
      title: 'Имя',
      key: 'name',
      width: 180,
      render: (_: any, r: Dispatcher) => `${r.user?.first_name || ''} ${r.user?.last_name || ''}`.trim() || '-',
    },
    {
      title: 'Email',
      key: 'email',
      width: 200,
      render: (_: any, r: Dispatcher) => r.user?.email || '-',
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'gold' : role === 'dispatcher' ? 'blue' : 'green'}>{role}</Tag>
      ),
    },
    {
      title: 'На смене',
      dataIndex: 'is_on_shift',
      key: 'is_on_shift',
      width: 100,
      render: (on: boolean) => <Tag color={on ? 'green' : 'default'}>{on ? 'Да' : 'Нет'}</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_: any, r: Dispatcher) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить диспетчера?" onConfirm={() => handleDelete(r.id)} okText="Да" cancelText="Нет">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Диспетчеры</Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Добавить диспетчера
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={dispatchers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Диспетчеров пока нет' }}
        />
      </Card>

      <Modal
        title={editingId ? 'Редактировать диспетчера' : 'Добавить диспетчера'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input placeholder="Логин" disabled={!!editingId} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingId ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
            rules={editingId ? [] : [{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password placeholder="Пароль" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="first_name" label="Имя">
                <Input placeholder="Имя" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Фамилия">
                <Input placeholder="Фамилия" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email">
            <Input placeholder="Email" />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input placeholder="Телефон" />
          </Form.Item>
          <Form.Item name="role" label="Роль">
            <Select>
              <Select.Option value="dispatcher">Диспетчер</Select.Option>
              <Select.Option value="admin">Администратор</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button icon={<CloseOutlined />} onClick={() => setModalOpen(false)}>Отмена</Button>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                {editingId ? 'Сохранить' : 'Создать'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DispatchersPage;
