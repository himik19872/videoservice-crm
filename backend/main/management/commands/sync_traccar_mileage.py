"""Синхронизация треков Traccar и расчёт дневного пробега мастеров.

Запускается по cron каждые 10 минут:
    docker compose exec -T web python manage.py sync_traccar_mileage --days 1
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from main.traccar_service import get_active_settings, sync_days


class Command(BaseCommand):
    help = 'Скачать треки из Traccar и посчитать дневной пробег/топливо мастеров'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=1,
                            help='Сколько дней назад синхронизировать (включая сегодня)')

    def handle(self, *args, **options):
        settings = get_active_settings()
        if settings is None:
            self.stdout.write('Traccar не активен — синхронизация пропущена')
            return

        days = max(1, min(int(options['days']), 31))
        try:
            summary = sync_days(days)
        except RuntimeError as e:
            # Ошибка авторизации Traccar — показываем внятно в логе cron
            self.stderr.write(self.style.ERROR('ОШИБКА Traccar: {}'.format(e)))
            raise SystemExit(1)
        for day in summary:
            self.stdout.write('{date}: мастеров {masters}, пробег {km} км'.format(
                date=day['date'], masters=day['masters'], km=day['distance_km']))
        self.stdout.write(self.style.SUCCESS('Синхронизация завершена {:%d.%m.%Y %H:%M}'.format(
            timezone.localtime())))
