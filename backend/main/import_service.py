"""
Сервис импорта данных из Excel-файлов.

Поддерживает два формата:
1. База клиентов (ТСЖ/УК): № п/п, № лицевого счета, ФИО, Адрес, № парадной, ТСЖ
   Лицевой счёт игнорируется. Адрес парсится на: город, улица, район, дом, корпус, квартира.
2. Оборотная ведомость ЕРЦ (форма № 30.01.01): автоопределение колонок по заголовкам.
"""

import io
import re
from datetime import datetime
from collections import defaultdict
import openpyxl


# ══════════════════════════════════════════════════════════════════
# Парсинг адреса
# ══════════════════════════════════════════════════════════════════

# Пример: "Санкт-Петербург, Аврова (Петергоф) ул, д..5 корп. 2, 19"
# Город: Санкт-Петербург
# Улица: Аврова
# Район (в скобках): Петергоф
# Дом: 5
# Корпус: 2
# Квартира: 19

def parse_address(raw_address):
    """
    Разбирает адрес на составные части.
    Возвращает dict: city, street, district, house, building, apartment.
    """
    result = {
        'city': '',
        'street': '',
        'district': '',  # район в скобках, например Петергоф
        'house': '',
        'building': '',
        'apartment': '',
        'full': raw_address.strip(),
    }

    if not raw_address:
        return result

    text = raw_address.strip()
    result['full'] = text

    # 1. Выделяем район из скобок: (Петергоф), (Ломоносов) и т.д.
    district_match = re.search(r'\(([^)]+)\)', text)
    if district_match:
        result['district'] = district_match.group(1).strip()
        text = text.replace(district_match.group(0), '').strip()
        # Убираем двойные запятые/пробелы
        text = re.sub(r',\s*,', ',', text)
        text = re.sub(r'\s{2,}', ' ', text)

    # 2. Разбиваем по запятым
    parts = [p.strip() for p in text.split(',') if p.strip()]

    # Первая часть — обычно "Город, ..."
    if parts:
        first = parts[0]
        # Проверяем: если первая часть — город (Санкт-Петербург, Москва...)
        if any(city in first for city in ['Санкт-Петербург', 'Москва', 'СПб', 'Спб']):
            result['city'] = first.replace('СПб', 'Санкт-Петербург').replace('Спб', 'Санкт-Петербург')
            parts = parts[1:]  # убираем город

    # 3. Улица — ищем часть с "ул", "пр", "пер" и т.д.
    street_idx = -1
    for i, p in enumerate(parts):
        p_lower = p.lower()
        if any(kw in p_lower for kw in [' ул', 'ул.', ' ул.', 'пр-кт', 'пр.', 'пер.', 'наб.', 'шоссе', 'проезд', 'аллея', 'бульвар']):
            street_idx = i
            break
    if street_idx == -1:
        # Если нет типа улицы, берём первую непохожую на дом часть
        for i, p in enumerate(parts):
            if not re.search(r'д\.\s*\d|дом\s*\d|корп\.?\s*\d|кв\.?\s*\d|\d+$', p.lower()):
                street_idx = i
                break

    if street_idx >= 0:
        result['street'] = parts[street_idx]

    # 4. Дом, корпус, квартира — ищем в оставшихся частях
    remaining = parts[max(street_idx + 1, 0):]

    for p in remaining:
        p_clean = p.strip()

        # Корпус: "корп. 2" или "к. 2"
        corp_match = re.search(r'корп\.?\s*(\S+)', p_clean, re.IGNORECASE)
        if corp_match:
            result['building'] = corp_match.group(1).rstrip(',')
            p_clean = re.sub(r'корп\.?\s*\S+', '', p_clean, flags=re.IGNORECASE).strip()

        # Дом: "д. 5", "д..5", "дом 5", просто "5" в начале
        house_match = re.search(r'д\.?\.?\s*(\d+[а-яА-Яa-zA-Z]*)', p_clean, re.IGNORECASE)
        if house_match and not result['house']:
            result['house'] = house_match.group(1)
            p_clean = re.sub(r'д\.?\.?\s*\d+[а-яА-Яa-zA-Z]*', '', p_clean, flags=re.IGNORECASE).strip()

        # Квартира: просто число в конце
        apt_match = re.search(r'(?:кв\.?|квартира)?\s*(\d+)$', p_clean, re.IGNORECASE)
        if apt_match and not result['apartment']:
            apt_num = apt_match.group(1)
            # Не путаем с домом: если число маленькое и дом уже есть — это квартира
            if result['house'] or int(apt_num) >= 10:
                result['apartment'] = apt_num

        # Если дом ещё не нашли — возможно это просто число
        if not result['house']:
            num_match = re.search(r'^(\d+[а-яА-Яa-zA-Z]*)$', p_clean.strip())
            if num_match:
                result['house'] = num_match.group(1)

    return result


