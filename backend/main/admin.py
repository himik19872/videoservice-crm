from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Region, Master, Client, Equipment, Order, OrderHistory, Report, Building, TraccarSettings, TraccarDevice


class MasterInline(admin.StackedInline):
    model = Master
    can_delete = False
    verbose_name_plural = 'Профиль мастера'


class UserAdmin(BaseUserAdmin):
    inlines = (MasterInline,)


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name', 'description']


@admin.register(Master)
class MasterAdmin(admin.ModelAdmin):
    list_display = ['user', 'region', 'phone', 'is_available', 'created_at']
    list_filter = ['region', 'is_available', 'created_at']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'phone']
    raw_id_fields = ['user', 'region']


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'address', 'region', 'created_at']
    list_filter = ['region', 'created_at']
    search_fields = ['name', 'phone', 'email', 'address']
    raw_id_fields = ['region']


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'equipment_type', 'serial_number', 'client', 'status', 'warranty_until', 'created_at']
    list_filter = ['equipment_type', 'status', 'created_at']
    search_fields = ['name', 'serial_number']
    raw_id_fields = ['client']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'number', 'order_type', 'client', 'master', 'region',
        'address', 'status', 'priority', 'created_at'
    ]
    list_filter = ['order_type', 'status', 'priority', 'created_at']
    search_fields = ['number', 'address', 'description']
    raw_id_fields = ['client', 'master', 'equipment', 'region']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Основная информация', {
            'fields': ('number', 'order_type', 'client', 'region', 'address')
        }),
        ('Мастер и оборудование', {
            'fields': ('master', 'equipment')
        }),
        ('Описание', {
            'fields': ('description',)
        }),
        ('Статус и приоритет', {
            'fields': ('status', 'priority')
        }),
        ('Временные метки', {
            'fields': ('assigned_at', 'started_at', 'completed_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_at', 'updated_at']


@admin.register(OrderHistory)
class OrderHistoryAdmin(admin.ModelAdmin):
    list_display = ['order', 'changed_by', 'old_status', 'new_status', 'changed_at']
    list_filter = ['changed_at']
    search_fields = ['order__number', 'notes']
    raw_id_fields = ['order', 'changed_by']
    date_hierarchy = 'changed_at'


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'period_start', 'period_end', 'status', 'generated_at', 'created_by']
    list_filter = ['report_type', 'status', 'generated_at']
    search_fields = ['title', 'data']
    raw_id_fields = ['created_by']
    date_hierarchy = 'generated_at'


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ['full_address_display', 'region', 'city', 'apartments_count', 'entrances_count', 'equipment_type', 'created_at']
    list_filter = ['region', 'city', 'street_type', 'equipment_type']
    search_fields = ['street_name', 'house_number', 'city', 'notes']

    @admin.display(description='Адрес')
    def full_address_display(self, obj):
        return str(obj)


@admin.register(TraccarSettings)
class TraccarSettingsAdmin(admin.ModelAdmin):
    list_display = ['server_url', 'username', 'is_active', 'sync_interval_minutes', 'updated_at']

    def has_add_permission(self, request):
        # Только один объект настроек
        return not TraccarSettings.objects.exists()


@admin.register(TraccarDevice)
class TraccarDeviceAdmin(admin.ModelAdmin):
    list_display = ['master', 'internal_device_id', 'unique_id', 'device_name', 'is_online', 'last_update']
    list_filter = ['is_online']
    search_fields = ['device_name', 'master__user__first_name', 'master__user__last_name']
    raw_id_fields = ['master']
