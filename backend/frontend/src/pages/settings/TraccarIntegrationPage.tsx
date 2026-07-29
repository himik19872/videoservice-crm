import React, { useState, useEffect } from 'react';
import { Typography, Card, Form, Input, InputNumber, Switch, Button, message, Spin, Table, Tag, Space, Modal, Popconfirm, Divider, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, LinkOutlined, SyncOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title } = Typography;

interface TraccarSettings {
  id: number;
  server_url: string;
  username: string;
  password: string;
  is_active: boolean;
  sync_interval_minutes: number;
}

interface TraccarDevice {
  id: number;
  master_id: number;
  master_name: string;
  internal_device_id: number;
  unique_id: string;
  device_name: string;
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed: number | null;
  last_update: string | null;
  is_online: boolean;
  created_at: string;
}

const TraccarIntegrationPage: React.FC = () => {
  const [settings, setSettings] = useState<TraccarSettings | null>(null);
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [masters, setMasters] = useState<any[]>([]);
  const [settingsForm] = Form.useForm();
  const [deviceForm] = Form.useForm();

  useEffect(() => {
    fetchSettings();
    fetchDevices();
    fetchMasters();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/traccar/settings/');
      const data = response.data;
      setSettings(data);
      settingsForm.setFieldsValue(data);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await api.get('/traccar/devices/');
      setDevices(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки устройств:', error);
    }
  };

  const fetchMasters = async () => {
    try {
      const response = await api.get('/masters/');
      setMasters(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки мастеров:', error);
    }
  };

  const handleSaveSettings = async (values: any) => {
    setSaving(true);
    try {
      if (settings?.id) {
        await api.put(`/traccar/settings/${settings.id}/`, values);
      } else {
        await api.post('/traccar/settings/', values);
      }
      message.success('Настройки сохранены');
      fetchSettings();
    } catch (error) {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await api.post('/traccar/settings/test_connection/');
      if (response.data.ok) {
        message.success(`Соединение установлено! Статус: ${response.data.status}`);
      } else {
        message.error(`Ошибка соединения: ${response.data.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      message.error('Ошибка проверки соединения');
    } finally {
      setTesting(false);
    }
  };

  const handleAddDevice = async (values: any) => {
    setDeviceLoading(true);
    try {
      await api.post('/traccar/devices/', values);
      message.success('GPS-устройство привязано к мастеру');
      setDeviceModalOpen(false);
      deviceForm.resetFields();
      fetchDevices();
    } catch (error) {
      message.error('Ошибка привязки устройства');
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    try {
      await api.delete(`/traccar/devices/${deviceId}/`);
      message.success('Устройство удалено');
      fetchDevices();
    } catch (error) {
      message.error('Ошибка удаления устройства');
    }
  };

  const handleSyncDevice = async (deviceId: number) => {
    try {
      const response = await api.post(`/traccar/devices/${deviceId}/sync_position/`);
      message.success('Данные синхронизированы');
      fetchDevices();
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'Ошибка синхронизации');
    }
  };

  const deviceColumns = [
    { title: 'Мастер', dataIndex: 'master_name', key: 'master_name', width: 200 },
    { title: 'Traccar ID', dataIndex: 'internal_device_id', key: 'internal_device_id', width: 90 },
    { title: 'IMEI', dataIndex: 'unique_id', key: 'unique_id', width: 130 },
    { title: 'Название', dataIndex: 'device_name', key: 'device_name', width: 140 },
    {
      title: 'Онлайн', dataIndex: 'is_online', key: 'is_online', width: 80,
      render: (online: boolean) => <Tag color={online ? 'green' : 'red'}>{online ? 'Да' : 'Нет'}</Tag>,
    },
    {
      title: 'Скорость', dataIndex: 'last_speed', key: 'last_speed', width: 100,
      render: (s: number | null) => s != null ? `${s} км/ч` : '-',
    },
    {
      title: 'Обновлено', dataIndex: 'last_update', key: 'last_update', width: 170,
      render: (d: string | null) => d ? new Date(d).toLocaleString('ru-RU') : '-',
    },
    {
      title: 'Действия', key: 'actions', width: 120,
      render: (_: any, record: TraccarDevice) => (
        <Space>
          <Button size="small" icon={<SyncOutlined />} onClick={() => handleSyncDevice(record.id)} title="Синхронизировать" />
          <Popconfirm title="Удалить привязку?" onConfirm={() => handleDeleteDevice(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={3}>Настройки интеграции с Traccar GPS</Title>

      {/* Настройки сервера */}
      <Card title="Сервер Traccar" style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={<LinkOutlined />} onClick={handleTestConnection} loading={testing}>
              Проверить соединение
            </Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => settingsForm.submit()} loading={saving}>
              Сохранить настройки
            </Button>
          </Space>
        }
      >
        <Form form={settingsForm} layout="vertical" onFinish={handleSaveSettings}>
          <Form.Item name="server_url" label="URL сервера" rules={[{ required: true, message: 'Введите URL' }]}
            extra="Например: http://traccar.example.com:8082">
            <Input placeholder="http://traccar.example.com:8082" />
          </Form.Item>

          <Form.Item name="username" label="Логин (email)" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input placeholder="admin@example.com" />
          </Form.Item>

          <Form.Item name="password" label="Пароль">
            <Input.Password placeholder="Пароль от Traccar" />
          </Form.Item>

          <Space size="large">
            <Form.Item name="is_active" label="Интеграция активна" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="sync_interval_minutes" label="Интервал синхронизации (мин)">
              <InputNumber min={1} max={60} />
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Divider />

      {/* GPS-устройства мастеров */}
      <Card title="GPS-устройства мастеров"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDeviceModalOpen(true)}>
            Привязать устройство
          </Button>
        }
      >
        <Table columns={deviceColumns} dataSource={devices} rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `Всего: ${total}` }}
          locale={{ emptyText: 'Нет привязанных устройств' }}
        />
      </Card>

      {/* Модалка добавления устройства */}
      <Modal title="Привязать GPS-устройство" open={deviceModalOpen}
        onCancel={() => { setDeviceModalOpen(false); deviceForm.resetFields(); }}
        footer={null}
      >
        <Form form={deviceForm} layout="vertical" onFinish={handleAddDevice}>
          <Form.Item name="master_id" label="Мастер" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Выберите мастера"
              optionFilterProp="label"
              options={masters.map((m: any) => ({ value: m.id, label: m.full_name || m.user?.username }))}
            />
          </Form.Item>
          <Form.Item name="unique_id" label="IMEI устройства" rules={[{ required: true, message: 'Введите IMEI' }]}
            extra="Бэкенд сам найдёт внутренний ID в Traccar">
            <Input placeholder="9170149321" />
          </Form.Item>
          <Form.Item name="device_name" label="Название устройства">
            <Input placeholder="Например: Трекер Иванова" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={deviceLoading} block>
              Привязать
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TraccarIntegrationPage;
