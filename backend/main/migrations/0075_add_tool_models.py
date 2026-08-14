# Generated manually
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('main', '0074_add_order_material_payment_fields'),
    ]
    operations = [
        migrations.CreateModel(
            name='Tool',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Название')),
                ('tool_type', models.CharField(choices=[('drill', 'Дрель/шуруповёрт'), ('perforator', 'Перфоратор'), ('grinder', 'Болгарка'), ('multimeter', 'Мультиметр'), ('crimper', 'Обжимной инструмент'), ('screwdriver_set', 'Набор отвёрток'), ('wrench_set', 'Набор ключей'), ('ladder', 'Лестница/стремянка'), ('tester', 'Тестер/кабелеискатель'), ('soldering', 'Паяльник/станция'), ('measure', 'Измерительный (рулетка/уровень)'), ('other', 'Другое')], default='other', max_length=20, verbose_name='Тип')),
                ('serial_number', models.CharField(blank=True, max_length=100, verbose_name='Инвентарный номер')),
                ('model_name', models.CharField(blank=True, max_length=100, verbose_name='Модель')),
                ('barcode', models.CharField(blank=True, max_length=100, null=True, unique=True, verbose_name='Штрих-код')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество')),
                ('cost_price', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Стоимость')),
                ('status', models.CharField(choices=[('in_stock', 'На складе'), ('issued', 'Выдан'), ('returned', 'Возвращён'), ('broken', 'Сломан'), ('written_off', 'Списан')], default='in_stock', max_length=20, verbose_name='Статус')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Добавлен')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Обновлён')),
                ('current_holder', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='held_tools', to='main.master', verbose_name='У кого на руках')),
            ],
            options={
                'verbose_name': 'Инструмент',
                'verbose_name_plural': 'Инструменты',
                'ordering': ['tool_type', 'name'],
            },
        ),
        migrations.CreateModel(
            name='ToolMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('movement_type', models.CharField(choices=[('issued', 'Выдан'), ('returned', 'Возвращён'), ('broken', 'Сломан'), ('written_off', 'Списан')], max_length=20, verbose_name='Тип')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата операции')),
                ('master', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tool_movements', to='main.master', verbose_name='Мастер/Монтажник')),
                ('performed_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Выполнил')),
                ('tool', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movements', to='main.tool', verbose_name='Инструмент')),
            ],
            options={
                'verbose_name': 'Движение инструмента',
                'verbose_name_plural': 'Движения инструментов',
                'ordering': ['-created_at'],
            },
        ),
    ]