# ══════════════════════════════════════════════════════════════════
# Импорт базы клиентов (ТСЖ)
# ══════════════════════════════════════════════════════════════════

def import_clients_from_excel(file_bytes, user):
    """
    Импорт клиентов из Excel-файла (ТСЖ/УК).
    Формат: № п/п, № лицевого счета (игнорируется), ФИО, Адрес, № парадной, ТСЖ

    Адрес парсится на: город, улица, район, дом, корпус, квартира.
    Возвращает: dict с результатами
    """
    from .models import Client

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(min_row=2, values_only=True))  # пропускаем заголовок
    total = 0
    created = 0
    updated = 0
    errors = []

    for row in rows:
        # Нет адреса и нет ФИО — пропускаем
        if not row:
            continue

        total += 1
        try:
            # Колонки: 0=№п/п, 1=№лицевого (игнорируем), 2=ФИО, 3=Адрес, 4=№парадной, 5=ТСЖ
            full_name = str(row[2]).strip() if len(row) > 2 and row[2] is not None else 'Не определено'
            raw_address = str(row[3]).strip() if len(row) > 3 and row[3] else ''
            entrance = str(row[4]).strip() if len(row) > 4 and row[4] else ''
            management_company = str(row[5]).strip() if len(row) > 5 and row[5] else ''

            # Пропускаем только полностью пустые строки (нет ни адреса, ни ФИО, ни УК)
            if not full_name and not raw_address and not management_company:
                continue

            # Парсим адрес
            parsed = parse_address(raw_address)

            # Собираем полный адрес: город, улица, дом, ...
            address_parts = []
            if parsed['city']:
                address_parts.append(parsed['city'])
            if parsed['street']:
                address_parts.append(parsed['street'])
            if parsed['house']:
                house_str = f'д. {parsed["house"]}'
                if parsed['building']:
                    house_str += f' корп. {parsed["building"]}'
                address_parts.append(house_str)
            if parsed['apartment']:
                address_parts.append(f'кв. {parsed["apartment"]}')
            if entrance:
                address_parts.append(f'под. {entrance}')

            address = ', '.join(address_parts) if address_parts else raw_address

            # Всегда создаём новую запись (без попытки найти дубликат)
            Client.objects.create(
                name=full_name if full_name else 'Не определено',
                address=address,
                phone='',
                entrance_number=entrance,
                management_company=management_company,
                district=parsed['district'],
                source='excel_import',
            )
            created += 1

        except Exception as e:
            errors.append(f'Строка {total}: {str(e)}')

    return {
        'success': True,
        'total': total,
        'created': created,
        'updated': updated,
        'errors': errors,
    }


# ══════════════════════════════════════════════════════════════════
# Импорт ЕРЦ — универсальный (4 формата)
# ══════════════════════════════════════════════════════════════════

