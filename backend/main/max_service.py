"""
Max Bot Service — уведомления для клиентов и мастеров
API: POST https://platform-api2.max.ru/messages?user_id={user_id}
Бот: https://max.ru/se13477973_bot
"""
import requests
import os

CA_BUNDLE = "/usr/local/share/ca-certificates/russian_trusted_root.crt"
from .models import SystemSettings, PushToken
from .models import MaxUserLink, Client


def _get_settings():
    return SystemSettings.objects.first()


def _get_token():
    s = _get_settings()
    return s.max_bot_token if s and s.max_bot_active else None


def max_send_by_user_id(max_user_id, text):
    """Отправить сообщение конкретному Max-пользователю по его user_id."""
    token = _get_token()
    if not token:
        return False
    try:
        url = f"https://platform-api2.max.ru/messages?user_id={max_user_id}"
        resp = requests.post(url, json={'text': text}, headers={
            'Authorization': token, 'Content-Type': 'application/json',
        }, timeout=10, verify=CA_BUNDLE)
        ok = resp.status_code == 200
        print(f'Max: user_id={max_user_id} -> {"OK" if ok else resp.text[:100]}')
        return ok
    except Exception as e:
        print(f'Max error: {e}')
        return False


def max_send_by_phone(phone, text):
    """Отправить сообщение клиенту по номеру телефона.
    Ищет MaxUserLink с этим телефоном, если нет — возвращает False.
    """
    token = _get_token()
    if not token:
        return False
    phone = phone.strip().replace(' ', '').replace('-', '')
    link = MaxUserLink.objects.filter(phone=phone, is_subscribed=True).first()
    if not link or not link.max_user_id:
        print(f'Max: no link for phone {phone}')
        return False
    return max_send_by_user_id(link.max_user_id, text)


def notify_client_order_assigned(client_id, order_number, order_type, address, master_name, master_phone):
    """Клиенту: назначен мастер."""
    text = (
        f"🔧 <b>Заявка #{order_number}</b>\n"
        f"Тип: {order_type}\n"
        f"Адрес: {address}\n\n"
        f"👨‍🔧 Назначен мастер: <b>{master_name}</b>\n"
        f"📞 Телефон: {master_phone}\n\n"
        f"Мастер свяжется с вами для уточнения времени."
    )
    return _notify_client(client_id, text)


def notify_client_order_completed(client_id, order_number, order_type, address, has_photos=False):
    """Клиенту: заявка выполнена."""
    text = (
        f"✅ <b>Заявка #{order_number} выполнена!</b>\n"
        f"Тип: {order_type}\n"
        f"Адрес: {address}\n\n"
        f"Спасибо, что выбрали нас! "
    )
    if has_photos:
        text += "\n📸 Фото отчёт прилагается."
    text += "\nЕсли остались вопросы — позвоните диспетчеру."
    return _notify_client(client_id, text)


def notify_client_order_confirmed(client_id, order_number, order_type, address, has_photos=False, has_videos=False, master_name=''):
    """Клиенту: заявка подтверждена диспетчером (отчёт о выполненной работе)."""
    text = (
        f"✅ <b>Заявка #{order_number} выполнена!</b>\n"
        f"Тип: {order_type}\n"
        f"Адрес: {address}"
    )
    if master_name:
        text += f"\n👨‍🔧 Мастер: {master_name}"
    text += "\n\nРаботы проверены и приняты диспетчером."
    if has_photos and has_videos:
        text += "\n📸📹 Фото и видео отчёт прилагаются."
    elif has_photos:
        text += "\n📸 Фото отчёт прилагается."
    elif has_videos:
        text += "\n📹 Видео отчёт прилагается."
    text += "\n\nСпасибо, что выбрали нас!"
    return _notify_client(client_id, text)


def _notify_client(client_id, text):
    """Внутренний метод: отправка клиенту по Client.id."""
    try:
        client = Client.objects.get(id=client_id)

        # 1. Прямая отправка по max_user_id клиента
        if client.max_user_id:
            if max_send_by_user_id(client.max_user_id, text):
                return True

        # 2. Поиск по телефону в MaxUserLink
        phone = client.phone.strip().replace(' ', '').replace('-', '') if client.phone else ''
        if phone:
            # Нормализуем телефон
            if phone.startswith('8'):
                phone = '+7' + phone[1:]
            elif not phone.startswith('+'):
                phone = '+7' + phone
            sent = max_send_by_phone(phone, text)
            if sent:
                return True

            # 3. Фоллбэк: User с таким же телефоном
            from django.contrib.auth.models import User
            user = User.objects.filter(max_link__phone=phone, max_link__is_subscribed=True).first()
            if user:
                return max_send_by_user_id(user.max_link.max_user_id, text)
        return False
    except Exception as e:
        print(f'Notify client error: {e}')
        return False


def send_notification_to_user(user_id, title, body, action_url=None):
    """Уведомление пользователю CRM (мастер/диспетчер): Max → Expo Push."""
    max_text = f"<b>{title}</b>\n\n{body}"
    link = MaxUserLink.objects.filter(user_id=user_id, is_subscribed=True).first()
    if link and link.max_user_id:
        if max_send_by_user_id(link.max_user_id, max_text):
            return True
    # Fallback: Expo Push
    _send_expo_push(user_id, title, body)
    return False


def _send_expo_push(user_id, title, body):
    import requests as req
    tokens = PushToken.objects.filter(user_id=user_id, is_active=True).values_list('token', flat=True)
    if not tokens:
        print(f'[Push] No tokens for user_id={user_id}')
        return
    try:
        resp = req.post('https://exp.host/--/api/v2/push/send', json=[
            {'to': t, 'title': title, 'body': body, 'sound': 'default'} for t in tokens
        ], timeout=10)  # без CA_BUNDLE — exp.host использует стандартный Let's Encrypt
        print(f'[Push] Expo response for user_id={user_id}: {resp.status_code} {resp.text[:200]}')
    except Exception as e:
        print(f'[Push] Expo push error for user_id={user_id}: {e}')


def link_max_user(user, max_user_id, phone=''):
    MaxUserLink.objects.update_or_create(
        user=user,
        defaults={'max_user_id': str(max_user_id), 'is_subscribed': True, 'phone': phone}
    )
