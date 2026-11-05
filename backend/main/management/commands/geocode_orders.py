"""Определить координаты адресов заявок (для маршрута в навигаторе).

Запуск:
    docker compose exec -T web python manage.py geocode_orders --days 90 --limit 200
"""
import time

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from main.geocode_service import geocode_address, extract_hints
from main.models import Order


class Command(BaseCommand):
    help = 'Геокодировать адреса заявок и сохранить координаты (lat/lon)'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=0,
                            help='Только заявки за последние N дней (0 — все)')
        parser.add_argument('--limit', type=int, default=200,
                            help='Максимум заявок за один запуск')
        parser.add_argument('--force', action='store_true',
                            help='Перегеокодировать даже те, у которых уже есть координаты')

    def handle(self, *args, **options):
        qs = Order.objects.exclude(address='')
        if not options['force']:
            qs = qs.filter(latitude__isnull=True)
        if options['days']:
            since = timezone.now() - timedelta(days=options['days'])
            qs = qs.filter(created_at__gte=since)

        qs = qs.order_by('-created_at')[:options['limit']]
        ok, fail = 0, 0

        for order in qs:
            client_addr = ''
            try:
                client_addr = (order.client.address if order.client else '') or ''
            except Exception:
                client_addr = ''

            hints = extract_hints(order.address or '', client_addr)
            found = geocode_address(
                city=order.city or '',
                street=order.street_name or '',
                house=order.house_number or '',
                building=order.building_number or '',
                full_address=order.address or client_addr,
                hints=hints,
            )
            if found:
                lat, lon, normalized = found
                order.latitude = lat
                order.longitude = lon
                order.save(update_fields=['latitude', 'longitude'])
                ok += 1
                self.stdout.write('OK   {} → {}, {}'.format(order.number, lat, lon))
            else:
                fail += 1
                self.stdout.write(self.style.WARNING(
                    'FAIL {} → {}'.format(order.number, (order.address or '')[:80])
                ))
            # вежливый интервал между запросами к Nominatim
            time.sleep(1.0)

        self.stdout.write(self.style.SUCCESS(
            'Готово: успешно {}, не найдено {}'.format(ok, fail)
        ))
