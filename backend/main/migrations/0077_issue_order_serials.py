# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('main', '0076_issue_order_nullable'),
    ]
    operations = [
        migrations.AddField(
            model_name='issueorderitem',
            name='issued_serials',
            field=models.JSONField(blank=True, default=list, verbose_name='Серийные номера (выдано)'),
        ),
        migrations.AddField(
            model_name='issueorderitem',
            name='returned_serials',
            field=models.JSONField(blank=True, default=list, verbose_name='Серийные номера (возвращено)'),
        ),
    ]