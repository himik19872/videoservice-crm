# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('main', '0073_issue_return_type'),
    ]
    operations = [
        migrations.AddField(
            model_name='ordermaterial',
            name='payment_type',
            field=models.CharField(choices=[('warranty', 'По гарантии (бесплатно)'), ('paid', 'За деньги')], default='warranty', max_length=20, verbose_name='Тип оплаты'),
        ),
        migrations.AddField(
            model_name='ordermaterial',
            name='price',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Цена за материал, если платно', max_digits=10, null=True, verbose_name='Цена (₽)'),
        ),
        migrations.AddField(
            model_name='ordermaterial',
            name='source',
            field=models.CharField(choices=[('warehouse', 'Со склада'), ('master_zip', 'Из ЗИП мастера')], default='warehouse', max_length=20, verbose_name='Источник'),
        ),
    ]