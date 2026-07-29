"""
Команда: python manage.py fix_buildings
Перепарсивает адреса клиентов без привязки к дому и создаёт здания.
Использует fallback regex-парсер (Dadata не нужен).
"""

from django.core.management.base import BaseCommand
from main.models import Client, Building, BuildingEntrance
from main.dadata_service import _regex_parse


class Command(BaseCommand):
    help = 'Перепарсить адреса клиентов без зданий и создать дома'

    def handle(self, *args, **options):
        from main.models import ErcAccount

        orphan = Client.objects.filter(building__isnull=True)
        total = orphan.count()
        created_buildings = 0
        linked = 0
        skipped = 0

        self.stdout.write(f'Клиентов без здания: {total}')

        for client in orphan.iterator(chunk_size=1000):
            # Пробуем парсить сырой адрес из ErcAccount (там исходные данные XLSX)
            raw = None
            if client.personal_account_number:
                erc = ErcAccount.objects.filter(account_number=client.personal_account_number).first()
                if erc and erc.address:
                    raw = erc.address
            if not raw:
                raw = client.address

            if not raw:
                skipped += 1
                continue

            addr = _regex_parse(raw)
            city = addr.get('city', '') or 'Санкт-Петербург'
            street = addr.get('street_name', '')
            house = addr.get('house_number', '')
            apt = addr.get('apartment', '')

            if not house:
                # Второй проход: может после улицы сразу число (без «д.»)
                # «Санкт-Петербург, Победы (Ломоносов) ул, д..1 лит. А, 1»
                # Уже должно парситься с д\.\.?\s*
                skipped += 1
                continue

            # Ищем/создаём здание
            filters = {'city__icontains': city, 'house_number': house}
            if street:
                filters['street_name__icontains'] = street
            else:
                filters['street_name'] = ''

            building = Building.objects.filter(**filters).first()
            if not building:
                building = Building.objects.create(
                    city=city,
                    street_name=street,
                    house_number=house,
                    district=addr.get('district', ''),
                )
                created_buildings += 1

            # Обновляем клиента
            client.building = building
            if not client.apartment and apt:
                client.apartment = apt
            client.save(update_fields=['building', 'apartment'])
            linked += 1

            if linked % 5000 == 0:
                self.stdout.write(f'  ... обработано {linked}/{total}')

        self.stdout.write(self.style.SUCCESS(
            f'Готово!\n'
            f'  Привязано: {linked}\n'
            f'  Пропущено: {skipped}\n'
            f'  Создано зданий: {created_buildings}\n'
            f'  Всего клиентов: {Client.objects.count()}\n'
            f'  Всего зданий: {Building.objects.count()}'
        ))
