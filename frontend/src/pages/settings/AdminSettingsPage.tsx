import React, { useState, useEffect } from 'react';
import { Typography, Card, Tabs, Table, Button, Form, Input, Select, Switch, message, Popconfirm, Space, Tag, Modal, InputNumber } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, DatabaseOutlined, CameraOutlined, UserOutlined, CloudUploadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title } = Typography;

const ROLE_OPTIONS = [
  { value: 'admin', label: '👑 Администратор' },
  { value: 'dispatcher', label: '📋 Диспетчер' },
  { value: 'master', label: '🔧 Мастер' },
  { value: 'installer', label: '🏗️ Монтажник' },
  { value: 'engineer', label: '🛠️ Инженер' },
  { value: 'chief_engineer', label: '⭐ Главный инженер' },
  { value: 'supervisor', label: '👁️ Начальник сервисной службы' },
  { value: 'tech_director', label: '🔬 Технический директор' },
  { value: 'executive_director', label: '💼 Исполнительный директор' },
  { value: 'general_director', label: '🏢 Генеральный директор' },
];

const roleColors: Record<string, string> = {
  admin: 'red', dispatcher: 'blue', master: 'green', installer: 'cyan',
  engineer: 'orange', chief_engineer: 'gold', supervisor: 'purple',
  tech_director: 'magenta', executive_director: 'volcano', general_director: 'red',
};
const roleLabels: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label]));

const AdminSettingsPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm] = Form.useForm();

  const [backupSettings, setBackupSettings] = useState({ auto_backup: false, backup_time: '03:00', backup_keep_days: 30, backup_path: '/var/backups/crm/' });
  const [mediaSettings, setMediaSettings] = useState({ media_max_size_mb: 50, media_allowed_types: 'jpg,jpeg,png,mp4,mov,avi', media_storage_path: '/var/media/crm/', media_retention_days: 90 });

  useEffect(() => { fetchUsers(); fetchSystemSettings(); }, []);

  const fetchSystemSettings = async () => {
    try {
      const { data } = await api.get('/system-settings/');
      if (data) {
        setBackupSettings({ auto_backup: data.auto_backup || false, backup_time: data.backup_time || '03:00', backup_keep_days: data.backup_keep_days || 30, backup_path: data.backup_path || '/var/backups/crm/' });
        setMediaSettings({ media_max_size_mb: data.media_max_size_mb || 50, media_allowed_types: data.media_allowed_types || 'jpg,jpeg,png,mp4,mov,avi', media_storage_path: data.media_storage_path || '/var/media/crm/', media_retention_days: data.media_retention_days || 90 });
      }
    } catch (e) { console.error('Ошибка загрузки настроек:', e); }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/users/');
      const data = resp.data.results || resp.data;
      setUsers(data.map((p: any) => ({
        id: p.id,
        user_id: p.user?.id,
        username: p.user?.username || '',
        email: p.user?.email || '',
        first_name: p.user?.first_name || '',
        last_name: p.user?.last_name || '',
        role: p.role,
        phone: p.phone || '',
        is_active: p.is_on_shift !== undefined ? p.is_on_shift : true,
      })));
    } catch (error) { console.error('Ошибка загрузки:', error); }
    finally { setLoading(false); }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'master', is_active: true });
    setUserModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    userForm.setFieldsValue({ username: user.username, password: '', first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone, role: user.role, is_active: user.is_active });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (values: any) => {
    try {
      const payload: any = {
        role: values.role,
        phone: values.phone || '',
        is_on_shift: values.is_active,
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || '',
      };
      if (values.password) payload.password = values.password;

      if (editingUser) {
        await api.put(`/users/${editingUser.id}/`, payload);
        message.success('Сотрудник обновлён');
      } else {
        await api.post('/users/', { ...payload, password: values.password || 'temp123' });
        message.success('Сотрудник создан');
      }
      setUserModalOpen(false);
      fetchUsers();
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Ошибка сохранения'); }
  };

  const handleDeleteUser = async (user: any) => {
    try {
      await api.delete(`/users/${user.id}/`);
      message.success('Сотрудник удалён');
      fetchUsers();
    } catch (e) { message.error('Ошибка удаления'); }
  };

  const handleSaveBackup = async () => {
    try { await api.put('/system-settings/1/', backupSettings); message.success('Настройки бэкапов сохранены'); } catch { message.error('Ошибка'); }
  };
  const handleSaveMedia = async () => {
    try { await api.put('/system-settings/1/', mediaSettings); message.success('Настройки медиа сохранены'); } catch { message.error('Ошибка'); }
  };
  const handleBackupNow = async () => {
    try { const r = await api.post('/system-settings/backup_db/'); message.success(r.data.message || 'Бэкап создан'); } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
  };

  const columns = [
    { title: 'Логин', dataIndex: 'username', key: 'username', width: 120 },
    { title: 'Имя', dataIndex: 'first_name', key: 'fn', width: 100 },
    { title: 'Фамилия', dataIndex: 'last_name', key: 'ln', width: 110 },
    { title: 'Телефон', dataIndex: 'phone', key: 'ph', width: 120 },
    { title: 'Роль', dataIndex: 'role', key: 'role', width: 160, render: (r: string) => <Tag color={roleColors[r] || 'default'}>{roleLabels[r] || r}</Tag> },
    { title: 'Активен', dataIndex: 'is_active', key: 'act', width: 70, render: (a: boolean) => <Tag color={a ? 'green' : 'red'}>{a ? 'Да' : 'Нет'}</Tag> },
    { title: '', key: 'act2', width: 80, render: (_: any, r: any) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)} />
        <Popconfirm title="Удалить?" onConfirm={() => handleDeleteUser(r)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  const tabItems = [
    {
      key: 'users',
      label: <span><UserOutlined /> Сотрудники</span>,
      children: (
        <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Добавить сотрудника</Button>}>
          <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={{ pageSize: 10, showTotal: (t: number) => `Всего: ${t}` }} size="middle" />
        </Card>
      ),
    },
    {
      key: 'backup',
      label: <span><DatabaseOutlined /> Бэкапы</span>,
      children: (
        <Card extra={<Space><Button icon={<CloudUploadOutlined />} onClick={handleBackupNow}>Создать бэкап</Button><Button type="primary" icon={<SaveOutlined />} onClick={handleSaveBackup}>Сохранить</Button></Space>}>
          <Form layout="vertical">
            <Form.Item label="Авто-бэкап"><Switch checked={backupSettings.auto_backup} onChange={v => setBackupSettings({...backupSettings, auto_backup: v})} /></Form.Item>
            <Form.Item label="Время"><Input type="time" value={backupSettings.backup_time} onChange={e => setBackupSettings({...backupSettings, backup_time: e.target.value})} /></Form.Item>
            <Form.Item label="Хранить дней"><InputNumber value={backupSettings.backup_keep_days} style={{width: '100%'}} onChange={v => setBackupSettings({...backupSettings, backup_keep_days: v || 30})} /></Form.Item>
            <Form.Item label="Путь"><Input value={backupSettings.backup_path} onChange={e => setBackupSettings({...backupSettings, backup_path: e.target.value})} /></Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'media',
      label: <span><CameraOutlined /> Медиа</span>,
      children: (
        <Card extra={<Button type="primary" icon={<SaveOutlined />} onClick={handleSaveMedia}>Сохранить</Button>}>
          <Form layout="vertical">
            <Form.Item label="Макс. размер (МБ)"><InputNumber value={mediaSettings.media_max_size_mb} style={{width: '100%'}} onChange={v => setMediaSettings({...mediaSettings, media_max_size_mb: v || 50})} /></Form.Item>
            <Form.Item label="Типы файлов"><Input value={mediaSettings.media_allowed_types} onChange={e => setMediaSettings({...mediaSettings, media_allowed_types: e.target.value})} /></Form.Item>
            <Form.Item label="Путь"><Input value={mediaSettings.media_storage_path} onChange={e => setMediaSettings({...mediaSettings, media_storage_path: e.target.value})} /></Form.Item>
            <Form.Item label="Хранить дней"><InputNumber value={mediaSettings.media_retention_days} style={{width: '100%'}} onChange={v => setMediaSettings({...mediaSettings, media_retention_days: v || 90})} /></Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>👥 Управление сотрудниками</Title>
      <Tabs items={tabItems} />
      <Modal title={editingUser ? 'Редактировать сотрудника' : 'Добавить сотрудника'} open={userModalOpen} onCancel={() => setUserModalOpen(false)} footer={null} width={500}>
        <Form form={userForm} layout="vertical" onFinish={handleSaveUser}>
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label={editingUser ? 'Пароль (оставьте пустым)' : 'Пароль'} rules={editingUser ? [] : [{ required: true, min: 6, message: 'Минимум 6 символов' }]}>
            <Input.Password placeholder={editingUser ? 'Не менять' : 'Минимум 6 символов'} /></Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="first_name" label="Имя"><Input /></Form.Item>
            <Form.Item name="last_name" label="Фамилия"><Input /></Form.Item>
          </Space>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked"><Switch /></Form.Item>
          <Button type="primary" htmlType="submit" block>{editingUser ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;