def _find_column_indices(header_rows, ws_max_column):
    """
    Ищет индексы колонок по заголовкам. Поддерживает 4 формата ЕРЦ.
    Возвращает dict с детектированным форматом и маппингом колонок.
    """
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
    fmt = 'standard'  # standard | lo | agalatovo

    # 1. Лицевой счёт — вторая колонка
    mapping['account_number'] = 1
    
    # 2. ФИО — третья колонка
    mapping['full_name'] = 2

    # Определяем формат
    has_city_col = any('населенный пункт' in combined[i] for i in range(len(combined)))
    has_credit_col = any('кредит' in combined[i] and i > 5 for i in range(len(combined)))
    has_paid_pct = any('% оплаты' in combined[i] for i in range(len(combined)))

    if has_city_col:
        # Формат Агалатово: адрес разбит по колонкам
        fmt = 'agalatovo'
        mapping['address_city'] = 5      # Населенный пункт
        mapping['address_street'] = 6     # Улица
        mapping['address_house'] = 7      # Дом
        mapping['address_apt'] = 8        # Кв.
        mapping['balance_start'] = 9      # Сальдо на 01.05 (колонка 10 Excel)
        mapping['charged'] = 11           # Начислено (колонка 12 Excel)
        mapping['paid'] = 13              # Оплачено (колонка 14 Excel)
        mapping['paid_percent'] = None
        mapping['balance_end'] = None
    elif has_credit_col and not has_paid_pct:
        # Формат ЛО: дебет/кредит, но без % оплаты
        fmt = 'lo'
        mapping['format'] = 'lo'
        mapping['address'] = 5
        mapping['balance_start'] = 6      # дебет
        mapping['balance_start_credit'] = 7  # кредит
        mapping['charged'] = 8            # Начислено
        mapping['charged_total'] = 11     # Всего начислено
        mapping['paid'] = 12              # Оплата
        mapping['balance_end'] = 14       # дебет
        mapping['balance_end_credit'] = 15  # кредит
        mapping['paid_percent'] = None
        mapping['residents'] = None
    else:
        # Стандартный формат (СПб, Коммунар)
        fmt = 'standard'
        mapping['format'] = 'standard'
        mapping['address'] = 5
        # Ищем колонки по заголовкам
        for i in range(6, max_cols):
            if 'жильцов' in combined[i]:
                mapping['residents'] = i
            elif 'сальдо' in combined[i] and any(d in combined[i] for d in ['01.', 'начало']):
                mapping['balance_start'] = i
            elif 'без льгот' in combined[i]:
                mapping['charged_no_benefits'] = i
            elif 'фактически' in combined[i]:
                mapping['charged'] = i
            elif 'начислено' in combined[i] and 'льгот' not in combined[i] and 'charged' not in mapping:
                mapping['charged'] = i
            elif 'оплачено' in combined[i] and '%' not in combined[i]:
                mapping['paid'] = i
            elif '% оплаты' in combined[i]:
                mapping['paid_percent'] = i
            elif 'сальдо' in combined[i] and any(d in combined[i] for d in ['конец', '31.', 'конечн']):
                mapping['balance_end'] = i
            elif 'кредит' in combined[i]:
                mapping['credit'] = i
        
        # Defaults для стандартного формата
        mapping.setdefault('balance_start', 8)
        mapping.setdefault('charged', 10)
        mapping.setdefault('paid', 11)
        mapping.setdefault('paid_percent', 12)
        mapping.setdefault('balance_end', 13)
        mapping.setdefault('credit', 14)
        mapping.setdefault('residents', 7)
        mapping.setdefault('charged_no_benefits', 9)

    return mapping, fmt


