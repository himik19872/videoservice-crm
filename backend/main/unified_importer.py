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
    from .models import Client, Building, ErcAccount, ErcBillingRecord, ManagementCompany

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

    def get_or_create_building(city, street, house, building_num, district='', management_company=''):
        """Найти или создать Building, с кешированием."""
        if not street or not house:
            return None

        key = (city.lower(), street.lower(), house.lower(), building_num.lower())
        if key in building_cache:
            return building_cache[key]

        if dry_run:
            # Возвращаем фейковый объект для dry-run
            b = Building(city=city or 'Санкт-Петербург', street_name=street,
                         house_number=house, building_number=building_num or '',
                         district=district or '', management_company=management_company or '')
            building_cache[key] = b
            return b

        b, created = Building.objects.get_or_create(
            city=city or 'Санкт-Петербург',
            street_name=street,
            house_number=house,
            building_number=building_num or '',
            defaults={
                'district': district or '',
                'management_company': management_company or '',
            }
        )

        # Обновляем УК если была пустая
        if not created and management_company and not b.management_company:
            b.management_company = management_company
            b.save(update_fields=['management_company'])

        if created:
            stats['buildings_created'] += 1

        building_cache[key] = b
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

                client_data = {
                    'name': full_name or 'Не определено',
                    'address': full_address,
                    'building': building,
                    'apartment': apartment,
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
                    Client.objects.create(**client_data)
                    stats['clients_created'] += 1

            elif row_type == 'payment':
                stats['payment_rows'] += 1

                if not personal_account:
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

                # ── Также создать/обновить Client для ЕРЦ ──
                client_existing = None
                if personal_account:
                    client_existing = Client.objects.filter(personal_account_number=personal_account).first()
                if not client_existing and building and apartment:
                    client_existing = Client.objects.filter(building=building, apartment=apartment).first()

                client_data = {
                    'name': full_name or 'Не определено',
                    'address': full_address,
                    'building': building,
                    'apartment': apartment,
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
                    Client.objects.create(**client_data)
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
