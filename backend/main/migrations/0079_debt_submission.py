# Generated manually
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('main', '0078_old_item_serial'),
    ]
    operations = [
        migrations.AddField(
            model_name='masterinventorydebt',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Сдано мастером (дата)'),
        ),
        migrations.AddField(
            model_name='masterinventorydebt',
            name='submitted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='submitted_returns', to=settings.AUTH_USER_MODEL, verbose_name='Сдал (мастер)'),
        ),
    ]