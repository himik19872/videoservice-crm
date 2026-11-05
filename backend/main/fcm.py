"""Прямая отправка push-уведомлений в Firebase Cloud Messaging (HTTP v1).

Работает по сервис-аккаунту Firebase (JSON из Firebase Console → Сервисные аккаунты).
Используется для APK, собранных локально: такие сборки получают обычный FCM-токен,
а не ExpoPushToken, поэтому отправлять нужно напрямую в FCM.

JWT-подпись формируется через `cryptography` (PyJWT в образе нет).
"""
import base64
import json
import os
import time

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

# Где искать сервис-аккаунт (первый существующий файл)
CREDENTIALS_CANDIDATES = [
    os.environ.get('FIREBASE_CREDENTIALS', ''),
    '/app/host/secrets/firebase-service-account.json',
    '/app/host/dok/videoservice-crm-firebase-adminsdk-fbsvc-d091478b36.json',
    '/app/dok/videoservice-crm-firebase-adminsdk-fbsvc-d091478b36.json',
]

_cache = {'token': None, 'expires_at': 0, 'project_id': None}
_creds = None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def load_credentials(force=False):
    global _creds
    if _creds and not force:
        return _creds
    for path in CREDENTIALS_CANDIDATES:
        if path and os.path.exists(path):
            try:
                with open(path, 'r') as fh:
                    _creds = json.load(fh)
                _cache['project_id'] = _creds.get('project_id')
                return _creds
            except Exception as e:
                print('[FCM] Ошибка чтения сервис-аккаунта {}: {}'.format(path, e))
    return None


def get_access_token(force=False):
    """OAuth2-токен по JWT-утверждению сервис-аккаунта (кэшируется на час)"""
    creds = load_credentials()
    if not creds:
        return None
    now = time.time()
    if not force and _cache['token'] and _cache['expires_at'] > now + 60:
        return _cache['token']

    header = {'alg': 'RS256', 'typ': 'JWT'}
    payload = {
        'iss': creds['client_email'],
        'scope': FCM_SCOPE,
        'aud': creds.get('token_uri') or 'https://oauth2.googleapis.com/token',
        'iat': int(now),
        'exp': int(now) + 3600,
    }
    signing_input = '{}.{}'.format(
        _b64url(json.dumps(header, separators=(',', ':')).encode()),
        _b64url(json.dumps(payload, separators=(',', ':')).encode()),
    )
    try:
        key = serialization.load_pem_private_key(creds['private_key'].encode(), password=None)
        signature = key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    except Exception as e:
        print('[FCM] Ошибка подписи JWT: {}'.format(e))
        return None

    assertion = '{}.{}'.format(signing_input, _b64url(signature))
    try:
        resp = requests.post(
            creds.get('token_uri') or 'https://oauth2.googleapis.com/token',
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': assertion,
            },
            timeout=15,
        )
    except Exception as e:
        print('[FCM] Ошибка запроса токена: {}'.format(e))
        return None

    if resp.status_code != 200:
        print('[FCM] Token HTTP {}: {}'.format(resp.status_code, resp.text[:200]))
        return None

    data = resp.json()
    _cache['token'] = data.get('access_token')
    _cache['expires_at'] = now + int(data.get('expires_in', 3600))
    return _cache['token']


def is_configured():
    return load_credentials() is not None


def send_to_token(token, title, body, data=None):
    """Отправить push на конкретный FCM-токен. Возвращает (ok, текст_ошибки)"""
    creds = load_credentials()
    access = get_access_token()
    project_id = (creds or {}).get('project_id')
    if not access or not project_id:
        return False, 'не настроен сервис-аккаунт Firebase'

    message = {
        'message': {
            'token': token,
            'notification': {'title': title, 'body': body},
            'data': {str(k): str(v) for k, v in (data or {}).items()},
            'android': {
                'priority': 'HIGH',
                'notification': {
                    'channel_id': 'default',
                    'sound': 'default',
                    'default_vibrate_timings': True,
                },
            },
            'apns': {'payload': {'aps': {'sound': 'default'}}},
        }
    }
    try:
        resp = requests.post(
            'https://fcm.googleapis.com/v1/projects/{}/messages:send'.format(project_id),
            headers={'Authorization': 'Bearer ' + access, 'Content-Type': 'application/json'},
            json=message,
            timeout=15,
        )
    except Exception as e:
        return False, 'сеть: {}'.format(e)

    if resp.status_code == 200:
        return True, ''
    return False, 'HTTP {}: {}'.format(resp.status_code, resp.text[:200])
