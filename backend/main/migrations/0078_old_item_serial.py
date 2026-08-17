# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('main', '0077_issue_order_serials'),
    ]
    operations = [
        migrations.AddField(
            model_name='issueorderitem',
            name='old_item_serial',
            field=models.CharField(blank=True, max_length=200, verbose_name='Серийный номер старого (обязателен к возврату)'),
        ),
        migrations.AddField(
            model_name='masterinventorydebt',
            name='serial_number',
            field=models.CharField(blank=True, max_length=200, verbose_name='Серийный номер старого'),
        ),
    ]