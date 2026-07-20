"""
Унифицированный импорт из стандартизированного CSV в базу данных.

Читает CSV, созданный конвертерами (converters.py), и импортирует в:
- Building (дома)
- Client (клиенты)
- ErcAccount + ErcBillingRecord (лицевые счета ЕРЦ и история платежей)

Архитектура:
  Любой Excel → converters.py → unified CSV → unified_importer.py → БД
"""

import csv
import io
from datetime import datetime
from pathlib import Path


UNIFIED_FIELDS = [
    'type', 'personal_account', 'full_name',
    'city', 'district', 'street', 'house', 'building', 'apartment', 'entrance',
    'management_company',
    'period', 'balance_start', 'charged', 'paid', 'balance_end',
    'raw_address',
]


def import_unified_csv(file_bytes_or_path, user=None, dry_run=False):
    """
    Импортирует унифицированный CSV в базу данных.
    
    Args:
        file_bytes_or_path: содержимое CSV (bytes) или путь к файлу (str/Path)
        user: пользователь Django
        dry_run: если True — только валидация, без сохранения в БД
    
    Returns:
        dict с статистикой импорта
    """
    from .models import Client, Building, ErcAccount, ErcBillingRecord, ManagementCompany, BuildingEntrance

    # Читаем CSV
    if isinstance(file_bytes_or_path, (str, Path)):
        with open(file_bytes_or_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    else:
        text = file_bytes_or_path.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

    stats = {
        'total_rows': len(rows),
        'client_rows': 0,
        'payment_rows': 0,
        'buildings_created': 0,
        'clients_created': 0,
        'clients_updated': 0,
        'erc_accounts_created': 0,
        'erc_records_created': 0,
        'erc_records_updated': 0,
        'errors': [],
        'skipped': 0,
    }

    building_cache = {}  # (city, street, house, building) → Building

    def smart_find_building(street_name, house_number, building_number='', city=''):
        """
        Умный поиск Building: не плодит дубликаты типа 'Лермонтова'/'Лермонтова ул'.
        Стратегия:
          1. Точный матч по городу+дому+улице
          2. icontains по улице
          3. Обратный матч (БД-улица содержится в нашей)
          4. Частичный матч первого слова
        """
        if not street_name or not house_number:
            return None
        
        qs = Building.objects.filter(house_number=house_number)
        if city:
            city_qs = qs.filter(city__iexact=city)
            if city_qs.exists():
                qs = city_qs
        if building_number:
            bld_qs = qs.filter(building_number=building_number)
            if bld_qs.exists():
                qs = bld_qs

        # 1. Точный icontains
        candidates = qs.filter(street_name__icontains=street_name)
        
        # 2. По первому слову
        if not candidates.exists() and street_name.split():
            candidates = qs.filter(street_name__icontains=street_name.split()[0])
        
        # 3. Обратный матч
        if not candidates.exists():
            for b in qs:
                if b.street_name and b.street_name.lower() in street_name.lower():
                    candidates = qs.filter(id=b.id)
                    break
        
        # 4. Наша улица в БД-улице
        if not candidates.exists():
            for b in qs:
                if street_name.lower() in (b.street_name or '').lower():
                    candidates = qs.filter(id=b.id)
                    break
        
        return candidates.first()

    def get_or_create_building(city, street, house, building_num, district='', management_company=''):
        """Найти или создать Building, с кешированием. Не плодит дубликаты."""
        if not street or not house:
            return None

        cache_key = (city.lower() if city else '', street.lower(), house.lower(), (building_num or '').lower(), management_company.lower() if management_company else '')
        if cache_key in building_cache:
            return building_cache[cache_key]

        if dry_run:
            b = Building(city=city or 'Санкт-Петербург', street_name=street,
                         house_number=house, building_number=building_num or '')
            building_cache[cache_key] = b
            return b

        # Сначала ищем умно
        b = smart_find_building(street, house, building_num, city)
        if b:
            # Привязываем УК, если здание найдено но без FK
            if management_company and not b.management_company_fk:
                mc_obj, _ = ManagementCompany.objects.get_or_create(name=management_company)
                b.management_company_fk = mc_obj
                b.management_company = management_company
                b.save(update_fields=['management_company_fk', 'management_company'])
            building_cache[cache_key] = b
            return b

        # Не нашли — создаём новый
        b = Building.objects.create(
            city=city or 'Санкт-Петербург',
            street_name=street,
            house_number=house,
            building_number=building_num or '',
        )
        stats['buildings_created'] += 1
        building_cache[cache_key] = b
        return b

    for i, row in enumerate(rows, 1):
        try:
            row_type = row.get('type', '').strip()
            personal_account = row.get('personal_account', '').strip()
            full_name = row.get('full_name', '').strip()
            city = row.get('city', '').strip()
            district = row.get('district', '').strip()
            street = row.get('street', '').strip()
            house = row.get('house', '').strip()
            building_num = row.get('building', '').strip()
            apartment = row.get('apartment', '').strip()
            entrance = row.get('entrance', '').strip()
            management_company = row.get('management_company', '').strip()
            period = row.get('period', '').strip()
            balance_start = row.get('balance_start', '').strip()
            charged = row.get('charged', '').strip()
            paid = row.get('paid', '').strip()
            balance_end = row.get('balance_end', '').strip()
            raw_address = row.get('raw_address', '').strip()

            # ── Собираем полный адрес ──
            address_parts = []
            base_city = city or 'Санкт-Петербург'
            if base_city != 'Санкт-Петербург':
                address_parts.append(f'г. {base_city}')
            else:
                address_parts.append('Санкт-Петербург')
            if district and district != base_city:
                address_parts.append(district)
            if street:
                address_parts.append(street)
            if house:
                hs = f'д. {house}'
                if building_num:
                    if 'литера' in building_num:
                        hs += f' {building_num}'
                    elif 'корп.' in building_num:
                        hs += f', {building_num}'
                    else:
                        hs += f' корп. {building_num}'
                address_parts.append(hs)
            if apartment:
                address_parts.append(f'кв. {apartment}')

            full_address = ', '.join(address_parts) if address_parts else raw_address

            # ── Найти/создать Building ──
            building = get_or_create_building(
                city, street, house, building_num, district, management_company
            )

            # ── Обработка в зависимости от типа ──
            if row_type == 'client':
                stats['client_rows'] += 1

                if not full_name and not personal_account and not full_address:
                    stats['skipped'] += 1
                    continue

                if dry_run:
                    continue

                # Ищем существующего клиента
                existing = None
                if personal_account:
                    existing = Client.objects.filter(personal_account_number=personal_account).first()
                if not existing and building and apartment:
                    existing = Client.objects.filter(building=building, apartment=apartment).first()
                if not existing and full_address:
                    existing = Client.objects.filter(address=full_address, name=full_name).first()

                # Разрешаем MC FK
                mc_obj = None
                if management_company:
                    mc_obj, _ = ManagementCompany.objects.get_or_create(name=management_company)

                # Привязываем Building к УК через FK
                entrance_obj = None
                if building and entrance:
                    try:
                        ent_num = int(float(entrance))
                        entrance_obj, _ = BuildingEntrance.objects.get_or_create(
                            building=building, number=ent_num,
                            defaults={'apartments_count': 0}
                        )
                    except (ValueError, TypeError):
                        pass

                # Привязываем УК к дому через FK
                if mc_obj and building and not building.management_company_fk:
                    building.management_company_fk = mc_obj
                    building.save(update_fields=['management_company_fk'])

                client_data = {
                    'name': full_name or 'Не определено',
                    'address': full_address,
                    'building': building,
                    'entrance': entrance_obj,
                    'apartment': apartment or '',
                    'management_company': mc_obj,
                    'district': district,
                    'personal_account_number': personal_account,
                    'source': 'excel_import',
                }

                if existing:
                    for k, v in client_data.items():
                        if v:
                            setattr(existing, k, v)
                    existing.save()
                    stats['clients_updated'] += 1
                else:
                    Client.objects.create(**{k: v for k, v in client_data.items() if v or k == 'apartment'})
                    stats['clients_created'] += 1

                # Также создать ErcAccount для client-строк, если есть personal_account
                if personal_account and not ErcAccount.objects.filter(account_number=personal_account).exists():
                    ErcAccount.objects.create(
                        account_number=personal_account,
                        full_name=full_name,
                        address=raw_address or full_address,
                    )
                    stats['erc_accounts_created'] += 1

            elif row_type == 'payment':
                stats['payment_rows'] += 1

                # Если нет personal_account — всё равно создаём клиента, но не ЕРЦ
                if not personal_account:
                    # Создаём клиента без ЕРЦ-привязки
                    if dry_run:
                        continue

                    # Разрешаем MC FK
                    mc_obj = None
                    if management_company:
                        mc_obj, _ = ManagementCompany.objects.get_or_create(name=management_company)

                    client_existing = None
                    if building and apartment:
                        client_existing = Client.objects.filter(building=building, apartment=apartment).first()
                    if not client_existing and full_address:
                        client_existing = Client.objects.filter(address=full_address, name=full_name).first()

                    client_data_pure = {
                        'name': full_name or 'Не определено',
                        'address': full_address,
                        'building': building,
                        'apartment': apartment,
                        'management_company': mc_obj,
                        'district': district,
                        'personal_account_number': '',
                        'source': 'erc',
                    }
                    if client_existing:
                        for k, v in client_data_pure.items():
                            if v:
                                setattr(client_existing, k, v)
                        client_existing.save()
                        stats['clients_updated'] += 1
                    else:
                        Client.objects.create(**client_data_pure)
                        stats['clients_created'] += 1
                    stats['skipped'] += 1
                    continue

                if dry_run:
                    continue

                # ── Создать/обновить ErcAccount ──
                erc_account, ea_created = ErcAccount.objects.get_or_create(
                    account_number=personal_account,
                    defaults={
                        'full_name': full_name,
                        'address': raw_address or full_address,
                    }
                )
                if ea_created:
                    stats['erc_accounts_created'] += 1
                elif full_name and not erc_account.full_name:
                    erc_account.full_name = full_name
                    erc_account.save(update_fields=['full_name'])

                # ── Разрешаем MC FK ──
                mc_obj = None
                if management_company:
                    mc_obj, _ = ManagementCompany.objects.get_or_create(name=management_company)

                # Привязываем Building к УК через FK
                entrance_obj = None
                if building and entrance:
                    try:
                        ent_num = int(float(entrance))
                        entrance_obj, _ = BuildingEntrance.objects.get_or_create(
                            building=building, number=ent_num,
                            defaults={'apartments_count': 0}
                        )
                    except (ValueError, TypeError):
                        pass

                if mc_obj and building and not building.management_company_fk:
                    building.management_company_fk = mc_obj
                    building.save(update_fields=['management_company_fk'])

                # ── Также создать/обновить Client для ЕРЦ ──
                client_existing = None
                if personal_account:
                    client_existing = Client.objects.filter(personal_account_number=personal_account).first()
                if not client_existing and building and apartment:
                    client_existing = Client.objects.filter(building=building, apartment=apartment).first()
                if not client_existing and full_address and full_name:
                    client_existing = Client.objects.filter(address=full_address, name=full_name).first()

                # Попытка найти Building по raw_address, если не нашли через парсинг
                if not building and raw_address:
                    import re
                    raw = raw_address.strip()
                    if raw.startswith('г. '):
                        rest = raw[3:]
                        fallback_city = rest.split(',')[0].strip() if ',' in rest else 'Санкт-Петербург'
                    elif raw.startswith('Санкт-Петербург'):
                        rest = raw[len('Санкт-Петербург'):].lstrip(', ')
                        fallback_city = 'Санкт-Петербург'
                    else:
                        rest = raw
                        fallback_city = 'Санкт-Петербург'
                    house_match = re.search(r'д\.\s*(\d+[\w]*)', rest)
                    if house_match:
                        fallback_house = house_match.group(1)
                        fallback_street = rest[:house_match.start()].rstrip(', ').strip()
                        bld_match = re.search(r'(?:корп\.|литера|стр\.)\s*([\w\d]+)', rest, re.IGNORECASE)
                        fallback_bld = bld_match.group(1) if bld_match else ''
                        if fallback_street and fallback_house:
                            building = get_or_create_building(fallback_city, fallback_street, fallback_house, fallback_bld)
                            if building and apartment:
                                client_existing = client_existing or Client.objects.filter(building=building, apartment=apartment).first()

                client_data = {
                    'name': full_name or 'Не определено',
                    'address': full_address,
                    'building': building,
                    'entrance': entrance_obj,
                    'apartment': apartment or '',
                    'management_company': mc_obj,
                    'district': district,
                    'personal_account_number': personal_account,
                    'source': 'erc',
                }

                if client_existing:
                    if client_existing.source != 'erc':
                        client_existing.source = 'erc'
                    for k, v in client_data.items():
                        if v and not getattr(client_existing, k, None):
                            setattr(client_existing, k, v)
                    client_existing.save()
                    stats['clients_updated'] += 1
                else:
                    # ВСЕГДА создаём клиента, даже без building
                    Client.objects.create(**{k: v for k, v in client_data.items() if v or k == 'apartment'})
                    stats['clients_created'] += 1

                # ── Создать/обновить ErcBillingRecord ──
                period_date = None
                if period:
                    try:
                        period_date = datetime.strptime(period, '%Y-%m-%d').date()
                    except ValueError:
                        period_date = datetime.now().date().replace(day=1)
                else:
                    period_date = datetime.now().date().replace(day=1)

                def _f(val):
                    try:
                        return float(val) if val else 0.0
                    except (ValueError, TypeError):
                        return 0.0

                record, rec_created = ErcBillingRecord.objects.update_or_create(
                    account=erc_account,
                    period=period_date,
                    defaults={
                        'charged': _f(charged),
                        'paid': _f(paid),
                        'balance_start': _f(balance_start),
                        'balance_end': _f(balance_end),
                    }
                )
                if rec_created:
                    stats['erc_records_created'] += 1
                else:
                    stats['erc_records_updated'] += 1

            else:
                stats['skipped'] += 1

        except Exception as e:
            stats['errors'].append(f'Строка {i}: {str(e)}')

    return stats


def import_unified_file(filepath, user=None, dry_run=False):
    """Импорт из CSV-файла. Возвращает статистику."""
    print(f'Импорт: {filepath}')
    stats = import_unified_csv(filepath, user, dry_run)

    print(f"  Всего строк:       {stats['total_rows']}")
    print(f"  Строк-клиентов:    {stats['client_rows']}")
    print(f"  Строк-платежей:    {stats['payment_rows']}")
    print(f"  Домов создано:     {stats['buildings_created']}")
    print(f"  Клиентов создано:  {stats['clients_created']}")
    print(f"  Клиентов обновлено:{stats['clients_updated']}")
    print(f"  ЕРЦ аккаунтов:     {stats['erc_accounts_created']}")
    print(f"  ЕРЦ записей новых: {stats['erc_records_created']}")
    print(f"  ЕРЦ записей обнов.:{stats['erc_records_updated']}")
    print(f"  Пропущено:         {stats['skipped']}")
    print(f"  Ошибок:            {len(stats['errors'])}")
    if stats['errors']:
        for e in stats['errors'][:10]:
            print(f"    ! {e}")

    return stats
