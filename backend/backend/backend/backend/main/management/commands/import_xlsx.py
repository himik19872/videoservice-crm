"""
Команда: python manage.py import_xlsx /path/to/dir/
Импортирует все XLSX из директории через Dadata.
"""

from django.core.management.base import BaseCommand
from main.xlsx_importer import import_xlsx_file, import_xlsx_directory


class Command(BaseCommand):
    help = 'Прямой импорт XLSX-файлов ЕРЦ с нормализацией адресов через Dadata'

    def add_arguments(self, parser):
        parser.add_argument('path', type=str, help='Путь к файлу .xlsx или директории')
        parser.add_argument('--period', type=str, default='2026-05-01', help='Период YYYY-MM-DD')

    def handle(self, *args, **options):
        from datetime import datetime
        period = datetime.strptime(options['period'], '%Y-%m-%d').date()
        path = options['path']

        import os
        if os.path.isfile(path):
            stats = import_xlsx_file(path, source_filename=os.path.basename(path), period_date=period)
            self._print_stats(stats)
        elif os.path.isdir(path):
            total = import_xlsx_directory(path, period_date=period)
            self.stdout.write(self.style.SUCCESS(
                f'╔══════════════════════════════════════╗\n'
                f'║  ИМПОРТ ЗАВЕРШЁН                     ║\n'
                f'╠══════════════════════════════════════╣\n'
                f'║  Файлов:        {total["files"]:>5}                ║\n'
                f'║  Строк:         {total["total_rows"]:>5}                ║\n'
                f'║  Клиентов +:    {total["clients_created"]:>5}                ║\n'
                f'║  Клиентов ~:    {total["clients_updated"]:>5}                ║\n'
                f'║  Зданий:        {total["buildings_created"]:>5}                ║\n'
                f'║  Подъездов:     {total["entrances_created"]:>5}                ║\n'
                f'║  ЕРЦ записей +: {total["erc_created"]:>5}                ║\n'
                f'║  ЕРЦ записей ~: {total["erc_updated"]:>5}                ║\n'
                f'╚══════════════════════════════════════╝'
            ))
        else:
            self.stderr.write(f'Путь не найден: {path}')

    def _print_stats(self, stats):
        self.stdout.write(self.style.SUCCESS(
            f'{stats["file"]} ({stats["format"]}):\n'
            f'  rows={stats["total_rows"]}, clients +{stats["clients_created"]} ~{stats["clients_updated"]}\n'
            f'  bld={stats["buildings_created"]}, entr={stats["entrances_created"]}\n'
            f'  erc +{stats["erc_created"]} ~{stats["erc_updated"]}, skip={stats["skipped"]}'
        ))
