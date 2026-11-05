/**
 * Группы прав, базовые права по ролям и хелперы доступа.
 * Единый источник правды для интерфейса (меню, настройки сотрудников).
 */

export interface PermissionItem {
  key: string;
  label: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
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

/** Все существующие права */
export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

/** Базовые права по ролям (персональные настройки их переопределяют) */
export const BASE_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
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
  general_director: ALL_PERMISSIONS,
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

/** Человекочитаемые названия ролей */
export const ROLE_NAMES: Record<string, string> = {
  admin: 'Администратор',
  dispatcher: 'Диспетчер',
  master: 'Мастер',
  installer: 'Монтажник',
  engineer: 'Инженер',
  chief_engineer: 'Главный инженер',
  supervisor: 'Начальник сервисной службы',
  tech_director: 'Технический директор',
  executive_director: 'Исполнительный директор',
  general_director: 'Генеральный директор',
  clerk: 'Делопроизводитель',
  accountant: 'Бухгалтер',
  cashier: 'Кассир',
  secretary: 'Секретарь',
};

export const roleName = (role?: string): string => (role ? ROLE_NAMES[role] || role : 'Сотрудник');

/** Эффективные права: базовые права роли + персональные переопределения */
export const getEffectivePermissions = (
  role: string | undefined,
  customPermissions: Record<string, any> = {},
): Set<string> => {
  const result = new Set(BASE_ROLE_PERMISSIONS[role || ''] || []);
  Object.entries(customPermissions || {}).forEach(([key, val]) => {
    if (val === true || val === 'true') result.add(key);
    else if (val === false || val === 'false') result.delete(key);
  });
  return result;
};

/** Проверка одного права у пользователя из контекста авторизации */
export const can = (user: any, permission?: string): boolean => {
  if (!permission) return true;
  const custom = user?.profile?.permissions || user?.permissions || {};
  return getEffectivePermissions(user?.role, custom).has(permission);
};
