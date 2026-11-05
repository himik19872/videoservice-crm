"""Настройки Telegram-бота и webhook для привязки сотрудников."""
import logging

from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt

from .models import TelegramSettings, TelegramUserLink
from . import telegram_service as tg

logger = logging.getLogger(__name__)


class TelegramSettingsViewSet(viewsets.ModelViewSet):
    """Настройки Telegram-бота (один объект)"""
    queryset = TelegramSettings.objects.all()
    http_method_names = ['get', 'post', 'patch']

    def _obj(self):
        return TelegramSettings.objects.first()

    def _payload(self):
        s = self._obj()
        if not s:
            return {'id': None, 'bot_token': '', 'bot_username': '', 'bot_name': 'CRM Bot', 'is_active': False}
        return {'id': s.id, 'bot_token': s.bot_token, 'bot_username': s.bot_username,
                'bot_name': s.bot_name, 'is_active': s.is_active}

    def list(self, request, *args, **kwargs):
        return Response(self._payload())

    def create(self, request, *args, **kwargs):
        s, _ = TelegramSettings.objects.get_or_create(
            defaults={'bot_token': request.data.get('bot_token', ''),
                      'bot_username': request.data.get('bot_username', ''),
                      'bot_name': request.data.get('bot_name', 'CRM Bot'),
                      'is_active': request.data.get('is_active', False)})
        for f in ('bot_token', 'bot_username', 'bot_name', 'is_active'):
            if f in request.data:
                setattr(s, f, request.data[f])
        s.save()
        return Response(self._payload())

    def partial_update(self, request, *args, **kwargs):
        return self.create(request)

    @action(detail=False, methods=['post'])
    def test(self, request):
        ok = tg.send_notification_to_user(
            request.user.id, '✅ Тест Telegram', 'Бот VideoService подключён — уведомления работают.')
        if ok:
            return Response({'ok': True, 'message': 'Сообщение отправлено в ваш Telegram'})
        return Response({'error': 'Вы не привязаны к Telegram (или бот не активен). '
                                  'Нажмите «Привязать» ниже и отправьте боту /start <код>.'}, status=400)

    @action(detail=False, methods=['post'])
    def set_webhook(self, request):
        public_url = request.data.get('url', '').strip()
        if not public_url:
            from .models import SystemSettings
            s = SystemSettings.objects.first()
            public_url = (s.dns_name if s and s.dns_name else
                          'https://{}/'.format(request.get_host()))
        ok, error = tg.set_webhook(public_url)
        if ok:
            return Response({'ok': True, 'webhook': public_url.rstrip('/') + '/api/telegram/webhook/'})
        return Response({'ok': False, 'error': error}, status=400)

    @action(detail=False, methods=['get'])
    def links(self, request):
        """Список привязанных сотрудников + код привязки для текущего пользователя"""
        rows = [{
            'user_id': l.user_id,
            'name': l.user.get_full_name() or l.user.username,
            'username': l.username,
            'chat_id': l.chat_id,
            'is_subscribed': l.is_subscribed,
            'linked_at': l.linked_at.isoformat() if l.linked_at else None,
        } for l in TelegramUserLink.objects.select_related('user').filter(chat_id__isnull=False)]
        rows.sort(key=lambda r: r['name'])
        return Response({'links': rows})

    @action(detail=False, methods=['post'])
    def link_me(self, request):
        """Сгенерировать код привязки для текущего сотрудника"""
        code = tg.generate_link_code(request.user)
        me = tg.get_me()
        username = me.get('username') if me else None
        return Response({'code': code, 'bot_username': username,
                         'link': 'https://t.me/{}?start={}'.format(username, code) if username else None})

    @action(detail=False, methods=['post'])
    def admin_link(self, request):
        """Админ: привязать Telegram сотруднику — по chat_id напрямую или выдать код.
        body: {user_id: int, chat_id?: str}"""
        user_id = request.data.get('user_id')
        chat_id = str(request.data.get('chat_id', '') or '').strip()
        if not user_id:
            return Response({'error': 'user_id обязателен'}, status=400)
        user = get_object_or_404(User, id=user_id)

        # Прямая привязка по числовому Telegram ID (chat_id)
        if chat_id:
            tg.link_user(user, chat_id)
            return Response({'ok': True, 'user_id': user.id, 'chat_id': chat_id,
                             'name': user.get_full_name() or user.username})

        code = tg.generate_link_code(user)
        me = tg.get_me()
        username = me.get('username') if me else None
        return Response({'ok': True, 'user_id': user.id, 'code': code,
                         'name': user.get_full_name() or user.username,
                         'bot_username': username,
                         'link': 'https://t.me/{}?start={}'.format(username, code) if username else None})

    @action(detail=False, methods=['post'])
    def unlink(self, request):
        """Отвязать сотрудника от Telegram (админ). body: {user_id}"""
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id обязателен'}, status=400)
        TelegramUserLink.objects.filter(user_id=user_id).update(chat_id='', link_code=None)
        return Response({'ok': True})


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook_view(request):
    """Webhook Telegram (резервный канал). Основной канал — polling (getUpdates).
    Обрабатывает /start <код> для привязки сотрудника."""
    try:
        data = request.data
        message = data.get('message') or data.get('edited_message')
        if not message:
            return Response({'ok': True})

        chat = message.get('chat', {})
        chat_id = chat.get('id')
        username = chat.get('username', '') or ''
        text = message.get('text') or ''

        if not chat_id:
            return Response({'ok': True})

        result = tg.handle_incoming_message(chat_id, username, text)
        return Response(result)

    except Exception as e:
        logger.error('Telegram webhook error: %s', e)
        return Response({'ok': False, 'error': str(e)}, status=500)
