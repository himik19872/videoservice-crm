import React, { useState, useEffect } from 'react';
import { Typography, Card, Tabs, Table, Button, Form, Input, Select, Switch, message, Popconfirm, Space, Tag, Modal, InputNumber, Divider, Checkbox } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, DatabaseOutlined, CameraOutlined, UserOutlined, CloudUploadOutlined, QrcodeOutlined, ReloadOutlined, KeyOutlined, BellOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { Text, Title } = Typography;

/** Адрес сервера, с которого открыта CRM (домен/IP + порт) */
const getServerAddress = () => ({
  host: window.location.hostname,
  port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80'),
});

/** Сложный пароль: 12 символов, буквы/цифры/спецсимволы (без похожих O/0, l/1) */
const generatePassword = (length = 12): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#%*?-_';
  const all = upper + lower + digits + special;

  const rand = (max: number) => {
    const buf = new Uint8Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  const pick = (set: string) => set[rand(set.length)];

  // гарантируем по одному символу каждого класса
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(all));

  // перемешиваем
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/** Пейлоад QR-кода для мобильного приложения */
const buildConnectPayload = (user: any): string => {
  const { host, port } = getServerAddress();
  const payload: any = {
    app: 'vscrm',
    host,
    port,
    user: user?.username || '',
  };
  // Пароль попадает в QR только сразу после создания/смены пароля
  if (user?.__password) payload.pass = user.__password;
  return JSON.stringify(payload);
};

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
      { key: 'companies_view', label: 'Просмотр УК/ТСЖ' },
      { key: 'companies_manage', label: 'Управление УК/ТСЖ' },
      { key: 'tariffs_view', label: 'Просмотр тарифов' },
      { key: 'tariffs_manage', label: 'Управление тарифами' },
    ],
  },
  {
    key: 'beward',
    label: 'Справочник Beward',
    permissions: [
      { key: 'beward_view', label: 'Просмотр устройств' },
      { key: 'beward_edit', label: 'Редактирование устройств' },
    ],
  },
  {
    key: 'estimates',
    label: 'Сметы и КП',
    permissions: [
      { key: 'estimates_view', label: 'Просмотр смет' },
      { key: 'estimates_manage', label: 'Создание и редактирование смет' },
      { key: 'estimates_approve', label: 'Согласование смет (ген. директор)' },
      { key: 'estimates_invoice', label: 'Выставление счетов на оплату' },
      { key: 'estimates_payment', label: 'Подтверждение оплаты по счёту' },
      { key: 'estimates_work', label: 'Запуск сметы в работу' },
    ],
  },
  {
    key: 'messages',
    label: 'Сообщения и чат',
    permissions: [
      { key: 'messages_view', label: 'Просмотр сообщений' },
      { key: 'messages_send', label: 'Отправка сообщений' },
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
    'reports_view',
    'buildings_view', 'buildings_manage',
    'companies_view', 'tariffs_view',
    'beward_view', 'estimates_view', 'estimates_work', 'messages_view', 'messages_send'],
  master: ['orders_view_all', 'orders_edit', 'messages_view', 'messages_send'],
  installer: ['orders_view_all', 'orders_edit', 'messages_view', 'messages_send'],
  engineer: ['orders_view_all', 'orders_edit', 'equipment_view', 'inventory_view',
    'beward_view', 'beward_edit', 'buildings_view', 'messages_view', 'messages_send'],
  chief_engineer: ['orders_view_all', 'orders_edit', 'orders_assign', 'equipment_view', 'equipment_manage', 'inventory_view', 'clients_view',
    'beward_view', 'beward_edit', 'buildings_view', 'companies_view',
    'estimates_view', 'estimates_manage', 'estimates_work', 'messages_view', 'messages_send'],
  supervisor: ['orders_view_all', 'orders_edit', 'orders_assign', 'orders_confirm', 'clients_view', 'masters_view', 'equipment_view', 'inventory_view', 'buildings_view',
    'beward_view', 'beward_edit', 'companies_view', 'tariffs_view',
    'estimates_view', 'estimates_work', 'messages_view', 'messages_send'],
  tech_director: ['orders_view_all', 'orders_edit', 'orders_assign', 'orders_confirm', 'clients_view', 'masters_view', 'masters_manage', 'equipment_view', 'equipment_manage', 'inventory_view', 'inventory_manage', 'payments_view', 'salary_view', 'reports_view', 'buildings_view', 'buildings_manage',
    'beward_view', 'beward_edit', 'companies_view', 'companies_manage', 'tariffs_view', 'tariffs_manage',
    'estimates_view', 'estimates_manage', 'estimates_work', 'messages_view', 'messages_send'],
  executive_director: ['orders_view_all', 'orders_confirm', 'clients_view', 'masters_view', 'equipment_view', 'inventory_view', 'payments_view', 'salary_view', 'salary_manage', 'reports_view', 'finance_export', 'buildings_view',
    'beward_view', 'companies_view', 'tariffs_view', 'estimates_view', 'messages_view', 'messages_send'],
  general_director: PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key)),
  clerk: ['orders_view_all', 'orders_create', 'clients_view', 'clients_create', 'clients_edit', 'equipment_view', 'buildings_view', 'reports_view',
    'beward_view', 'companies_view', 'messages_view', 'messages_send'],
  accountant: ['orders_view_all', 'payments_view', 'salary_view', 'salary_manage', 'reports_view', 'finance_export', 'clients_view',
    'companies_view', 'estimates_view', 'estimates_invoice', 'estimates_payment',
    'messages_view', 'messages_send'],
  cashier: ['orders_view_all', 'payments_view', 'payments_manage', 'clients_view',
    'estimates_view', 'estimates_payment',
    'messages_view', 'messages_send'],
  secretary: ['orders_view_all', 'orders_create', 'clients_view', 'clients_create', 'clients_edit', 'masters_view', 'equipment_view', 'inventory_view', 'buildings_view', 'reports_view',
    'beward_view', 'companies_view', 'estimates_view', 'messages_view', 'messages_send'],
};

