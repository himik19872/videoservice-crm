"""Telegram Bot Service — уведомления сотрудникам.

Отправка через Bot API: POST https://api.telegram.org/bot<token>/sendMessage.
Сотрудник привязывается к чату через код: отправляет боту `/start <КОД>`.
"""
import os
import secrets
import time

import requests

from .models import TelegramSettings, TelegramUserLink

# api.telegram.org у некоторых провайдеров РФ работает нестабильно
# (часть соединений рвётся) — поэтому повторяем запрос несколько раз.
MAX_ATTEMPTS = 5
CONNECT_TIMEOUT = 8


def _tg_request(method, url, **kwargs):
    """Запрос к Telegram с повторами при обрыве соединения."""
    last_error = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            resp = requests.request(method, url, timeout=CONNECT_TIMEOUT,
                                    proxies=_proxies(), **kwargs)
            return resp
        except Exception as e:
            last_error = e
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(0.4 * (attempt + 1))
    raise last_error


def _proxies():
    """HTTP/SOCKS-прокси для Telegram (если api.telegram.org заблокирован у провайдера).
    Задаётся переменной окружения TELEGRAM_PROXY, например:
      TELEGRAM_PROXY=http://user:pass@host:port
      TELEGRAM_PROXY=socks5://host:port
    """
    proxy = os.environ.get('TELEGRAM_PROXY', '').strip()
    if proxy:
        return {'http': proxy, 'https': proxy}
    return None


def _settings():
    return TelegramSettings.objects.first()


def get_token():
    s = _settings()
    return s.bot_token if s and s.is_active and s.bot_token else None


def send_message(chat_id, text, parse_mode='HTML'):
    """Отправить сообщение в Telegram. Возвращает True/False."""
    token = get_token()
    if not token or not chat_id:
        return False
    try:
        url = 'https://api.telegram.org/bot{}/sendMessage'.format(token)
        resp = _tg_request('POST', url, json={
            'chat_id': chat_id,
            'text': text,
            'parse_mode': parse_mode,
            'disable_web_page_preview': True,
        })
        ok = resp.status_code == 200 and resp.json().get('ok')
        if not ok:
            print('[Telegram] send error: {}'.format(resp.text[:200]))
        return ok
    except Exception as e:
        print('[Telegram] error: {}'.format(e))
        return False


def send_notification_to_user(user_id, title, body, action_url=None):
    """Уведомление сотруднику CRM через Telegram (если привязан)."""
    text = '<b>{}</b>\n\n{}'.format(title, body)
    if action_url:
        text += '\n\n{}'.format(action_url)
    link = TelegramUserLink.objects.filter(user_id=user_id, is_subscribed=True).first()
    if link and link.chat_id:
        return send_message(link.chat_id, text)
    return False


def generate_link_code(user):
    """Сгенерировать/вернуть код привязки Telegram для сотрудника."""
    code = secrets.token_hex(4).upper()  # 8 символов
    TelegramUserLink.objects.update_or_create(
        user=user,
        defaults={'link_code': code, 'is_subscribed': True},
    )
    return code


def resolve_link_code(code):
    return TelegramUserLink.objects.filter(link_code__iexact=code).first()


def link_user(user, chat_id, username=''):
    TelegramUserLink.objects.update_or_create(
        user=user,
        defaults={'chat_id': str(chat_id), 'username': username or '',
                  'link_code': None, 'is_subscribed': True},
    )


def get_me():
    """Информация о боте (username, name) через getMe."""
    token = get_token()
    if not token:
        return None
    try:
        resp = _tg_request('GET', 'https://api.telegram.org/bot{}/getMe'.format(token))
        if resp.status_code == 200 and resp.json().get('ok'):
            return resp.json()['result']
    except Exception as e:
        print('[Telegram] getMe error: {}'.format(e))
    return None


def set_webhook(public_url):
    """Установить webhook на /api/telegram/webhook/"""
    token = get_token()
    if not token:
        return False, 'бот не активен или нет токена'
    webhook_url = public_url.rstrip('/') + '/api/telegram/webhook/'
    try:
        resp = _tg_request(
            'POST', 'https://api.telegram.org/bot{}/setWebhook'.format(token),
            json={'url': webhook_url, 'allowed_updates': ['message']},
        )
        ok = resp.status_code == 200 and resp.json().get('ok')
        return ok, (resp.text[:200] if not ok else '')
    except Exception as e:
        return False, str(e)


def delete_webhook():
    """Убрать webhook — чтобы работал getUpdates (polling)."""
    token = get_token()
    if not token:
        return False
    try:
        resp = _tg_request('POST', 'https://api.telegram.org/bot{}/deleteWebhook'.format(token))
        return resp.status_code == 200 and resp.json().get('ok')
    except Exception as e:
        print('[Telegram] deleteWebhook error: {}'.format(e))
        return False


_UPDATE_OFFSET = None


def poll_updates():
    """Забрать накопленные сообщения через getUpdates (long polling).
    Возвращает список update-объектов и сдвигает offset."""
    global _UPDATE_OFFSET
    token = get_token()
    if not token:
        return []
    params = {'timeout': 25, 'allowed_updates': ['message']}
    if _UPDATE_OFFSET is not None:
        params['offset'] = _UPDATE_OFFSET
    try:
        resp = _tg_request('POST', 'https://api.telegram.org/bot{}/getUpdates'.format(token), json=params)
        data = resp.json()
        updates = data.get('result') or []
        if updates:
            _UPDATE_OFFSET = updates[-1]['update_id'] + 1
        return updates
    except Exception as e:
        print('[Telegram] getUpdates error: {}'.format(e))
        return []


def handle_incoming_message(chat_id, username, text):
    """Обработка входящего сообщения (/start <код> — привязка). Возвращает dict."""
    text = (text or '').strip()
    if text.startswith('/start'):
        parts = text.split()
        code = parts[1] if len(parts) > 1 else ''
        if code:
            link = resolve_link_code(code)
            if link:
                link_user(link.user, chat_id, username)
                send_message(chat_id, '✅ Готово! Вы привязаны к CRM.\n'
                                      'Теперь сюда будут приходить уведомления о заявках и сообщениях.')
                return {'ok': True, 'action': 'linked', 'user_id': link.user_id}
            send_message(chat_id, '❌ Код не найден. Возьмите актуальный код в CRM → Настройки → Telegram.')
            return {'ok': True, 'action': 'bad_code'}

    send_message(chat_id, '👋 Привет! Это бот ВидеоСервис.\n'
                          'Отправьте <b>/start &lt;код&gt;</b>, чтобы привязать аккаунт.\n'
                          'Код — в CRM → Настройки → Telegram (кнопка «Привязать меня»).')
    return {'ok': True, 'action': 'help'}
