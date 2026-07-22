from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import random
import string


def generate_order_number():
    """Генерирует уникальный номер заявки: ЗАЯВ-YYMMDD-XXXX"""
    today = timezone.localdate()
    date_part = today.strftime('%y%m%d')
    random_part = ''.join(random.choices(string.digits, k=4))
    return f'ЗАЯВ-{date_part}-{random_part}'


class AuditLog(models.Model):
    """Журнал действий сотрудников."""
    ACTION_CHOICES = [
        ('create', 'Создание'),
        ('update', 'Изменение'),
        ('delete', 'Удаление'),
        ('login', 'Вход'),
        ('logout', 'Выход'),
        ('import', 'Импорт'),
        ('export', 'Экспорт'),
        ('migrate', 'Перенос данных'),
        ('other', 'Прочее'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs', verbose_name=_('Сотрудник'))
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name=_('Действие'))
    model_name = models.CharField(max_length=100, blank=True, verbose_name=_('Модель'))
    object_id = models.CharField(max_length=50, blank=True, verbose_name=_('ID объекта'))
    object_repr = models.CharField(max_length=300, blank=True, verbose_name=_('Представление объекта'))
    details = models.JSONField(default=dict, blank=True, verbose_name=_('Детали'))
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name=_('IP-адрес'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Время'))

    class Meta:
        verbose_name = _('Запись аудита')
        verbose_name_plural = _('Журнал аудита')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        return f'[{self.created_at.strftime("%d.%m.%Y %H:%M")}] {self.user} — {self.get_action_display()}: {self.object_repr}'


class Building(models.Model):
    """Обслуживаемый адрес (дом) — основа адресной системы.
    
    Иерархия: Город → Улица → Дом → Корпус/Литера
    К дому привязаны клиенты (квартиры), история, оборудование.
    """
    STREET_TYPES = [
        ('street', _('Улица')),
        ('avenue', _('Проспект')),
        ('lane', _('Переулок')),
        ('boulevard', _('Бульвар')),
        ('highway', _('Шоссе')),
        ('square', _('Площадь')),
        ('embankment', _('Набережная')),
        ('passage', _('Проезд')),
        ('alley', _('Аллея')),
        ('microdistrict', _('Микрорайон')),
        ('other', _('Другое')),
    ]

    EQUIPMENT_TYPES = [
        ('intercom', _('Домофон')),
        ('video_intercom', _('Видеодомофон')),
        ('camera', _('Камера')),
        ('call_panel', _('Вызывная панель')),
        ('door_lock', _('Дверной замок')),
        ('multi_apartment', _('Многоквартирная система')),
        ('other', _('Другое')),
    ]

    region = models.ForeignKey('Region', on_delete=models.SET_NULL, null=True, related_name='buildings', verbose_name=_('Регион'))
    city = models.CharField(max_length=100, default='Санкт-Петербург', verbose_name=_('Город'))
    district = models.CharField(max_length=200, blank=True, verbose_name=_('Район / пригород'))
    street_type = models.CharField(max_length=20, choices=STREET_TYPES, default='street', verbose_name=_('Тип улицы'))
    street_name = models.CharField(max_length=200, verbose_name=_('Название улицы'))
    house_number = models.CharField(max_length=20, verbose_name=_('Номер дома'))
    building_number = models.CharField(max_length=30, blank=True, verbose_name=_('Корпус/строение'))
    liter = models.CharField(max_length=10, blank=True, verbose_name=_('Литера'))
    apartments_count = models.PositiveIntegerField(default=0, verbose_name=_('Количество квартир'))
    entrances_count = models.PositiveIntegerField(default=1, verbose_name=_('Количество подъездов'))
    management_company = models.CharField(max_length=300, blank=True, verbose_name=_('Управляющая компания / ТСЖ'))
    management_company_fk = models.ForeignKey('ManagementCompany', on_delete=models.SET_NULL, null=True, blank=True, related_name='buildings_list', verbose_name=_('УК/ТСЖ (справочник)'))
    equipment_type = models.CharField(max_length=30, choices=EQUIPMENT_TYPES, blank=True, verbose_name=_('Тип оборудования'))
    equipment_list = models.TextField(blank=True, verbose_name=_('Список оборудования'))
    programming_code = models.CharField(max_length=200, blank=True, verbose_name=_('Код программирования'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    is_dormitory = models.BooleanField(default=False, verbose_name=_('Общежитие'), help_text=_('В одной квартире может быть несколько лицевых счетов'))
    dadata_verified = models.BooleanField(default=False, verbose_name=_('Адрес проверен через Dadata'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата добавления'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Дата обновления'))

    class Meta:
        verbose_name = _('Дом')
        verbose_name_plural = _('Дома')
        ordering = ['city', 'street_name', 'house_number']
        indexes = [
            models.Index(fields=['city', 'street_name', 'house_number']),
        ]

    def __str__(self):
        parts = []
        if self.city and self.city != 'Санкт-Петербург':
            parts.append(f'г. {self.city}')
        else:
            parts.append(self.city)
        if self.district and self.district != self.city:
            parts.append(self.district)
        if self.street_name:
            parts.append(f'{self.get_street_type_display().lower() if self.street_type != "other" else ""} {self.street_name}'.strip())
        if self.house_number:
            house = f'д. {self.house_number}'
            if self.building_number:
                house += f' корп. {self.building_number}'
            if self.liter:
                house += f' лит. {self.liter}'
            parts.append(house)
        return ', '.join(parts)

    @property
    def full_address(self):
        return str(self)


class BuildingEntrance(models.Model):
    """Подъезд дома — детализация по подъездам."""
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='entrances', verbose_name=_('Дом'))
    number = models.PositiveIntegerField(verbose_name=_('Номер подъезда'))
    apartment_from = models.PositiveIntegerField(default=0, verbose_name=_('Квартиры с'))
    apartment_to = models.PositiveIntegerField(default=0, verbose_name=_('Квартиры по'))
    apartments_count = models.PositiveIntegerField(default=0, verbose_name=_('Кол-во квартир'))
    ip_address = models.CharField(max_length=100, blank=True, verbose_name=_('IP-адрес панели'))
    access_code = models.CharField(max_length=100, blank=True, verbose_name=_('Код открытия двери'))
    programming_code = models.CharField(max_length=100, blank=True, verbose_name=_('Код программирования ключей'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))

    class Meta:
        verbose_name = _('Подъезд дома')
        verbose_name_plural = _('Подъезды домов')
        ordering = ['building', 'number']
        unique_together = ['building', 'number']

    def __str__(self):
        return f'{self.building}, подъезд №{self.number} (кв. {self.apartment_from}–{self.apartment_to})'


class BewardDevice(models.Model):
    """Справочник IP-адресов панелей Beward (умные домофоны)."""
    region = models.CharField(max_length=200, blank=True, verbose_name=_('Район'))
    address = models.TextField(blank=True, verbose_name=_('Адрес'))
    entrance_number = models.CharField(max_length=20, blank=True, verbose_name=_('Номер подъезда'))
    ip_address = models.CharField(max_length=100, blank=True, verbose_name=_('IP-адрес'))
    access_code = models.CharField(max_length=100, blank=True, verbose_name=_('Код открытия двери'))
    programming_code = models.CharField(max_length=100, blank=True, verbose_name=_('Код программирования ключей'))
    door_opening_code = models.CharField(max_length=100, blank=True, verbose_name=_('Код открытия двери (доп.)'))
    apartment_range = models.CharField(max_length=100, blank=True, verbose_name=_('Нумерация квартир'))
    date_issued = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата выдачи ключей'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    building = models.ForeignKey(Building, on_delete=models.SET_NULL, null=True, blank=True, related_name='beward_devices', verbose_name=_('Привязанный дом'))
    entrance = models.ForeignKey(BuildingEntrance, on_delete=models.SET_NULL, null=True, blank=True, related_name='beward_devices', verbose_name=_('Привязанный подъезд'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлён'))

    class Meta:
        verbose_name = _('Панель Beward')
        verbose_name_plural = _('Панели Beward (справочник IP)')
        ordering = ['address', 'entrance_number']

    def __str__(self):
        return f'Beward {self.ip_address} — {self.address}, под. {self.entrance_number}'


class ManagementCompany(models.Model):
    """Управляющая компания / ТСЖ — справочник."""
    PAYMENT_METHODS = [
        ('contract', _('По договору с УК/ТСЖ')),
        ('erc', _('Через ЕРЦ (прямые платежи жителей)')),
        ('mixed', _('Смешанная')),
    ]

    name = models.CharField(max_length=300, unique=True, verbose_name=_('Название'))
    short_name = models.CharField(max_length=100, blank=True, verbose_name=_('Короткое название'))
    inn = models.CharField(max_length=12, blank=True, verbose_name=_('ИНН'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Телефон'))
    email = models.EmailField(blank=True, verbose_name=_('Email'))
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='contract', verbose_name=_('Способ оплаты за домофон'))
    is_active = models.BooleanField(default=True, verbose_name=_('На обслуживании'))
    contract_number = models.CharField(max_length=50, blank=True, verbose_name=_('№ договора'))
    contract_date = models.DateField(null=True, blank=True, verbose_name=_('Дата договора'))
    contract_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Сумма договора в мес.'))
    terminated_at = models.DateField(null=True, blank=True, verbose_name=_('Дата расторжения'))
    termination_reason = models.TextField(blank=True, verbose_name=_('Причина расторжения'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создана'))

    class Meta:
        verbose_name = _('Управляющая компания')
        verbose_name_plural = _('Управляющие компании')
        ordering = ['name']

    def __str__(self):
        return self.short_name or self.name


class MCContact(models.Model):
    """Контактное лицо в УК/ТСЖ (сотрудник, с которым мы общаемся)."""
    management_company = models.ForeignKey(ManagementCompany, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=200, verbose_name=_('ФИО'))
    position = models.CharField(max_length=200, blank=True, verbose_name=_('Должность'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Телефон'))
    email = models.EmailField(blank=True, verbose_name=_('Email'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Контакт УК')
        verbose_name_plural = _('Контакты УК')
        ordering = ['name']

    def __str__(self):
        return f'{self.name} — {self.management_company.short_name or self.management_company.name}'


class MCPayment(models.Model):
    """Начисление/оплата от УК (бухгалтерия)."""
    management_company = models.ForeignKey(ManagementCompany, on_delete=models.CASCADE, related_name='payments')
    period = models.DateField(verbose_name=_('Период (месяц)'))
    amount_charged = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Начислено'))
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Оплачено'))
    is_confirmed = models.BooleanField(default=False, verbose_name=_('Подтверждено бухгалтером'))
    confirmed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Подтвердил'))
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата подтверждения'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Платёж УК')
        verbose_name_plural = _('Платежи УК')
        ordering = ['-period']
        unique_together = ['management_company', 'period']

    def __str__(self):
        return f'{self.management_company}: {self.period} — {self.amount_paid}/{self.amount_charged}'


class MCComment(models.Model):
    """История обращений/комментариев по УК (звонки, жалобы, письма...)"""
    management_company = models.ForeignKey(ManagementCompany, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name=_('Автор'))
    comment_type = models.CharField(max_length=30, default='note',
        choices=[('call', _('Звонок')), ('email', _('Письмо')), ('complaint', _('Жалоба')),
                 ('request', _('Запрос')), ('meeting', _('Встреча')), ('note', _('Заметка'))])
    text = models.TextField(verbose_name=_('Текст'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Комментарий УК')
        verbose_name_plural = _('Комментарии УК')
        ordering = ['-created_at']


class BuildingSystem(models.Model):
    """Система в доме (домофон, видеонаблюдение, СКУД, ворота...) со своим тарифом."""
    SYSTEM_TYPES = [
        ('intercom', _('Домофон')),
        ('cctv', _('Видеонаблюдение')),
        ('access_control', _('СКУД')),
        ('dispatch', _('Диспетчеризация')),
        ('auskue', _('АУСКУЭ')),
        ('gate', _('Ворота')),
        ('barrier', _('Шлагбаум')),
        ('fire_alarm', _('Пожарная сигнализация')),
        ('elevator_dispatch', _('Диспетчеризация лифтов')),
        ('other', _('Другое')),
    ]

    building = models.ForeignKey('Building', on_delete=models.CASCADE, related_name='systems', verbose_name=_('Дом'))
    system_type = models.CharField(max_length=30, choices=SYSTEM_TYPES, verbose_name=_('Тип системы'))
    tariff = models.ForeignKey('Tariff', on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Тариф'))
    monthly_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Сумма в месяц'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активна'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создана'))

    class Meta:
        verbose_name = _('Система дома')
        verbose_name_plural = _('Системы домов')
        ordering = ['building', 'system_type']
        unique_together = ['building', 'system_type']

    def __str__(self):
        return f'{self.get_system_type_display()} — {self.building}'


class Tariff(models.Model):
    """Тариф на обслуживание (ежемесячный платёж с квартиры)."""
    name = models.CharField(max_length=200, verbose_name=_('Название тарифа'))
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_('Сумма (₽/мес)'))
    description = models.TextField(blank=True, verbose_name=_('Описание'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))

    class Meta:
        verbose_name = _('Тариф')
        verbose_name_plural = _('Тарифы')
        ordering = ['amount']

    def __str__(self):
        return f'{self.name} — {self.amount} ₽/мес'


class Region(models.Model):
    """Регион (субъект РФ) с кодом."""
    name = models.CharField(max_length=100, verbose_name=_('Название'))
    code = models.CharField(max_length=3, default='', verbose_name=_('Код региона'), help_text=_('Напр. 78 (СПб), 47 (ЛО), 77 (Москва)'))
    country = models.CharField(max_length=100, default='Россия', verbose_name=_('Страна'))
    description = models.TextField(blank=True, verbose_name=_('Описание'))

    class Meta:
        verbose_name = _('Регион')
        verbose_name_plural = _('Регионы')
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.name}'


class UserProfile(models.Model):
    """Расширенный профиль пользователя (роль, смена)"""
    ROLE_CHOICES = [
        ('admin', _('Администратор')),
        ('dispatcher', _('Диспетчер')),
        ('master', _('Мастер')),
        ('installer', _('Монтажник')),
        ('engineer', _('Инженер')),
        ('chief_engineer', _('Главный инженер')),
        ('supervisor', _('Начальник сервисной службы')),
        ('tech_director', _('Технический директор')),
        ('executive_director', _('Исполнительный директор')),
        ('general_director', _('Генеральный директор')),
        ('clerk', _('Делопроизводитель')),
        ('accountant', _('Бухгалтер')),
        ('cashier', _('Кассир')),
        ('secretary', _('Секретарь')),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile', verbose_name=_('Пользователь'))
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='master', verbose_name=_('Роль'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Телефон'))
    is_on_shift = models.BooleanField(default=False, verbose_name=_('На смене'))
    shift_started_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Смена начата'))
    # JSON-поле с персональными правами (переопределяет/расширяет базовые права роли)
    permissions = models.JSONField(default=dict, blank=True, verbose_name=_('Персональные права'))

    class Meta:
        verbose_name = _('Профиль пользователя')
        verbose_name_plural = _('Профили пользователей')

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


class Master(models.Model):
    """Мастер-ремонтник"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='master_profile', verbose_name=_('Пользователь'))
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, related_name='masters', verbose_name=_('Район'))
    phone = models.CharField(max_length=20, verbose_name=_('Телефон'))
    is_available = models.BooleanField(default=True, verbose_name=_('Доступен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата регистрации'))

    class Meta:
        verbose_name = _('Мастер')
        verbose_name_plural = _('Мастера')

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.region})"


class Client(models.Model):
    """Клиент — житель квартиры в доме или юридическое лицо"""
    name = models.CharField(max_length=150, verbose_name=_('ФИО'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Телефон'))
    email = models.EmailField(blank=True, verbose_name=_('Email'))
    address = models.CharField(max_length=500, blank=True, default='', verbose_name=_('Адрес (строка)'))
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, related_name='clients', verbose_name=_('Район'))
    
    # Привязка к дому (основная адресная структура)
    building = models.ForeignKey(Building, on_delete=models.SET_NULL, null=True, blank=True, related_name='residents', verbose_name=_('Дом'))
    entrance = models.ForeignKey(BuildingEntrance, on_delete=models.SET_NULL, null=True, blank=True, related_name='residents', verbose_name=_('Подъезд'))
    apartment = models.CharField(max_length=20, blank=True, verbose_name=_('Квартира'))
    
    max_user_id = models.CharField(max_length=100, blank=True, verbose_name=_('Max user ID'))
    max_linked_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Max привязан'))
    # Юридическое лицо клиента (для смет и КП)
    is_legal = models.BooleanField(default=False, verbose_name=_('Юридическое лицо'))
    legal_type = models.CharField(max_length=30, blank=True, verbose_name=_('Тип юрлица'),
        choices=[
            ('uk_tszh', _('УК / ТСЖ')),
            ('developer', _('Застройщик')),
            ('contractor', _('Подрядчик')),
            ('partner', _('Партнёр')),
            ('independent', _('Самостоятельное')),
            ('other', _('Другое')),
        ])
    inn = models.CharField(max_length=12, blank=True, verbose_name=_('ИНН'))
    kpp = models.CharField(max_length=9, blank=True, verbose_name=_('КПП'))
    ogrn = models.CharField(max_length=15, blank=True, verbose_name=_('ОГРН'))
    legal_address = models.CharField(max_length=500, blank=True, verbose_name=_('Юридический адрес'))
    director_name = models.CharField(max_length=200, blank=True, verbose_name=_('ФИО руководителя'))
    # Импорт из Excel — база клиентов
    personal_account_number = models.CharField(max_length=50, blank=True, null=True, db_index=True, verbose_name=_('Номер лицевого счета'))
    management_company = models.ForeignKey(ManagementCompany, on_delete=models.SET_NULL, null=True, blank=True, related_name='clients', verbose_name=_('Управляющая компания/ТСЖ'))
    # === НОВЫЕ ПОЛЯ ===
    contract_type = models.CharField(max_length=30, default='erc', verbose_name=_('Тип договора'),
        choices=[
            ('erc', _('ЕРЦ')),
            ('uk_tszh', _('УК / ТСЖ')),
            ('one_time', _('Разовый платный выезд')),
        ])
    erc_enabled = models.BooleanField(default=True, verbose_name=_('ЕРЦ (да/нет)'))
    tariff = models.ForeignKey(Tariff, on_delete=models.SET_NULL, null=True, blank=True, related_name='clients', verbose_name=_('Тариф'))
    monthly_payment = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Ежемесячный платёж (₽)'))
    # Расширенный разбор адреса при импорте
    district = models.CharField(max_length=200, blank=True, verbose_name=_('Район (муниципальный)'))
    source = models.CharField(max_length=20, default='manual', verbose_name=_('Источник'),
                              choices=[('manual', _('Ручной ввод')), ('excel_import', _('Импорт Excel (ТСЖ)')), ('erc', _('ЕРЦ')), ('bitrix24', _('Битрикс24'))])
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата добавления'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))

    class Meta:
        verbose_name = _('Клиент')
        verbose_name_plural = _('Клиенты')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.phone})"


class PaymentRecord(models.Model):
    """Внутренний платёж / начисление (не из ЕРЦ) — от УК, ТСЖ, разовые."""
    PAYMENT_TYPE_CHOICES = [
        ('accrual', _('Начисление')),
        ('payment', _('Оплата')),
        ('debt', _('Задолженность')),
    ]
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='payment_records', verbose_name=_('Клиент'))
    period = models.DateField(verbose_name=_('Период'))
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_('Сумма'))
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='accrual', verbose_name=_('Тип'))
    description = models.CharField(max_length=300, blank=True, verbose_name=_('Описание'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))

    class Meta:
        verbose_name = _('Платёж (внутренний)')
        verbose_name_plural = _('Платежи (внутренние)')
        ordering = ['-period']

    def __str__(self):
        return f'{self.client.name}: {self.get_payment_type_display()} {self.amount}₽ ({self.period.strftime("%m.%Y")})'


class Equipment(models.Model):
    """Оборудование"""
    EQUIPMENT_TYPES = [
        ('intercom', _('Домофон')),
        ('camera', _('Камера')),
        ('call_panel', _('Вызывная панель')),
        ('door_lock', _('Дверной замок')),
        ('other', _('Другое')),
    ]

    STATUS_CHOICES = [
        ('working', _('Работает')),
        ('broken', _('Не работает')),
        ('under_repair', _('На ремонте')),
        ('decommissioned', _('Выбыл')),
    ]

    name = models.CharField(max_length=100, verbose_name=_('Название'))
    equipment_type = models.CharField(max_length=20, choices=EQUIPMENT_TYPES, verbose_name=_('Тип'))
    serial_number = models.CharField(max_length=100, unique=True, verbose_name=_('Серийный номер'))
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='equipment', verbose_name=_('Клиент'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='working', verbose_name=_('Статус'))
    warranty_until = models.DateField(blank=True, null=True, verbose_name=_('Гарантия до'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата добавления'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Дата обновления'))

    class Meta:
        verbose_name = _('Оборудование')
        verbose_name_plural = _('Оборудование')

    def __str__(self):
        return f"{self.name} - {self.serial_number}"


class Order(models.Model):
    """Заявка"""
    ORDER_TYPES = [
        ('repair', _('Ремонт')),
        ('sale', _('Продажа оборудования')),
        ('maintenance', _('Сервисное ТО')),
        ('installation', _('Монтаж оборудования')),
        ('contract_install', _('Договор на монтаж')),
        ('contract_service', _('Договор на обслуживание')),
        ('inspection', _('Обследование')),
        ('connection', _('Подключение')),
    ]

    STATUS_CHOICES = [
        ('new', _('Новая')),
        ('assigned', _('Назначена')),
        ('accepted', _('Принята')),
        ('in_progress', _('В работе')),
        ('paused', _('На паузе')),
        ('need_help', _('Требуется помощь')),
        ('completed', _('Выполнена')),
        ('confirmed', _('Подтверждена')),
        ('cancelled', _('Отменена')),
    ]

    PAYMENT_TYPES = [
        ('cash', _('Наличные')),
        ('cashless', _('Безналичные')),
    ]

    priority_choices = [
        ('low', _('Низкий')),
        ('medium', _('Средний')),
        ('high', _('Высокий')),
        ('urgent', _('Срочный')),
    ]

    number = models.CharField(max_length=20, unique=True, verbose_name=_('Номер'), default=generate_order_number)
    order_type = models.CharField(max_length=20, choices=ORDER_TYPES, verbose_name=_('Тип заявки'))
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='orders', verbose_name=_('Клиент'))
    master = models.ForeignKey('Master', on_delete=models.SET_NULL, null=True, related_name='orders', verbose_name=_('Исполнитель'))
    helpers = models.ManyToManyField(User, blank=True, related_name='helper_orders', verbose_name=_('Помощники'))
    equipment = models.ForeignKey(Equipment, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', verbose_name=_('Оборудование'))
    building = models.ForeignKey('Building', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', verbose_name=_('Дом'))
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, related_name='orders', verbose_name=_('Район'))

    # Расширенные поля адреса
    city = models.CharField(max_length=100, default='', blank=True, verbose_name=_('Город'))
    street_name = models.CharField(max_length=200, default='', blank=True, verbose_name=_('Улица'))
    house_number = models.CharField(max_length=20, default='', blank=True, verbose_name=_('Дом'))
    building_number = models.CharField(max_length=20, default='', blank=True, verbose_name=_('Корпус/строение'))
    apartment = models.CharField(max_length=20, default='', blank=True, verbose_name=_('Квартира'))
    entrance = models.CharField(max_length=10, default='', blank=True, verbose_name=_('Подъезд'))
    address = models.CharField(max_length=500, blank=True, verbose_name=_('Адрес'))

    description = models.TextField(verbose_name=_('Описание проблемы'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', verbose_name=_('Статус'))
    priority = models.CharField(max_length=20, choices=priority_choices, default='medium', verbose_name=_('Приоритет'))
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_('Стоимость'))
    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPES, blank=True, null=True, verbose_name=_('Тип оплаты'))
    is_paid = models.BooleanField(default=False, verbose_name=_('Оплачена'))
    is_warranty = models.BooleanField(default=False, verbose_name=_('Гарантийная (бесплатно)'))
    photo_report_required = models.BooleanField(default=False, verbose_name=_('Требуется фото/видео отчёт'))
    assigned_at = models.DateTimeField(blank=True, null=True, verbose_name=_('Назначена'))
    scheduled_at = models.DateTimeField(blank=True, null=True, verbose_name=_('Запланировано на'))
    accepted_at = models.DateTimeField(blank=True, null=True, verbose_name=_('Принята'))
    started_at = models.DateTimeField(blank=True, null=True, verbose_name=_('Начата'))
    paused_at = models.DateTimeField(blank=True, null=True, verbose_name=_('На паузе'))
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name=_('Завершена'))
    confirmed_at = models.DateTimeField(blank=True, null=True, verbose_name=_('Подтверждена'))
    confirmed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmed_orders', verbose_name=_('Подтвердил'))
    used_materials = models.ManyToManyField('InventoryItem', through='OrderMaterial', blank=True, related_name='used_in_orders', verbose_name=_('Материалы'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата создания'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Дата обновления'))
    deadline = models.DateTimeField(blank=True, null=True, verbose_name=_('Срок выполнения'))

    # Группировка заявок
    parent_order = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='linked_orders', verbose_name=_('Главная заявка (объединение)'))

    class Meta:
        verbose_name = _('Заявка')
        verbose_name_plural = _('Заявки')
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Автогенерация номера + сборка полного адреса"""
        if not self.number:
            self.number = generate_order_number()
            for _ in range(10):
                if not Order.objects.filter(number=self.number).exists():
                    break
                self.number = generate_order_number()

        # Собираем полный адрес из частей
        parts = []
        if self.city:
            parts.append(self.city)
        if self.street_name:
            parts.append(self.street_name)
        if self.house_number:
            house = f'д. {self.house_number}'
            if self.building_number:
                house += f' корп. {self.building_number}'
            parts.append(house)
        if self.apartment:
            parts.append(f'кв. {self.apartment}')
        if self.entrance:
            parts.append(f'под. {self.entrance}')
        full = ', '.join(parts)
        if full:
            self.address = full
        elif not self.address:
            self.address = full or ''

        super().save(*args, **kwargs)

    @property
    def full_address(self):
        """Полный адрес для навигатора"""
        return self.address or f"{self.city}, {self.street_name}, {self.house_number}"

    def __str__(self):
        return f"Заявка #{self.number} - {self.get_order_type_display()}"


class OrderHistory(models.Model):
    """История изменений заявки"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='history', verbose_name=_('Заявка'))
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name=_('Изменил'))
    old_status = models.CharField(max_length=20, blank=True, verbose_name=_('Старый статус'))
    new_status = models.CharField(max_length=20, verbose_name=_('Новый статус'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    master_lat = models.FloatField(null=True, blank=True, verbose_name=_('Широта мастера'))
    master_lon = models.FloatField(null=True, blank=True, verbose_name=_('Долгота мастера'))
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Время изменения'))

    class Meta:
        verbose_name = _('История заявки')
        verbose_name_plural = _('История заявок')

    def __str__(self):
        return f"{self.order} - {self.old_status} → {self.new_status}"


class Report(models.Model):
    """Отчет"""
    REPORT_TYPES = [
        ('daily', _('Ежедневный')),
        ('weekly', _('Еженедельный')),
        ('monthly', _('Ежемесячный')),
        ('custom', _('Пользовательский')),
    ]

    STATUS_CHOICES = [
        ('draft', _('Черновик')),
        ('generated', _('Сгенерирован')),
        ('sent', _('Отправлен')),
    ]

    title = models.CharField(max_length=200, verbose_name=_('Название'))
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES, verbose_name=_('Тип'))
    period_start = models.DateField(verbose_name=_('Начало периода'))
    period_end = models.DateField(verbose_name=_('Конец периода'))
    data = models.JSONField(default=dict, verbose_name=_('Данные'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name=_('Статус'))
    generated_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Сгенерирован'))
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name=_('Создал'))

    class Meta:
        verbose_name = _('Отчет')
        verbose_name_plural = _('Отчеты')

    def __str__(self):
        return f"{self.title} ({self.period_start} - {self.period_end})"


class TraccarSettings(models.Model):
    """Настройки интеграции с Traccar GPS"""
    server_url = models.CharField(max_length=255, verbose_name=_('URL сервера'), help_text='Например: http://traccar.example.com:8082')
    username = models.CharField(max_length=100, verbose_name=_('Логин (email)'))
    password = models.CharField(max_length=100, verbose_name=_('Пароль'))
    is_active = models.BooleanField(default=False, verbose_name=_('Интеграция активна'))
    sync_interval_minutes = models.PositiveIntegerField(default=5, verbose_name=_('Интервал синхронизации (мин)'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Настройки Traccar')
        verbose_name_plural = _('Настройки Traccar')

    def __str__(self):
        return f"Traccar: {self.server_url} ({'активен' if self.is_active else 'не активен'})"


class TraccarDevice(models.Model):
    """Привязка GPS-устройства Traccar к мастеру"""
    master = models.OneToOneField(Master, on_delete=models.CASCADE, related_name='traccar_device', verbose_name=_('Мастер'))
    internal_device_id = models.IntegerField(unique=True, verbose_name=_('Внутренний ID устройства в Traccar'))
    unique_id = models.CharField(max_length=100, unique=True, verbose_name=_('Уникальный ID (IMEI)'))
    device_name = models.CharField(max_length=200, blank=True, verbose_name=_('Название устройства'))
    last_latitude = models.FloatField(null=True, blank=True, verbose_name=_('Последняя широта'))
    last_longitude = models.FloatField(null=True, blank=True, verbose_name=_('Последняя долгота'))
    last_speed = models.FloatField(null=True, blank=True, verbose_name=_('Последняя скорость (км/ч)'))
    last_update = models.DateTimeField(null=True, blank=True, verbose_name=_('Последнее обновление координат'))
    is_online = models.BooleanField(default=False, verbose_name=_('Устройство онлайн'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Привязано'))

    class Meta:
        verbose_name = _('GPS-устройство мастера')
        verbose_name_plural = _('GPS-устройства мастеров')

    def __str__(self):
        return f"{self.master} → устройство #{self.internal_device_id}"


class TraccarMileage(models.Model):
    """Пробег мастера по заявке"""
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='mileage', verbose_name=_('Заявка'))
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='mileages', verbose_name=_('Мастер'))
    distance_km = models.FloatField(default=0, verbose_name=_('Пробег (км)'))
    start_position_lat = models.FloatField(null=True, blank=True, verbose_name=_('Старт: широта'))
    start_position_lon = models.FloatField(null=True, blank=True, verbose_name=_('Старт: долгота'))
    end_position_lat = models.FloatField(null=True, blank=True, verbose_name=_('Финиш: широта'))
    end_position_lon = models.FloatField(null=True, blank=True, verbose_name=_('Финиш: долгота'))
    data = models.JSONField(default=dict, verbose_name=_('Данные пробега (JSON)'))
    synced_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Синхронизировано'))

    class Meta:
        verbose_name = _('Пробег по заявке')
        verbose_name_plural = _('Пробеги по заявкам')

    def __str__(self):
        return f"{self.master}: {self.distance_km} км — {self.order}"


class SystemSettings(models.Model):
    """Системные настройки (один объект на всю систему)"""
    # Резервное копирование
    auto_backup = models.BooleanField(default=False, verbose_name=_('Авто-бэкап'))
    backup_time = models.CharField(max_length=5, default='03:00', verbose_name=_('Время бэкапа'))
    backup_keep_days = models.PositiveIntegerField(default=30, verbose_name=_('Хранить дней'))
    backup_path = models.CharField(max_length=255, default='/var/backups/crm/', verbose_name=_('Путь для бэкапов'))

    # Медиа (фото/видео отчёты)
    media_max_size_mb = models.PositiveIntegerField(default=50, verbose_name=_('Макс. размер файла (МБ)'))
    media_allowed_types = models.CharField(max_length=200, default='jpg,jpeg,png,mp4,mov,avi', verbose_name=_('Разрешённые типы'))
    media_storage_path = models.CharField(max_length=255, default='/var/media/crm/', verbose_name=_('Путь хранения'))
    media_retention_days = models.PositiveIntegerField(default=90, verbose_name=_('Хранить дней'))

    # Сетевые настройки
    external_ip = models.CharField(max_length=50, default='83.243.73.86', verbose_name=_('Внешний IP'))
    internal_ip = models.CharField(max_length=50, default='192.168.1.38', verbose_name=_('Внутренний IP'))
    external_port = models.PositiveIntegerField(default=3000, verbose_name=_('Внешний порт'))
    internal_port = models.PositiveIntegerField(default=8000, verbose_name=_('Внутренний порт'))
    dns_name = models.CharField(max_length=100, blank=True, verbose_name=_('DNS-имя'))
    api_base_url = models.CharField(max_length=255, default='/api', verbose_name=_('API base URL'))
    
    # Внешние API
    dadata_token = models.CharField(max_length=200, blank=True, verbose_name=_('DaData API токен'))
    dadata_secret = models.CharField(max_length=200, blank=True, verbose_name=_('DaData секретный ключ'))
    max_bot_token = models.CharField(max_length=255, blank=True, verbose_name=_('Max бот токен'))
    max_bot_name = models.CharField(max_length=100, default='CRM Bot', verbose_name=_('Max бот имя'))
    max_bot_active = models.BooleanField(default=False, verbose_name=_('Max бот активен'))
    max_api_url = models.CharField(max_length=255, default='https://business.max.ru', verbose_name=_('Max API URL'))
    traccar_url = models.CharField(max_length=255, default='http://localhost:8082', verbose_name=_('Traccar URL'))
    traccar_user = models.CharField(max_length=100, blank=True, verbose_name=_('Traccar логин'))
    traccar_pass = models.CharField(max_length=100, blank=True, verbose_name=_('Traccar пароль'))
    traccar_active = models.BooleanField(default=False, verbose_name=_('Traccar активен'))

    # Шаблон КП (коммерческого предложения)
    cp_logo_url = models.CharField(max_length=500, blank=True, verbose_name=_('Логотип для КП (URL)'))
    cp_header_text = models.CharField(max_length=300, default='Коммерческое предложение', blank=True, verbose_name=_('Заголовок КП'))
    cp_footer_text = models.CharField(max_length=500, default='С уважением, команда Видео Сервис', blank=True, verbose_name=_('Текст в подвале КП'))
    cp_signature_name = models.CharField(max_length=200, blank=True, verbose_name=_('ФИО подписанта'))
    cp_signature_title = models.CharField(max_length=200, blank=True, verbose_name=_('Должность подписанта'))
    cp_validity_days = models.PositiveIntegerField(default=7, verbose_name=_('Срок действия КП (дней)'))
    cp_color = models.CharField(max_length=20, default='#1a3e60', verbose_name=_('Цвет шапки КП (hex)'))
    cp_show_logo = models.BooleanField(default=True, verbose_name=_('Показывать логотип'))

    # Обновление с GitHub
    git_repo_url = models.CharField(max_length=500, default='https://github.com/himik19872/videoservice-crm.git', blank=True, verbose_name=_('GitHub репозиторий'))
    git_branch = models.CharField(max_length=100, default='main', verbose_name=_('Ветка'))
    git_token = models.CharField(max_length=255, blank=True, verbose_name=_('GitHub токен (для приватных репо)'))
    auto_update_enabled = models.BooleanField(default=False, verbose_name=_('Автообновление'))
    last_update_check = models.DateTimeField(null=True, blank=True, verbose_name=_('Последняя проверка'))
    current_version = models.CharField(max_length=50, default='1.0.0', verbose_name=_('Текущая версия'))
    latest_commit = models.CharField(max_length=40, blank=True, verbose_name=_('Последний коммит'))

    # ═══ Битрикс24 ═══
    bitrix24_webhook = models.CharField(max_length=500, blank=True, verbose_name=_('Bitrix24 Webhook URL'),
                                         help_text=_('Входящий вебхук: https://yourdomain.bitrix24.ru/rest/1/xxxx...'))
    bitrix24_active = models.BooleanField(default=False, verbose_name=_('Интеграция с Битрикс24 активна'))

    # ═══ Ростелеком АТС ═══
    rostelecom_account_id = models.CharField(max_length=100, blank=True, verbose_name=_('Account ID Ростелеком'))
    rostelecom_api_token = models.CharField(max_length=255, blank=True, verbose_name=_('API токен Ростелеком'))
    rostelecom_active = models.BooleanField(default=False, verbose_name=_('Интеграция с Ростелеком АТС активна'))

    # ═══ Asterisk PBX ═══
    asterisk_host = models.CharField(max_length=100, default='192.168.1.68', blank=True, verbose_name=_('Asterisk хост'))
    asterisk_port = models.PositiveIntegerField(default=5038, verbose_name=_('Asterisk AMI порт'))
    asterisk_user = models.CharField(max_length=100, default='crm_admin', blank=True, verbose_name=_('AMI пользователь'))
    asterisk_secret = models.CharField(max_length=255, default='crm_asterisk_secret_2026', blank=True, verbose_name=_('AMI пароль'))
    asterisk_ssh_user = models.CharField(max_length=100, default='himik', blank=True, verbose_name=_('SSH пользователь'))
    asterisk_ssh_password = models.CharField(max_length=255, default='96811621', blank=True, verbose_name=_('SSH пароль'))
    asterisk_ssh_port = models.PositiveIntegerField(default=22, verbose_name=_('SSH порт'))
    asterisk_active = models.BooleanField(default=False, verbose_name=_('Интеграция с Asterisk активна'))

    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Системные настройки')
        verbose_name_plural = _('Системные настройки')

    def save(self, *args, **kwargs):
        # Очищаем битрикс24 webhook: принимаем и с profile.json, и без
        if self.bitrix24_webhook:
            url = self.bitrix24_webhook.strip()
            if url.endswith('/profile.json'):
                url = url[:-13]
            self.bitrix24_webhook = url
        super().save(*args, **kwargs)

    def __str__(self):
        return 'Системные настройки'


class OrderMedia(models.Model):
    """Фото/видео отчёты мастера по заявке"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='media', verbose_name=_('Заявка'))
    file = models.FileField(upload_to='orders/%Y/%m/', verbose_name=_('Файл'))
    file_type = models.CharField(max_length=10, choices=[('image', _('Фото')), ('video', _('Видео'))], verbose_name=_('Тип'))
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name=_('Загрузил'))
    notes = models.CharField(max_length=500, blank=True, verbose_name=_('Описание'))
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Загружено'))

    class Meta:
        verbose_name = _('Медиа заявки')
        verbose_name_plural = _('Медиа заявок')

    def __str__(self):
        return f"{self.get_file_type_display()}: {self.order.number}"


class WorkShift(models.Model):
    """Рабочая смена мастера или диспетчера"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shifts', verbose_name=_('Пользователь'))
    started_at = models.DateTimeField(verbose_name=_('Начало смены'))
    ended_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Конец смены'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активна'))
    orders_total = models.PositiveIntegerField(default=0, verbose_name=_('Заявок за смену'))
    orders_completed = models.PositiveIntegerField(default=0, verbose_name=_('Выполнено'))
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Общая стоимость'))
    total_mileage_km = models.FloatField(default=0, verbose_name=_('Пробег (км)'))
    hours_worked = models.FloatField(default=0, verbose_name=_('Часов на смене'))

    class Meta:
        verbose_name = _('Рабочая смена')
        verbose_name_plural = _('Рабочие смены')
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.username}: {self.started_at.strftime('%d.%m.%Y %H:%M')}"


class PushToken(models.Model):
    """Push-токен для уведомлений (Expo)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens', verbose_name=_('Пользователь'))
    token = models.CharField(max_length=255, unique=True, verbose_name=_('Expo push token'))
    platform = models.CharField(max_length=10, choices=[('ios', 'iOS'), ('android', 'Android')], default='android', verbose_name=_('Платформа'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлён'))

    class Meta:
        verbose_name = _('Push-токен')
        verbose_name_plural = _('Push-токены')

    def __str__(self):
        return f'{self.user.username}: {self.token[:20]}...'


class MaxBotSettings(models.Model):
    """Настройки бота Max"""
    bot_token = models.CharField(max_length=255, verbose_name=_('Токен бота'))
    bot_name = models.CharField(max_length=100, default='CRM Bot', verbose_name=_('Имя бота'))
    is_active = models.BooleanField(default=False, verbose_name=_('Активен'))
    api_base_url = models.CharField(max_length=255, default='https://business.max.ru', verbose_name=_('API URL'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Настройки Max бота')
        verbose_name_plural = _('Настройки Max ботов')

    def __str__(self):
        return f"Max Bot: {self.bot_name}"


class MaxUserLink(models.Model):
    """Связка пользователя CRM с Max"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='max_link', verbose_name=_('Пользователь'))
    max_user_id = models.CharField(max_length=100, verbose_name=_('Max user ID'))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_('Телефон в Max'))
    is_subscribed = models.BooleanField(default=True, verbose_name=_('Уведомления'))
    linked_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Привязан'))

    class Meta:
        verbose_name = _('Связка Max')
        verbose_name_plural = _('Связки Max')


# ══════════════════════════════════════════════════════════════════
# Склад и оборудование
# ══════════════════════════════════════════════════════════════════

class InventoryItem(models.Model):
    """Единица оборудования на складе (до установки клиенту)"""
    ITEM_TYPES = [
        ('intercom', _('Домофон')),
        ('video_intercom', _('Видеодомофон')),
        ('camera', _('Камера')),
        ('call_panel', _('Вызывная панель')),
        ('door_lock', _('Дверной замок')),
        ('monitor', _('Монитор')),
        ('power_supply', _('Блок питания')),
        ('cable', _('Кабель')),
        ('mounting_kit', _('Монтажный комплект')),
        ('other', _('Другое')),
    ]

    STATUS_CHOICES = [
        ('in_stock', _('На складе')),
        ('with_master', _('У мастера')),
        ('installed', _('Установлено')),
        ('returned', _('Возвращено')),
        ('defective', _('Брак')),
        ('written_off', _('Списано')),
    ]

    name = models.CharField(max_length=200, verbose_name=_('Название'))
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, verbose_name=_('Тип'))
    serial_number = models.CharField(max_length=100, blank=True, verbose_name=_('Серийный номер'))
    model_name = models.CharField(max_length=100, blank=True, verbose_name=_('Модель'))
    barcode = models.CharField(max_length=100, blank=True, unique=True, null=True, verbose_name=_('Штрих-код (SKU)'), help_text=_('Сканируется с упаковки товара'))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    unit = models.CharField(max_length=20, default='шт.', verbose_name=_('Ед. изм.'))
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_('Закупочная цена'))
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_('Цена продажи'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_stock', verbose_name=_('Статус'))
    location = models.CharField(max_length=200, blank=True, verbose_name=_('Место хранения'))  # устаревшее, используйте storage_location
    storage_location = models.ForeignKey('StorageLocation', on_delete=models.SET_NULL, null=True, blank=True, related_name='items', verbose_name=_('Ячейка хранения'))
    supplier = models.CharField(max_length=200, blank=True, verbose_name=_('Поставщик'))
    warranty_months = models.PositiveIntegerField(default=12, verbose_name=_('Гарантия (мес.)'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата поступления'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Складская единица')
        verbose_name_plural = _('Склад')
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Авто-генерация штрихкода если не задан
        if not self.barcode:
            import uuid
            self.barcode = f'SKU-{uuid.uuid4().hex[:8].upper()}'
        # Авто-наценка: если есть cost_price но нет sale_price → +25%
        if self.cost_price and not self.sale_price:
            from decimal import Decimal
            self.sale_price = (self.cost_price * Decimal('1.25')).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        sn = f' S/N:{self.serial_number}' if self.serial_number else ''
        return f'{self.get_item_type_display()} {self.name}{sn} ({self.get_status_display()})'


class InventoryMovement(models.Model):
    """Движение оборудования: приход, выдача, возврат, установка, списание"""
    MOVEMENT_TYPES = [
        ('in', _('Приход')),
        ('out_to_master', _('Выдано мастеру')),
        ('return_from_master', _('Возврат от мастера')),
        ('installed', _('Установлено клиенту')),
        ('return_from_client', _('Возврат от клиента')),
        ('written_off', _('Списано')),
        ('defect', _('Брак')),
    ]

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements', verbose_name=_('Оборудование'))
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES, verbose_name=_('Тип движения'))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    master = models.ForeignKey('Master', on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_movements', verbose_name=_('Мастер'))
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_movements', verbose_name=_('Заявка'))
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_movements', verbose_name=_('Клиент'))
    supply_invoice = models.ForeignKey('SupplyInvoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='movements', verbose_name=_('Накладная'))
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name=_('Выполнил'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата операции'))

    class Meta:
        verbose_name = _('Движение оборудования')
        verbose_name_plural = _('Движения оборудования')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_movement_type_display()}: {self.item} ({self.created_at:%d.%m.%Y %H:%M})'

    def save(self, *args, **kwargs):
        is_new = not self.pk
        if is_new:
            item = self.item
            if self.movement_type in ('out_to_master', 'installed'):
                item.quantity = max(0, item.quantity - self.quantity)
                if self.movement_type == 'out_to_master':
                    item.status = 'with_master'
                elif self.movement_type == 'installed':
                    item.status = 'installed'
            elif self.movement_type in ('in', 'return_from_master', 'return_from_client'):
                item.quantity += self.quantity
                if item.status in ('with_master', 'installed', 'returned'):
                    item.status = 'in_stock'
            elif self.movement_type == 'written_off':
                item.quantity = max(0, item.quantity - self.quantity)
                item.status = 'written_off'
            elif self.movement_type == 'defect':
                item.status = 'defective'
            item.save(update_fields=['quantity', 'status', 'updated_at'])
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════
# Склад v2: Поставщики, Накладные, Штрих-коды
# ══════════════════════════════════════════════════════════════════

class Supplier(models.Model):
    """Поставщик оборудования"""
    name = models.CharField(max_length=200, verbose_name=_('Название'))
    phone = models.CharField(max_length=50, blank=True, verbose_name=_('Телефон'))
    email = models.EmailField(blank=True, verbose_name=_('Email'))
    contact_person = models.CharField(max_length=150, blank=True, verbose_name=_('Контактное лицо'))
    inn = models.CharField(max_length=12, blank=True, verbose_name=_('ИНН'))
    kpp = models.CharField(max_length=9, blank=True, verbose_name=_('КПП'))
    legal_address = models.CharField(max_length=500, blank=True, verbose_name=_('Юр. адрес'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Добавлен'))

    class Meta:
        verbose_name = _('Поставщик')
        verbose_name_plural = _('Поставщики')
        ordering = ['name']

    def __str__(self):
        return self.name


class SupplyInvoice(models.Model):
    """Накладная от поставщика (документ прихода)"""
    STATUS_CHOICES = [
        ('draft', _('Черновик')),
        ('received', _('Принято полностью')),
        ('partial', _('Принято частично')),
        ('cancelled', _('Отменена')),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='invoices', verbose_name=_('Поставщик'))
    invoice_number = models.CharField(max_length=100, verbose_name=_('Номер накладной'))
    invoice_date = models.DateField(verbose_name=_('Дата накладной'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name=_('Статус'))
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Принял'))
    received_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата приёмки'))
    total_ordered = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Заказано на сумму'))
    total_received = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Принято на сумму'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создана'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлена'))

    class Meta:
        verbose_name = _('Накладная поставщика')
        verbose_name_plural = _('Накладные поставщиков')
        ordering = ['-invoice_date', '-created_at']

    def __str__(self):
        return f'Накладная №{self.invoice_number} от {self.supplier} ({self.invoice_date})'

    def recalculate_totals(self):
        """Пересчитать итоги по позициям накладной"""
        items = self.items.all()
        self.total_ordered = sum((i.unit_price or 0) * (i.quantity_ordered or 0) for i in items)
        self.total_received = sum((i.unit_price or 0) * (i.quantity_received or 0) for i in items)
        self.save(update_fields=['total_ordered', 'total_received', 'updated_at'])

    def apply_received(self, user):
        """Оприходовать принятые позиции на склад"""
        from django.utils import timezone
        for item in self.items.filter(quantity_received__gt=0):
            inv_item = item.inventory_item
            # Создаём движение прихода
            InventoryMovement.objects.create(
                item=inv_item,
                movement_type='in',
                quantity=item.quantity_received,
                supply_invoice=self,
                performed_by=user,
                notes=f'Приход по накладной №{self.invoice_number} от {self.invoice_date}'
            )
        # Определяем статус накладной
        has_partial = self.items.filter(quantity_received__gt=0, quantity_received__lt=models.F('quantity_ordered')).exists()
        all_received = not self.items.filter(quantity_received__lt=models.F('quantity_ordered')).exists()
        if all_received:
            self.status = 'received'
        elif has_partial:
            self.status = 'partial'
        self.received_at = timezone.now()
        self.received_by = user
        self.save()


class SupplyInvoiceItem(models.Model):
    """Товарная позиция в накладной поставщика"""
    invoice = models.ForeignKey(SupplyInvoice, on_delete=models.CASCADE, related_name='items', verbose_name=_('Накладная'))
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name='supply_items', verbose_name=_('Номенклатура'))
    quantity_ordered = models.PositiveIntegerField(default=0, verbose_name=_('Заказано'))
    quantity_received = models.PositiveIntegerField(default=0, verbose_name=_('Принято'))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Цена за ед.'))
    notes = models.CharField(max_length=300, blank=True, verbose_name=_('Примечание'))

    class Meta:
        verbose_name = _('Позиция накладной')
        verbose_name_plural = _('Позиции накладной')
        unique_together = ['invoice', 'inventory_item']

    def __str__(self):
        return f'{self.inventory_item.name}: заказано {self.quantity_ordered}, принято {self.quantity_received}'

    @property
    def shortage(self):
        """Недопоставка"""
        return max(0, self.quantity_ordered - self.quantity_received)

    @property
    def ordered_total(self):
        return (self.unit_price or 0) * (self.quantity_ordered or 0)

    @property
    def received_total(self):
        return (self.unit_price or 0) * (self.quantity_received or 0)


# ══════════════════════════════════════════════════════════════════
# Исходящая накладная (УПД — Универсальный передаточный документ)
# ══════════════════════════════════════════════════════════════════

class OutgoingInvoice(models.Model):
    """Исходящая накладная (УПД) — выдача товаров со склада клиенту"""
    STATUS_CHOICES = [
        ('draft', _('Черновик')),
        ('issued', _('Выдано')),
        ('cancelled', _('Аннулировано')),
    ]

    number = models.CharField(max_length=50, unique=True, verbose_name=_('Номер УПД'))
    date = models.DateField(default=timezone.localdate, verbose_name=_('Дата составления'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name=_('Статус'))

    # От кого (наше юрлицо)
    from_legal = models.ForeignKey('LegalEntity', on_delete=models.PROTECT, related_name='outgoing_invoices', verbose_name=_('От юр. лица'))

    # Кому (клиент — физ. или юр. лицо)
    to_client = models.ForeignKey('Client', on_delete=models.PROTECT, related_name='outgoing_invoices', verbose_name=_('Получатель'))

    # Основание
    basis = models.CharField(max_length=500, blank=True, verbose_name=_('Основание'), help_text=_('Договор, счёт, заявка'))

    # Подписи
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_invoices', verbose_name=_('Выдал'))
    received_by_name = models.CharField(max_length=200, blank=True, verbose_name=_('Принял (ФИО)'), help_text=_('Кто принял товар со стороны получателя'))

    # Суммы
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Сумма итого'))
    total_vat = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('В т.ч. НДС'))

    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создана'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлена'))

    class Meta:
        verbose_name = _('Исходящая накладная (УПД)')
        verbose_name_plural = _('Исходящие накладные (УПД)')
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'УПД №{self.number} от {self.date} → {self.to_client}'

    def save(self, *args, **kwargs):
        if not self.number:
            today = timezone.localdate()
            date_part = today.strftime('%y%m%d')
            # Найти последний номер за сегодня
            last = OutgoingInvoice.objects.filter(number__startswith=f'УПД-{date_part}').order_by('-number').first()
            if last:
                try:
                    seq = int(last.number.split('-')[-1]) + 1
                except ValueError:
                    seq = 1
            else:
                seq = 1
            self.number = f'УПД-{date_part}-{seq:04d}'
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        items = self.items.all()
        self.total_amount = sum((i.unit_price or 0) * (i.quantity or 0) for i in items)
        # НДС 20% в сумме (упрощённо, без ставки в позициях)
        self.total_vat = (self.total_amount * 20 / 120).quantize(self.total_amount)
        self.save(update_fields=['total_amount', 'total_vat', 'updated_at'])

    def issue(self, user):
        """Провести выдачу: списать товары, создать движения"""
        now = timezone.now()
        for item in self.items.all():
            inv_item = item.inventory_item
            if item.quantity > inv_item.quantity:
                raise ValueError(f'Недостаточно {inv_item.name}: есть {inv_item.quantity}, требуется {item.quantity}')
            inv_item.quantity -= item.quantity
            inv_item.save(update_fields=['quantity', 'updated_at'])
            # Если остаток 0 — снимаем с ячейки
            if inv_item.quantity == 0:
                inv_item.storage_location = None
                inv_item.status = 'written_off'
                inv_item.save(update_fields=['storage_location', 'status', 'updated_at'])
            # Движение
            InventoryMovement.objects.create(
                item=inv_item,
                movement_type='installed',
                quantity=item.quantity,
                performed_by=user,
                notes=f'Выдача по УПД №{self.number} клиенту {self.to_client}',
            )
        self.status = 'issued'
        self.issued_by = user
        self.save()


class OutgoingInvoiceItem(models.Model):
    """Товарная позиция в исходящей накладной (УПД)"""
    invoice = models.ForeignKey(OutgoingInvoice, on_delete=models.CASCADE, related_name='items', verbose_name=_('Накладная'))
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name='outgoing_items', verbose_name=_('Номенклатура'))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Цена за ед.'))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Сумма'))
    vat_rate = models.CharField(max_length=10, default='20%', blank=True, verbose_name=_('Ставка НДС'))
    notes = models.CharField(max_length=300, blank=True, verbose_name=_('Примечание'))

    class Meta:
        verbose_name = _('Позиция УПД')
        verbose_name_plural = _('Позиции УПД')

    def __str__(self):
        return f'{self.inventory_item.name}: {self.quantity} × {self.unit_price} ₽'

    def save(self, *args, **kwargs):
        self.amount = (self.unit_price or 0) * (self.quantity or 0)
        super().save(*args, **kwargs)
        # Пересчёт итогов накладной
        if self.invoice_id:
            self.invoice.recalculate_totals()


# Финансы
# ══════════════════════════════════════════════════════════════════

class Payment(models.Model):
    """Оплата по заявке"""
    PAYMENT_METHODS = [
        ('cash', _('Наличные')),
        ('card', _('Карта')),
        ('transfer', _('Перевод')),
        ('online', _('Онлайн')),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments', verbose_name=_('Заявка'))
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_('Сумма'))
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash', verbose_name=_('Способ оплаты'))
    is_received = models.BooleanField(default=True, verbose_name=_('Получено'))
    paid_at = models.DateTimeField(default=timezone.now, verbose_name=_('Дата оплаты'))
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_payments', verbose_name=_('Принял'))
    collected_by_master = models.ForeignKey('Master', on_delete=models.SET_NULL, null=True, blank=True, related_name='collected_payments', verbose_name=_('Мастер получил деньги'))
    collected_by_master_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата получения денег мастером'))
    is_submitted_to_office = models.BooleanField(default=False, verbose_name=_('Сдано в офис'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))

    class Meta:
        verbose_name = _('Оплата')
        verbose_name_plural = _('Оплаты')
        ordering = ['-paid_at']

    def __str__(self):
        return f'{self.order.number}: {self.amount} ₽ ({self.get_payment_method_display()})'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Автообновление is_paid у заявки
        order = self.order
        total_paid = order.payments.filter(is_received=True).aggregate(s=models.Sum('amount'))['s'] or 0
        if order.cost and total_paid >= order.cost:
            order.is_paid = True
        else:
            order.is_paid = False
        order.save(update_fields=['is_paid'])


class MasterSalary(models.Model):
    """Расчёт зарплаты мастера за период"""
    STATUS_CHOICES = [
        ('draft', _('Черновик')),
        ('approved', _('Утверждён')),
        ('paid', _('Выплачен')),
    ]

    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='salaries', verbose_name=_('Мастер'))
    period_start = models.DateField(verbose_name=_('Начало периода'))
    period_end = models.DateField(verbose_name=_('Конец периода'))
    orders_total = models.PositiveIntegerField(default=0, verbose_name=_('Всего заявок'))
    orders_completed = models.PositiveIntegerField(default=0, verbose_name=_('Выполнено'))
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Выручка по заявкам'))
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=30, verbose_name=_('Комиссия (%)'))
    bonus = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Премия'))
    deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Удержания'))
    total_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Итого к выплате'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name=_('Статус'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Зарплата мастера')
        verbose_name_plural = _('Зарплаты мастеров')
        ordering = ['-period_start']

    def __str__(self):
        return f'{self.master}: {self.total_salary} ₽ ({self.period_start} — {self.period_end})'


# ══════════════════════════════════════════════════════════════════
# Учёт долгов мастеров (наличные + оборудование)
# ══════════════════════════════════════════════════════════════════

class MasterCashDebt(models.Model):
    """Долг мастера по наличным: получил от клиента → должен сдать в кассу"""
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='cash_debts', verbose_name=_('Мастер'))
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='cash_debts', verbose_name=_('Заявка'))
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_('Сумма'))
    is_paid_to_office = models.BooleanField(default=False, verbose_name=_('Сдано в кассу'))
    paid_to_office_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата сдачи в кассу'))
    accepted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='accepted_cash', verbose_name=_('Принял в кассу'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))

    class Meta:
        verbose_name = _('Долг по наличным')
        verbose_name_plural = _('Долги по наличным')
        ordering = ['-created_at']

    def __str__(self):
        status = '✅ сдано' if self.is_paid_to_office else '❌ не сдано'
        return f'{self.master}: {self.amount} ₽ — {self.order.number} ({status})'


class MasterInventoryDebt(models.Model):
    """Оборудование, которое мастер должен вернуть (старое/сломанное после замены)"""
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='inventory_debts', verbose_name=_('Мастер'))
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='inventory_debts', verbose_name=_('Заявка'))
    item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, related_name='master_debts', verbose_name=_('Позиция склада'))
    description = models.CharField(max_length=300, verbose_name=_('Что нужно сдать'))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    is_returned = models.BooleanField(default=False, verbose_name=_('Возвращено'))
    returned_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата возврата'))
    condition = models.CharField(max_length=20, choices=[('working', _('Рабочее')), ('broken', _('Сломанное')), ('repairable', _('Ремонтопригодное'))], default='broken', verbose_name=_('Состояние'))
    accepted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='accepted_returns', verbose_name=_('Принял'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))

    class Meta:
        verbose_name = _('Долг по оборудованию')
        verbose_name_plural = _('Долги по оборудованию')
        ordering = ['-created_at']

    def __str__(self):
        status = '✅ возвращено' if self.is_returned else '❌ не возвращено'
        return f'{self.master}: {self.description} — {self.order.number} ({status})'


class OrderMaterial(models.Model):
    """Связь: материал, использованный в заявке (снят со склада)"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, verbose_name=_('Заявка'))
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, verbose_name=_('Материал'))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    used_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Использован'))

    class Meta:
        verbose_name = _('Материал в заявке')
        verbose_name_plural = _('Материалы в заявках')
        unique_together = ['order', 'item']

    def save(self, *args, **kwargs):
        is_new = not self.pk
        if is_new:
            self.item.quantity = max(0, self.item.quantity - self.quantity)
            self.item.save(update_fields=['quantity', 'updated_at'])
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.item.name} x{self.quantity} → {self.order.number}'


class Message(models.Model):
    """Сообщение между сотрудниками (чат)"""
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages', verbose_name=_('Отправитель'))
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='received_messages', verbose_name=_('Получатель'))
    is_broadcast = models.BooleanField(default=False, verbose_name=_('Всем'))
    text = models.TextField(verbose_name=_('Текст'))
    read_by = models.ManyToManyField(User, blank=True, related_name='read_messages', verbose_name=_('Прочитали'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Отправлено'))

    class Meta:
        verbose_name = _('Сообщение')
        verbose_name_plural = _('Сообщения')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.text[:50]}'


class OrderComment(models.Model):
    """Обсуждение внутри заявки — диалог сотрудников по заявке"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='comments', verbose_name=_('Заявка'))
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='order_comments', verbose_name=_('Автор'))
    text = models.TextField(verbose_name=_('Текст'))
    event_type = models.CharField(max_length=30, default='comment', verbose_name=_('Тип события'), help_text='comment/payment/material_assigned/estimate_linked/purchase_created/status_changed')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))

    class Meta:
        verbose_name = _('Комментарий к заявке')
        verbose_name_plural = _('Комментарии к заявкам')
        ordering = ['created_at']

    def __str__(self):
        return f'{self.author.username}: {self.text[:50]} → #{self.order.number}'


# ══════════════════════════════════════════════════════════════════
# Сметы и коммерческие предложения
# ══════════════════════════════════════════════════════════════════

class LegalEntity(models.Model):
    """Юридическое лицо компании (может быть несколько: ООО Видео Сервис, ИП и т.д.)"""
    name = models.CharField(max_length=300, verbose_name=_('Название организации'))
    short_name = models.CharField(max_length=100, blank=True, verbose_name=_('Краткое название'))
    inn = models.CharField(max_length=12, blank=True, verbose_name=_('ИНН'))
    kpp = models.CharField(max_length=9, blank=True, verbose_name=_('КПП'))
    ogrn = models.CharField(max_length=15, blank=True, verbose_name=_('ОГРН'))
    legal_address = models.CharField(max_length=500, blank=True, verbose_name=_('Юридический адрес'))
    actual_address = models.CharField(max_length=500, blank=True, verbose_name=_('Фактический адрес'))
    phone = models.CharField(max_length=50, blank=True, verbose_name=_('Телефон'))
    email = models.EmailField(blank=True, verbose_name=_('Email'))
    bank_name = models.CharField(max_length=300, blank=True, verbose_name=_('Банк'))
    bik = models.CharField(max_length=9, blank=True, verbose_name=_('БИК'))
    corr_account = models.CharField(max_length=20, blank=True, verbose_name=_('Корр. счёт'))
    settlement_account = models.CharField(max_length=20, blank=True, verbose_name=_('Расчётный счёт'))
    director = models.CharField(max_length=200, blank=True, verbose_name=_('Директор'))
    is_default = models.BooleanField(default=False, verbose_name=_('По умолчанию'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))

    class Meta:
        verbose_name = _('Юридическое лицо')
        verbose_name_plural = _('Юридические лица')

    def __str__(self):
        return self.short_name or self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            LegalEntity.objects.exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class EstimateService(models.Model):
    """Справочник услуг и работ для смет"""
    CATEGORIES = [
        ('installation', _('Монтаж')),
        ('setup', _('Настройка/Пусконаладка')),
        ('design', _('Проектирование')),
        ('maintenance', _('Обслуживание/ТО')),
        ('repair', _('Ремонт')),
        ('consulting', _('Консультация')),
        ('other', _('Другое')),
    ]

    name = models.CharField(max_length=300, verbose_name=_('Наименование услуги'))
    category = models.CharField(max_length=30, choices=CATEGORIES, default='installation', verbose_name=_('Категория'))
    unit = models.CharField(max_length=30, default='шт', verbose_name=_('Единица измерения'))
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Себестоимость'))
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Цена для клиента'))
    installer_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Зарплата монтажникам'))
    notes = models.TextField(blank=True, verbose_name=_('Описание'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активна'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Услуга')
        verbose_name_plural = _('Услуги и работы')
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.name} ({self.sale_price} ₽/{self.unit})'

    @property
    def margin_percent(self):
        if self.cost_price and self.cost_price > 0:
            return round((self.sale_price - self.cost_price) / self.cost_price * 100, 1)
        return 0


class CommercialEstimate(models.Model):
    """Смета / Коммерческое предложение"""
    STATUS_CHOICES = [
        ('draft', _('Черновик')),
        ('sent', _('Отправлено клиенту')),
        ('approved', _('Согласовано')),
        ('rejected', _('Отклонено')),
        ('in_work', _('В работе')),
        ('completed', _('Завершено')),
    ]
    TAX_CHOICES = [
        ('usn', _('УСН (доходы)')),
        ('usn_dr', _('УСН (доходы-расходы)')),
        ('osno', _('ОСНО (с НДС)')),
        ('patent', _('Патент')),
        ('none', _('Без налога')),
    ]
    DELIVERY_CHOICES = [
        ('client', _('Самовывоз')),
        ('our', _('Наша доставка')),
        ('tc', _('Транспортная компания')),
        ('none', _('Не требуется')),
    ]

    number = models.CharField(max_length=30, unique=True, verbose_name=_('Номер сметы'))
    name = models.CharField(max_length=300, verbose_name=_('Название'))
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='estimates', verbose_name=_('Клиент (контрагент)'))
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Юрлицо (наша компания)'))
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='estimates', verbose_name=_('Связанная заявка'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name=_('Статус'))

    # Скидки и наценки
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name=_('Скидка общая (%)'))
    commission = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name=_('Комиссионные (%)'))
    dealer_fee = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name=_('Дилерская наценка (%)'))
    unexpected_costs = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Непредвиденные расходы (₽)'))

    # Доставка
    delivery_type = models.CharField(max_length=10, choices=DELIVERY_CHOICES, default='client', verbose_name=_('Тип доставки'))
    delivery_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('Стоимость доставки (₽)'))

    # Налог
    tax_type = models.CharField(max_length=10, choices=TAX_CHOICES, default='usn', verbose_name=_('Система налогообложения'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=6, verbose_name=_('Ставка налога (%)'))

    # Сотрудник (кто составил / ответственный)
    employee = models.CharField(max_length=200, blank=True, verbose_name=_('Ответственный сотрудник'))
    employee_phone = models.CharField(max_length=50, blank=True, verbose_name=_('Телефон сотрудника'))

    # Итоги (вычисляемые)
    total_materials = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Итого материалы'))
    total_services = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Итого услуги'))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Подытог'))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Итого'))
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Итого себестоимость'))
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Прибыль'))

    note = models.TextField(blank=True, verbose_name=_('Примечание'))
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_estimates', verbose_name=_('Создал'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Смета/КП')
        verbose_name_plural = _('Сметы и КП')
        ordering = ['-created_at']

    def __str__(self):
        return f'Смета №{self.number}: {self.total} ₽ ({self.get_status_display()})'

    def recalculate(self):
        """Пересчёт итогов по позициям"""
        items = self.items.all()
        total_materials = sum(i.total_price for i in items if i.item_type == 'material')
        total_services = sum(i.total_price for i in items if i.item_type in ('service', 'custom_service'))
        subtotal = total_materials + total_services

        # Скидка
        discount_amount = subtotal * self.discount / 100
        after_discount = subtotal - discount_amount

        # Комиссионные и дилерская наценка
        commission_amount = after_discount * self.commission / 100
        dealer_amount = after_discount * self.dealer_fee / 100

        total = after_discount + commission_amount + dealer_amount + self.unexpected_costs + self.delivery_cost

        # Себестоимость
        total_cost = sum(
            (i.cost_price or 0) * i.quantity
            for i in items
        )

        self.total_materials = total_materials
        self.total_services = total_services
        self.subtotal = subtotal
        self.total = total
        self.total_cost = total_cost
        self.profit = total - total_cost - self.unexpected_costs - self.delivery_cost
        self.save(update_fields=[
            'total_materials', 'total_services', 'subtotal',
            'total', 'total_cost', 'profit', 'updated_at'
        ])

    def save(self, *args, **kwargs):
        if not self.number:
            from datetime import datetime
            prefix = 'КП' if self.client else 'СМ'
            self.number = f'{prefix}-{datetime.now().strftime("%y%m%d")}-{CommercialEstimate.objects.filter(created_at__date=datetime.now().date()).count() + 1:03d}'
            while CommercialEstimate.objects.filter(number=self.number).exists():
                self.number = f'{prefix}-{datetime.now().strftime("%y%m%d")}-{CommercialEstimate.objects.filter(created_at__date=datetime.now().date()).count() + 2:03d}'
        super().save(*args, **kwargs)


class EstimateItem(models.Model):
    """Позиция в смете"""
    ITEM_TYPES = [
        ('material', _('Материал со склада')),
        ('service', _('Услуга из справочника')),
        ('custom_material', _('Произвольный материал')),
        ('custom_service', _('Произвольная услуга/работа')),
    ]

    estimate = models.ForeignKey(CommercialEstimate, on_delete=models.CASCADE, related_name='items', verbose_name=_('Смета'))
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, verbose_name=_('Тип позиции'))

    # Ссылки на справочники (опционально)
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Позиция склада'))
    service = models.ForeignKey(EstimateService, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Услуга'))

    # Поля позиции
    name = models.CharField(max_length=300, verbose_name=_('Наименование'))
    unit = models.CharField(max_length=30, default='шт', verbose_name=_('Ед. изм.'))
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, verbose_name=_('Количество'))
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Себестоимость за ед.'))
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Цена за ед.'))
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name=_('Скидка на позицию (%)'))
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_('Сумма'))
    installer_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_('ЗП монтажникам'))

    # Сортировка
    order_num = models.PositiveIntegerField(default=0, verbose_name=_('Порядок'))

    class Meta:
        verbose_name = _('Позиция сметы')
        verbose_name_plural = _('Позиции сметы')
        ordering = ['order_num', 'id']

    def __str__(self):
        return f'{self.name} x{self.quantity} = {self.total_price} ₽'

    def save(self, *args, **kwargs):
        # Авторасчёт суммы с учётом скидки
        amount = self.sale_price * self.quantity
        if self.discount:
            amount = amount * (1 - self.discount / 100)
        self.total_price = amount
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════
# Склад v3: Расходный ордер, заявка на закупку, подтверждение материалов
# ══════════════════════════════════════════════════════════════════

class IssueOrder(models.Model):
    """Расходный ордер — документ выдачи материалов со склада сотруднику под заявку"""
    STATUS_CHOICES = [
        ('pending', _('Ожидает получения')),
        ('received', _('Получено сотрудником')),
        ('partially_used', _('Частично использовано')),
        ('fully_used', _('Полностью использовано')),
        ('returned', _('Возвращено на склад')),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='issue_orders', verbose_name=_('Заявка'))
    master = models.ForeignKey('Master', on_delete=models.SET_NULL, null=True, related_name='issue_orders', verbose_name=_('Сотрудник'))
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='issued_orders', verbose_name=_('Выдал'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name=_('Статус'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    issued_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата выдачи'))
    received_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата получения'))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Дата закрытия'))

    class Meta:
        verbose_name = _('Расходный ордер')
        verbose_name_plural = _('Расходные ордера')
        ordering = ['-issued_at']

    def __str__(self):
        return f'Ордер №{self.id}: {self.master} → заявка {self.order.number}'


class IssueOrderItem(models.Model):
    """Позиция в расходном ордере: что выдано, что использовано, что возвращено"""
    issue_order = models.ForeignKey(IssueOrder, on_delete=models.CASCADE, related_name='items', verbose_name=_('Ордер'))
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name='issue_items', verbose_name=_('Номенклатура'))
    quantity_issued = models.PositiveIntegerField(default=0, verbose_name=_('Выдано'))
    quantity_used = models.PositiveIntegerField(default=0, verbose_name=_('Использовано (установлено)'))
    quantity_returned = models.PositiveIntegerField(default=0, verbose_name=_('Возвращено'))
    need_return_old = models.BooleanField(default=False, verbose_name=_('Требуется возврат старого'))
    old_item_description = models.CharField(max_length=300, blank=True, verbose_name=_('Что нужно вернуть (старое)'))
    old_item_returned = models.BooleanField(default=False, verbose_name=_('Старое возвращено'))
    notes = models.CharField(max_length=300, blank=True, verbose_name=_('Примечание'))

    class Meta:
        verbose_name = _('Позиция ордера')
        verbose_name_plural = _('Позиции ордера')

    def __str__(self):
        return f'{self.inventory_item.name}: выдано {self.quantity_issued}, исп. {self.quantity_used}, возвр. {self.quantity_returned}'

    @property
    def remaining(self):
        """Осталось у мастера (не использовано и не возвращено)"""
        return max(0, self.quantity_issued - self.quantity_used - self.quantity_returned)


class PurchaseRequest(models.Model):
    """Заявка на закупку материалов (когда позиции нет на складе или закончились)"""
    STATUS_CHOICES = [
        ('draft', _('Черновик')),
        ('pending', _('Ожидает закупки')),
        ('ordered', _('Заказано поставщику')),
        ('received', _('Получено')),
        ('cancelled', _('Отменено')),
    ]

    number = models.CharField(max_length=30, unique=True, verbose_name=_('Номер заявки'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name=_('Статус'))
    estimate = models.ForeignKey('CommercialEstimate', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requests', verbose_name=_('Основание (КП/смета)'))
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requests', verbose_name=_('Основание (заявка)'))
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='purchase_requests', verbose_name=_('Создал'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создана'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлена'))

    class Meta:
        verbose_name = _('Заявка на закупку')
        verbose_name_plural = _('Заявки на закупку')
        ordering = ['-created_at']

    def __str__(self):
        return f'Заявка на закупку №{self.number} ({self.get_status_display()})'

    def save(self, *args, **kwargs):
        if not self.number:
            from datetime import datetime
            self.number = f'ЗАКУП-{datetime.now().strftime("%y%m%d")}-{PurchaseRequest.objects.filter(created_at__date=datetime.now().date()).count() + 1:03d}'
            while PurchaseRequest.objects.filter(number=self.number).exists():
                self.number = f'ЗАКУП-{datetime.now().strftime("%y%m%d")}-{PurchaseRequest.objects.filter(created_at__date=datetime.now().date()).count() + 2:03d}'
        super().save(*args, **kwargs)


class PurchaseRequestItem(models.Model):
    """Позиция в заявке на закупку"""
    purchase_request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name='items', verbose_name=_('Заявка на закупку'))
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_items', verbose_name=_('Номенклатура (если есть в каталоге)'))
    name = models.CharField(max_length=300, verbose_name=_('Название'))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    unit = models.CharField(max_length=20, default='шт.', verbose_name=_('Ед. изм.'))
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_('Ожидаемая цена'))
    supplier = models.ForeignKey('Supplier', on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Поставщик'))
    notes = models.CharField(max_length=300, blank=True, verbose_name=_('Примечание'))

    class Meta:
        verbose_name = _('Позиция заявки на закупку')
        verbose_name_plural = _('Позиции заявок на закупку')

    def __str__(self):
        return f'{self.name} x{self.quantity}'


# ══════════════════════════════════════════════════════════════════
# Импорт из Excel: ЕРЦ (Единый расчётный центр)
# ══════════════════════════════════════════════════════════════════

class ErcAccount(models.Model):
    """Лицевой счёт из ЕРЦ (отдельные клиенты, не пересекаются с основной базой)"""
    account_number = models.CharField(max_length=50, unique=True, verbose_name=_('Номер лицевого счета'))
    full_name = models.CharField(max_length=200, blank=True, verbose_name=_('ФИО'))
    address = models.CharField(max_length=500, blank=True, verbose_name=_('Адрес'))
    residents_count = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name=_('Кол-во жильцов'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата добавления'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Дата обновления'))

    class Meta:
        verbose_name = _('ЕРЦ — лицевой счёт')
        verbose_name_plural = _('ЕРЦ — лицевые счета')
        ordering = ['account_number']

    def __str__(self):
        return f'ЕРЦ {self.account_number}: {self.full_name or "—"}'


class ErcBillingRecord(models.Model):
    """Ежемесячная запись о начислениях и оплатах из ЕРЦ"""
    account = models.ForeignKey(ErcAccount, on_delete=models.CASCADE, related_name='billing_records', verbose_name=_('Лицевой счёт'))
    period = models.DateField(verbose_name=_('Период (первое число месяца)'), help_text=_('Например: 2026-05-01 для мая 2026'))
    # Данные из оборотной ведомости ЕРЦ (форма № 30.01.01)
    balance_start = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_('Сальдо на начало'))
    charged = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_('Начислено (фактически)'))
    charged_no_benefits = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_('Начислено (без льгот)'))
    paid = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_('Оплачено'))
    paid_percent = models.DecimalField(max_digits=7, decimal_places=2, default=0, verbose_name=_('% оплаты'))
    balance_end = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_('Сальдо на конец (дебет)'))
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name=_('Кредит'))
    imported_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата импорта'))

    class Meta:
        verbose_name = _('ЕРЦ — платёжная запись')
        verbose_name_plural = _('ЕРЦ — платёжные записи')
        ordering = ['-period', 'account__account_number']
        unique_together = ['account', 'period']

    def __str__(self):
        return f'{self.account.account_number}: {self.period.strftime("%m.%Y")} — оплачено {self.paid} ₽ ({self.paid_percent}%)'


# ══════════════════════════════════════════════════════════════════
# Asterisk PBX — Управление телефонией
# ══════════════════════════════════════════════════════════════════

class AsteriskSipPeer(models.Model):
    """SIP-аккаунт (внутренний номер сотрудника или внешний абонент)"""
    TRANSPORT_CHOICES = [
        ('udp', 'UDP'),
        ('tcp', 'TCP'),
        ('tls', 'TLS'),
    ]
    CODEC_CHOICES = [
        ('ulaw,alaw', 'G.711 (ulaw + alaw)'),
        ('ulaw,alaw,g722', 'HD Voice (G.722)'),
        ('ulaw,alaw,gsm', 'G.711 + GSM'),
        ('opus,ulaw,alaw', 'Opus + G.711'),
    ]

    name = models.CharField(max_length=80, verbose_name=_('Номер/имя'), help_text=_('Напр. 101, 102, manager'))
    display_name = models.CharField(max_length=100, blank=True, verbose_name=_('Отображаемое имя'))
    secret = models.CharField(max_length=100, verbose_name=_('Пароль'), default='')
    host = models.CharField(max_length=15, default='dynamic', verbose_name=_('Хост'), help_text=_('dynamic — любой IP, либо фиксированный'))
    transport = models.CharField(max_length=10, choices=TRANSPORT_CHOICES, default='udp', verbose_name=_('Транспорт'))
    codecs = models.CharField(max_length=100, choices=CODEC_CHOICES, default='ulaw,alaw', verbose_name=_('Кодеки'))
    context = models.CharField(max_length=80, default='internal', verbose_name=_('Контекст'))
    caller_id = models.CharField(max_length=100, blank=True, verbose_name=_('Caller ID'), help_text=_('Отображаемый номер, напр. +74951112233'))
    mailbox = models.CharField(max_length=50, blank=True, verbose_name=_('Голосовая почта'), help_text=_('Напр. 101@default'))
    nat = models.BooleanField(default=True, verbose_name=_('NAT (за роутером)'))
    allow = models.CharField(max_length=200, default='ulaw,alaw', verbose_name=_('Разрешённые кодеки'))
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sip_peer', verbose_name=_('Сотрудник'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))

    class Meta:
        verbose_name = _('SIP-аккаунт')
        verbose_name_plural = _('SIP-аккаунты')
        ordering = ['name']

    def __str__(self):
        return f"SIP/{self.name} ({self.display_name or self.name})"


class AsteriskTrunk(models.Model):
    """SIP-транк (подключение к оператору связи)"""
    name = models.CharField(max_length=80, verbose_name=_('Название транка'), help_text=_('Напр. rostel-sip, mgts'))
    provider = models.CharField(max_length=200, blank=True, verbose_name=_('Провайдер'))
    host = models.CharField(max_length=200, verbose_name=_('Сервер провайдера'), help_text=_('sip.provider.ru'))
    port = models.PositiveIntegerField(default=5060, verbose_name=_('Порт'))
    username = models.CharField(max_length=100, blank=True, verbose_name=_('Логин (username)'))
    secret = models.CharField(max_length=100, blank=True, verbose_name=_('Пароль'))
    auth_username = models.CharField(max_length=100, blank=True, verbose_name=_('Auth username'), help_text=_('Если отличается от username'))
    from_user = models.CharField(max_length=100, blank=True, verbose_name=_('From User'))
    from_domain = models.CharField(max_length=200, blank=True, verbose_name=_('From Domain'))
    caller_id = models.CharField(max_length=100, blank=True, verbose_name=_('Caller ID'), help_text=_('Исходящий номер'))
    context = models.CharField(max_length=80, default='inbound', verbose_name=_('Входящий контекст'))
    transport = models.CharField(max_length=10, choices=[('udp', 'UDP'), ('tcp', 'TCP'), ('tls', 'TLS')], default='udp', verbose_name=_('Транспорт'))
    codecs = models.CharField(max_length=100, default='ulaw,alaw', verbose_name=_('Кодеки'))
    max_channels = models.PositiveIntegerField(default=10, verbose_name=_('Макс. каналов'))
    register = models.BooleanField(default=True, verbose_name=_('Регистрироваться'), help_text=_('Отправить REGISTER провайдеру'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))

    class Meta:
        verbose_name = _('SIP-транк')
        verbose_name_plural = _('SIP-транки')
        ordering = ['name']

    def __str__(self):
        return f"Trunk: {self.name} ({self.provider or self.host})"


class AsteriskRoute(models.Model):
    """Маршрут звонков (входящий/исходящий/внутренний)"""
    DIRECTION_CHOICES = [
        ('inbound', _('Входящий')),
        ('outbound', _('Исходящий')),
        ('internal', _('Внутренний')),
    ]
    MATCH_CHOICES = [
        ('_X.', _('Любой номер')),
        ('_8XXXXXXXXXX', _('Местный (8XXXXXXXXXX)')),
        ('_+7XXXXXXXXXX', _('Мобильный (+7XXXXXXXXXX)')),
        ('_8XXXXXXXXXXX', _('Мобильный (8XXXXXXXXXXX)')),
        ('_XXXX', _('Внутренний (короткий)')),
    ]

    name = models.CharField(max_length=100, verbose_name=_('Название маршрута'))
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES, verbose_name=_('Направление'))
    match_pattern = models.CharField(max_length=80, choices=MATCH_CHOICES, default='_X.', verbose_name=_('Шаблон номера'))
    priority = models.PositiveIntegerField(default=1, verbose_name=_('Приоритет'))
    trunk = models.ForeignKey(AsteriskTrunk, on_delete=models.CASCADE, null=True, blank=True, related_name='routes', verbose_name=_('Транк'))
    prepend = models.CharField(max_length=20, blank=True, verbose_name=_('Добавить перед номером'), help_text=_('Напр. 8, +7, 810'))
    strip = models.PositiveIntegerField(default=0, verbose_name=_('Убрать цифр сначала'), help_text=_('Сколько цифр убрать из номера'))
    destination = models.CharField(max_length=200, blank=True, verbose_name=_('Цель (extension/context)'), help_text=_('Куда направить: SIP/101, ivr-main, queue-support'))
    caller_id_override = models.CharField(max_length=100, blank=True, verbose_name=_('Подмена Caller ID'))
    failover_destination = models.CharField(max_length=200, blank=True, verbose_name=_('Резервная цель'), help_text=_('Куда направить при отказе'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))

    class Meta:
        verbose_name = _('Маршрут звонков')
        verbose_name_plural = _('Маршруты звонков')
        ordering = ['direction', 'priority']

    def __str__(self):
        return f"Route: {self.name} ({self.get_direction_display()})"


class AsteriskIvr(models.Model):
    """Голосовое меню (IVR)"""
    name = models.CharField(max_length=100, verbose_name=_('Название IVR'))
    description = models.TextField(blank=True, verbose_name=_('Описание'))
    greeting_audio = models.CharField(max_length=200, blank=True, verbose_name=_('Аудио приветствия'), help_text=_('Путь к файлу, напр. /var/lib/asterisk/sounds/ivr/welcome'))
    timeout = models.PositiveIntegerField(default=5, verbose_name=_('Таймаут ввода (сек)'))
    max_attempts = models.PositiveIntegerField(default=3, verbose_name=_('Макс. попыток'))
    invalid_audio = models.CharField(max_length=200, blank=True, verbose_name=_('Аудио при ошибке'))
    exit_destination = models.CharField(max_length=200, default='hangup', verbose_name=_('Куда направить при ошибке'), help_text=_('hangup, SIP/101, queue-support'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))

    class Meta:
        verbose_name = _('Голосовое меню (IVR)')
        verbose_name_plural = _('Голосовые меню (IVR)')
        ordering = ['name']

    def __str__(self):
        return f"IVR: {self.name}"


class AsteriskIvrOption(models.Model):
    """Опция IVR-меню: нажатие цифры → действие"""
    ACTION_CHOICES = [
        ('extension', _('Внутренний номер')),
        ('queue', _('Очередь')),
        ('ivr', _('Под-меню (IVR)')),
        ('playback', _('Проиграть аудио')),
        ('voicemail', _('Голосовая почта')),
        ('hangup', _('Завершить звонок')),
        ('dial', _('Набрать номер')),
    ]

    ivr = models.ForeignKey(AsteriskIvr, on_delete=models.CASCADE, related_name='options', verbose_name=_('IVR'))
    digit = models.CharField(max_length=5, verbose_name=_('Цифра'), help_text=_('0-9, *, # или t (таймаут)'))
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='extension', verbose_name=_('Действие'))
    destination = models.CharField(max_length=200, verbose_name=_('Цель'), help_text=_('SIP/101, queue-support, hangup, номер'))
    description = models.CharField(max_length=200, blank=True, verbose_name=_('Описание (озвучка)'))
    order = models.PositiveIntegerField(default=0, verbose_name=_('Порядок'))

    class Meta:
        verbose_name = _('Опция IVR')
        verbose_name_plural = _('Опции IVR')
        ordering = ['ivr', 'order']

    def __str__(self):
        return f"IVR {self.ivr.name}: {self.digit} → {self.get_action_display()}"


class AsteriskVoicemail(models.Model):
    """Автоответчик / голосовая почта"""
    mailbox = models.CharField(max_length=50, verbose_name=_('Номер ящика'), help_text=_('Напр. 101@default'))
    password = models.CharField(max_length=20, default='0000', verbose_name=_('Пароль доступа'))
    display_name = models.CharField(max_length=100, blank=True, verbose_name=_('Отображаемое имя'))
    email = models.EmailField(blank=True, verbose_name=_('Email для уведомлений'))
    email_attachment = models.BooleanField(default=True, verbose_name=_('Отправлять запись на email'))
    delete_after_email = models.BooleanField(default=False, verbose_name=_('Удалять после отправки'))
    max_messages = models.PositiveIntegerField(default=100, verbose_name=_('Макс. сообщений'))
    max_seconds = models.PositiveIntegerField(default=120, verbose_name=_('Макс. длительность (сек)'))
    min_seconds = models.PositiveIntegerField(default=3, verbose_name=_('Мин. длительность (сек)'))
    greeting = models.CharField(max_length=200, blank=True, verbose_name=_('Приветствие (аудио)'), help_text=_('Напр. vm-intro'))
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='voicemail', verbose_name=_('Сотрудник'))
    is_active = models.BooleanField(default=True, verbose_name=_('Активен'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создан'))

    class Meta:
        verbose_name = _('Автоответчик')
        verbose_name_plural = _('Автоответчики')
        ordering = ['mailbox']

    def __str__(self):
        return f"VM: {self.mailbox} ({self.display_name or ''})"


class AsteriskCallRecording(models.Model):
    """Запись звонка (ссылка на файл на Asterisk-сервере)"""
    call_id = models.CharField(max_length=100, unique=True, verbose_name=_('ID звонка'))
    caller = models.CharField(max_length=50, verbose_name=_('Звонящий'))
    callee = models.CharField(max_length=50, verbose_name=_('Вызываемый'))
    direction = models.CharField(max_length=20, choices=[('incoming', _('Входящий')), ('outgoing', _('Исходящий')), ('internal', _('Внутренний'))], verbose_name=_('Направление'))
    start_time = models.DateTimeField(verbose_name=_('Начало'))
    duration = models.PositiveIntegerField(default=0, verbose_name=_('Длительность (сек)'))
    file_path = models.CharField(max_length=500, verbose_name=_('Путь к файлу'))
    file_size = models.PositiveIntegerField(default=0, verbose_name=_('Размер (байт)'))
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='call_recordings', verbose_name=_('Клиент'))
    synced_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Синхронизировано'))

    class Meta:
        verbose_name = _('Запись звонка')
        verbose_name_plural = _('Записи звонков')
        ordering = ['-start_time']

    def __str__(self):
        return f"Recording: {self.caller} → {self.callee} ({self.start_time})"


# ══════════════════════════════════════════════════════════════════
# Интеграция с Ростелеком АТС — Журнал звонков (CDR)
# ══════════════════════════════════════════════════════════════════

class CallLog(models.Model):
    """Запись звонка из Ростелеком АТС"""
    DIRECTION_CHOICES = [
        ('incoming', _('Входящий')),
        ('outgoing', _('Исходящий')),
        ('internal', _('Внутренний')),
    ]

    CALL_TYPE_CHOICES = [
        ('voip', _('VoIP')),
        ('mobile', _('Мобильный')),
        ('landline', _('Стационарный')),
        ('unknown', _('Неизвестно')),
    ]

    STATUS_CHOICES = [
        ('completed', _('Завершен')),
        ('missed', _('Пропущенный')),
        ('busy', _('Занято')),
        ('failed', _('Ошибка')),
        ('queued', _('В очереди')),
    ]

    call_id = models.CharField(max_length=100, unique=True, verbose_name=_('ID звонка'))
    phone = models.CharField(max_length=50, verbose_name=_('Номер телефона'))
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES, verbose_name=_('Направление'))
    start_time = models.DateTimeField(verbose_name=_('Начало звонка'))
    duration = models.PositiveIntegerField(default=0, verbose_name=_('Длительность (сек)'))
    call_type = models.CharField(max_length=20, choices=CALL_TYPE_CHOICES, default='unknown', verbose_name=_('Тип звонка'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed', verbose_name=_('Статус'))
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='call_logs', verbose_name=_('Клиент'))
    raw_data = models.JSONField(default=dict, verbose_name=_('Полные данные (JSON)'))
    synced_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Синхронизировано'))

    class Meta:
        verbose_name = _('Звонок (Ростелеком)')
        verbose_name_plural = _('Журнал звонков (Ростелеком)')
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['phone', 'start_time']),
            models.Index(fields=['client', 'start_time']),
        ]

    def __str__(self):
        direction_label = self.get_direction_display()
        return f"{direction_label} {self.phone} → {self.start_time.strftime('%d.%m.%Y %H:%M')} ({self.duration}с)"


# ══════════════════════════════════════════════════════════════════
# Склад v4: Места хранения (StorageLocation)
# ══════════════════════════════════════════════════════════════════

class StorageLocation(models.Model):
    """Физическое место хранения товаров на складе"""
    code = models.CharField(max_length=50, unique=True, verbose_name=_('Код места'), help_text='Например: A-03-12')
    barcode = models.CharField(max_length=100, blank=True, unique=True, null=True, verbose_name=_('Штрихкод места'))
    zone = models.CharField(max_length=100, blank=True, verbose_name=_('Зона'), help_text='Например: Склад А, Основной')
    rack = models.CharField(max_length=50, blank=True, verbose_name=_('Стеллаж'), help_text='Номер стеллажа')
    shelf = models.CharField(max_length=50, blank=True, verbose_name=_('Полка'), help_text='Номер полки')
    capacity = models.PositiveIntegerField(default=0, verbose_name=_('Вместимость'), help_text='Макс. кол-во позиций (0 = не ограничено)')
    is_active = models.BooleanField(default=True, verbose_name=_('Активно'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Создано'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Место хранения')
        verbose_name_plural = _('Места хранения')
        ordering = ['zone', 'rack', 'shelf']

    def __str__(self):
        parts = [self.zone, self.rack, self.shelf]
        return f'[{self.code}] {" / ".join(p for p in parts if p)}'

    def save(self, *args, **kwargs):
        if not self.barcode:
            import uuid
            self.barcode = f'LOC-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    @property
    def items_count(self):
        return self.items.count()

    @property
    def is_full(self):
        if self.capacity <= 0:
            return False
        return self.items_count >= self.capacity


# ── Сигналы ──────────────────────────────────────────────────────────────

def _build_client_address(building, client):
    """Формирует строку адреса клиента из данных дома + квартира."""
    parts = [f'г. {building.city}' if building.city else 'Санкт-Петербург']
    if building.district and building.district != building.city:
        parts.append(building.district)
    if building.street_name:
        street = building.get_street_type_display().lower() if building.street_type != 'other' else ''
        parts.append(f'{street} {building.street_name}'.strip())
    house = f'д. {building.house_number}'
    if building.building_number:
        house += f' корп. {building.building_number}'
    if building.liter:
        house += f' лит. {building.liter}'
    parts.append(house)
    if client.apartment:
        parts.append(f'кв. {client.apartment}')
    return ', '.join(parts)


@receiver(post_save, sender=Building)
def update_residents_on_building_change(sender, instance, **kwargs):
    """
    При сохранении дома — обновить address, region, district у всех привязанных клиентов.
    """
    from .models import Client  # локальный импорт для избежания цикла
    residents = Client.objects.filter(building=instance)
    if residents.exists():
        for client in residents:
            new_address = _build_client_address(instance, client)
            update_fields = {'address': new_address}
            if instance.region_id:
                update_fields['region'] = instance.region
            if instance.district:
                update_fields['district'] = instance.district
            Client.objects.filter(pk=client.pk).update(**update_fields)
