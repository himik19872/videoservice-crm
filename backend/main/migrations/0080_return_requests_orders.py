# Создано вручную (без AddField return_type — поле уже существует в БД)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('main', '0079_debt_submission'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReturnOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('draft', 'Черновик'), ('pending', 'Ожидает приёмки'), ('completed', 'Принято'), ('partial', 'Частично принято')], default='draft', max_length=20, verbose_name='Статус')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('completed_at', models.DateTimeField(blank=True, null=True, verbose_name='Завершено')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_return_orders', to=settings.AUTH_USER_MODEL, verbose_name='Создал (кладовщик)')),
                ('master', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='return_orders', to='main.master', verbose_name='Мастер')),
            ],
            options={
                'verbose_name': 'Ордер на приёмку',
                'verbose_name_plural': 'Ордера на приёмку',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ReturnRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_type', models.CharField(choices=[('material', 'Материал'), ('tool', 'Инструмент')], max_length=10, verbose_name='Тип позиции')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество')),
                ('serial_number', models.CharField(blank=True, max_length=200, verbose_name='Серийный номер')),
                ('status', models.CharField(choices=[('pending', 'Ожидает сдачи'), ('submitted', 'Сдано мастером'), ('accepted', 'Принято кладовщиком'), ('rejected', 'Отклонено')], default='pending', max_length=20, verbose_name='Статус')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Обновлено')),
                ('inventory_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_requests', to='main.inventoryitem', verbose_name='Материал')),
                ('master', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='return_requests', to='main.master', verbose_name='Мастер')),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_returns', to=settings.AUTH_USER_MODEL, verbose_name='Запросил (кладовщик)')),
                ('tool', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_requests', to='main.tool', verbose_name='Инструмент')),
            ],
            options={
                'verbose_name': 'Запрос возврата',
                'verbose_name_plural': 'Запросы возврата',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ReturnOrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_type', models.CharField(choices=[('material', 'Материал'), ('tool', 'Инструмент')], max_length=10, verbose_name='Тип позиции')),
                ('name', models.CharField(max_length=300, verbose_name='Название')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество к сдаче')),
                ('quantity_accepted', models.PositiveIntegerField(default=0, verbose_name='Принято')),
                ('serial_number', models.CharField(blank=True, max_length=200, verbose_name='Серийный номер')),
                ('condition', models.CharField(choices=[('working', 'Рабочее'), ('broken', 'Сломанное'), ('repairable', 'Ремонтопригодное'), ('missing', 'Отсутствует')], default='broken', max_length=20, verbose_name='Состояние')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('inventory_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_order_items', to='main.inventoryitem', verbose_name='Материал')),
                ('return_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='main.returnorder', verbose_name='Ордер приёмки')),
                ('return_request', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_order_items', to='main.returnrequest', verbose_name='Запрос возврата')),
                ('tool', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_order_items', to='main.tool', verbose_name='Инструмент')),
            ],
            options={
                'verbose_name': 'Позиция ордера приёмки',
                'verbose_name_plural': 'Позиции ордеров приёмки',
            },
        ),
    ]