def import_erc_from_excel(file_bytes, user, period_date=None):
    """Универсальный импорт ЕРЦ. Автоопределение формата."""
    from .models import ErcAccount, ErcBillingRecord, Client
    from django.utils import timezone

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    # Ищем строку заголовка с «фамилия» + «лицевого»
    header_start = None
    for r in range(1, min(40, ws.max_row + 1)):
        row_vals = [str(ws.cell(row=r, column=c).value or '').lower() for c in range(1, min(ws.max_column+1, 20))]
        combined = ' '.join(row_vals)
        if ('фамилия' in combined or 'фио' in combined) and ('лицевого' in combined or 'счета' in combined or 'адрес' in combined):
            header_start = r
            break

    if header_start is None:
        header_start = 6

    # Берём 4 строки заголовка
    header_rows = []
    for r in range(header_start, min(header_start + 4, ws.max_row + 1)):
        header_rows.append(list(ws.iter_rows(min_row=r, max_row=r, values_only=True))[0])

    col, fmt = _find_column_indices(header_rows, ws.max_column)

    # Ищем первую строку данных
    data_start_row = header_start + 4
    for r in range(header_start + 3, min(header_start + 15, ws.max_row + 1)):
        val = ws.cell(row=r, column=2).value  # л/с всегда в колонке 2
        if val is not None and str(val).strip():
            data_start_row = r
            break

    rows = list(ws.iter_rows(min_row=data_start_row, values_only=True))

    # Период
    if period_date is None:
        today = timezone.localdate()
        month = today.month - 1 if today.day <= 10 else today.month
        year = today.year
        if month == 0:
            month = 12; year -= 1
        period_date = today.replace(year=year, month=month, day=1)

    total = created_accounts = updated_accounts = created_records = updated_records = 0
    errors = []

    def parse_decimal(val):
        if val is None or str(val).strip() in ('', '—', '-'):
            return 0
        try:
            return float(str(val).replace(',', '.').replace('\xa0', '').replace(' ', ''))
        except: return 0

    def get_row(row, idx):
        if idx is None or idx >= len(row): return ''
        return row[idx] if row[idx] is not None else ''

    for row in rows:
        if not row: continue
        account_number = str(get_row(row, 1)).strip()
        if not account_number: continue

        total += 1
        try:
            full_name = str(get_row(row, 2)).strip()

            # Собираем адрес в зависимости от формата
            if fmt == 'agalatovo':
                city = str(get_row(row, col.get('address_city', 5))).strip()
                street = str(get_row(row, col.get('address_street', 6))).strip()
                house = str(get_row(row, col.get('address_house', 7))).strip()
                apt = str(get_row(row, col.get('address_apt', 8))).strip()
                parts = []
                if city and city != '-': parts.append(city)
                if street and street != '-': parts.append(street)
                if house and house != '-': parts.append(f'д. {house}')
                if apt and apt != '-': parts.append(f'кв. {apt}')
                address = ', '.join(parts) if parts else ''
                
                balance_start = parse_decimal(get_row(row, col.get('balance_start', 10)))
                charged = parse_decimal(get_row(row, col.get('charged', 12)))
                paid = parse_decimal(get_row(row, col.get('paid', 13)))
                paid_percent = 0
                balance_end = 0
                credit = 0
            elif fmt == 'lo':
                address = str(get_row(row, col.get('address', 5))).strip()
                balance_start = parse_decimal(get_row(row, col.get('balance_start', 6)))
                charged = parse_decimal(get_row(row, col.get('charged_total', 11)) or 
                                       get_row(row, col.get('charged', 8)))
                paid = parse_decimal(get_row(row, col.get('paid', 12)))
                balance_end = parse_decimal(get_row(row, col.get('balance_end', 14)))
                paid_percent = round(paid / charged * 100, 1) if charged else 0
                credit = parse_decimal(get_row(row, col.get('balance_end_credit', 15)))
            else:
                address = str(get_row(row, col.get('address', 5))).strip()
                residents = parse_decimal(get_row(row, col.get('residents', 7)))
                balance_start = parse_decimal(get_row(row, col.get('balance_start', 8)))
                charged_no_benefits = parse_decimal(get_row(row, col.get('charged_no_benefits', 9)))
                charged = parse_decimal(get_row(row, col.get('charged', 10)))
                paid = parse_decimal(get_row(row, col.get('paid', 11)))
                paid_percent = parse_decimal(get_row(row, col.get('paid_percent', 12)))
                balance_end = parse_decimal(get_row(row, col.get('balance_end', 13)))
                credit = parse_decimal(get_row(row, col.get('credit', 14)))

            account, is_new = ErcAccount.objects.update_or_create(
                account_number=account_number,
                defaults={'full_name': full_name, 'address': address, 'residents_count': 0, 'is_active': True}
            )
            if is_new: created_accounts += 1
            else: updated_accounts += 1

            Client.objects.update_or_create(
                personal_account_number=account_number,
                defaults={'name': full_name or 'Не определено', 'address': address, 'phone': '', 'source': 'erc'}
            )

            ErcBillingRecord.objects.update_or_create(
                account=account, period=period_date,
                defaults={
                    'balance_start': balance_start, 'charged': charged,
                    'charged_no_benefits': 0, 'paid': paid,
                    'paid_percent': paid_percent, 'balance_end': balance_end, 'credit': credit,
                }
            )
            created_records += 1

        except Exception as e:
            errors.append(f'Строка {total} (счёт {account_number}): {str(e)}')

    return {
        'success': True, 'total': total, 'period': period_date.strftime('%Y-%m-%d'),
        'column_mapping': col, 'format': fmt,
        'accounts': {'created': created_accounts, 'updated': updated_accounts},
        'billing_records': {'created': created_records, 'updated': updated_records},
        'errors': errors,
    }


# ══════════════════════════════════════════════════════════════════
# Preview (предпросмотр первых строк)
# ══════════════════════════════════════════════════════════════════

def preview_excel(file_bytes, max_rows=10):
    """
    Возвращает первые N строк Excel-файла для предпросмотра.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    preview = []
    for row in ws.iter_rows(min_row=1, max_row=max_rows, values_only=True):
        preview.append([str(cell) if cell is not None else '' for cell in row])

    total_rows = ws.max_row - 1 if ws.max_row else 0  # минус заголовок

    return {
        'headers': preview[0] if preview else [],
        'rows': preview[1:] if len(preview) > 1 else [],
        'total_rows': total_rows,
    }
