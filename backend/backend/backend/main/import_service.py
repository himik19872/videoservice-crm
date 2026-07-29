"""
Сервис импорта данных из Excel-файлов.

Поддерживает:
1. База клиентов (ТСЖ/УК): с гибким маппингом колонок
2. Оборотная ведомость ЕРЦ (форма № 30.01.01): автоопределение колонок по заголовкам.

Адрес парсится локально (без внешних API) с поддержкой пригородов СПб.
"""

import io
import re
from datetime import datetime
from collections import defaultdict
import openpyxl


# ══════════════════════════════════════════════════════════════════
# Словарь пригородов Санкт-Петербурга (город в городе)
# ══════════════════════════════════════════════════════════════════

SPB_SUBURBS = {
    'петергоф': 'Петергоф',
    'петродворец': 'Петергоф',
    'ломоносов': 'Ломоносов',
    'колпино': 'Колпино',
    'пушкин': 'Пушкин',
    'царское село': 'Пушкин',
    'павловск': 'Павловск',
    'кронштадт': 'Кронштадт',
    'сестрорецк': 'Сестрорецк',
    'зеленогорск': 'Зеленогорск',
    'красное село': 'Красное Село',
    'гатчина': 'Гатчина',
    'стрельна': 'Стрельна',
    'шушары': 'Шушары',
    'парголово': 'Парголово',
    'левашово': 'Левашово',
    'репино': 'Репино',
    'комарово': 'Комарово',
    'солнечное': 'Солнечное',
    'белоостров': 'Белоостров',
    'серово': 'Серово',
    'усть-ижора': 'Усть-Ижора',
    'понтонный': 'Понтонный',
    'металлострой': 'Металлострой',
    'сапёрный': 'Сапёрный',
    'петро-славянка': 'Петро-Славянка',
    'динамо': 'Динамо',
    'рощино': 'Рощино',
    'молодёжное': 'Молодёжное',
    'сосново': 'Сосново',
    'всеволожск': 'Всеволожск',
    'тосненский': 'Тосно',
}

# Типы улиц (ключевые слова для поиска)
STREET_TYPES = [
    'ул.', ' ул', 'улица',
    'пр-кт', 'пр.', 'пр ', 'проспект',
    'пер.', 'пер ', 'переулок',
    'наб.', 'наб ', 'набережная',
    'шоссе', 'ш.', 'ш ',
    'бульвар', 'б-р', 'бул.',
    'аллея', 'проезд', 'пл.', 'площадь',
    'линия', 'дорога', 'дор.', 'тупик',
    'канал', 'кан.', 'мост', 'м.',
    'тракт', 'промузел',
]


