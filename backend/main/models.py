from django.db import models
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


class Building(models.Model):
    """Обслуживаемый адрес (дом)"""
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
    city = models.CharField(max_length=100, default='Москва', verbose_name=_('Город'))
    street_type = models.CharField(max_length=20, choices=STREET_TYPES, default='street', verbose_name=_('Тип улицы'))
    street_name = models.CharField(max_length=200, verbose_name=_('Название улицы'))
    house_number = models.CharField(max_length=20, verbose_name=_('Номер дома'))
    building_number = models.CharField(max_length=20, blank=True, verbose_name=_('Корпус/строение'))
    apartments_count = models.PositiveIntegerField(default=0, verbose_name=_('Количество квартир'))
    entrances_count = models.PositiveIntegerField(default=1, verbose_name=_('Количество подъездов'))
    equipment_type = models.CharField(max_length=30, choices=EQUIPMENT_TYPES, blank=True, verbose_name=_('Тип оборудования'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата добавления'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Дата обновления'))

    class Meta:
        verbose_name = _('Дом')
        verbose_name_plural = _('Дома')
        ordering = ['city', 'street_name', 'house_number']

    def __str__(self):
        return f"{self.get_street_type_display()} {self.street_name}, {self.house_number}{' корп.' + self.building_number if self.building_number else ''}"

    @property
    def full_address(self):
        """Полный адрес строкой"""
        return str(self)


class Region(models.Model):
    """Район обслуживания"""
    name = models.CharField(max_length=100, verbose_name=_('Название'))
    description = models.TextField(blank=True, verbose_name=_('Описание'))

    class Meta:
        verbose_name = _('Район')
        verbose_name_plural = _('Районы')

    def __str__(self):
        return self.name


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
    """Клиент"""
    name = models.CharField(max_length=150, verbose_name=_('ФИО'))
    phone = models.CharField(max_length=20, verbose_name=_('Телефон'))
    email = models.EmailField(blank=True, verbose_name=_('Email'))
    address = models.CharField(max_length=255, verbose_name=_('Адрес'))
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, related_name='clients', verbose_name=_('Район'))
    max_user_id = models.CharField(max_length=100, blank=True, verbose_name=_('Max user ID'))
    max_linked_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Max привязан'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата добавления'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))

    class Meta:
        verbose_name = _('Клиент')
        verbose_name_plural = _('Клиенты')

    def __str__(self):
        return f"{self.name} ({self.phone})"


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

    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Системные настройки')
        verbose_name_plural = _('Системные настройки')

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
    quantity = models.PositiveIntegerField(default=1, verbose_name=_('Количество'))
    unit = models.CharField(max_length=20, default='шт.', verbose_name=_('Ед. изм.'))
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_('Закупочная цена'))
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name=_('Цена продажи'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_stock', verbose_name=_('Статус'))
    location = models.CharField(max_length=200, blank=True, verbose_name=_('Место хранения'))
    supplier = models.CharField(max_length=200, blank=True, verbose_name=_('Поставщик'))
    warranty_months = models.PositiveIntegerField(default=12, verbose_name=_('Гарантия (мес.)'))
    notes = models.TextField(blank=True, verbose_name=_('Примечания'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Дата поступления'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Обновлено'))

    class Meta:
        verbose_name = _('Складская единица')
        verbose_name_plural = _('Склад')
        ordering = ['-created_at']

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
