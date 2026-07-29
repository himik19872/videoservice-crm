
import json
import re
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from .models import MaxBotSettings, SystemSettings, Client, MaxUserLink
from .max_service import max_send_by_user_id

logger = logging.getLogger(__name__)


class MaxSettingsViewSet(viewsets.ModelViewSet):
    """Настройки бота Max (через SystemSettings)"""
    queryset = MaxBotSettings.objects.all()
    http_method_names = ['get', 'post', 'patch']

    def _settings(self):
        return SystemSettings.objects.first()

    def list(self, request, *args, **kwargs):
        s = self._settings()
        if not s:
            return Response({'id': None, 'bot_token': '', 'bot_name': 'CRM Bot', 'is_active': False, 'api_base_url': 'https://max.ru'})
        return Response({'id': s.id, 'bot_token': s.max_bot_token, 'bot_name': s.max_bot_name, 'is_active': s.max_bot_active, 'api_base_url': s.max_api_url})

    def create(self, request, *args, **kwargs):
        s = self._settings()
        if not s:
            s = SystemSettings.objects.create(
                max_bot_token=request.data.get('bot_token', ''),
                max_bot_name=request.data.get('bot_name', 'CRM Bot'),
                max_bot_active=request.data.get('is_active', False),
                max_api_url=request.data.get('api_base_url', 'https://max.ru'),
            )
        else:
            s.max_bot_token = request.data.get('bot_token', s.max_bot_token)
            s.max_bot_name = request.data.get('bot_name', s.max_bot_name)
            s.max_bot_active = request.data.get('is_active', s.max_bot_active)
            s.max_api_url = request.data.get('api_base_url', s.max_api_url)
            s.save()
        return Response({'id': s.id, 'bot_token': s.max_bot_token, 'bot_name': s.max_bot_name, 'is_active': s.max_bot_active, 'api_base_url': s.max_api_url})

    @action(detail=False, methods=['post'])
    def test(self, request):
        from .max_service import send_notification_to_user, max_send_by_user_id
        s = self._settings()
        if not s or not s.max_bot_active:
            return Response({'error': 'Бот не активен'}, status=400)

        import requests as req
        url = f"https://platform-api2.max.ru/messages?user_id=5660687"

        # Тест: отправляем админу
        ok = send_notification_to_user(
            request.user.id,
            'Тест Max',
            'Бот VideoService подключён! Уведомления работают.'
        )
        if ok:
            return Response({'ok': True, 'message': 'Сообщение отправлено', 'url': url})
        return Response({'error': 'Пользователь не привязан к Max', 'url': url}, status=400)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def max_webhook_view(request):
    """
    Webhook для Max бота.
    Принимает события от Max API:
    - new_message: пользователь написал боту
    - callback_query: пользователь нажал кнопку

    Автоматически линкует клиента по user_id.
    """
    try:
        data = request.data
        logger.info(f'Max webhook received: {json.dumps(data, ensure_ascii=False)[:500]}')

        event_type = data.get('type', '')
        user_id = str(data.get('user_id', '') or data.get('from', {}).get('user_id', ''))
        text = (data.get('text', '') or data.get('message', {}).get('text', '')).strip()

        if not user_id:
            return Response({'ok': True, 'message': 'no user_id'})

        # Обработка нового сообщения
        if event_type in ('new_message', 'message', '') and text:
            response = _handle_webhook_message(user_id, text, data)
            return Response(response)

        # Callback query (нажатие кнопки)
        if event_type == 'callback_query':
            callback_data = data.get('data', '') or data.get('callback_query', {}).get('data', '')
            response = _handle_webhook_callback(user_id, callback_data, data)
            return Response(response)

        return Response({'ok': True, 'message': 'processed'})

    except Exception as e:
        logger.error(f'Max webhook error: {e}')
        return Response({'ok': False, 'error': str(e)}, status=500)


