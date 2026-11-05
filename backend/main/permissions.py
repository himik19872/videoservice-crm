"""
Проверка гранулярных прав на уровне API.

Права берутся из UserProfile.permissions (персональные переопределения)
поверх базовых прав роли — та же логика, что и в интерфейсе
(frontend/src/utils/access.ts).

Правило простое: если для запроса найдено правило и у сотрудника нет нужного
права — 403. Если маршрут не описан в таблице — доступ разрешён (чтобы не
ломать служебные/операционные эндпоинты мобильного приложения).
"""
import re

from rest_framework.permissions import SAFE_METHODS, BasePermission

# ── Базовые права по ролям ───────────────────────────────────────────────────
ALL_PERMISSIONS = frozenset({
    'orders_view_all', 'orders_create', 'orders_edit', 'orders_assign', 'orders_confirm', 'orders_delete',
    'clients_view', 'clients_create', 'clients_edit', 'clients_delete',
    'masters_view', 'masters_manage',
    'equipment_view', 'equipment_manage',
    'inventory_view', 'inventory_manage',
    'payments_view', 'payments_manage',
    'salary_view', 'salary_manage',
    'reports_view', 'finance_export',
    'buildings_view', 'buildings_manage',
    'companies_view', 'companies_manage',
    'tariffs_view', 'tariffs_manage',
    'beward_view', 'beward_edit',
    'estimates_view', 'estimates_manage',
    'estimates_approve', 'estimates_invoice', 'estimates_payment', 'estimates_work',
    'messages_view', 'messages_send',
    'users_manage', 'settings_system', 'settings_traccar', 'settings_max',
})

ROLE_PERMISSIONS = {
    'admin': ALL_PERMISSIONS,
    'general_director': ALL_PERMISSIONS,
    'dispatcher': frozenset({
        'orders_view_all', 'orders_create', 'orders_edit', 'orders_assign', 'orders_confirm',
        'clients_view', 'clients_create', 'clients_edit', 'clients_delete',
        'masters_view', 'equipment_view', 'inventory_view',
        'payments_view', 'payments_manage',
        'reports_view',
        'buildings_view', 'buildings_manage',
        'companies_view', 'tariffs_view',
        'beward_view', 'estimates_view', 'estimates_work', 'messages_view', 'messages_send',
    }),
    # Мастеру нужны склад/оплаты для работы в мобильном приложении
    'master': frozenset({
        'orders_view_all', 'orders_edit', 'inventory_view', 'payments_view',
        'messages_view', 'messages_send',
    }),
    'installer': frozenset({
        'orders_view_all', 'orders_edit', 'inventory_view', 'payments_view',
        'messages_view', 'messages_send',
    }),
    'engineer': frozenset({
        'orders_view_all', 'orders_edit', 'equipment_view', 'inventory_view',
        'beward_view', 'beward_edit', 'buildings_view', 'messages_view', 'messages_send',
    }),
    'chief_engineer': frozenset({
        'orders_view_all', 'orders_edit', 'orders_assign', 'equipment_view', 'equipment_manage',
        'inventory_view', 'clients_view', 'beward_view', 'beward_edit', 'buildings_view',
        'companies_view', 'estimates_view', 'estimates_manage', 'estimates_work',
        'messages_view', 'messages_send',
    }),
    'supervisor': frozenset({
        'orders_view_all', 'orders_edit', 'orders_assign', 'orders_confirm', 'clients_view',
        'masters_view', 'equipment_view', 'inventory_view', 'buildings_view', 'beward_view',
        'beward_edit', 'companies_view', 'tariffs_view', 'estimates_view', 'estimates_work',
        'messages_view', 'messages_send',
    }),
    'tech_director': frozenset({
        'orders_view_all', 'orders_edit', 'orders_assign', 'orders_confirm', 'clients_view',
        'masters_view', 'masters_manage', 'equipment_view', 'equipment_manage',
        'inventory_view', 'inventory_manage', 'payments_view', 'salary_view', 'reports_view',
        'buildings_view', 'buildings_manage', 'beward_view', 'beward_edit',
        'companies_view', 'companies_manage', 'tariffs_view', 'tariffs_manage',
        'estimates_view', 'estimates_manage', 'estimates_work',
        'messages_view', 'messages_send',
    }),
    'executive_director': frozenset({
        'orders_view_all', 'orders_confirm', 'clients_view', 'masters_view', 'equipment_view',
        'inventory_view', 'payments_view', 'salary_view', 'salary_manage', 'reports_view',
        'finance_export', 'buildings_view', 'beward_view', 'companies_view', 'tariffs_view',
        'estimates_view', 'messages_view', 'messages_send',
    }),
    'clerk': frozenset({
        'orders_view_all', 'orders_create', 'clients_view', 'clients_create', 'clients_edit',
        'equipment_view', 'buildings_view', 'reports_view', 'beward_view', 'companies_view',
        'messages_view', 'messages_send',
    }),
    'accountant': frozenset({
        'orders_view_all', 'payments_view', 'salary_view', 'salary_manage', 'reports_view',
        'finance_export', 'clients_view', 'companies_view',
        'estimates_view', 'estimates_invoice', 'estimates_payment',
        'messages_view', 'messages_send',
    }),
    'cashier': frozenset({
        'orders_view_all', 'payments_view', 'payments_manage', 'clients_view',
        'estimates_view', 'estimates_payment',
        'messages_view', 'messages_send',
    }),
    'secretary': frozenset({
        'orders_view_all', 'orders_create', 'clients_view', 'clients_create', 'clients_edit',
        'masters_view', 'equipment_view', 'inventory_view', 'buildings_view', 'reports_view',
        'beward_view', 'companies_view', 'estimates_view', 'messages_view', 'messages_send',
    }),
}

