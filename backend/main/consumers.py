"""
WebSocket consumer для push-уведомлений мастерам.
Аутентификация через токен в query-параметре.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import AnonymousUser


class NotificationsConsumer(AsyncWebsocketConsumer):
    """Принимает WS-соединения, аутентифицирует по токену, рассылает уведомления."""

    async def connect(self):
        # Аутентификация: token передан как query-параметр
        token_key = self.scope.get('query_string', b'').decode()
        token = None
        if 'token=' in token_key:
            token = token_key.split('token=')[-1].split('&')[0]

        self.user = AnonymousUser()
        if token:
            user = await self._get_user_by_token(token)
            if user:
                self.user = user

        if self.user.is_authenticated:
            self.group_name = f'user_{self.user.id}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            await self.send(text_data=json.dumps({
                'type': 'connected',
                'message': f'Подключено, user_id={self.user.id}',
            }))
        else:
            await self.close(code=4001)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # Клиент ничего не должен слать (только слушать)

    async def notification_message(self, event):
        """Получение от channel layer → отправка клиенту"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'title': event.get('title', ''),
            'body': event.get('body', ''),
            'data': event.get('data', {}),
        }))

    @database_sync_to_async
    def _get_user_by_token(self, token_key):
        try:
            return Token.objects.select_related('user').get(key=token_key).user
        except Token.DoesNotExist:
            return None
