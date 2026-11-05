"""Геокодирование адресов для построения маршрута в навигаторе.

Порядок попыток:
  1. DaData (если тариф поддерживает SUGGESTIONS/CLEAN — на некоторых
     тарифах API отключён и отвечает 403);
  2. Nominatim (OpenStreetMap) — бесплатно, без ключа. Требует вежливого
     обращения: не чаще 1 запроса в секунду и осмысленный User-Agent.

Возвращает (широта, долгота, уточнённый адрес) или None.
"""
import logging
import re
import time

import requests

logger = logging.getLogger(__name__)

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'VideoServiceCRM/1.0 (CRM for video surveillance service; +https://github.com/himik19872)'

# Мусор в адресе, который мешает геокодеру
_NOISE_RE = re.compile(
    r'(\bлитера\s+[А-Яа-яA-Za-z]|\bкорп\.?\s*\d+|\bкорпус\s*\d+|'
    r'\bкв\.?\s*[\w\-/]+|\bквартира\s*[\w\-/]+|\bпод\.?\s*\d+|\bподъезд\s*\d+|'
    r'\bофис\s*[\w\-/]+|\bэтаж\s*\d+)',
    re.IGNORECASE,
)


def clean_address(raw: str) -> str:
    """Привести адрес к виду, который понимает геокодер.

    Nominatim, например, не находит адрес, если оставить «г Санкт-Петербург»,
    «д. 10» или «корп. 5» — поэтому убираем сокращения и приводим корпус к «к5».
    """
    if not raw:
        return ''
    text = raw
    # корпус/корп. 5 → к5
    text = re.sub(r'\bкорп(?:ус)?\.?\s*(\d+[А-Яа-яA-Za-z]?)', r'к\1', text, flags=re.IGNORECASE)
    # литера А / лит. А
    text = re.sub(r'\bлит(?:ера)?\.?\s*[А-Яа-яA-Za-z]\b', ' ', text, flags=re.IGNORECASE)
    # квартира/офис/подъезд/этаж с номером
    text = re.sub(
        r'\b(?:кв|квартира|офис|под|подъезд|этаж)\.?\s*[\w\-/]+',
        ' ', text, flags=re.IGNORECASE,
    )
    # д. 10 / дом 10 → 10
    text = re.sub(r'\bд(?:ом)?\.?\s*(\d)', r'\1', text, flags=re.IGNORECASE)
    # ведущее «г»/«город»: «г Санкт-Петербург» → «Санкт-Петербург»
    text = re.sub(r'^\s*г(?:ород)?\.?\s+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'(,\s*)г(?:ород)?\.?\s+', r'\1', text, flags=re.IGNORECASE)
    text = re.sub(r'\bг\.\s*', '', text)
    # «10 к5» → «10к5» (геокодеры лучше понимают слитно)
    text = re.sub(r'(\d)\s+к(\d)', r'\1к\2', text)
    # чистка пробелов и висячих запятых
    text = re.sub(r'\s{2,}', ' ', text)
    text = re.sub(r'\s*,\s*(,\s*)+', ', ', text)
    text = re.sub(r'^\s*,\s*|\s*,\s*$', '', text)
    return text.strip()


def _try_dadata(raw: str):
    try:
        from .dadata_service import normalize_address
        result = normalize_address(raw)
    except Exception as e:
        logger.warning('DaData geocode error: %s', e)
        return None
    lat, lon = result.get('latitude'), result.get('longitude')
    if lat is not None and lon is not None:
        return float(lat), float(lon), result.get('full_address') or raw
    return None


def _try_nominatim(query: str):
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={'q': query, 'format': 'json', 'limit': 1, 'addressdetails': 0},
            headers={'User-Agent': USER_AGENT, 'Accept-Language': 'ru'},
            timeout=15,
        )
    except Exception as e:
        logger.warning('Nominatim request error: %s', e)
        return None
    if resp.status_code != 200:
        logger.warning('Nominatim HTTP %s for %r', resp.status_code, query)
        return None
    try:
        data = resp.json()
    except Exception:
        return None
    if not data:
        return None
    try:
        return float(data[0]['lat']), float(data[0]['lon']), data[0].get('display_name') or query
    except (KeyError, TypeError, ValueError):
        return None


def build_queries(city='', street='', house='', building='', full_address='', hints=None):
    """Варианты запроса от самого точного к самому общему."""
    city = clean_address(city)
    street = clean_address(street)
    house = (house or '').strip()
    building = (building or '').strip()
    hints = [h for h in (hints or []) if h]

    houses = []
    if house:
        if building:
            houses.append(f'{house}{building}')      # 3а
            houses.append(f'{house} к {building}')   # 3 к а
        houses.append(house)

    queries = []
    base = ', '.join([p for p in (city, street) if p])

    # 1. Точный вариант с городом
    if base and houses:
        for h in houses:
            queries.append(f'{base}, {h}')
    elif base:
        queries.append(base)

    # 2. С подсказками (посёлок/район) — когда улица есть в разных районах
    for hint in hints:
        parts = [street or base, houses[0] if houses else '', hint, city]
        q = ', '.join([p for p in parts if p])
        if q:
            queries.append(q)

    # 3. Полный адрес из карточки
    full = clean_address(full_address or '')
    if full:
        queries.append(full)

    # 4. Совсем общий вариант — только улица и город
    if base and base not in queries:
        queries.append(base)

    # Убираем дубли, сохраняя порядок
    seen = set()
    result = []
    for q in queries:
        q = q.strip(' ,')
        if q and q not in seen:
            seen.add(q)
            result.append(q)
    return result


def extract_hints(*addresses):
    """Достать уточнения из адреса: посёлок в скобках и район «р-н»."""
    hints = []
    for raw in addresses:
        if not raw:
            continue
        for m in re.findall(r'\(([^)]{3,40})\)', raw):
            hints.append(m.strip())
        for m in re.findall(r'([А-ЯЁ][а-яё\-]+)\s+р-н', raw):
            hints.append(m.strip())
    seen = set()
    result = []
    for h in hints:
        key = h.lower()
        if key not in seen:
            seen.add(key)
            result.append(h)
    return result


def _plausible(display_name, hints):
    """Отбросить явно неверный результат (улица нашлась в другом районе)."""
    if not display_name:
        return True
    if not hints:
        return True
    d = display_name.lower()
    return any(h.lower() in d for h in hints)


def geocode_address(city='', street='', house='', building='', full_address='', hints=None):
    """Определить координаты адреса. Возвращает (lat, lon, адрес) или None."""
    queries = build_queries(city, street, house, building, full_address, hints)
    if not queries:
        return None

    # 1. DaData — только одним запросом (там работает точный cleaner)
    for q in queries[:1]:
        res = _try_dadata(q)
        if res and _plausible(res[2], hints):
            return res

    # 2. Nominatim — перебираем варианты, соблюдая лимит 1 req/sec
    for idx, q in enumerate(queries[:5]):
        if idx > 0:
            time.sleep(1.1)
        res = _try_nominatim(q)
        if res and _plausible(res[2], hints):
            return res

    return None