# ── Маршруты без ограничений (для любого авторизованного сотрудника) ─────────
OPEN_PREFIXES = (
    '/api/auth/',
    '/api/users/me/',
    '/api/push-tokens/',
    '/api/shifts/',
    '/api/regions/',
    '/api/instructions/',
    '/api/order-media/',
    '/api/import/',          # импорт — отдельная операция, проверяется на UI
    '/api/reports/dashboard/',
    '/api/max-settings/',    # карточка настроек нужна для работы приложения
    '/api/app-versions/check/',
)

# Служебные действия, которыми пользуется мобильное приложение мастера
OPEN_PATTERNS = (
    r'^/api/masters/locations/?$',
    r'^/api/masters/\d+/report_location/?$',
    r'^/api/masters/\d+/(inventory|return_zip|submit_debt|zip_orders)/',
    r'^/api/issue-orders/\d+/(receive|report_usage|confirm)/',
    r'^/api/orders/\d+/(comments|add_material|return_item)/',
    r'^/api/return-requests/\d+/submit/',
    r'^/api/telegram-settings/(link_me|links)/?$',
)

# ── Таблица модулей: (регулярка пути, {метод: право}) ────────────────────────
# read — GET/HEAD/OPTIONS, create — POST, update — PUT/PATCH, delete — DELETE
# None — действие разрешено любому авторизованному (например, мастер принимает оплату)
MODULE_RULES = [
    (r'^/api/orders/', {'read': 'orders_view_all', 'create': 'orders_create',
                        'update': 'orders_edit', 'delete': 'orders_delete'}),
    (r'^/api/clients/', {'read': 'clients_view', 'create': 'clients_create',
                         'update': 'clients_edit', 'delete': 'clients_delete'}),
    (r'^/api/legal-entities/', {'read': 'clients_view', 'create': 'clients_create',
                                'update': 'clients_edit', 'delete': 'clients_delete'}),
    (r'^/api/bank-accounts/', {'read': 'estimates_view', 'create': 'estimates_invoice',
                               'update': 'estimates_invoice', 'delete': 'estimates_invoice'}),
    (r'^/api/masters/', {'read': 'masters_view', 'create': 'masters_manage',
                         'update': 'masters_manage', 'delete': 'masters_manage'}),
    (r'^/api/equipment/', {'read': 'equipment_view', 'create': 'equipment_manage',
                           'update': 'equipment_manage', 'delete': 'equipment_manage'}),
    (r'^/api/inventory/', {'read': 'inventory_view', 'create': 'inventory_manage',
                           'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/inventory-movements/', {'read': 'inventory_view', 'create': 'inventory_manage',
                                     'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/storage-locations/', {'read': 'inventory_view', 'create': 'inventory_manage',
                                   'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/suppliers/', {'read': 'inventory_view', 'create': 'inventory_manage',
                           'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/supply-invoices/', {'read': 'inventory_view', 'create': 'inventory_manage',
                                 'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/purchase-requests/', {'read': 'inventory_view', 'create': 'inventory_manage',
                                   'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/issue-orders/', {'read': 'inventory_view', 'create': 'inventory_manage',
                              'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/return-requests/', {'read': 'inventory_view', 'create': 'inventory_manage',
                                 'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/return-orders/', {'read': 'inventory_view', 'create': 'inventory_manage',
                               'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/tools/', {'read': 'inventory_view', 'create': 'inventory_manage',
                       'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    (r'^/api/tool-movements/', {'read': 'inventory_view', 'create': 'inventory_manage',
                                'update': 'inventory_manage', 'delete': 'inventory_manage'}),
    # Мастер принимает оплату с клиента — создание оплаты открыто
    (r'^/api/payments/', {'read': 'payments_view', 'create': None,
                          'update': 'payments_manage', 'delete': 'payments_manage'}),
    (r'^/api/payment-records/', {'read': 'payments_view', 'create': 'payments_manage',
                                 'update': 'payments_manage', 'delete': 'payments_manage'}),
    (r'^/api/erc-accounts/', {'read': 'payments_view', 'create': 'payments_manage',
                              'update': 'payments_manage', 'delete': 'payments_manage'}),
    (r'^/api/erc-billing/', {'read': 'payments_view', 'create': 'payments_manage',
                             'update': 'payments_manage', 'delete': 'payments_manage'}),
    (r'^/api/master-salaries/', {'read': 'salary_view', 'create': 'salary_manage',
                                 'update': 'salary_manage', 'delete': 'salary_manage'}),
    (r'^/api/reports/', {'read': 'reports_view', 'create': 'reports_view',
                         'update': 'reports_view', 'delete': 'reports_view'}),
    (r'^/api/buildings/', {'read': 'buildings_view', 'create': 'buildings_manage',
                           'update': 'buildings_manage', 'delete': 'buildings_manage'}),
    (r'^/api/apartments/', {'read': 'buildings_view', 'create': 'buildings_manage',
                            'update': 'buildings_manage', 'delete': 'buildings_manage'}),
    (r'^/api/entrances/', {'read': 'buildings_view', 'create': 'buildings_manage',
                           'update': 'buildings_manage', 'delete': 'buildings_manage'}),
    (r'^/api/management-companies/', {'read': 'companies_view', 'create': 'companies_manage',
                                      'update': 'companies_manage', 'delete': 'companies_manage'}),
    (r'^/api/tariffs/', {'read': 'tariffs_view', 'create': 'tariffs_manage',
                         'update': 'tariffs_manage', 'delete': 'tariffs_manage'}),
    (r'^/api/beward-devices/', {'read': 'beward_view', 'create': 'beward_edit',
                                'update': 'beward_edit', 'delete': 'beward_edit'}),
    (r'^/api/estimates/', {'read': 'estimates_view', 'create': 'estimates_manage',
                           'update': 'estimates_manage', 'delete': 'estimates_manage'}),
    (r'^/api/estimate-services/', {'read': 'estimates_view', 'create': 'estimates_manage',
                                   'update': 'estimates_manage', 'delete': 'estimates_manage'}),
    (r'^/api/estimate-items/', {'read': 'estimates_view', 'create': 'estimates_manage',
                                'update': 'estimates_manage', 'delete': 'estimates_manage'}),
    (r'^/api/messages/', {'read': 'messages_view', 'create': 'messages_send',
                          'update': 'messages_send', 'delete': 'messages_send'}),
    (r'^/api/users/', {'read': None, 'create': 'users_manage',
                       'update': 'users_manage', 'delete': 'users_manage'}),
    (r'^/api/system-settings/', {'read': None, 'create': 'settings_system',
                                 'update': 'settings_system', 'delete': 'settings_system'}),
    (r'^/api/traccar/', {'read': 'settings_traccar', 'create': 'settings_traccar',
                         'update': 'settings_traccar', 'delete': 'settings_traccar'}),
    (r'^/api/asterisk/', {'read': 'settings_system', 'create': 'settings_system',
                          'update': 'settings_system', 'delete': 'settings_system'}),
    (r'^/api/telegram-settings/', {'read': None, 'create': 'settings_system',
                                   'update': 'settings_system', 'delete': 'settings_system'}),
    (r'^/api/outgoing-invoices/', {'read': 'estimates_view', 'create': 'estimates_manage',
                                   'update': 'estimates_manage', 'delete': 'estimates_manage'}),
]

_COMPILED_RULES = [(re.compile(pattern), rules) for pattern, rules in MODULE_RULES]
_COMPILED_OPEN = [re.compile(pattern) for pattern in OPEN_PATTERNS]


def effective_permissions(user) -> frozenset:
    """Базовые права роли + персональные переопределения сотрудника"""
    profile = getattr(user, 'profile', None)
    role = getattr(profile, 'role', None)

    if getattr(user, 'is_superuser', False) or role == 'admin':
        return ALL_PERMISSIONS

    perms = set(ROLE_PERMISSIONS.get(role or '', frozenset()))
    custom = getattr(profile, 'permissions', None) or {}
    for key, value in custom.items():
        if value is True or value == 'true':
            perms.add(key)
        elif value is False or value == 'false':
            perms.discard(key)

    return frozenset(perms)


def required_permission(method: str, path: str):
    """Какое право нужно для запроса. None — ограничений нет."""
    for pattern in _COMPILED_OPEN:
        if pattern.match(path):
            return None
    for prefix in OPEN_PREFIXES:
        if path.startswith(prefix):
            return None

    for pattern, rules in _COMPILED_RULES:
        if not pattern.match(path):
            continue
        if method in SAFE_METHODS:
            return rules.get('read')
        if method == 'POST':
            return rules.get('create', rules.get('update'))
        if method in ('PUT', 'PATCH'):
            return rules.get('update')
        if method == 'DELETE':
            return rules.get('delete', rules.get('update'))
        return None

    return None


class ModulePermission(BasePermission):
    """Проверяет гранулярные права сотрудника по таблице MODULE_RULES"""

    message = 'Недостаточно прав для этого действия'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            # авторизацию проверяют другие классы (IsAuthenticated / AllowAny)
            return True

        needed = required_permission(request.method, request.path)
        if not needed:
            return True

        return needed in effective_permissions(user)
