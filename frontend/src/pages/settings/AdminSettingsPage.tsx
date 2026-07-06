import React, { useState, useEffect } from 'react';
import { Typography, Card, Tabs, Table, Button, Form, Input, Select, Switch, message, Popconfirm, Space, Tag, Modal, InputNumber, Divider, Checkbox } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, DatabaseOutlined, CameraOutlined, UserOutlined, CloudUploadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Text, Title } = Typography;

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
  { value: 'clerk', label: '📁 Делопроизводитель' },
  { value: 'accountant', label: '🧮 Бухгалтер' },
  { value: 'cashier', label: '💵 Кассир' },
  { value: 'secretary', label: '📞 Секретарь' },
];

// Группы прав
const PERMISSION_GROUPS = [
  {
    key: 'orders',
    label: 'Заявки',
    permissions: [
      { key: 'orders_view_all', label: 'Видеть все заявки' },
      { key: 'orders_create', label: 'Создавать заявки' },
      { key: 'orders_edit', label: 'Редактировать заявки' },
      { key: 'orders_assign', label: 'Назначать мастеров' },
      { key: 'orders_confirm', label: 'Подтверждать выполнение' },
      { key: 'orders_delete', label: 'Удалять заявки' },
    ],
  },
  {
    key: 'clients',
    label: 'Клиенты',
    permissions: [
      { key: 'clients_view', label: 'Просмотр клиентов' },
      { key: 'clients_create', label: 'Создание клиентов' },
      { key: 'clients_edit', label: 'Редактирование клиентов' },
      { key: 'clients_delete', label: 'Удаление клиентов' },
    ],
  },
  {
    key: 'masters',
    label: 'Мастера',
    permissions: [
      { key: 'masters_view', label: 'Просмотр мастеров' },
      { key: 'masters_manage', label: 'Управление мастерами' },
    ],
  },
  {
    key: 'equipment',
    label: 'Оборудование и склад',
    permissions: [
      { key: 'equipment_view', label: 'Просмотр оборудования' },
      { key: 'equipment_manage', label: 'Управление оборудованием' },
      { key: 'inventory_view', label: 'Просмотр склада' },
      { key: 'inventory_manage', label: 'Управление складом' },
    ],
  },
  {
    key: 'finance',
    label: 'Финансы',
    permissions: [
      { key: 'payments_view', label: 'Просмотр оплат' },
      { key: 'payments_manage', label: 'Приём оплат' },
      { key: 'salary_view', label: 'Просмотр зарплат' },
      { key: 'salary_manage', label: 'Управление зарплатами' },
      { key: 'reports_view', label: 'Просмотр отчётов' },
      { key: 'finance_export', label: 'Экспорт финансов' },
    ],
  },
  {
    key: 'settings',
    label: 'Настройки',
    permissions: [
      { key: 'users_manage', label: 'Управление пользователями' },
      { key: 'settings_system', label: 'Системные настройки' },
      { key: 'settings_traccar', label: 'Настройки GPS (Traccar)' },
      { key: 'settings_max', label: 'Настройки Max-бота' },
    ],
  },
  {
    key: 'buildings',
    label: 'Адреса и дома',
    permissions: [
      { key: 'buildings_view', label: 'Просмотр домов' },
      { key: 'buildings_manage', label: 'Управление домами' },
    ],
  },
];

// Базовые права по ролям
const BASE_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)),
  dispatcher: ['orders_view_all', 'orders_create', 'orders_edit', 'orders_assign', 'orders_confirm',
    'clients_view', 'clients_create', 'clients_edit', 'clients_delete',
    'masters_view', 'equipment_view', 'inventory_view',
    'payments_view', 'payments_manage',
    'buildings_view', 'buildings_manage'],
  master: ['orders_view_all', 'orders_edit'],
  installer: ['orders_view_all', 'orders_edit'],
  engineer: ['orders_view_all', 'orders_edit', 'equipment_view'],
  chief_engineer: ['orders_view_all', 'orders_edit', 'orders_assign', 'equipment_view', 'equipment_manage', 'inventory_view', 'clients_view'],
  supervisor: ['orders_view_all', 'orders_edit', 'orders_assign', 'orders_confirm', 'clients_view', 'masters_view', 'equipment_view', 'inventory_view', 'buildings_view'],
  tech_director: ['orders_view_all', 'orders_edit', 'orders_assign', 'orders_confirm', 'clients_view', 'masters_view', 'masters_manage', 'equipment_view', 'equipment_manage', 'inventory_view', 'inventory_manage', 'payments_view', 'salary_view', 'reports_view', 'buildings_view', 'buildings_manage'],
  executive_director: ['orders_view_all', 'orders_confirm', 'clients_view', 'masters_view', 'equipment_view', 'inventory_view', 'payments_view', 'salary_view', 'salary_manage', 'reports_view', 'finance_export', 'buildings_view'],
  general_director: PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)),
  clerk: ['orders_view_all', 'orders_create', 'clients_view', 'clients_create', 'clients_edit', 'equipment_view', 'buildings_view', 'reports_view'],
  accountant: ['orders_view_all', 'payments_view', 'salary_view', 'salary_manage', 'reports_view', 'finance_export', 'clients_view'],
  cashier: ['orders_view_all', 'payments_view', 'payments_manage', 'clients_view'],
  secretary: ['orders_view_all', 'orders_create', 'clients_view', 'clients_create', 'clients_edit', 'masters_view', 'equipment_view', 'inventory_view', 'buildings_view', 'reports_view'],
};