def parse_address(raw_address):
    """
    Локальный парсер адресов (без внешних API).
    Поддерживает пригороды СПб (в скобках и вне скобок).
    
    Возвращает dict: city, street, district, house, building, apartment, full.
    """
    result = {
        'city': 'Санкт-Петербург',
        'street': '',
        'district': '',
        'house': '',
        'building': '',
        'apartment': '',
        'full': raw_address.strip() if raw_address else '',
    }

    if not raw_address or not raw_address.strip():
        return result

    raw = raw_address.strip()
    text = raw

    # ── 1. Выделяем содержимое скобок — пригород/район ──
    bracket_match = re.search(r'\(([^)]+)\)', text)
    bracket_text = ''
    if bracket_match:
        bracket_text = bracket_match.group(1).strip().lower()
        text = text.replace(bracket_match.group(0), '').strip()
        text = re.sub(r',\s*,', ',', text)
        text = re.sub(r'\s{2,}', ' ', text)

    # ── 2. Разбиваем по запятым ──
    parts = [p.strip() for p in text.split(',') if p.strip()]

    # ── 3. Определяем город ──
    city_found = None
    if parts:
        first = parts[0].lower()
        if any(c in first for c in ['санкт-петербург', 'спб', 'москва']):
            city_found = 'Санкт-Петербург' if 'москва' not in first else 'Москва'
            parts = parts[1:]

    # Проверяем скобки на пригород
    if bracket_text:
        for key, val in SPB_SUBURBS.items():
            if key in bracket_text:
                city_found = val
                result['district'] = val  # пригород = и город, и район
                break
        if not city_found:
            # Не пригород — значит район (Петродворцовый, Приморский...)
            result['district'] = bracket_text.title()
            if not city_found:
                city_found = 'Санкт-Петербург'

    # Проверяем сами части на пригород
    if not city_found or city_found == 'Санкт-Петербург':
        for i, p in enumerate(parts):
            for key, val in SPB_SUBURBS.items():
                if key in p.lower() and key not in (result.get('street') or '').lower():
                    city_found = val
                    if not result['district']:
                        result['district'] = val
                    # Убираем название города из части (оставляем остальное как улицу)
                    parts[i] = re.sub(r'(?i)\b' + re.escape(key) + r'\b\s*', '', p).strip()
                    if not parts[i]:
                        parts.pop(i)
                    break
            if city_found and city_found != 'Санкт-Петербург':
                break

    result['city'] = city_found or 'Санкт-Петербург'

    # ── 4. Ищем улицу ──
    street_idx = -1
    for i, p in enumerate(parts):
        p_lower = p.lower()
        for st in STREET_TYPES:
            if st in p_lower or p_lower.startswith(st.replace('.', '')):
                street_idx = i
                break
        if street_idx >= 0:
            break

    if street_idx >= 0:
        result['street'] = parts[street_idx]
    elif parts:
        # Нет типа улицы — берём первую непохожую на дом/квартиру часть
        for i, p in enumerate(parts):
            if not re.search(r'д\.\s*\d|дом\s*\d|корп|кв\.?\s*\d|^\d+$', p.lower()):
                result['street'] = p
                street_idx = i
                break

    # ── 5. Дом, корпус, квартира ──
    remaining = parts[max(street_idx + 1, 0):]

    for p in remaining:
        p_clean = p.strip()

        # Литера: "лит. А", "литера А", "лит А"
        lit_match = re.search(r'лит\.?\s*([а-яА-Яa-zA-Z])', p_clean, re.IGNORECASE)
        if lit_match:
            if result['building']:
                result['building'] += f' литера {lit_match.group(1).upper()}'
            else:
                result['building'] = f'литера {lit_match.group(1).upper()}'
            p_clean = re.sub(r'лит\.?\s*[а-яА-Яa-zA-Z]', '', p_clean, flags=re.IGNORECASE).strip()

        # Корпус/строение: "корп. 3", "корп 3", "к.3", "стр. 2"
        corp_match = re.search(r'(?:корп|к|стр)\.?\s*(\d+[а-яА-Яa-zA-Z]?)', p_clean, re.IGNORECASE)
        if corp_match:
            corp_val = corp_match.group(1)
            if result['building']:
                result['building'] += f' корп. {corp_val}'
            else:
                result['building'] = corp_val
            p_clean = re.sub(r'(?:корп|к|стр)\.?\s*\d+[а-яА-Яa-zA-Z]?', '', p_clean, flags=re.IGNORECASE).strip()

        # Дом: "д. 37", "д..37", "д 37А", "дом 37"
        house_match = re.search(r'д\.?\.?\s*(\d+[а-яА-Яa-zA-Z]*)', p_clean, re.IGNORECASE)
        if house_match and not result['house']:
            result['house'] = house_match.group(1)
            p_clean = re.sub(r'д\.?\.?\s*\d+[а-яА-Яa-zA-Z]*', '', p_clean, flags=re.IGNORECASE).strip()

        # Квартира: число в конце (после всего)
        apt_match = re.search(r'(?:\d+)\s*$', p_clean.strip().rstrip(','))
        if apt_match and result['house'] and not result['apartment']:
            result['apartment'] = apt_match.group(0).strip()

        # Дом без префикса: просто число
        if not result['house']:
            num_match = re.search(r'^(\d+[а-яА-Яa-zA-Z]?)$', p_clean.strip().rstrip(','))
            if num_match:
                result['house'] = num_match.group(1)

    # ── 6. Собираем полный адрес ──
    address_parts = []
    city_name = result['city']
    if city_name != 'Санкт-Петербург':
        address_parts.append(f'г. {city_name}')
    else:
        address_parts.append('Санкт-Петербург')

    if result['district'] and result['district'] != city_name and result['district'] not in address_parts[-1]:
        address_parts.append(result['district'])
    if result['street']:
        address_parts.append(result['street'])
    if result['house']:
        house_str = f'д. {result["house"]}'
        if result['building']:
            # Если building содержит "корп." — не дублируем
            if 'корп.' in result['building'] or 'литера' in result['building']:
                house_str += f', {result["building"]}'
            else:
                house_str += f' корп. {result["building"]}'
        address_parts.append(house_str)
    if result['apartment']:
        address_parts.append(f'кв. {result["apartment"]}')

    result['full'] = ', '.join(address_parts)
    return result