const roleColors: Record<string, string> = {
  admin: 'red', dispatcher: 'blue', master: 'green', installer: 'cyan',
  engineer: 'orange', chief_engineer: 'gold', supervisor: 'purple',
  tech_director: 'magenta', executive_director: 'volcano', general_director: 'red',
  clerk: 'geekblue', accountant: 'lime', cashier: 'gold', secretary: 'purple',
};
const roleLabels: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label]));

/** Где сотруднику разрешено работать */
const ACCESS_OPTIONS = [
  { value: 'both', label: '🌐📱 Веб-интерфейс + мобильное приложение' },
  { value: 'web', label: '🌐 Только веб-интерфейс' },
  { value: 'mobile', label: '📱 Только мобильное приложение' },
];

const ACCESS_TAGS: Record<string, { color: string; label: string }> = {
  both: { color: 'blue', label: 'Веб + моб.' },
  web: { color: 'geekblue', label: 'Только веб' },
  mobile: { color: 'green', label: 'Только моб.' },
};

const AdminSettingsPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [qrUser, setQrUser] = useState<any>(null);
  const [pushResult, setPushResult] = useState<any>(null);
  const [pushLoading, setPushLoading] = useState(false);

  // Telegram-привязка
  const [tgLinks, setTgLinks] = useState<Record<number, any>>({});
  const [tgCode, setTgCode] = useState<any>(null);
  const [tgChatId, setTgChatId] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { user: currentUser } = useAuth();
  // Сброс пароля и QR с автовходом — только для администратора
  const isAdmin = currentUser?.role === 'admin';

  const handleResetPassword = async (u: any) => {
    if (!u?.id) return;
    setResetting(true);
    try {
      const r = await api.post(`/users/${u.id}/reset_password/`);
      setQrUser({
        ...u,
        username: r.data.username || u.username,
        first_name: r.data.first_name ?? u.first_name,
        last_name: r.data.last_name ?? u.last_name,
        __password: r.data.password,
      });
      message.success('Новый пароль сгенерирован — QR готов для автовхода');
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.response?.data?.detail || 'Не удалось сбросить пароль');
    } finally {
      setResetting(false);
    }
  };
  const [userForm] = Form.useForm();

  const [backupSettings, setBackupSettings] = useState({ auto_backup: false, backup_time: '03:00', backup_keep_days: 30, backup_path: '/var/backups/crm/' });
  const [mediaSettings, setMediaSettings] = useState({ media_max_size_mb: 50, media_allowed_types: 'jpg,jpeg,png,mp4,mov,avi', media_storage_path: '/var/media/crm/', media_retention_days: 90 });

  useEffect(() => { fetchUsers(); fetchSystemSettings(); fetchTgLinks(); }, []);

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
        access_scope: p.access_scope || 'both',
        phone: p.phone || '',
        is_active: p.user?.is_active !== false,
        is_on_shift: !!p.is_on_shift,
        permissions: p.permissions || {},
      })));
    } catch (error) { console.error('Ошибка загрузки:', error); }
    finally { setLoading(false); }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    userForm.resetFields();
    // Новому сотруднику сразу подставляем сложный пароль
    userForm.setFieldsValue({ role: 'master', access_scope: 'both', is_active: true, permissions: {}, password: generatePassword() });
    setUserModalOpen(true);
  };

  const regeneratePassword = () => {
    userForm.setFieldsValue({ password: generatePassword() });
    message.success('Сгенерирован новый пароль');
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      username: user.username, password: '',
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, phone: user.phone,
      role: user.role, is_active: user.is_active !== false,
      access_scope: user.access_scope || 'both',
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
    // Поле «permissions» редактируется кастомным блоком чекбоксов и не
    // регистрируется как обычное поле формы, поэтому onFinish его не отдаёт.
    // Берём значение напрямую из формы — иначе права затирались в {}.
    const permissions =
      userForm.getFieldValue('permissions') ?? values.permissions ?? {};

    try {
      const payload: any = {
        role: values.role,
        access_scope: values.access_scope || 'both',
        phone: values.phone || '',
        is_active: values.is_active !== false,
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || '',
        permissions,
      };
      if (values.password) payload.password = values.password;

      if (editingUser) {
        await api.put(`/users/${editingUser.id}/`, payload);
        message.success('Сотрудник обновлён');
        setUserModalOpen(false);
        // Если задан новый пароль — сразу даём QR для автовхода
        if (values.password) {
          setQrUser({ ...editingUser, username: values.username || editingUser.username, __password: values.password });
        }
      } else {
        const created = await api.post('/users/', { ...payload, password: values.password || 'temp123' });
        message.success('Сотрудник создан');
        setUserModalOpen(false);
        // Показываем QR с паролем — второй раз пароль увидеть нельзя
        setQrUser({
          username: created.data?.user?.username || values.username,
          first_name: created.data?.user?.first_name || values.first_name || '',
          last_name: created.data?.user?.last_name || values.last_name || '',
          __password: values.password,
        });
      }
      fetchUsers();
    } catch (e: any) {
      // Показываем конкретную причину от сервера (валидация полей), а не общее «Ошибка»
      const data = e?.response?.data;
      let msg = 'Ошибка сохранения';
      if (typeof data === 'string') msg = data;
      else if (data?.detail) msg = data.detail;
      else if (data && typeof data === 'object') {
        const parts = Object.entries(data).map(([field, err]) => {
          const text = Array.isArray(err) ? err[0] : String(err);
          return `${field}: ${text}`;
        });
        if (parts.length) msg = parts.join('; ');
      }
      message.error(msg);
    }
  };

  const handleDeleteUser = async (user: any) => {
    try {
      await api.delete(`/users/${user.id}/`);
      message.success('Сотрудник удалён');
      fetchUsers();
    } catch (e) { message.error('Ошибка удаления'); }
  };

  /** Тестовое push-уведомление сотруднику (диагностика доставки) */
  const handleTestPush = async (user: any) => {
    setPushLoading(true);
    try {
      const res = await api.post(`/users/${user.id}/test_push/`);
      setPushResult(res.data);
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка отправки');
    } finally {
      setPushLoading(false);
    }
  };

  const fetchTgLinks = async () => {
    try {
      const res = await api.get('/telegram-settings/links/');
      const map: Record<number, any> = {};
      (res.data.links || []).forEach((l: any) => { map[l.user_id] = l; });
      setTgLinks(map);
    } catch (e) { /* нет прав */ }
  };

  const handleTgCode = async (user: any) => {
    setTgLoading(true);
    try {
      const res = await api.post('/telegram-settings/admin_link/', { user_id: user.user_id || user.id });
      setTgCode(res.data);
      message.success('Код сгенерирован');
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка');
    } finally { setTgLoading(false); }
  };

  const handleTgBind = async (user: any) => {
    if (!tgChatId.trim()) { message.warning('Введите Telegram ID'); return; }
    setTgLoading(true);
    try {
      await api.post('/telegram-settings/admin_link/', { user_id: user.user_id || user.id, chat_id: tgChatId.trim() });
      message.success('Telegram привязан');
      setTgChatId('');
      fetchTgLinks();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка');
    } finally { setTgLoading(false); }
  };

  const handleTgUnlink = async (user: any) => {
    setTgLoading(true);
    try {
      await api.post('/telegram-settings/unlink/', { user_id: user.user_id || user.id });
      message.success('Telegram отвязан');
      fetchTgLinks();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка');
    } finally { setTgLoading(false); }
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
      title: 'Доступ', dataIndex: 'access_scope', key: 'scope', width: 130,
      render: (s: string) => {
        const info = ACCESS_TAGS[s || 'both'] || ACCESS_TAGS.both;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
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
    { title: '', key: 'act2', width: 150, render: (_: any, r: any) => (
      <Space size={4}>
        <Button size="small" icon={<QrcodeOutlined />} title="QR-код для мобильного приложения" onClick={() => setQrUser(r)} />
        <Button size="small" icon={<BellOutlined />} title="Отправить тестовое уведомление"
          loading={pushLoading} onClick={() => handleTestPush(r)} />
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
          <Form.Item
            name="password"
            label={editingUser ? 'Новый пароль (оставьте пустым — не менять)' : 'Пароль'}
            rules={editingUser ? [] : [{ required: true, min: 6, message: 'Минимум 6 символов' }]}
            extra={editingUser ? 'Если задать новый пароль — сразу покажем QR-код для входа' : 'Сложный пароль генерируется автоматически. После сохранения откроется QR-код для входа в приложение.'}
          >
            <Input.Password
              placeholder={editingUser ? 'Не менять' : 'Минимум 6 символов'}
              addonAfter={
                <Button type="text" size="small" icon={<ReloadOutlined />} onClick={regeneratePassword} title="Сгенерировать сложный пароль" />
              }
            />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="first_name" label="Имя"><Input /></Form.Item>
            <Form.Item name="last_name" label="Фамилия"><Input /></Form.Item>
          </Space>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="access_scope"
            label="Доступ"
            extra="Где сотрудник может работать: только веб-интерфейс, только мобильное приложение или и там, и там"
          >
            <Select options={ACCESS_OPTIONS} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked"><Switch /></Form.Item>

          {editingUser && (
            <>
              <Divider orientation="left" plain style={{ fontSize: 13 }}>✈️ Telegram</Divider>
              {tgLinks[editingUser.user_id]?.chat_id ? (
                <div style={{ marginBottom: 8 }}>
                  <Tag color="green">Привязан</Tag>
                  {tgLinks[editingUser.user_id].username ? <span>@{tgLinks[editingUser.user_id].username}</span> : null}
                  <span style={{ marginLeft: 8, color: '#888' }}>chat_id: {tgLinks[editingUser.user_id].chat_id}</span>
                  <Button size="small" danger style={{ marginLeft: 8 }} onClick={() => handleTgUnlink(editingUser)} loading={tgLoading}>Отвязать</Button>
                </div>
              ) : (
                <div style={{ color: '#888', marginBottom: 8 }}>Не привязан</div>
              )}
              <Space wrap style={{ width: '100%' }}>
                <Input placeholder="Telegram ID (число)" value={tgChatId} onChange={e => setTgChatId(e.target.value)} style={{ width: 210 }} />
                <Button size="small" onClick={() => handleTgBind(editingUser)} loading={tgLoading}>Привязать по ID</Button>
                <Button size="small" onClick={() => handleTgCode(editingUser)} loading={tgLoading}>Получить код</Button>
              </Space>
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                Telegram ID можно узнать у @userinfobot. Либо нажмите «Получить код» и пусть сотрудник отправит боту /start &lt;код&gt;.
              </div>
              {tgCode && tgCode.user_id === editingUser.user_id && (
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">Код: <b style={{ fontFamily: 'monospace' }}>{tgCode.code}</b></Tag>
                  {tgCode.link && <Button type="link" href={tgCode.link} target="_blank" size="small">Открыть бота</Button>}
                </div>
              )}
            </>
          )}

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

      {/* Результат проверки push-уведомлений */}
      <Modal
        title="🔔 Проверка push-уведомлений"
        open={!!pushResult}
        onCancel={() => setPushResult(null)}
        footer={<Button onClick={() => setPushResult(null)}>Закрыть</Button>}
        width={560}
      >
        {pushResult && (
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 10 }}>
              Сотрудник: <b>{pushResult.user?.name}</b> ({pushResult.user?.username})
            </div>

            <div style={{ marginBottom: 8 }}>
              <b>Каналы доставки:</b>
              <Space wrap style={{ marginLeft: 8 }}>
                <Tag color={pushResult.result?.fcm ? 'green' : 'red'}>FCM {pushResult.result?.fcm ? '✔' : '✖'}</Tag>
                <Tag color={pushResult.result?.expo ? 'green' : 'default'}>Expo {pushResult.result?.expo ? '✔' : '—'}</Tag>
                <Tag color={pushResult.result?.telegram ? 'green' : 'default'}>Telegram {pushResult.result?.telegram ? '✔' : '—'}</Tag>
                <Tag color={pushResult.result?.websocket ? 'green' : 'default'}>WebSocket {pushResult.result?.websocket ? '✔' : '—'}</Tag>
              </Space>
            </div>

            <div style={{ marginBottom: 6 }}>
              <b>Firebase подключён:</b> {pushResult.fcm_configured ? '✅ да' : '❌ нет (нет сервис-аккаунта)'}
            </div>

            <div style={{ marginBottom: 6 }}>
              <b>Токены сотрудника ({pushResult.tokens?.length || 0}):</b>
            </div>
            {(pushResult.tokens?.length || 0) === 0 ? (
              <div style={{ color: '#d4380d' }}>Токенов нет — сотруднику нужно открыть приложение и войти.</div>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {pushResult.tokens.map((t: any, i: number) => (
                  <li key={i}>
                    <Tag color={t.type === 'fcm' ? 'blue' : 'purple'}>{t.type.toUpperCase()}</Tag>
                    <code>{t.token}</code> · {t.platform}
                  </li>
                ))}
              </ul>
            )}

            {(pushResult.fcm_details || []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <b>Ответ FCM:</b>
                {(pushResult.fcm_details || []).map((d: any, i: number) => (
                  <div key={i} style={{ marginTop: 4, color: d.ok ? '#389e0d' : '#cf1322', fontSize: 12 }}>
                    {d.ok ? '✔ доставлено' : '✖ ' + (d.error || 'ошибка')}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12, color: '#888', fontSize: 12 }}>{pushResult.hint}</div>
          </div>
        )}
      </Modal>

      {/* QR-код подключения мобильного приложения */}
      <Modal
        title="📱 Подключение мобильного приложения"
        open={!!qrUser}
        onCancel={() => setQrUser(null)}
        footer={null}
        width={420}
      >
        {qrUser && (
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG value={buildConnectPayload(qrUser)} size={240} includeMargin />
            <div style={{ marginTop: 14, fontSize: 13, lineHeight: '20px' }}>
              <div><b>{qrUser.last_name} {qrUser.first_name}</b></div>
              <div>Логин: <Tag color="blue">{qrUser.username}</Tag></div>
              {qrUser.__password && (
                <div>
                  Пароль: <Tag color="red" style={{ fontFamily: 'monospace' }}>{qrUser.__password}</Tag>
                </div>
              )}
              <div style={{ color: '#888' }}>
                Сервер: {getServerAddress().host}:{getServerAddress().port}
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#888', marginTop: 12, marginBottom: 0 }}>
              В приложении: «📷 Сканировать QR-код» → наведите камеру.<br />
              {qrUser.__password
                ? 'Адрес, логин и пароль подставятся автоматически — вход выполнится сразу.'
                : 'Адрес сервера и логин подставятся автоматически, пароль нужно ввести вручную.'}
            </p>
            {qrUser.__password && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#d4380d', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 10px' }}>
                ⚠️ Пароль показывается только сейчас — сохраните его или отсканируйте QR сотрудником.
              </div>
            )}
            {!qrUser.__password && isAdmin && (
              <Popconfirm
                title="Сгенерировать новый пароль?"
                description="Текущий пароль сотрудника перестанет работать. Новый будет показан здесь и попадёт в QR для автовхода."
                okText="Сгенерировать"
                cancelText="Отмена"
                onConfirm={() => handleResetPassword(qrUser)}
              >
                <Button type="primary" icon={<KeyOutlined />} loading={resetting} style={{ marginTop: 14 }}>
                  🔑 Новый пароль + QR для автовхода
                </Button>
              </Popconfirm>
            )}
            {!qrUser.__password && !isAdmin && (
              <p style={{ fontSize: 12, color: '#aaa', marginTop: 12, marginBottom: 0 }}>
                Генерация пароля и QR с автовходом доступна только администратору.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminSettingsPage;
