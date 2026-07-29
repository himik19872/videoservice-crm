"""
Middleware для аудита действий сотрудников.
Записывает все CUD-операции (Create/Update/Delete) в AuditLog.
"""
import json
import logging
from django.utils import timezone
from .models import AuditLog

logger = logging.getLogger(__name__)

# Какие URL логировать (префиксы)
AUDIT_URL_PREFIXES = [
    '/api/orders/',
    '/api/clients/',
    '/api/buildings/',
    '/api/entrances/',
    '/api/equipment/',
    '/api/inventory/',
    '/api/masters/',
    '/api/regions/',
    '/api/payments/',
    '/api/import/',
    '/api/system/migrate/',
    '/api/suppliers/',
    '/api/erc-accounts/',
    '/api/erc-billing/',
    '/api/management-companies/',
    '/api/tariffs/',
    '/api/legal-entities/',
    '/api/storage-locations/',
    '/api/system-settings/',
]

# Какие методы логировать
AUDIT_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Action по методу
METHOD_ACTION = {
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete',
}

# Максимальная длина ответа для сохранения в details
MAX_RESPONSE_BODY = 500


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Логируем только API-запросы
        if not request.path.startswith('/api/'):
            return response

        # Только аутентифицированных пользователей
        if not request.user or not request.user.is_authenticated:
            return response

        # Только нужные методы
        if request.method not in AUDIT_METHODS:
            return response

        # Только нужные URL
        should_log = False
        for prefix in AUDIT_URL_PREFIXES:
            if request.path.startswith(prefix):
                should_log = True
                break
        if not should_log:
            return response

        # Определяем модель из URL
        model_name = self._extract_model(request.path)
        object_id = ''
        object_repr = ''

        # Пробуем извлечь ID из URL
        import re
        m = re.search(r'/(\d+)/?$', request.path)
        if m:
            object_id = m.group(1)

        # Парсим тело ответа для получения представления
        details = {}
        try:
            if hasattr(response, 'data') and response.data:
                if isinstance(response.data, dict):
                    # Ищем понятное имя объекта
                    object_repr = response.data.get('number', '') or \
                                  response.data.get('name', '') or \
                                  response.data.get('full_name', '') or \
                                  response.data.get('title', '') or \
                                  str(response.data.get('id', ''))
                    # Сохраняем ключевые поля
                    details = {k: v for k, v in response.data.items()
                              if k in ('id', 'number', 'name', 'full_name', 'status',
                                        'order_type', 'street_name', 'house_number',
                                        'city', 'address', 'personal_account_number',
                                        'equipment_type', 'system_type')}
                elif isinstance(response.data, list):
                    object_repr = f'{len(response.data)} записей'
                    details = {'count': len(response.data)}
        except Exception:
            pass

        # Если object_repr пустой — пробуем тело запроса
        if not object_repr and request.method in ('POST', 'PUT', 'PATCH'):
            try:
                body = request.data if hasattr(request, 'data') else {}
                object_repr = body.get('number', '') or \
                              body.get('name', '') or \
                              body.get('full_name', '') or \
                              body.get('title', '') or ''
            except Exception:
                pass

        # Получаем IP
        ip = self._get_client_ip(request)

        # Записываем в лог
        try:
            AuditLog.objects.create(
                user=request.user,
                action=METHOD_ACTION.get(request.method, 'other'),
                model_name=model_name,
                object_id=object_id,
                object_repr=str(object_repr)[:300],
                details=details,
                ip_address=ip,
            )
        except Exception as e:
            logger.error(f'AuditLog error: {e}')

        return response

    def _extract_model(self, path):
        """Извлекает имя модели из URL: /api/orders/ → Order, /api/clients/ → Client"""
        import re
        m = re.match(r'/api/([a-z-]+)/?', path.lstrip('/'))
        if m:
            name = m.group(1)
            # Маппинг URL-префиксов на понятные имена
            mapping = {
                'orders': 'Заявка', 'clients': 'Клиент', 'buildings': 'Дом',
                'entrances': 'Подъезд', 'equipment': 'Оборудование',
                'inventory': 'Склад', 'masters': 'Мастер', 'regions': 'Регион',
                'payments': 'Платёж', 'import': 'Импорт', 'suppliers': 'Поставщик',
                'erc-accounts': 'ЕРЦ-счёт', 'erc-billing': 'ЕРЦ-запись',
                'management-companies': 'УК/ТСЖ', 'tariffs': 'Тариф',
                'legal-entities': 'Юрлицо', 'storage-locations': 'Склад-место',
                'system-settings': 'Настройки', 'system': 'Система',
            }
            return mapping.get(name, name.replace('-', ' ').title())
        return 'Неизвестно'

    def _get_client_ip(self, request):
        """Получает IP-адрес клиента."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '')
        return ip


def log_manual_action(user, action, model_name, object_repr='', object_id='', details=None):
    """Вспомогательная функция для ручного логирования."""
    try:
        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_id=str(object_id)[:50],
            object_repr=str(object_repr)[:300],
            details=details or {},
        )
    except Exception as e:
        logger.error(f'AuditLog manual error: {e}')