# ══════════════════════════════════════════════════════════════════
# Импорт базы клиентов (ТСЖ) — с гибким маппингом колонок
# ══════════════════════════════════════════════════════════════════

DEFAULT_COLUMN_MAP = {
    'name': 2,           # ФИО (индекс 2 = колонка C)
    'address': 3,        # Адрес (индекс 3 = колонка D)
    'entrance': 4,       # № парадной (индекс 4 = колонка E)
    'management_company': 5,  # ТСЖ/УК (индекс 5 = колонка F)
    'personal_account': 1,    # № лицевого счёта (индекс 1 = колонка B)
}


def import_clients_from_excel(file_bytes, user, column_map=None):
    """
    Импорт клиентов из Excel-файла (ТСЖ/УК).
    
    Args:
        file_bytes: содержимое .xlsx файла
        user: пользователь Django (для логов)
        column_map: dict с маппингом колонок (0-based индексы):
            {'name': 2, 'address': 3, 'entrance': 4, 'management_company': 5, 'personal_account': 1}
            Если None — используется DEFAULT_COLUMN_MAP.
    
    Возвращает: dict { success, total, created, updated, errors }
    """
    from .models import Client, Building

    cm = column_map or DEFAULT_COLUMN_MAP

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(min_row=2, values_only=True))
    total = 0
    created = 0
    updated = 0
    buildings_created = 0
    errors = []

    for row in rows:
        if not row:
            continue

        total += 1
        try:
            def get_col(key, default=''):
                idx = cm.get(key, -1)
                if 0 <= idx < len(row) and row[idx] is not None:
                    return str(row[idx]).strip()
                return default

            full_name = get_col('name', 'Не определено')
            raw_address = get_col('address', '')
            entrance_val = get_col('entrance', '')
            management_company = get_col('management_company', '')
            personal_account = get_col('personal_account', '')

            if not full_name and not raw_address and not management_company:
                continue

            # Парсим адрес
            parsed = parse_address(raw_address)
            address = parsed['full'] if parsed['full'] else raw_address

            # ── Найти или создать Building (дом) ──
            building = None
            if parsed['street'] and parsed['house']:
                # Чистим улицу от типа
                street_clean = parsed['street']
                for st in STREET_TYPES:
                    street_clean = re.sub(r'\b' + re.escape(st) + r'\b\.?', '', street_clean, flags=re.IGNORECASE).strip()

                building, _bcreated = Building.objects.get_or_create(
                    city=parsed['city'] or 'Санкт-Петербург',
                    street_name=street_clean or parsed['street'],
                    house_number=parsed['house'],
                    building_number=parsed['building'] or '',
                    defaults={
                        'district': parsed['district'] or '',
                        'management_company': management_company,
                    }
                )
                if _bcreated:
                    buildings_created += 1

            # Ищем существующего клиента
            existing = None
            if personal_account:
                existing = Client.objects.filter(personal_account_number=personal_account).first()
            if not existing and building and parsed['apartment']:
                existing = Client.objects.filter(building=building, apartment=parsed['apartment']).first()
            if not existing and address:
                existing = Client.objects.filter(address=address, name=full_name).first()

            client_data = {
                'name': full_name or 'Не определено',
                'address': address,
                'phone': '',
                'building': building,
                'apartment': parsed['apartment'] or '',
                'entrance': entrance_val or '',
                'entrance_number': entrance_val,
                'management_company': management_company,
                'district': parsed['district'],
                'personal_account_number': personal_account,
                'source': 'excel_import',
            }

            if existing:
                for k, v in client_data.items():
                    if v: setattr(existing, k, v)
                existing.save()
                updated += 1
            else:
                Client.objects.create(**client_data)
                created += 1

        except Exception as e:
            errors.append(f'Строка {total}: {str(e)}')

    return {
        'success': True,
        'total': total,
        'created': created,
        'updated': updated,
        'buildings_created': buildings_created,
        'errors': errors,
    }


