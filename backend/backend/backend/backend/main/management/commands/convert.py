"""
Management command: python manage.py convert <input>
Конвертирует Excel-файлы в унифицированный CSV.
"""
from django.core.management.base import BaseCommand
from pathlib import Path
from main.converters import convert_file, convert_directory, auto_convert, write_csv


class Command(BaseCommand):
    help = 'Конвертирует Excel-файлы ТСЖ/ЕРЦ в унифицированный CSV'

    def add_arguments(self, parser):
        parser.add_argument('input', type=str, nargs='+', help='Путь к .xlsx файлу или директории')
        parser.add_argument('--output', '-o', type=str, default=None, help='Путь к выходному CSV (только для одного файла)')
        parser.add_argument('--output-dir', '-d', type=str, default=None, help='Директория для выходных CSV (для папки)')
        parser.add_argument('--period', '-p', type=str, default=None, help='Период для ЕРЦ (YYYY-MM-DD)')

    def handle(self, *args, **options):
        inputs = options['input']
        period = options.get('period')

        if period:
            from datetime import datetime
            period = datetime.strptime(period, '%Y-%m-%d').date()

        for inp in inputs:
            path = Path(inp)
            if not path.exists():
                self.stderr.write(f'Файл/папка не найдены: {inp}')
                continue

            if path.is_dir():
                out_dir = options.get('output_dir') or (path / 'converted')
                convert_directory(str(path), str(out_dir), period)
            else:
                convert_file(str(path), options.get('output'), period)
