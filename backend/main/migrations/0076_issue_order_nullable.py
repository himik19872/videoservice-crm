# Generated manually
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('main', '0075_add_tool_models'),
    ]
    operations = [
        migrations.AlterField(
            model_name='issueorder',
            name='order',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='issue_orders', to='main.order', verbose_name='Заявка'),
        ),
    ]