# ══════════════════════════════════════════════════════════════════
# Импорт ЕРЦ — универсальный (4 формата)
# ══════════════════════════════════════════════════════════════════

def _find_column_indices(header_rows, ws_max_column):
    """Ищет индексы колонок по заголовкам. 4 формата ЕРЦ."""
    max_cols = max(len(row) for row in header_rows if row)
    combined = [''] * max_cols
    
    for row in header_rows:
        if not row:
            continue
        for i in range(len(row)):
            if i < len(combined) and row[i] is not None:
                combined[i] += ' ' + str(row[i]).lower().strip()

    def has(idx, *words):
        if idx >= len(combined):
            return False
        return any(w in combined[idx] for w in words)

    mapping = {}
    fmt = 'standard'

    mapping['account_number'] = 1
    mapping['full_name'] = 2

    if has(3, 'дебет') and has(4, 'кредит'):
        fmt = 'lo'
        mapping['period'] = 0
        mapping['debet'] = 3
        mapping['credit'] = 4
    elif has(0, '№п/п') and has(3, 'начисл'):
        fmt = 'standard'
        mapping['accrued'] = 3
        mapping['paid'] = 4
        mapping['debt_start'] = 5
        mapping['debt_end'] = 6
    else:
        fmt = 'agalatovo'
        mapping['accrued'] = 3
        mapping['paid'] = 4
        mapping['debt_end'] = 6

    return mapping, fmt


def import_erc_from_excel(file_bytes, user, period_date=None):
    """Импорт данных ЕРЦ из Excel."""
    from .models import ErcAccount, ErcBillingRecord

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    all_rows = list(ws.iter_rows(min_row=1, values_only=True))

    header_rows = all_rows[:5]
    mapping, fmt = _find_column_indices(header_rows, ws.max_column)

    rows = all_rows[5:]
    total = 0
    created = 0
    errors = []

    for row in rows:
        if not row:
            continue
        total += 1
        try:
            acc_num = str(row[mapping['account_number']]).strip() if len(row) > mapping['account_number'] and row[mapping['account_number']] else ''
            if not acc_num or acc_num == 'None':
                continue

            name = str(row[mapping['full_name']]).strip() if len(row) > mapping['full_name'] else ''

            account, _ = ErcAccount.objects.get_or_create(
                account_number=acc_num,
                defaults={'full_name': name, 'address': ''}
            )

            if fmt == 'lo':
                debet = float(row[mapping['debet']]) if len(row) > mapping['debet'] and row[mapping['debet']] else 0
                credit = float(row[mapping['credit']]) if len(row) > mapping['credit'] and row[mapping['credit']] else 0
                ErcBillingRecord.objects.update_or_create(
                    account=account, period=period_date or datetime.now().date().replace(day=1),
                    defaults={'debet': debet, 'credit': credit}
                )
            else:
                accrued = float(row[mapping['accrued']]) if len(row) > mapping['accrued'] and row[mapping['accrued']] else 0
                paid = float(row[mapping['paid']]) if len(row) > mapping['paid'] and row[mapping['paid']] else 0
                ErcBillingRecord.objects.update_or_create(
                    account=account, period=period_date or datetime.now().date().replace(day=1),
                    defaults={'charged': accrued, 'paid': paid}
                )
            created += 1
        except Exception as e:
            errors.append(f'Строка {total}: {str(e)}')

    return {
        'success': True,
        'total': total,
        'created': created,
        'errors': errors,
    }


# ══════════════════════════════════════════════════════════════════
# Предпросмотр Excel
# ══════════════════════════════════════════════════════════════════

def preview_excel(file_bytes):
    """Предпросмотр первых 10 строк Excel."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(min_row=1, max_row=11, values_only=True))
    headers = [str(c) if c else '' for c in rows[0]] if rows else []
    data = [[str(c) if c is not None else '' for c in row] for row in rows[1:]]

    return {
        'success': True,
        'headers': headers,
        'rows': data,
        'total_rows': ws.max_row - 1,
        'total_columns': ws.max_column,
    }