def _handle_webhook_message(user_id, text, raw_data):
    """Обрабатывает текстовое сообщение от пользователя."""
    text_lower = text.lower().strip()

    # /start или приветствие — инструкция
    if text_lower in ('/start', 'привет', 'здравствуйте', 'start', 'hi', 'hello'):
        _send_welcome_message(user_id)
        return {'ok': True, 'action': 'welcome'}

    # Заявка по номеру — проверяем ДО телефона
    from .models import Order
    order_match = re.search(r'(ЗАЯВ-\d{6}-\d{4})', text.upper())
    if order_match:
        order_number = order_match.group(1)
        order = Order.objects.filter(number=order_number).first()
        if order:
            status_map = {
                'new': '🆕 Новая', 'assigned': '👨‍🔧 Назначена', 'accepted': '✅ Принята',
                'in_progress': '🔧 В работе', 'paused': '⏸️ На паузе', 'need_help': '🆘 Нужна помощь',
                'completed': '✔️ Выполнена', 'confirmed': '✅ Подтверждена', 'cancelled': '❌ Отменена',
            }
            max_send_by_user_id(user_id, (
                f'📋 <b>{order_number}</b>\n'
                f'Тип: {order.get_order_type_display()}\n'
                f'Статус: {status_map.get(order.status, order.status)}\n'
                f'Адрес: {order.address or "не указан"}'
            ))
            return {'ok': True, 'action': 'order_status'}

    # Пытаемся найти номер телефона в тексте
    phone = _extract_phone(text)
    if phone:
        result = _link_client_by_phone(user_id, phone)
        if result:
            return {'ok': True, 'action': 'linked', 'client_id': result.id}
        else:
            max_send_by_user_id(user_id, '❌ Клиент с таким номером не найден в базе.\nПроверьте номер и попробуйте снова.')
            return {'ok': True, 'action': 'phone_not_found'}

    # Если ничего не подошло — подсказка
    _send_welcome_message(user_id)
    return {'ok': True, 'action': 'unknown'}


def _send_welcome_message(user_id):
    """Отправляет приветственное сообщение."""
    max_send_by_user_id(user_id, (
        '🏠 <b>VideoService — Домофонная компания</b>\n\n'
        'Я бот для отслеживания заявок.\n\n'
        '<b>Что я умею:</b>\n'
        '📋 Отправьте номер заявки (например, <i>ЗАЯВ-250705-0001</i>) — покажу статус\n'
        '📱 Отправьте свой номер телефона — привяжу вас к заявкам\n\n'
        'По любым вопросам звоните диспетчеру ☎️'
    ))


def _handle_webhook_callback(user_id, callback_data, raw_data):
    """Обрабатывает нажатие на кнопку."""
    if callback_data == 'check_orders':
        client = Client.objects.filter(max_user_id=user_id).first()
        if client:
            orders = client.orders.order_by('-created_at')[:5]
            if orders:
                lines = ['📋 <b>Ваши последние заявки:</b>\n']
                for o in orders:
                    status_emoji = {'new': '🆕', 'completed': '✔️', 'cancelled': '❌'}.get(o.status, '🔧')
                    lines.append(f'{status_emoji} {o.number} — {o.get_status_display()}')
                max_send_by_user_id(user_id, '\n'.join(lines))
            else:
                max_send_by_user_id(user_id, 'У вас пока нет заявок.')
        else:
            max_send_by_user_id(user_id, 'Вы не привязаны к CRM. Отправьте свой номер телефона.')
    return {'ok': True, 'action': 'callback'}


def _extract_phone(text):
    """Извлекает номер телефона из текста."""
    # Убираем всё кроме цифр и +
    cleaned = re.sub(r'[^\d+]', '', text)
    # Разные форматы российских номеров
    patterns = [
        r'^\+7\d{10}$',      # +79161234567
        r'^8\d{10}$',        # 89161234567
        r'^7\d{10}$',        # 79161234567
        r'^9\d{9}$',         # 9161234567 (10 цифр, мобильный, без кода)
    ]
    for pat in patterns:
        if re.match(pat, cleaned):
            if cleaned.startswith('8'):
                return '+7' + cleaned[1:]
            elif cleaned.startswith('7') and not cleaned.startswith('+'):
                return '+' + cleaned
            elif len(cleaned) == 10:
                return '+7' + cleaned
            return cleaned
    return None


def _link_client_by_phone(user_id, phone):
    """Привязывает max_user_id к клиенту по номеру телефона."""
    # Нормализуем телефон
    phone_clean = phone.replace(' ', '').replace('-', '')
    if phone_clean.startswith('8'):
        phone_clean = '+7' + phone_clean[1:]
    elif phone_clean.startswith('7') and not phone_clean.startswith('+'):
        phone_clean = '+' + phone_clean

    # Ищем клиента
    client = Client.objects.filter(phone__icontains=phone_clean[-10:]).first()
    if client:
        client.max_user_id = user_id
        client.max_linked_at = timezone.now()
        client.save(update_fields=['max_user_id', 'max_linked_at'])
        max_send_by_user_id(user_id, (
            f'✅ <b>Вы успешно привязаны!</b>\n\n'
            f'Имя: {client.name}\n'
            f'Телефон: {client.phone}\n\n'
            f'Теперь отправьте номер заявки, чтобы узнать её статус.'
        ))
        return client

    return None