# Создано вручную (без AddField return_type — поле уже существует в БД)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0080_return_requests_orders'),
    ]

    operations = [
        migrations.AlterField(
            model_name='inventoryitem',
            name='status',
            field=models.CharField(choices=[('in_stock', 'На складе'), ('with_master', 'У мастера'), ('installed', 'Установлено'), ('returned', 'Возвращено'), ('defective', 'Брак'), ('repair', 'В ремонте'), ('written_off', 'Списано')], default='in_stock', max_length=20, verbose_name='Статус'),
        ),
        migrations.AlterField(
            model_name='inventorymovement',
            name='movement_type',
            field=models.CharField(choices=[('in', 'Приход'), ('out_to_master', 'Выдано мастеру'), ('return_from_master', 'Возврат от мастера'), ('installed', 'Установлено клиенту'), ('return_from_client', 'Возврат от клиента'), ('written_off', 'Списано'), ('defect', 'Брак'), ('to_repair', 'В ремонт'), ('from_repair', 'Из ремонта')], max_length=20, verbose_name='Тип движения'),
        ),
    ]
