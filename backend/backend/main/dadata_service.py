"""
Сервис нормализации адресов через Dadata API.
Использует suggest API (доступен на всех тарифах), т.к. clean может быть отключён.
"""

import requests
import re as _re
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

DADATA_CLEAN_URL = 'https://cleaner.dadata.ru/api/v1/clean/address'
DADATA_SUGGEST_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'


def normalize_address(raw_address: str) -> dict:
    """
    Нормализует адрес через Dadata Suggest API.
    Если API недоступен — использует regex-парсер.

    Возвращает:
      {
        'city': str,            # город / нас. пункт (без «г.»)
        'region': str,          # область
        'district': str,        # район
        'street_name': str,     # чистое название улицы
        'street_type': str,     # 'street', 'avenue', etc.
        'house_number': str,    # номер дома
        'building_number': str, # корпус/строение
        'apartment': str,       # квартира
        'postal_code': str,     # индекс
        'full_address': str,    # полная строка
        'raw': str,
        'success': bool,
      }
    """
    if not raw_address:
        return _empty_result('')

    api_key = settings.DADATA_API_KEY
    secret = settings.DADATA_SECRET

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    if api_key:
        headers['Authorization'] = f'Token {api_key}'
    if secret:
        headers['X-Secret'] = secret

    # ── Пробуем Clean API (если включён в тарифе) ──
    if api_key and secret:
        try:
            resp = requests.post(DADATA_CLEAN_URL, json=[raw_address], headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data and isinstance(data, list) and len(data) > 0:
                    return _parse_dadata_item(data[0], raw_address)
        except Exception:
            pass  # fallback to suggest

    # ── Suggest API (работает всегда) ──
    if api_key and secret:
        try:
            resp = requests.post(
                DADATA_SUGGEST_URL,
                json={'query': raw_address, 'count': 1},
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                suggestions = data.get('suggestions', [])
                if suggestions:
                    item = suggestions[0].get('data', {})
                    # suggest возвращает value как полную строку
                    full_addr = suggestions[0].get('value', raw_address)
                    result = _parse_dadata_item(item, raw_address)
                    if result['success']:
                        if not result['full_address'] or result['full_address'] == raw_address:
                            result['full_address'] = full_addr
                        return result
        except Exception as e:
            logger.warning(f'Dadata suggest failed: {e}')

    # ── Fallback: regex-парсер ──
    return _regex_parse(raw_address)


def _parse_dadata_item(item: dict, raw_address: str) -> dict:
    """Парсит поля из ответа Dadata (формат и clean, и suggest одинаков)."""
    city = item.get('city') or ''
    region = item.get('region_with_type') or ''
    district = item.get('area_with_type') or ''

    # Для деревень/посёлков без города — используем settlement
    if not city:
        city = item.get('settlement') or ''
    if not city:
        # пробуем city_with_type без «г»
        cwt = item.get('city_with_type') or ''
        city = _re.sub(r'^г\.?\s*', '', cwt).strip()

    street = item.get('street') or ''
    street_type_raw = item.get('street_type', 'ул') or 'ул'
    house = item.get('house') or ''
    block = item.get('block') or ''
    flat = item.get('flat') or ''
    postal = item.get('postal_code') or ''

    has_data = bool(city or street or house)

    return {
        'city': city,
        'region': region,
        'district': district,
        'street_name': street,
        'street_type': _map_street_type(street_type_raw),
        'house_number': house,
        'building_number': block,
        'apartment': flat,
        'postal_code': postal,
        'full_address': item.get('result', raw_address) if has_data else raw_address,
        'raw': raw_address,
        'success': has_data,
    }


def _regex_parse(raw_address: str) -> dict:
    """
    Fallback-парсер адресов ERC без Dadata.
    Обрабатывает форматы:
      - «г Коммунар, ул Бумажников, д 2, кв 2»
      - «Коммунар г, Бумажников ул, 2, 2»
      - «Ленинградская обл, Гатчинский р-н, г Коммунар, ул Бумажников, д 2, кв 2»
      - «Агалатово д 144 кв 34»
    """
    s = raw_address.strip()
    region = ''
    district = ''
    city = ''
    street = ''
    house = ''
    apartment = ''

    # Область
    m = _re.search(r'([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)\s+обл', s)
    if m:
        region = m.group(0).strip()
        s = s[m.end():].lstrip(', ')

    # Район
    m = _re.search(r'([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)\s+р-н', s)
    if m:
        district = m.group(0).strip()
        s = s[m.end():].lstrip(', ')

    # Город: «г Коммунар», «г. Коммунар», «Коммунар г», «Санкт-Петербург»
    m = _re.search(r'г\.?\s*([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)\b', s)
    if m:
        city = m.group(1)
        s = s[:m.start()] + s[m.end():]
        s = s.lstrip(', ').strip()
    else:
        # Формат «Коммунар г»
        m = _re.search(r'([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)\s+г\.?\s*(?:,|$)', s)
        if m:
            city = m.group(1)
            s = s[:m.start()] + s[m.end():]
            s = s.lstrip(', ').strip()
    # Если город всё ещё пуст — берём первое слово (Санкт-Петербург, Сертолово и т.д.)
    if not city:
        m = _re.match(r'([А-ЯЁ][а-яё]+(?:\s*-\s*[А-ЯЁ][а-яё]+)*)\b', s)
        if m:
            possible = m.group(1)
            if possible not in ('Ленинградская', 'Гатчинский'):
                city = possible
                s = s[m.end():].lstrip(', ').strip()
            s = s[:m.start()] + s[m.end():]
            s = s.lstrip(', ').strip()

    # Улица: «ул Бумажников», «ул. Бумажников», «Бумажников ул»
    m = _re.search(r'ул\.?\s+([^,]+?(?=\s*,?\s*(?:д\.?|$)))', s)
    if not m:
        m = _re.search(r'([^,]+)\s+ул\.?\s*', s)
    if m:
        street = m.group(1).strip().rstrip(',')
        s = s[:m.start()] + s[m.end():]
        s = s.lstrip(', ').strip()

    # Дом: «д 2», «д. 2», «д..1» (двойная точка из СПб!), «д 15А»
    # СПб формат: «д..1 лит. А» — ловим обе точки
    m = _re.search(r'д\.\.?\s*(\d+[а-яА-ЯA-Za-z]*)', s)
    if m:
        house = m.group(1)
        s = s[:m.start()] + s[m.end():]
        s = s.lstrip(', ').strip()
        # Убираем «лит. А» если остался
        s = _re.sub(r'лит\.?\s*[А-ЯA-Z]', '', s).strip(', ')
    else:
        # Может быть просто число (без «д.»)
        # Но только если нет улицы — значит это деревня «Агалатово д 144»
        m = _re.search(r'(?:^|[,\s])(\d+[а-яА-ЯA-Za-z]?)\s*(?:,|$|\s*кв)', s)
        if m and not street:
            house = m.group(1)
            s = s[:m.start()] + s[m.end():]
            s = s.lstrip(', ').strip()

    # Квартира: «кв 2», «кв. 2», или последнее число
    m = _re.search(r'кв\.?\s*(\d+[а-яА-ЯA-Za-z]*)', s)
    if m:
        apartment = m.group(1)
    else:
        # Последнее число в строке
        nums = _re.findall(r'\b(\d+)\b', s)
        if nums:
            apartment = nums[-1]

    return {
        'city': city,
        'region': region,
        'district': district,
        'street_name': street,
        'street_type': 'street',
        'house_number': house,
        'building_number': '',
        'apartment': apartment,
        'postal_code': '',
        'full_address': raw_address,
        'raw': raw_address,
        'success': bool(city or street or house),
    }


def _map_street_type(dadata_type: str) -> str:
    mapping = {
        'ул': 'street',
        'пр-кт': 'avenue',
        'пер': 'lane',
        'б-р': 'boulevard',
        'ш': 'highway',
        'пл': 'square',
        'наб': 'embankment',
        'проезд': 'passage',
        'аллея': 'alley',
        'мкр': 'microdistrict',
    }
    return mapping.get(dadata_type, 'street')


def _empty_result(raw: str) -> dict:
    return {
        'city': '',
        'region': '',
        'district': '',
        'street_name': '',
        'street_type': 'street',
        'house_number': '',
        'building_number': '',
        'apartment': '',
        'postal_code': '',
        'full_address': raw,
        'raw': raw,
        'success': False,
    }
