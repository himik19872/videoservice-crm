# Generated migration: справочники, подъезды, тарифы, контракты, платежи
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0043_add_building_client_link'),
    ]

    operations = [
        # 1. Новые модели-справочники
        migrations.CreateModel(
            name='BuildingEntrance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('number', models.PositiveIntegerField(verbose_name='Номер подъезда')),
                ('apartment_from', models.PositiveIntegerField(default=0, verbose_name='Квартиры с')),
                ('apartment_to', models.PositiveIntegerField(default=0, verbose_name='Квартиры по')),
                ('apartments_count', models.PositiveIntegerField(default=0, verbose_name='Кол-во квартир')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('building', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entrances', to='main.building', verbose_name='Дом')),
            ],
            options={
                'verbose_name': 'Подъезд дома',
                'verbose_name_plural': 'Подъезды домов',
                'ordering': ['building', 'number'],
                'unique_together': {('building', 'number')},
            },
        ),
        migrations.CreateModel(
            name='ManagementCompany',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=300, unique=True, verbose_name='Название')),
                ('short_name', models.CharField(blank=True, max_length=100, verbose_name='Короткое название')),
                ('inn', models.CharField(blank=True, max_length=12, verbose_name='ИНН')),
                ('phone', models.CharField(blank=True, max_length=20, verbose_name='Телефон')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('notes', models.TextField(blank=True, verbose_name='Примечания')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создана')),
            ],
            options={
                'verbose_name': 'Управляющая компания',
                'verbose_name_plural': 'Управляющие компании',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Tariff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Название тарифа')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Сумма (₽/мес)')),
                ('description', models.TextField(blank=True, verbose_name='Описание')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активен')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создан')),
            ],
            options={
                'verbose_name': 'Тариф',
                'verbose_name_plural': 'Тарифы',
                'ordering': ['amount'],
            },
        ),

        # 2. Новые поля в Client
        migrations.AddField(
            model_name='client',
            name='contract_type',
            field=models.CharField(choices=[('erc', 'ЕРЦ'), ('uk_tszh', 'УК / ТСЖ'), ('one_time', 'Разовый платный выезд')], default='erc', max_length=30, verbose_name='Тип договора'),
        ),
        migrations.AddField(
            model_name='client',
            name='erc_enabled',
            field=models.BooleanField(default=True, verbose_name='ЕРЦ (да/нет)'),
        ),
        migrations.AddField(
            model_name='client',
            name='monthly_payment',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Ежемесячный платёж (₽)'),
        ),
        # tariff FK (nullable)
        migrations.AddField(
            model_name='client',
            name='tariff',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='clients', to='main.tariff', verbose_name='Тариф'),
        ),
        # Замена management_company: CharField → FK. Сначала переименовываем старое поле
        migrations.RenameField(
            model_name='client',
            old_name='management_company',
            new_name='management_company_str',
        ),
        migrations.AddField(
            model_name='client',
            name='management_company',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='clients', to='main.managementcompany', verbose_name='Управляющая компания/ТСЖ'),
        ),
        # Замена entrance: CharField → FK
        migrations.RenameField(
            model_name='client',
            old_name='entrance',
            new_name='entrance_str',
        ),
        migrations.AddField(
            model_name='client',
            name='entrance',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='residents', to='main.buildingentrance', verbose_name='Подъезд'),
        ),

        # 3. Новая модель PaymentRecord
        migrations.CreateModel(
            name='PaymentRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period', models.DateField(verbose_name='Период')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Сумма')),
                ('payment_type', models.CharField(choices=[('accrual', 'Начисление'), ('payment', 'Оплата'), ('debt', 'Задолженность')], default='accrual', max_length=20, verbose_name='Тип')),
                ('description', models.CharField(blank=True, max_length=300, verbose_name='Описание')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_records', to='main.client', verbose_name='Клиент')),
            ],
            options={
                'verbose_name': 'Платёж (внутренний)',
                'verbose_name_plural': 'Платежи (внутренние)',
                'ordering': ['-period'],
            },
        ),
    ]
