import React, { useState, useEffect } from 'react';
import { Typography, Card, Tabs, Table, Button, Form, Input, Select, Switch, message, Spin, Popconfirm, Space, Tag, Modal, InputNumber, Statistic, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, DatabaseOutlined, CameraOutlined, UserOutlined, CloudUploadOutlined, PlayCircleOutlined, StopOutlined, BarChartOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title } = Typography;

const AdminSettingsPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm] = Form.useForm();

  // Backup settings — загружаем из API
  const [backupSettings, setBackupSettings] = useState({
    auto_backup: false,
    backup_time: '03:00',
    backup_keep_days: 30,
    backup_path: '/var/backups/crm/',
  });

  // Media settings
  const [mediaSettings, setMediaSettings] = useState({
    media_max_size_mb: 50,
    media_allowed_types: 'jpg,jpeg,png,mp4,mov,avi',
    media_storage_path: '/var/media/crm/',
    media_retention_days: 90,
  });

  useEffect(() => {
    fetchUsers();
    fetchSystemSettings();
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const resp = await api.get('/system-settings/');
      const data = resp.data;
      if (data) {
        setBackupSettings({
          auto_backup: data.auto_backup || false,
          backup_time: data.backup_time || '03:00',
          backup_keep_days: data.backup_keep_days || 30,
          backup_path: data.backup_path || '/var/backups/crm/',
        });
        setMediaSettings({
          media_max_size_mb: data.media_max_size_mb || 50,
          media_allowed_types: data.media_allowed_types || 'jpg,jpeg,png,mp4,mov,avi',
          media_storage_path: data.media_storage_path || '/var/media/crm/',
          media_retention_days: data.media_retention_days || 90,
        });
      }
    } catch (e) {
      console.error('Ошибка загрузки настроек:', e);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Получаем всех пользователей через API
      const [mastersRes] = await Promise.all([
        api.get('/masters/'),
      ]);
      // Собираем пользователей из мастеров + админов
      const masters = mastersRes.data.results || mastersRes.data;
      const usersList: any[] = [];

      for (const m of masters) {
        if (m.user) {
          usersList.push({
            id: m.id,
            type: 'master',
            user_id: m.user.id,
            username: m.user.username,
            email: m.user.email,
            first_name: m.user.first_name,
            last_name: m.user.last_name,
            role: m.user.role || 'master',
            is_active: m.is_available,
            phone: m.phone,
            region: m.region?.name,
          });
        }
      }

      setUsers(usersList);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      is_active: user.is_active,
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (values: any) => {
    try {
      if (editingUser?.type === 'master' && editingUser?.id) {
        await api.put(`/masters/${editingUser.id}/`, {
          phone: values.phone,
          is_available: values.is_active,
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email || '',
          username: values.username,
          password: values.password || undefined,
        });
        message.success('Пользователь обновлён');
        setUserModalOpen(false);
        fetchUsers();
      }
    } catch (error) {
      message.error('Ошибка сохранения');
    }
  };

  const handleDeleteUser = async (user: any) => {
    try {
      if (user.type === 'master') {
        await api.delete(`/masters/${user.id}/`);
      }
      message.success('Пользователь удалён');
      fetchUsers();
    } catch (error) {
      message.error('Ошибка удаления');
    }
  };

  const handleSaveBackupSettings = async () => {
    try {
      await api.put('/system-settings/1/', backupSettings);
      message.success('Настройки бэкапов сохранены');
    } catch (e) {
      message.error('Ошибка сохранения');
    }
  };

  const handleSaveMediaSettings = async () => {
    try {
      await api.put('/system-settings/1/', mediaSettings);
      message.success('Настройки медиа сохранены');
    } catch (e) {
      message.error('Ошибка сохранения');
    }
  };

  const handleBackupNow = async () => {
    try {
      const resp = await api.post('/system-settings/backup_db/');
      message.success(resp.data.message || 'Бэкап создан');
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка бэкапа');
    }
  };

  const userColumns = [
    { title: 'Логин', dataIndex: 'username', key: 'username', width: 130 },
    { title: 'Имя', dataIndex: 'first_name', key: 'first_name', width: 100 },
    { title: 'Фамилия', dataIndex: 'last_name', key: 'last_name', width: 120 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 180 },
    { title: 'Телефон', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: 'Роль', dataIndex: 'role', key: 'role', width: 100,
      render: (r: string) => {
        const colors: Record<string, string> = { admin: 'red', dispatcher: 'blue', master: 'green' };
        const labels: Record<string, string> = { admin: 'Админ', dispatcher: 'Диспетчер', master: 'Мастер' };
        return <Tag color={colors[r] || 'default'}>{labels[r] || r}</Tag>;
      },
    },
    {
      title: 'Активен', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: (a: boolean) => <Tag color={a ? 'green' : 'red'}>{a ? 'Да' : 'Нет'}</Tag>,
    },
    {
      title: 'Действия', key: 'actions', width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditUser(record)} />
          <Popconfirm title="Удалить пользователя?" onConfirm={() => handleDeleteUser(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'users',
      label: <span><UserOutlined /> Пользователи</span>,
      children: (
        <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/masters/create')}>Добавить мастера</Button>}>
          <Table columns={userColumns} dataSource={users} rowKey="id" loading={loading}
            pagination={{ pageSize: 10, showTotal: (t) => `Всего: ${t}` }} />
        </Card>
      ),
    },
    {
      key: 'backup',
      label: <span><DatabaseOutlined /> Резервное копирование</span>,
      children: (
        <Card extra={
          <Space>
            <Button icon={<CloudUploadOutlined />} onClick={handleBackupNow}>Создать бэкап сейчас</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveBackupSettings}>Сохранить</Button>
          </Space>
        }>
          <Form layout="vertical">
            <Form.Item label="Автоматическое резервное копирование">
              <Switch checked={backupSettings.auto_backup} onChange={(v) => setBackupSettings({ ...backupSettings, auto_backup: v })} />
            </Form.Item>
            <Form.Item label="Время бэкапа">
              <Input type="time" value={backupSettings.backup_time}
                onChange={(e) => setBackupSettings({ ...backupSettings, backup_time: e.target.value })} />
            </Form.Item>
            <Form.Item label="Хранить дней">
              <InputNumber value={backupSettings.backup_keep_days} style={{ width: '100%' }}
                onChange={(v) => setBackupSettings({ ...backupSettings, backup_keep_days: v || 30 })} />
            </Form.Item>
            <Form.Item label="Путь для бэкапов">
              <Input value={backupSettings.backup_path}
                onChange={(e) => setBackupSettings({ ...backupSettings, backup_path: e.target.value })} />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'media',
      label: <span><CameraOutlined /> Фото/видео отчёты</span>,
      children: (
        <Card extra={<Button type="primary" icon={<SaveOutlined />} onClick={handleSaveMediaSettings}>Сохранить</Button>}>
          <Form layout="vertical">
            <Form.Item label="Максимальный размер файла (МБ)">
              <InputNumber value={mediaSettings.media_max_size_mb} style={{ width: '100%' }}
                onChange={(v) => setMediaSettings({ ...mediaSettings, media_max_size_mb: v || 50 })} />
            </Form.Item>
            <Form.Item label="Разрешённые типы файлов">
              <Input value={mediaSettings.media_allowed_types}
                onChange={(e) => setMediaSettings({ ...mediaSettings, media_allowed_types: e.target.value })} />
            </Form.Item>
            <Form.Item label="Путь хранения">
              <Input value={mediaSettings.media_storage_path}
                onChange={(e) => setMediaSettings({ ...mediaSettings, media_storage_path: e.target.value })} />
            </Form.Item>
            <Form.Item label="Хранить дней">
              <InputNumber value={mediaSettings.media_retention_days} style={{ width: '100%' }}
                onChange={(v) => setMediaSettings({ ...mediaSettings, media_retention_days: v || 90 })} />
            </Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Настройки системы</Title>
      <Tabs items={tabItems} />

      <Modal title="Редактировать пользователя" open={userModalOpen}
        onCancel={() => setUserModalOpen(false)} footer={null} width={500}>
        <Form form={userForm} layout="vertical" onFinish={handleSaveUser}>
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Новый пароль (оставьте пустым)">
            <Input.Password placeholder="Не менять" />
          </Form.Item>
          <Form.Item name="first_name" label="Имя"><Input /></Form.Item>
          <Form.Item name="last_name" label="Фамилия"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Сохранить</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;
