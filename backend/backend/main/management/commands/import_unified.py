"""
Management command: python manage.py import_unified <csv_file>
Импортирует унифицированный CSV в базу данных.
"""
from django.core.management.base import BaseCommand
from pathlib import Path
from main.unified_importer import import_unified_file


class Command(BaseCommand):
    help = 'Импортирует унифицированный CSV в базу (клиенты + ЕРЦ)'

    def add_arguments(self, parser):
        parser.add_argument('input', type=str, nargs='+', help='Путь к .csv файлу(ам)')
        parser.add_argument('--dry-run', action='store_true', help='Только проверка, без сохранения')

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        for inp in options['input']:
            path = Path(inp)
            if not path.exists():
                self.stderr.write(f'Файл не найден: {inp}')
                continue

            if dry_run:
                self.stdout.write(f'DRY RUN: {path}')
            import_unified_file(str(path), dry_run=dry_run)