const roleColors: Record<string, string> = {
  admin: 'red', dispatcher: 'blue', master: 'green', installer: 'cyan',
  engineer: 'orange', chief_engineer: 'gold', supervisor: 'purple',
  tech_director: 'magenta', executive_director: 'volcano', general_director: 'red',
  clerk: 'geekblue', accountant: 'lime', cashier: 'gold', secretary: 'purple',
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
      const resp = await api.get('/users/?page_size=200');
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
        permissions: p.permissions || {},
      })));
    } catch (error) { console.error('Ошибка загрузки:', error); }
    finally { setLoading(false); }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'master', is_active: true, permissions: {} });
    setUserModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      username: user.username, password: '',
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, phone: user.phone,
      role: user.role, is_active: user.is_active,
      permissions: user.permissions || {},
    });
    setUserModalOpen(true);
  };

  // Функция для получения эффективных прав (базовые + персональные)
  const getEffectivePermissions = (role: string, customPermissions: Record<string, boolean> = {}) => {
    const base = BASE_ROLE_PERMISSIONS[role] || [];
    const result = new Set(base);
    for (const [key, val] of Object.entries(customPermissions)) {
      if (val === true || val === 'true') result.add(key);
      else if (val === false || val === 'false') result.delete(key);
    }
    return result;
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
        permissions: values.permissions || {},
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
    { title: 'Телефон', dataIndex: 'phone', key: 'ph', width: 130 },
    {
      title: 'Роль', dataIndex: 'role', key: 'role', width: 170,
      render: (r: string) => <Tag color={roleColors[r] || 'default'}>{roleLabels[r] || r}</Tag>,
    },
    {
      title: 'Права', dataIndex: 'permissions', key: 'perms', width: 100,
      render: (_p: any, record: any) => {
        const eff = getEffectivePermissions(record.role, record.permissions);
        const customKeys = Object.keys(record.permissions || {}).filter(k => record.permissions[k] === true);
        const revokedKeys = Object.keys(record.permissions || {}).filter(k => record.permissions[k] === false);
        return (
          <Space size={2} wrap>
            <Tag color="blue">{eff.size} прав</Tag>
            {customKeys.length > 0 && <Tag color="green">+{customKeys.length}</Tag>}
            {revokedKeys.length > 0 && <Tag color="red">-{revokedKeys.length}</Tag>}
          </Space>
        );
      },
    },
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
      <Modal title={editingUser ? 'Редактировать сотрудника' : 'Добавить сотрудника'} open={userModalOpen} onCancel={() => setUserModalOpen(false)} footer={null} width={650}>
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

          <Divider orientation="left" plain style={{ fontSize: 13 }}>🔐 Персональные права (переопределяют базовые права роли)</Divider>
          <Form.Item shouldUpdate={(prev, cur) => prev.role !== cur.role || prev.permissions !== cur.permissions}>
            {({ getFieldValue }: any) => {
              const currentRole = getFieldValue('role');
              const basePerms = BASE_ROLE_PERMISSIONS[currentRole] || [];
              const customPerms: Record<string, boolean> = getFieldValue('permissions') || {};

              return (
                <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.key} style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{group.label}</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {group.permissions.map(perm => {
                          const isInBase = basePerms.includes(perm.key);
                          const isCustom = customPerms[perm.key] !== undefined;
                          const isEnabled = isCustom ? customPerms[perm.key] : isInBase;
                          return (
                            /* @ts-ignore */
                            <Checkbox
                              key={perm.key}
                              checked={isEnabled}
                              onChange={(e) => {
                                const currentPerms = userForm.getFieldValue('permissions') || {};
                                if (e.target.checked === isInBase) {
                                  delete currentPerms[perm.key];
                                } else {
                                  currentPerms[perm.key] = e.target.checked;
                                }
                                userForm.setFieldsValue({ permissions: { ...currentPerms } });
                              }}
                            >
                              <span style={{ fontSize: 11 }}>
                                {perm.label}{isCustom && (isEnabled ? ' ✅' : ' ❌')}
                              </span>
                            </Checkbox>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <Text type="secondary" style={{ fontSize: 10, marginTop: 4, display: 'block' }}>
                    🟢 зелёная рамка = расширенное право &nbsp; 🔴 красная рамка = отозванное право &nbsp; ✅/❌ = персональная настройка
                  </Text>
                </div>
              );
            }}
          </Form.Item>

          <Button type="primary" htmlType="submit" block style={{ marginTop: 8 }}>{editingUser ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;
