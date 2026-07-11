from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import Region, Master, Client, Equipment, Order, OrderHistory, Report, Building, TraccarSettings, TraccarDevice, SystemSettings, OrderMedia, UserProfile, WorkShift, PushToken
from .models import InventoryItem, InventoryMovement, Payment, MasterSalary, Message
from .models import LegalEntity, EstimateService, CommercialEstimate, EstimateItem
from .models import Supplier, SupplyInvoice, SupplyInvoiceItem
from .models import IssueOrder, IssueOrderItem, PurchaseRequest, PurchaseRequestItem
from .models import OrderComment
from .models import ErcAccount, ErcBillingRecord
from .models import StorageLocation
from .models import OutgoingInvoice, OutgoingInvoiceItem
from .models import CallLog
from .models import AsteriskSipPeer, AsteriskTrunk, AsteriskRoute, AsteriskIvr, AsteriskIvrOption
from .models import AsteriskVoicemail, AsteriskCallRecording


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    master_profile = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'master_profile', 'profile']

    def get_role(self, obj):
        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            if obj.is_superuser:
                return 'admin'
            if obj.is_staff:
                return 'dispatcher'
        return 'master'

    def get_master_profile(self, obj):
        try:
            m = obj.master_profile
            return {'id': m.id, 'phone': m.phone, 'region': m.region_id}
        except Master.DoesNotExist:
            return None

    def get_profile(self, obj):
        try:
            p = obj.profile
            return {
                'role': p.role, 'phone': p.phone,
                'is_on_shift': p.is_on_shift,
                'shift_started_at': p.shift_started_at.isoformat() if p.shift_started_at else None,
            }
        except UserProfile.DoesNotExist:
            # Авто-создаём профиль
            if obj.is_superuser:
                p = UserProfile.objects.create(user=obj, role='admin', phone='')
            elif obj.is_staff:
                p = UserProfile.objects.create(user=obj, role='dispatcher', phone='')
            else:
                p = UserProfile.objects.create(user=obj, role='master', phone='')
            return {'role': p.role, 'phone': p.phone, 'is_on_shift': False, 'shift_started_at': None}


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ['id', 'name', 'description']


class MasterSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', required=False)
    password = serializers.CharField(source='user.password', write_only=True, required=False, allow_blank=True)
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    email = serializers.EmailField(source='user.email', required=False, allow_blank=True)
    region = RegionSerializer(read_only=True)
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(), source='region', write_only=True, required=False, allow_null=True
    )
    traccar_device = serializers.SerializerMethodField()

    class Meta:
        model = Master
        fields = [
            'id', 'user', 'full_name', 'username', 'password',
            'first_name', 'last_name', 'email', 'region', 'region_id',
            'phone', 'is_available', 'created_at', 'traccar_device'
        ]
        read_only_fields = ['id', 'created_at']

    def get_traccar_device(self, obj):
        try:
            d = obj.traccar_device
            return {
                'id': d.id,
                'device_name': d.device_name,
                'internal_device_id': d.internal_device_id,
                'unique_id': d.unique_id,
                'last_latitude': d.last_latitude,
                'last_longitude': d.last_longitude,
                'last_speed': d.last_speed,
                'last_update': d.last_update.isoformat() if d.last_update else None,
                'is_online': d.is_online,
            }
        except Exception:
            return None

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        password = user_data.pop('password', None)

        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        if password:
            user.set_password(password)
        user.save()

        return super().update(instance, validated_data)


class ClientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='name')
    region = RegionSerializer(read_only=True)
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(), source='region', write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Client
        fields = [
            'id', 'full_name', 'phone', 'email', 'address',
            'region', 'region_id', 'is_legal', 'inn', 'kpp', 'ogrn',
            'legal_address', 'director_name',
            'personal_account_number', 'entrance_number', 'management_company',
            'district', 'source',
            'created_at', 'notes'
        ]
        read_only_fields = ['id', 'created_at']


class EquipmentSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), source='client', write_only=True
    )

    class Meta:
        model = Equipment
        fields = [
            'id', 'name', 'equipment_type', 'serial_number', 
            'client', 'client_id', 'status', 'warranty_until',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OrderHistorySerializer(serializers.ModelSerializer):
    changed_by = UserSerializer(read_only=True)

    class Meta:
        model = OrderHistory
        fields = ['id', 'order', 'changed_by', 'old_status', 'new_status',
                  'notes', 'master_lat', 'master_lon', 'changed_at']
        read_only_fields = ['id', 'changed_at']


class OrderMediaSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    file = serializers.SerializerMethodField()

    class Meta:
        model = OrderMedia
        fields = ['id', 'order', 'file', 'file_type', 'uploaded_by', 'notes', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

    def get_file(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class OrderSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), source='client', write_only=True
    )
    client_info = serializers.SerializerMethodField()
    master = MasterSerializer(read_only=True)
    master_id = serializers.PrimaryKeyRelatedField(
        queryset=Master.objects.all(), source='master', write_only=True, required=False, allow_null=True
    )
    master_info = serializers.SerializerMethodField()
    equipment = EquipmentSerializer(read_only=True)
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(), source='equipment', write_only=True, required=False, allow_null=True
    )
    region = RegionSerializer(read_only=True)
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(), source='region', write_only=True
    )
    region_info = serializers.SerializerMethodField()
    building_id = serializers.PrimaryKeyRelatedField(
        queryset=Building.objects.all(), source='building', write_only=True, required=False, allow_null=True
    )
    payment_type_display = serializers.SerializerMethodField()
    confirmed_by = serializers.SerializerMethodField()
    helpers = serializers.SerializerMethodField()
    history = OrderHistorySerializer(many=True, read_only=True)
    media = OrderMediaSerializer(many=True, read_only=True)
    issue_orders = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'number', 'order_type', 'client', 'client_id', 'client_info',
            'master', 'master_id', 'master_info', 'equipment', 'equipment_id',
            'building_id', 'region', 'region_id', 'region_info',
            'city', 'street_name', 'house_number', 'building_number', 'apartment', 'entrance', 'address',
            'description', 'status', 'priority', 'cost', 'payment_type',
            'payment_type_display', 'is_paid', 'is_warranty',
            'photo_report_required', 'deadline',
            'assigned_at', 'scheduled_at', 'accepted_at', 'started_at', 'paused_at',
            'completed_at', 'confirmed_at', 'confirmed_by',
            'helpers', 'history', 'media', 'issue_orders', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'number', 'assigned_at', 'scheduled_at', 'accepted_at', 'started_at',
            'paused_at', 'completed_at', 'confirmed_at', 'confirmed_by',
            'created_at', 'updated_at', 'helpers', 'history', 'media', 'issue_orders'
        ]

    def get_client_info(self, obj):
        if obj.client:
            return {
                'id': obj.client.id,
                'full_name': obj.client.name,
                'phone': obj.client.phone,
                'address': obj.client.address,
            }
        return None

    def get_region_info(self, obj):
        if obj.region:
            return {
                'id': obj.region.id,
                'name': obj.region.name,
            }
        return None

    def get_master_info(self, obj):
        if obj.master:
            return {
                'id': obj.master.id,
                'full_name': obj.master.user.get_full_name() or obj.master.user.username,
                'phone': obj.master.phone,
            }
        return None

    def get_payment_type_display(self, obj):
        return obj.get_payment_type_display() if obj.payment_type else None

    def get_confirmed_by(self, obj):
        if obj.confirmed_by:
            return {
                'id': obj.confirmed_by.id,
                'username': obj.confirmed_by.username,
            }
        return None

    def get_helpers(self, obj):
        return [{'id': u.id, 'username': u.username, 'full_name': u.get_full_name() or u.username} for u in obj.helpers.all()]

    def get_issue_orders(self, obj):
        issue_orders = obj.issue_orders.prefetch_related('items__inventory_item').all()
        result = []
        for io in issue_orders:
            result.append({
                'id': io.id,
                'master_name': io.master.user.get_full_name() or io.master.user.username if io.master else '',
                'status': io.status,
                'status_display': io.get_status_display(),
                'notes': io.notes,
                'issued_at': io.issued_at.isoformat() if io.issued_at else None,
                'received_at': io.received_at.isoformat() if io.received_at else None,
                'items': [{
                    'id': item.id,
                    'item_name': str(item.inventory_item),
                    'barcode': item.inventory_item.barcode,
                    'quantity_issued': item.quantity_issued,
                    'quantity_used': item.quantity_used,
                    'quantity_returned': item.quantity_returned,
                    'remaining': item.remaining,
                    'need_return_old': item.need_return_old,
                    'old_item_description': item.old_item_description,
                    'old_item_returned': item.old_item_returned,
                } for item in io.items.all()],
            })
        return result


class ReportSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Report
        fields = [
            'id', 'title', 'report_type', 'period_start', 
            'period_end', 'data', 'status', 'generated_at', 'created_by'
        ]
        read_only_fields = ['id', 'generated_at']


# Дополнительные сериализаторы для API

class OrderCreateSerializer(serializers.ModelSerializer):
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), source='client'
    )
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(), source='region'
    )
    master_id = serializers.PrimaryKeyRelatedField(
        queryset=Master.objects.all(), source='master', required=False, allow_null=True
    )
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(), source='equipment', required=False, allow_null=True
    )
    building_id = serializers.PrimaryKeyRelatedField(
        queryset=Building.objects.all(), source='building', required=False, allow_null=True
    )
    helper_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False, write_only=True
    )

    class Meta:
        model = Order
        fields = [
            'order_type', 'client_id', 'master_id', 'equipment_id',
            'building_id', 'region_id',
            'city', 'street_name', 'house_number', 'building_number', 'apartment', 'entrance', 'address',
            'description', 'priority',
            'cost', 'payment_type', 'photo_report_required', 'deadline', 'scheduled_at',
            'helper_ids'
        ]

    def create(self, validated_data):
        helper_ids = validated_data.pop('helper_ids', [])
        order = Order.objects.create(**validated_data)
        if helper_ids:
            order.helpers.set(helper_ids)
        return order


class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    notes = serializers.CharField(required=False, allow_blank=True, write_only=True)
    master_id = serializers.PrimaryKeyRelatedField(
        queryset=Master.objects.all(), source='master', required=False, allow_null=True
    )

    class Meta:
        model = Order
        fields = ['status', 'notes', 'master_id', 'cost', 'payment_type']


class BuildingSerializer(serializers.ModelSerializer):
    region = RegionSerializer(read_only=True)
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(), source='region', write_only=True
    )
    street_type_display = serializers.SerializerMethodField()
    equipment_type_display = serializers.SerializerMethodField()

    class Meta:
        model = Building
        fields = [
            'id', 'region', 'region_id', 'city', 'street_type',
            'street_type_display', 'street_name', 'house_number',
            'building_number', 'apartments_count', 'entrances_count',
            'equipment_type', 'equipment_type_display', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_street_type_display(self, obj):
        return obj.get_street_type_display()

    def get_equipment_type_display(self, obj):
        return obj.get_equipment_type_display() if obj.equipment_type else ''


class BuildingDetailSerializer(BuildingSerializer):
    orders = serializers.SerializerMethodField()

    class Meta(BuildingSerializer.Meta):
        fields = BuildingSerializer.Meta.fields + ['orders']

    def get_orders(self, obj):
        orders = obj.orders.select_related('master__user').order_by('-created_at')
        return [{
            'id': o.id,
            'number': o.number,
            'order_type': o.order_type,
            'order_type_display': o.get_order_type_display(),
            'status': o.status,
            'status_display': o.get_status_display(),
            'master_name': o.master.user.get_full_name() or o.master.user.username if o.master else '—',
            'created_at': o.created_at.isoformat(),
        } for o in orders]


class TraccarSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TraccarSettings
        fields = ['id', 'server_url', 'username', 'password', 'is_active', 'sync_interval_minutes', 'updated_at']
        read_only_fields = ['id', 'updated_at']
        extra_kwargs = {'password': {'write_only': True}}


class TraccarDeviceSerializer(serializers.ModelSerializer):
    master_name = serializers.SerializerMethodField()
    master_id = serializers.PrimaryKeyRelatedField(
        queryset=Master.objects.all(), source='master', write_only=True
    )
    display_id = serializers.SerializerMethodField()

    class Meta:
        model = TraccarDevice
        fields = ['id', 'master_id', 'master_name', 'internal_device_id', 'unique_id',
                  'display_id', 'device_name', 'last_latitude', 'last_longitude',
                  'last_speed', 'last_update', 'is_online', 'created_at']
        read_only_fields = ['id', 'last_latitude', 'last_longitude', 'last_speed', 'last_update', 'is_online', 'created_at']

    def get_master_name(self, obj):
        return str(obj.master)

    def get_display_id(self, obj):
        return f"#{obj.internal_device_id} / {obj.unique_id}"


class MasterStatsSerializer(serializers.Serializer):
    """Статистика по мастеру"""
    master_id = serializers.IntegerField()
    master_name = serializers.CharField()
    total_orders = serializers.IntegerField()
    completed_orders = serializers.IntegerField()
    overdue_orders = serializers.IntegerField()
    avg_completion_hours = serializers.FloatField()
    total_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    by_type = serializers.DictField()
    month = serializers.CharField()


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = '__all__'
        read_only_fields = ['id', 'updated_at']


class SystemSettingsPublicSerializer(serializers.ModelSerializer):
    """Публичные настройки (без секретов) для шаблона КП"""
    class Meta:
        model = SystemSettings
        fields = ['cp_logo_url', 'cp_header_text', 'cp_footer_text',
                  'cp_signature_name', 'cp_signature_title', 'cp_validity_days',
                  'cp_color', 'cp_show_logo']


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    permissions = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'role', 'phone', 'is_on_shift', 'shift_started_at',
                  'username', 'password', 'first_name', 'last_name', 'email', 'permissions']

    def create(self, validated_data):
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', 'admin123')
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        email = validated_data.pop('email', '')
        if not username:
            import random; username = f"user{random.randint(100, 999)}"
        user = User.objects.create_user(username=username, password=password, first_name=first_name, last_name=last_name, email=email)
        role = validated_data.get('role', 'master')
        user.is_superuser = (role == 'admin')
        user.is_staff = (role in ['admin', 'dispatcher'])
        user.save()
        profile = UserProfile.objects.create(user=user, **validated_data)
        # Авто-создание Master для ролей master/installer
        if role in ('master', 'installer') and not hasattr(user, 'master_profile'):
            from .models import Master, Region
            region = Region.objects.first()
            Master.objects.create(user=user, phone=validated_data.get('phone', ''), region=region)
        return profile

    def update(self, instance, validated_data):
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        email = validated_data.pop('email', None)
        user = instance.user
        if username: user.username = username
        if password: user.set_password(password)
        if first_name is not None: user.first_name = first_name
        if last_name is not None: user.last_name = last_name
        if email is not None: user.email = email
        role = validated_data.get('role', instance.role)
        user.is_superuser = (role == 'admin')
        user.is_staff = (role in ['admin', 'dispatcher'])
        user.save()
        return super().update(instance, validated_data)


class WorkShiftSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkShift
        fields = '__all__'
        read_only_fields = ['id', 'orders_total', 'orders_completed', 'total_cost', 'total_mileage_km', 'hours_worked']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class PushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushToken
        fields = ['id', 'token', 'platform', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


# ══════════════════════════════════════════════════════════════════
# Склад и оборудование
# ══════════════════════════════════════════════════════════════════

class InventoryItemSerializer(serializers.ModelSerializer):
    item_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()
    storage_location_info = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        """При создании — авто-привязка к первой свободной ячейке, если не указана явно"""
        if not validated_data.get('storage_location'):
            # Ищем первую активную, не заполненную ячейку
            loc = StorageLocation.objects.filter(is_active=True).first()
            if not loc:
                # Если ячеек нет — создаём ячейку по умолчанию
                loc = StorageLocation.objects.create(
                    code='A-01-01',
                    zone='Основной склад',
                    rack='01',
                    shelf='01',
                    capacity=0,  # безлимит
                    is_active=True,
                )
            # Проверяем, не заполнена ли она
            if not loc.is_full:
                validated_data['storage_location'] = loc
        return super().create(validated_data)

    def get_item_type_display(self, obj):
        return obj.get_item_type_display()

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_total_value(self, obj):
        if obj.sale_price:
            return float(obj.sale_price) * obj.quantity
        return None

    def get_storage_location_info(self, obj):
        if obj.storage_location:
            return {
                'id': obj.storage_location.id,
                'code': obj.storage_location.code,
                'barcode': obj.storage_location.barcode,
                'zone': obj.storage_location.zone,
                'rack': obj.storage_location.rack,
                'shelf': obj.storage_location.shelf,
            }
        return None


class InventoryMovementSerializer(serializers.ModelSerializer):
    movement_type_display = serializers.SerializerMethodField()
    item_name = serializers.SerializerMethodField()
    master_name = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    performed_by_name = serializers.SerializerMethodField()
    supply_invoice_info = serializers.SerializerMethodField()

    class Meta:
        model = InventoryMovement
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_movement_type_display(self, obj):
        return obj.get_movement_type_display()

    def get_item_name(self, obj):
        return str(obj.item) if obj.item else ''

    def get_master_name(self, obj):
        if obj.master:
            return obj.master.user.get_full_name() or obj.master.user.username
        return ''

    def get_order_number(self, obj):
        return obj.order.number if obj.order else ''

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return ''

    def get_supply_invoice_info(self, obj):
        if obj.supply_invoice:
            return {
                'id': obj.supply_invoice.id,
                'invoice_number': obj.supply_invoice.invoice_number,
                'supplier_name': obj.supply_invoice.supplier.name,
            }
        return None


# ══════════════════════════════════════════════════════════════════
# Финансы
# ══════════════════════════════════════════════════════════════════

class PaymentSerializer(serializers.ModelSerializer):
    payment_method_display = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_payment_method_display(self, obj):
        return obj.get_payment_method_display()

    def get_order_number(self, obj):
        return obj.order.number if obj.order else ''

    def get_received_by_name(self, obj):
        if obj.received_by:
            return obj.received_by.get_full_name() or obj.received_by.username
        return ''


class MasterSalarySerializer(serializers.ModelSerializer):
    master_name = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    total_revenue = serializers.FloatField(read_only=True)
    total_salary = serializers.FloatField(read_only=True)
    bonus = serializers.FloatField(read_only=True)
    deduction = serializers.FloatField(read_only=True)
    commission_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = MasterSalary
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'orders_total', 'orders_completed', 'total_revenue', 'total_salary']

    def get_master_name(self, obj):
        return obj.master.user.get_full_name() or obj.master.user.username if obj.master else ''

    def get_status_display(self, obj):
        return obj.get_status_display()


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'recipient', 'recipient_name', 'is_broadcast', 'text', 'read_by', 'created_at', 'unread']
        read_only_fields = ['id', 'sender', 'created_at', 'read_by']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    def get_recipient_name(self, obj):
        if obj.recipient:
            return obj.recipient.get_full_name() or obj.recipient.username
        return 'Всем'

    def get_unread(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user not in obj.read_by.all()
        return False


# ══════════════════════════════════════════════════════════════════
# Сметы и КП — сериализаторы
# ══════════════════════════════════════════════════════════════════

class LegalEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalEntity
        fields = '__all__'


class EstimateServiceSerializer(serializers.ModelSerializer):
    margin_percent = serializers.ReadOnlyField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = EstimateService
        fields = ['id', 'name', 'category', 'category_display', 'unit', 'cost_price',
                  'sale_price', 'installer_salary', 'margin_percent', 'notes', 'is_active',
                  'created_at', 'updated_at']


class EstimateItemSerializer(serializers.ModelSerializer):
    item_type_display = serializers.CharField(source='get_item_type_display', read_only=True)

    class Meta:
        model = EstimateItem
        fields = ['id', 'estimate', 'item_type', 'item_type_display', 'inventory_item',
                  'service', 'name', 'unit', 'quantity', 'cost_price', 'sale_price',
                  'discount', 'total_price', 'installer_salary', 'order_num']


class CommercialEstimateSerializer(serializers.ModelSerializer):
    items = EstimateItemSerializer(many=True, read_only=True)
    client_name = serializers.SerializerMethodField()
    legal_entity_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CommercialEstimate
        fields = ['id', 'number', 'name', 'client', 'client_name', 'legal_entity',
                  'legal_entity_name', 'order', 'status', 'status_display', 'discount',
                  'commission', 'dealer_fee', 'unexpected_costs', 'delivery_type',
                  'delivery_cost', 'tax_type', 'tax_rate', 'employee', 'employee_phone',
                  'total_materials', 'total_services', 'subtotal', 'total', 'total_cost',
                  'profit', 'note', 'items', 'created_by', 'created_by_name',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'number', 'created_by', 'created_at', 'updated_at']

    def get_client_name(self, obj):
        if obj.client:
            return obj.client.name
        return None

    def get_legal_entity_name(self, obj):
        if obj.legal_entity:
            return obj.legal_entity.short_name or obj.legal_entity.name
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


# ══════════════════════════════════════════════════════════════════
# Склад v2: Поставщики, Накладные, Штрих-коды
# ══════════════════════════════════════════════════════════════════

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class SupplyInvoiceItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()
    item_barcode = serializers.SerializerMethodField()
    item_type_display = serializers.SerializerMethodField()
    shortage = serializers.SerializerMethodField()
    ordered_total = serializers.SerializerMethodField()
    received_total = serializers.SerializerMethodField()

    class Meta:
        model = SupplyInvoiceItem
        fields = ['id', 'invoice', 'inventory_item', 'item_name', 'item_barcode',
                  'item_type_display', 'quantity_ordered', 'quantity_received',
                  'unit_price', 'shortage', 'ordered_total', 'received_total', 'notes']
        read_only_fields = ['id']

    def get_item_name(self, obj):
        return str(obj.inventory_item) if obj.inventory_item else ''

    def get_item_barcode(self, obj):
        return obj.inventory_item.barcode if obj.inventory_item else ''

    def get_item_type_display(self, obj):
        return obj.inventory_item.get_item_type_display() if obj.inventory_item else ''

    def get_shortage(self, obj):
        return obj.shortage

    def get_ordered_total(self, obj):
        return obj.ordered_total

    def get_received_total(self, obj):
        return obj.received_total


class SupplyInvoiceSerializer(serializers.ModelSerializer):
    items = SupplyInvoiceItemSerializer(many=True, read_only=True)
    supplier_name = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SupplyInvoice
        fields = ['id', 'supplier', 'supplier_name', 'invoice_number', 'invoice_date',
                  'status', 'status_display', 'received_by', 'received_by_name',
                  'received_at', 'total_ordered', 'total_received', 'notes',
                  'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_supplier_name(self, obj):
        return obj.supplier.name if obj.supplier else ''

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_received_by_name(self, obj):
        if obj.received_by:
            return obj.received_by.get_full_name() or obj.received_by.username
        return ''


class SupplyInvoiceCreateSerializer(serializers.Serializer):
    """Для создания накладной с позициями одним запросом"""
    supplier_id = serializers.IntegerField()
    invoice_number = serializers.CharField()
    invoice_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = serializers.ListField(child=serializers.DictField())


class SupplyInvoiceReceiveSerializer(serializers.Serializer):
    """Для приёмки товара: обновление quantity_received по позициям"""
    items = serializers.ListField(child=serializers.DictField())


# ══════════════════════════════════════════════════════════════════
# Склад v3: Расходный ордер, заявка на закупку
# ══════════════════════════════════════════════════════════════════

class IssueOrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()
    item_barcode = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = IssueOrderItem
        fields = '__all__'
        read_only_fields = ['id']

    def get_item_name(self, obj):
        return str(obj.inventory_item) if obj.inventory_item else ''

    def get_item_barcode(self, obj):
        return obj.inventory_item.barcode if obj.inventory_item else ''

    def get_remaining(self, obj):
        return obj.remaining


class IssueOrderSerializer(serializers.ModelSerializer):
    items = IssueOrderItemSerializer(many=True, read_only=True)
    master_name = serializers.SerializerMethodField()
    issued_by_name = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = IssueOrder
        fields = '__all__'
        read_only_fields = ['id', 'issued_at', 'received_at', 'completed_at', 'issued_by']

    def get_master_name(self, obj):
        if obj.master:
            return obj.master.user.get_full_name() or obj.master.user.username
        return ''

    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.username
        return ''

    def get_order_number(self, obj):
        return obj.order.number if obj.order else ''

    def get_status_display(self, obj):
        return obj.get_status_display()


class IssueOrderCreateSerializer(serializers.Serializer):
    """Создание расходного ордера с позициями"""
    order_id = serializers.IntegerField()
    master_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = serializers.ListField(child=serializers.DictField())


class PurchaseRequestItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRequestItem
        fields = '__all__'
        read_only_fields = ['id']


class PurchaseRequestSerializer(serializers.ModelSerializer):
    items = PurchaseRequestItemSerializer(many=True, read_only=True)
    status_display = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseRequest
        fields = '__all__'
        read_only_fields = ['id', 'number', 'created_at', 'updated_at']

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''


# ══════════════════════════════════════════════════════════════════
# Комментарии к заявкам (диалоги)
# ══════════════════════════════════════════════════════════════════

class OrderCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderComment
        fields = ['id', 'order', 'author', 'author_name', 'text', 'event_type', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username


# ══════════════════════════════════════════════════════════════════
# Сериализаторы для ЕРЦ
# ══════════════════════════════════════════════════════════════════

class ErcAccountSerializer(serializers.ModelSerializer):
    last_payment = serializers.SerializerMethodField()
    billing_records_count = serializers.SerializerMethodField()

    class Meta:
        model = ErcAccount
        fields = ['id', 'account_number', 'full_name', 'address', 'residents_count',
                  'is_active', 'last_payment', 'billing_records_count', 'created_at', 'updated_at']

    def get_last_payment(self, obj):
        last = obj.billing_records.order_by('-period').first()
        if last:
            return {
                'period': last.period.strftime('%Y-%m'),
                'paid': str(last.paid),
                'paid_percent': str(last.paid_percent),
            }
        return None

    def get_billing_records_count(self, obj):
        return obj.billing_records.count()


class ErcBillingRecordSerializer(serializers.ModelSerializer):
    account_number = serializers.CharField(source='account.account_number', read_only=True)
    account_name = serializers.CharField(source='account.full_name', read_only=True)

    class Meta:
        model = ErcBillingRecord
        fields = ['id', 'account', 'account_number', 'account_name', 'period',
                  'balance_start', 'charged', 'charged_no_benefits',
                  'paid', 'paid_percent', 'balance_end', 'credit', 'imported_at']


# ══════════════════════════════════════════════════════════════════
# StorageLocation
# ══════════════════════════════════════════════════════════════════

class StorageLocationSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    is_full = serializers.SerializerMethodField()
    free_space = serializers.SerializerMethodField()

    class Meta:
        model = StorageLocation
        fields = ['id', 'code', 'barcode', 'zone', 'rack', 'shelf',
                  'capacity', 'is_active', 'notes',
                  'items_count', 'is_full', 'free_space',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'barcode', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_is_full(self, obj):
        return obj.is_full

    def get_free_space(self, obj):
        if obj.capacity <= 0:
            return None  # безлимит
        return max(0, obj.capacity - obj.items.count())


class StorageLocationDetailSerializer(StorageLocationSerializer):
    """Расширенный сериализатор с перечнем товаров в ячейке"""
    items = serializers.SerializerMethodField()

    class Meta(StorageLocationSerializer.Meta):
        fields = StorageLocationSerializer.Meta.fields + ['items']

    def get_items(self, obj):
        items = obj.items.select_related('storage_location').all()
        return [{
            'id': item.id,
            'name': item.name,
            'barcode': item.barcode,
            'serial_number': item.serial_number,
            'model_name': item.model_name,
            'item_type': item.item_type,
            'item_type_display': item.get_item_type_display(),
            'quantity': item.quantity,
            'cost_price': str(item.cost_price) if item.cost_price else None,
            'sale_price': str(item.sale_price) if item.sale_price else None,
            'status': item.status,
            'status_display': item.get_status_display(),
        } for item in items]


# ══════════════════════════════════════════════════════════════════
# Исходящие накладные (УПД)
# ══════════════════════════════════════════════════════════════════

class OutgoingInvoiceItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()
    item_barcode = serializers.SerializerMethodField()
    item_unit = serializers.SerializerMethodField()

    class Meta:
        model = OutgoingInvoiceItem
        fields = ['id', 'invoice', 'inventory_item', 'item_name', 'item_barcode',
                  'item_unit', 'quantity', 'unit_price', 'amount', 'vat_rate', 'notes']
        read_only_fields = ['id', 'amount']

    def get_item_name(self, obj):
        return str(obj.inventory_item) if obj.inventory_item else ''

    def get_item_barcode(self, obj):
        return obj.inventory_item.barcode if obj.inventory_item else ''

    def get_item_unit(self, obj):
        return obj.inventory_item.unit if obj.inventory_item else 'шт.'


class OutgoingInvoiceSerializer(serializers.ModelSerializer):
    items = OutgoingInvoiceItemSerializer(many=True, read_only=True)
    from_legal_name = serializers.SerializerMethodField()
    to_client_name = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    issued_by_name = serializers.SerializerMethodField()
    date = serializers.DateField(read_only=True)

    class Meta:
        model = OutgoingInvoice
        fields = ['id', 'number', 'date', 'status', 'status_display',
                  'from_legal', 'from_legal_name',
                  'to_client', 'to_client_name',
                  'basis', 'issued_by', 'issued_by_name',
                  'received_by_name', 'total_amount', 'total_vat',
                  'notes', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'number', 'created_at', 'updated_at']

    def get_from_legal_name(self, obj):
        return obj.from_legal.short_name or obj.from_legal.name if obj.from_legal else ''

    def get_to_client_name(self, obj):
        return obj.to_client.name if obj.to_client else ''

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.username
        return ''


class OutgoingInvoiceCreateSerializer(serializers.Serializer):
    """Создание УПД с позициями"""
    from_legal_id = serializers.IntegerField()
    to_client_id = serializers.IntegerField()
    basis = serializers.CharField(required=False, allow_blank=True, default='')
    received_by_name = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = serializers.ListField(child=serializers.DictField())




# ════════════════════════════════════════════════════════════
# Asterisk PBX сериализаторы
# ════════════════════════════════════════════════════════════

class AsteriskSipPeerSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, allow_null=True)

    class Meta:
        model = AsteriskSipPeer
        fields = '__all__'
        extra_kwargs = {'secret': {'write_only': True}}


class AsteriskTrunkSerializer(serializers.ModelSerializer):
    routes_count = serializers.SerializerMethodField()

    class Meta:
        model = AsteriskTrunk
        fields = '__all__'
        extra_kwargs = {'secret': {'write_only': True}}

    def get_routes_count(self, obj):
        return obj.routes.count()


class AsteriskRouteSerializer(serializers.ModelSerializer):
    trunk_name = serializers.CharField(source='trunk.name', read_only=True, allow_null=True)

    class Meta:
        model = AsteriskRoute
        fields = '__all__'


class AsteriskIvrOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AsteriskIvrOption
        fields = '__all__'


class AsteriskIvrSerializer(serializers.ModelSerializer):
    options = AsteriskIvrOptionSerializer(many=True, read_only=True)

    class Meta:
        model = AsteriskIvr
        fields = '__all__'


class AsteriskVoicemailSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, allow_null=True)

    class Meta:
        model = AsteriskVoicemail
        fields = '__all__'
        extra_kwargs = {'password': {'write_only': True}}


class AsteriskCallRecordingSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True, allow_null=True)

    class Meta:
        model = AsteriskCallRecording
        fields = '__all__'


class CallLogSerializer(serializers.ModelSerializer):
    """Сериализатор записи звонка"""
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)
    call_type_display = serializers.CharField(source='get_call_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True, allow_null=True)

    class Meta:
        model = CallLog
        fields = '__all__'
