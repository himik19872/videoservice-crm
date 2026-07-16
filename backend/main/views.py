from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Sum
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from datetime import timedelta
from .models import Region, Master, Client, Equipment, Order, OrderHistory, Report, Building, TraccarSettings, TraccarDevice, SystemSettings, UserProfile, WorkShift, OrderMedia, PushToken
from .models import MaxBotSettings, MaxUserLink
from .models import InventoryItem, InventoryMovement, Payment, MasterSalary
from .models import MasterCashDebt, MasterInventoryDebt, OrderMaterial, Message
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
from django.db.models import Q
from .serializers import (
    RegionSerializer, MasterSerializer, ClientSerializer,
    EquipmentSerializer, OrderSerializer, OrderCreateSerializer,
    OrderStatusUpdateSerializer, ReportSerializer, UserSerializer, LoginSerializer,
    BuildingSerializer, BuildingDetailSerializer, TraccarSettingsSerializer, TraccarDeviceSerializer,
    SystemSettingsSerializer, UserProfileSerializer, WorkShiftSerializer, OrderMediaSerializer, PushTokenSerializer
)
from .serializers import InventoryItemSerializer, InventoryMovementSerializer, PaymentSerializer, MasterSalarySerializer, MessageSerializer
from .serializers import LegalEntitySerializer, EstimateServiceSerializer, CommercialEstimateSerializer, EstimateItemSerializer
from .serializers import SupplierSerializer, SupplyInvoiceSerializer, SupplyInvoiceCreateSerializer, SupplyInvoiceReceiveSerializer
from .serializers import SupplyInvoiceItemSerializer
from .serializers import IssueOrderSerializer, IssueOrderCreateSerializer, IssueOrderItemSerializer
from .serializers import PurchaseRequestSerializer, PurchaseRequestItemSerializer
from .serializers import OrderCommentSerializer
from .serializers import ErcAccountSerializer, ErcBillingRecordSerializer
from .serializers import StorageLocationSerializer, StorageLocationDetailSerializer
from .serializers import OutgoingInvoiceSerializer, OutgoingInvoiceCreateSerializer
from .serializers import CallLogSerializer
from .serializers import AsteriskSipPeerSerializer, AsteriskTrunkSerializer, AsteriskRouteSerializer
from .serializers import AsteriskIvrSerializer, AsteriskIvrOptionSerializer
from .serializers import AsteriskVoicemailSerializer, AsteriskCallRecordingSerializer


class RegionViewSet(viewsets.ModelViewSet):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']


class MasterViewSet(viewsets.ModelViewSet):
    queryset = Master.objects.all()
    serializer_class = MasterSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['region', 'is_available']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'phone']

    def get_queryset(self):
        queryset = Master.objects.all()
        user = self.request.user

        # Мастер видит только свои данные
        if user.is_authenticated and not user.is_staff:
            try:
                master = user.master_profile
                return queryset.filter(id=master.id)
            except Master.DoesNotExist:
                return Master.objects.none()

        return queryset

    def create(self, request, *args, **kwargs):
        from django.contrib.auth.models import User
        import random

        full_name = request.data.get('full_name', '')
        name_parts = full_name.strip().split(' ', 1) if full_name else ['', '']
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        # Берём пароль из запроса или генерируем
        password = request.data.get('password', '').strip()
        if not password:
            password = f"master{random.randint(100, 999)}"

        # Генерируем username из ФИО или случайный
        username = request.data.get('username', '').strip()
        if not username:
            base = (first_name[:1] + last_name).lower() if last_name else first_name.lower()
            username = base
            # Уникализируем, если такой username уже есть
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base}{counter}"
                counter += 1

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        # Создаём UserProfile для роли
        UserProfile.objects.get_or_create(
            user=user,
            defaults={'role': 'master', 'phone': request.data.get('phone', '')}
        )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        master = serializer.save(user=user)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def locations(self, request):
        """Координаты всех мастеров (телефон + Traccar-маяк)"""
        masters = Master.objects.select_related('traccar_device', 'user').all()
        user = request.user
        if not user.is_staff:
            try:
                masters = masters.filter(id=user.master_profile.id)
            except Master.DoesNotExist:
                masters = Master.objects.none()

        result = []
        for master in masters:
            lat = lon = speed = None
            is_online = False
            last_update = None
            loc_source = None

            try:
                device = master.traccar_device
                if device and device.last_latitude is not None:
                    lat, lon, speed = device.last_latitude, device.last_longitude, device.last_speed
                    is_online = device.is_online
                    last_update = device.last_update.isoformat() if device.last_update else None
                    loc_source = 'traccar'
            except Exception:
                pass

            if loc_source is None:
                last_hist = OrderHistory.objects.filter(
                    order__master=master, master_lat__isnull=False, master_lon__isnull=False
                ).order_by('-changed_at').first()
                if last_hist:
                    lat, lon = last_hist.master_lat, last_hist.master_lon
                    last_update = last_hist.changed_at.isoformat() if last_hist.changed_at else None
                    loc_source = 'phone'
                    is_online = (timezone.now() - last_hist.changed_at).total_seconds() < 3600

            if lat is not None and lon is not None:
                result.append({
                    'master_id': master.id, 'master_name': str(master),
                    'lat': lat, 'lon': lon, 'speed': speed,
                    'is_online': is_online, 'last_update': last_update, 'source': loc_source,
                })

        return Response(result)

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Статистика по мастеру за месяц"""
        master = self.get_object()
        from datetime import date

        month = request.query_params.get('month', date.today().strftime('%Y-%m'))
        year, month_num = map(int, month.split('-'))

        orders = Order.objects.filter(
            master=master,
            created_at__year=year,
            created_at__month=month_num
        )

        completed = orders.filter(status='completed')
        now = timezone.now()
        overdue = orders.filter(status__in=['assigned', 'accepted', 'in_progress', 'paused', 'need_help'], deadline__lt=now)

        # Среднее время выполнения (в часах)
        avg_hours = 0
        count_completed = completed.count()
        if count_completed > 0:
            total_seconds = sum(
                (o.completed_at - o.started_at).total_seconds()
                for o in completed
                if o.started_at and o.completed_at
            )
            avg_hours = round(total_seconds / 3600 / count_completed, 1)

        total_cost = completed.aggregate(s=Sum('cost'))['s'] or 0

        by_type = {}
        for t in ['repair', 'connection', 'sale']:
            by_type[t] = orders.filter(order_type=t).count()

        return Response({
            'master_id': master.id,
            'master_name': str(master),
            'total_orders': orders.count(),
            'completed_orders': count_completed,
            'overdue_orders': overdue.count(),
            'avg_completion_hours': avg_hours,
            'total_cost': float(total_cost),
            'by_type': by_type,
            'month': month,
        })

    @action(detail=True, methods=['post'])
    def update_gps(self, request, pk=None):
        """Запросить актуальные GPS-координаты мастера из Traccar"""
        import requests
        master = self.get_object()
        try:
            device = master.traccar_device
        except Exception:
            return Response({'error': 'У мастера не привязан GPS-трекер'}, status=400)

        settings = TraccarSettings.objects.first()
        if not settings or not settings.is_active:
            return Response({'error': 'Интеграция Traccar не активна'}, status=400)

        try:
            resp = requests.get(
                f"{settings.server_url.rstrip('/')}/api/positions",
                auth=(settings.username, settings.password),
                params={'deviceId': device.internal_device_id},
                timeout=10
            )
            if resp.status_code == 200 and resp.json():
                pos = resp.json()[0]
                device.last_latitude = pos.get('latitude')
                device.last_longitude = pos.get('longitude')
                device.last_speed = round(pos.get('speed', 0) * 1.852, 1) if pos.get('speed') else None
                device.last_update = timezone.now()
                device.is_online = True
                device.save()
                return Response({
                    'ok': True,
                    'latitude': device.last_latitude,
                    'longitude': device.last_longitude,
                    'speed': device.last_speed,
                    'is_online': device.is_online,
                    'last_update': device.last_update.isoformat() if device.last_update else None,
                })
            return Response({'error': 'Нет данных с устройства', 'is_online': False}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка связи с Traccar: {e}'}, status=500)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['region', 'is_legal']
    search_fields = ['name', 'phone', 'email', 'address', 'inn']

    def get_queryset(self):
        queryset = Client.objects.all()
        user = self.request.user

        # Если не администратор, показываем только клиентов своего региона
        if user.is_authenticated and not user.is_staff:
            try:
                master = user.master_profile
                if master.region:
                    return queryset.filter(region=master.region)
            except Master.DoesNotExist:
                pass

        return queryset

    @action(detail=False, methods=['get'])
    def autocomplete(self, request):
        """
        Быстрый поиск клиентов для автокомплита.
        Ищет по: адресу, названию юрлица, ИНН, ФИО, телефону.
        Параметр: ?q=поисковый_запрос (минимум 2 символа)
        Возвращает до 15 результатов.
        """
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])

        from django.db.models import Q

        clients = Client.objects.filter(
            Q(name__icontains=q) |
            Q(phone__icontains=q) |
            Q(address__icontains=q) |
            Q(inn__icontains=q) |
            Q(legal_address__icontains=q)
        ).order_by('name')[:15]

        # Возвращаем только нужные поля для автокомплита
        data = []
        for c in clients:
            label = c.name
            sub = c.address or c.phone or ''
            if c.is_legal:
                label = f'{c.name} (ИНН {c.inn})' if c.inn else c.name
                sub = c.legal_address or c.address or ''

            data.append({
                'id': c.id,
                'label': label,
                'sub': sub,
                'name': c.name,
                'phone': c.phone,
                'address': c.address,
                'inn': c.inn,
                'is_legal': c.is_legal,
                'personal_account_number': c.personal_account_number,
            })

        return Response(data)
    @action(detail=False, methods=['get'])
    def street_autocomplete(self, request):
        """Умный поиск: улица → номера домов из базы.
        ?q=Стрельнин — вернёт улицы; ?q=Стрельнинское&house=6 — дома."""
        q = request.query_params.get('q', '').strip()
        house_filter = request.query_params.get('house', '').strip()
        if not q or len(q) < 2:
            return Response([])

        if house_filter:
            buildings = Building.objects.filter(
                street_name__icontains=q, house_number__icontains=house_filter
            ).order_by('street_name', 'house_number').distinct('street_name', 'house_number', 'building_number')[:20]
            result, seen = [], set()
            for b in buildings:
                key = f'{b.house_number}|{b.building_number}'
                if key not in seen:
                    seen.add(key)
                    label = f'д. {b.house_number}'
                    if b.building_number:
                        label += f' корп. {b.building_number}'
                    result.append({'id': b.id, 'label': label, 'sub': f'{b.street_name}'})
            return Response(result)

        buildings = Building.objects.filter(street_name__icontains=q).order_by('street_name').distinct('street_name')[:12]
        result, seen = [], set()
        for b in buildings:
            if b.street_name not in seen:
                seen.add(b.street_name)
                cnt = Building.objects.filter(street_name=b.street_name).count()
                result.append({'id': b.id, 'label': b.street_name, 'sub': f'{cnt} домов', 'street': b.street_name})
        return Response(result)




    @action(detail=True, methods=['get'])
    def erc_payments(self, request, pk=None):
        """Возвращает историю платежей ЕРЦ для клиента (по personal_account_number)."""
        client = self.get_object()
        if not client.personal_account_number:
            return Response([])

        from .models import ErcBillingRecord
        records = ErcBillingRecord.objects.filter(
            account__account_number=client.personal_account_number
        ).order_by('-period')

        from .serializers import ErcBillingRecordSerializer
        return Response(ErcBillingRecordSerializer(records, many=True).data)


    @action(detail=False, methods=['get'])
    def address_suggest(self, request):
        """Адресные подсказки через DaData. Параметр: ?q=улица Ленина"""
        import requests
        q = request.query_params.get('q', '').strip()
        if len(q) < 3:
            return Response([])

        settings = SystemSettings.objects.first()
        token = settings.dadata_token if settings else ''
        if not token:
            return Response([])

        try:
            resp = requests.post(
                'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
                json={'query': q, 'count': 7},
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': f'Token {token}'
                },
                timeout=5
            )
            data = resp.json()
            suggestions = []
            for s in data.get('suggestions', []):
                suggestions.append({
                    'value': s.get('value', ''),
                    'unrestricted_value': s.get('unrestricted_value', ''),
                    'data': {
                        'city': s.get('data', {}).get('city', ''),
                        'street': s.get('data', {}).get('street', ''),
                        'house': s.get('data', {}).get('house', ''),
                        'flat': s.get('data', {}).get('flat', ''),
                    }
                })
            return Response(suggestions)
        except Exception:
            return Response([])



class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['client', 'status', 'equipment_type']
    search_fields = ['name', 'serial_number']

    def get_queryset(self):
        queryset = Equipment.objects.all()
        user = self.request.user

        # Если не администратор, показываем только оборудование клиентов своего региона
        if user.is_authenticated and not user.is_staff:
            try:
                master = user.master_profile
                if master.region:
                    return queryset.filter(client__region=master.region)
            except Master.DoesNotExist:
                pass

        return queryset


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'order_type', 'priority', 'master', 'region', 'client']
    search_fields = ['number', 'address', 'description', 'city', 'street_name', 'client__first_name', 'client__last_name']
    ordering_fields = ['created_at', 'priority', 'status', 'cost', 'master__user__last_name', 'region__name', 'address', 'city', 'street_name', 'number', 'order_type']

    def get_queryset(self):
        queryset = Order.objects.all()
        user = self.request.user

        if not user.is_authenticated:
            return Order.objects.none()

        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            return Order.objects.none()

        role = profile.role

        # Админ, диспетчер, главный инженер, техдиректор, исполнительный, гендиректор — видят все заявки
        if role in ('admin', 'dispatcher', 'chief_engineer', 'tech_director', 'executive_director', 'general_director'):
            return queryset

        # Мастер, монтажник — только свои
        if role in ('master', 'installer'):
            try:
                master = user.master_profile
                return queryset.filter(Q(master=master) | Q(helpers=user)).distinct()
            except Master.DoesNotExist:
                return Order.objects.none()

        # Инженер, начальник сервисной службы — заявки где нужна помощь или они помощники
        if role in ('engineer', 'supervisor'):
            return queryset.filter(
                Q(status='need_help') | Q(master__user=user) | Q(helpers=user)
            )

        # Помощники в любых ролях видят свои заявки
        return queryset.filter(Q(helpers=user) | Q(master__user=user)).distinct()

    def create(self, request, *args, **kwargs):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # Создаем запись в истории
        OrderHistory.objects.create(
            order=order,
            changed_by=request.user,
            old_status='',
            new_status=order.status
        )

        # Уведомляем диспетчеров и админов о новой заявке
        from django.contrib.auth.models import User
        staff_users = User.objects.filter(
            profile__role__in=['admin', 'dispatcher', 'secretary', 'operator']
        ).exclude(id=request.user.id)
        for u in staff_users:
            try:
                send_push_notification(
                    u.id,
                    '🆕 Новая заявка',
                    f'#{order.number} — {order.get_order_type_display()}, {order.address or order.full_address}'
                )
            except Exception:
                pass

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = OrderStatusUpdateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        new_status = request.data.get('status', instance.status)
        user = request.user

        # Мастер не может подтверждать заявку — только диспетчер/админ
        if new_status == 'confirmed' and not user.is_staff:
            return Response(
                {'error': 'Только диспетчер или администратор может подтвердить выполнение заявки'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Мастер не может редактировать выполненную заявку
        if instance.status == 'completed' and not user.is_staff:
            return Response(
                {'error': 'Выполненная заявка недоступна для редактирования. Ожидайте подтверждения диспетчера.'},
                status=status.HTTP_403_FORBIDDEN
            )

        old_status = instance.status
        old_master_id = instance.master_id
        notes = request.data.get('notes', '')
        order = serializer.save()

        # Если статус изменился, создаем запись в истории
        if old_status != order.status:
            # Авто-захват GPS из трекера мастера, если не переданы явно
            master_lat = request.data.get('master_lat')
            master_lon = request.data.get('master_lon')
            if (not master_lat or not master_lon) and order.master:
                try:
                    device = order.master.traccar_device
                    if device and device.last_latitude is not None:
                        master_lat = device.last_latitude
                        master_lon = device.last_longitude
                except Exception:
                    pass

            OrderHistory.objects.create(
                order=order,
                changed_by=request.user,
                old_status=old_status,
                new_status=order.status,
                notes=notes,
                master_lat=master_lat,
                master_lon=master_lon,
            )

            now = timezone.now()
            status_time_map = {
                'assigned': 'assigned_at',
                'accepted': 'accepted_at',
                'in_progress': 'started_at',
                'paused': 'paused_at',
                'completed': 'completed_at',
                'confirmed': 'confirmed_at',
            }

            # Если переводим в completed и foto_report_required — проверяем медиа
            if order.status == 'completed' and order.photo_report_required:
                if not order.media.exists():
                    return Response(
                        {'error': 'Для этой заявки требуется фото/видео отчёт. Прикрепите файлы перед завершением.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            field = status_time_map.get(order.status)
            if field and not getattr(order, field):
                setattr(order, field, now)

            # Если на паузе или завершена — обязательный комментарий
            if order.status == 'paused' and not notes:
                return Response(
                    {'error': 'Для статуса "На паузе" обязательно укажите причину (notes)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if order.status == 'completed' and not notes:
                return Response(
                    {'error': 'Для завершения заявки обязательно оставьте комментарий о проделанной работе'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # GPS-позиция мастера при смене статуса
            master_lat = request.data.get('master_lat')
            master_lon = request.data.get('master_lon')

            # Если заявка подтверждена — запоминаем, кто подтвердил
            if order.status == 'confirmed' and not order.confirmed_by:
                order.confirmed_by = request.user

            order.save()

        # Если переназначили мастера
        if order.master_id and order.master_id != old_master_id:
            old_master_name = str(Master.objects.get(id=old_master_id)) if old_master_id else '—'
            OrderHistory.objects.create(
                order=order,
                changed_by=request.user,
                old_status=old_status,
                new_status=order.status,
                notes=f'Мастер переназначен: {old_master_name} → {order.master}'
            )

        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Календарь: заявки с датой scheduled_at"""
        user = request.user
        qs = Order.objects.filter(scheduled_at__isnull=False).exclude(status__in=['cancelled', 'confirmed'])
        if not user.is_staff:
            try:
                master = user.master_profile
                qs = qs.filter(master=master)
            except Master.DoesNotExist:
                qs = qs.filter(helpers=user)
        return Response([{
            'id': o.id, 'number': o.number, 'order_type': o.order_type,
            'status': o.status,
            'address': o.address or o.full_address,
            'master': o.master.user.get_full_name() or o.master.user.username if o.master else None,
            'client': o.client.name if o.client else None,
            'scheduled_at': o.scheduled_at.isoformat() if o.scheduled_at else None,
            'priority': o.priority,
        } for o in qs.order_by('scheduled_at')])

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Назначить заявку сотруднику (мастер, монтажник, инженер и др.)"""
        order = self.get_object()
        master_id = request.data.get('master_id')  # старый параметр
        user_id = request.data.get('user_id')  # новый параметр — любой сотрудник
        scheduled_at = request.data.get('scheduled_at')

        master = None
        assigned_name = 'Неизвестный'

        # Поддержка user_id (любой сотрудник)
        if user_id:
            try:
                assigned_user = User.objects.get(id=user_id)
                # Ищем или создаём Master для этого пользователя
                master, _ = Master.objects.get_or_create(
                    user=assigned_user,
                    defaults={'phone': getattr(assigned_user.profile, 'phone', ''), 'region': Region.objects.first()}
                )
                assigned_name = assigned_user.get_full_name() or assigned_user.username
            except User.DoesNotExist:
                return Response({'error': 'Сотрудник не найден'}, status=404)
        elif master_id:
            try:
                master = Master.objects.get(id=master_id)
                assigned_name = str(master)
            except Master.DoesNotExist:
                return Response({'error': 'Мастер не найден'}, status=404)
        else:
            return Response({'error': 'Не указан ID сотрудника (user_id или master_id)'}, status=400)

        old_status = order.status
        order.master = master
        order.status = 'assigned'
        order.assigned_at = timezone.now()

        if scheduled_at:
            order.scheduled_at = scheduled_at
        order.save()

        OrderHistory.objects.create(
            order=order, changed_by=request.user,
            old_status=old_status, new_status=order.status,
            notes=f'Заявка назначена: {assigned_name}'
        )

        # Уведомление сотруднику
        if master:
            send_push_notification(master.user_id,
                'Новая заявка',
                f'#{order.number} — {order.get_order_type_display()}, {order.address}')

        if order.client:
            try:
                from .max_service import notify_client_order_assigned
                notify_client_order_assigned(
                    client_id=order.client_id,
                    order_number=order.number,
                    order_type=order.get_order_type_display(),
                    address=order.full_address,
                    master_name=assigned_name,
                    master_phone=master.phone if master else 'не указан',
                )
            except Exception:
                pass

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Начать выполнение заявки"""
        order = self.get_object()

        if order.status != 'assigned':
            return Response(
                {'error': 'Нельзя начать заявку, которая не назначена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = order.status
        order.status = 'in_progress'
        order.started_at = timezone.now()
        order.save()

        OrderHistory.objects.create(
            order=order,
            changed_by=request.user,
            old_status=old_status,
            new_status=order.status,
            notes='Начато выполнение заявки'
        )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Завершить заявку"""
        order = self.get_object()

        if order.status not in ['assigned', 'in_progress']:
            return Response({'error': 'Нельзя завершить заявку в текущем статусе'}, status=400)

        old_status = order.status
        order.status = 'completed'
        order.completed_at = timezone.now()
        order.save()

        OrderHistory.objects.create(
            order=order, changed_by=request.user,
            old_status=old_status, new_status=order.status,
            notes=request.data.get('notes', 'Заявка выполнена')
        )

        # Клиенту НЕ отправляем — ждём подтверждения диспетчером (confirm)

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def receive_payment(self, request, pk=None):
        """Мастер принимает оплату от клиента (нал/безнал/перевод)"""
        order = self.get_object()
        amount = request.data.get('amount')
        method = request.data.get('payment_method', 'cash')
        if not amount:
            return Response({'error': 'Укажите amount'}, status=400)
        try:
            master = request.user.master_profile
        except Exception:
            return Response({'error': 'Только мастер может принимать оплату'}, status=403)
        # Создаём платёж
        payment = Payment.objects.create(
            order=order, amount=float(amount), payment_method=method,
            collected_by_master=master, collected_by_master_at=timezone.now(),
            is_submitted_to_office=False, received_by=request.user
        )
        # Если наличные — создаём долг мастеру
        if method == 'cash':
            MasterCashDebt.objects.create(
                master=master, order=order, amount=float(amount),
                notes=f'Наличные от клиента по заявке {order.number}'
            )
        return Response({'ok': True, 'payment_id': payment.id})

    @action(detail=True, methods=['post'])
    def submit_cash(self, request, pk=None):
        """Мастер сдал наличные в кассу"""
        debt = MasterCashDebt.objects.filter(order_id=pk, is_paid_to_office=False).first()
        if not debt:
            return Response({'error': 'Нет неоплаченного долга по этой заявке'}, status=404)
        debt.is_paid_to_office = True
        debt.paid_to_office_at = timezone.now()
        debt.accepted_by = request.user
        debt.save()
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def return_item(self, request, pk=None):
        """Мастер возвращает сломанное/старое оборудование на склад"""
        debt = MasterInventoryDebt.objects.filter(order_id=pk, is_returned=False).first()
        if not debt:
            return Response({'error': 'Нет невозвращённого оборудования по этой заявке'}, status=404)
        debt.is_returned = True
        debt.returned_at = timezone.now()
        debt.accepted_by = request.user
        debt.condition = request.data.get('condition', 'broken')
        debt.save()
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def helpers(self, request, pk=None):
        """Добавить/убрать помощников к заявке"""
        order = self.get_object()
        helper_ids = request.data.get('helper_ids', [])
        if not helper_ids:
            return Response({'error': 'Укажите helper_ids (список ID пользователей)'}, status=400)
        from django.contrib.auth.models import User as AuthUser
        users = AuthUser.objects.filter(id__in=helper_ids)
        order.helpers.set(users)
        return Response({
            'ok': True,
            'helpers': [{'id': u.id, 'username': u.username, 'full_name': u.get_full_name() or u.username} for u in users]
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Отменить заявку"""
        order = self.get_object()
        if order.status == 'cancelled':
            return Response({'error': 'Заявка уже отменена'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = order.status
        order.status = 'cancelled'
        order.save()
        OrderHistory.objects.create(
            order=order, changed_by=request.user,
            old_status=old_status, new_status=order.status,
            notes=request.data.get('notes', 'Заявка отменена')
        )
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Диспетчер/админ подтверждает выполнение заявки"""
        order = self.get_object()
        if not request.user.is_staff:
            return Response({'error': 'Только диспетчер или администратор может подтвердить заявку'}, status=403)

        if order.status != 'completed':
            return Response({'error': 'Подтвердить можно только выполненную заявку'}, status=400)

        order.status = 'confirmed'
        order.confirmed_at = timezone.now()
        order.confirmed_by = request.user
        order.save()
        OrderHistory.objects.create(
            order=order, changed_by=request.user,
            old_status='completed', new_status='confirmed',
            notes=request.data.get('notes', 'Заявка подтверждена диспетчером')
        )

        # Списываем материалы с мастера — закрываем расходные ордера по заявке
        from .models import IssueOrder, IssueOrderItem, InventoryItem, InventoryMovement
        for io in order.issue_orders.filter(status__in=['pending', 'received', 'partially_used']):
            for ioi in io.items.all():
                if ioi.quantity_used == 0:
                    ioi.quantity_used = ioi.quantity_issued
                    ioi.save()
                if ioi.quantity_used > 0:
                    ioi.inventory_item.status = 'installed'
                    ioi.inventory_item.save(update_fields=['status', 'updated_at'])
                    InventoryMovement.objects.create(
                        item=ioi.inventory_item,
                        movement_type='installed',
                        quantity=ioi.quantity_used,
                        master=io.master,
                        order=order,
                        performed_by=request.user,
                        notes=f'Списание по заявке #{order.number}'
                    )
            io.status = 'fully_used'
            io.completed_at = timezone.now()
            io.save()

        # Max-уведомление клиенту: заявка подтверждена диспетчером
        if order.client:
            try:
                from .max_service import notify_client_order_confirmed
                media_files = order.media.all()
                has_photos = any(m.file_type == 'image' for m in media_files)
                has_videos = any(m.file_type == 'video' for m in media_files)
                master_name = order.master.user.get_full_name() or order.master.user.username if order.master else '—'
                notify_client_order_confirmed(
                    client_id=order.client_id,
                    order_number=order.number,
                    order_type=order.get_order_type_display(),
                    address=order.full_address,
                    has_photos=has_photos,
                    has_videos=has_videos,
                    master_name=master_name,
                )
            except Exception:
                pass

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def rework(self, request, pk=None):
        """Диспетчер/админ возвращает заявку в работу (клиент недоволен)"""
        order = self.get_object()
        if not request.user.is_staff:
            return Response({'error': 'Только диспетчер или администратор может вернуть заявку'}, status=403)

        if order.status != 'completed':
            return Response({'error': 'Вернуть можно только выполненную заявку'}, status=400)

        notes = request.data.get('notes', '')
        if not notes:
            return Response({'error': 'Укажите причину возврата (notes) — что нужно доделать'}, status=400)

        order.status = 'in_progress'
        order.completed_at = None
        order.save()
        OrderHistory.objects.create(
            order=order, changed_by=request.user,
            old_status='completed', new_status='in_progress',
            notes=f'Возвращено в работу. Причина: {notes}'
        )
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['get'])
    def gps_history(self, request, pk=None):
        """GPS-история мастера по заявке (координаты на момент смены статусов)"""
        order = self.get_object()
        if not order.master:
            return Response({'error': 'У заявки нет назначенного мастера'}, status=400)
        try:
            device = order.master.traccar_device
        except Exception:
            return Response({'error': 'У мастера не привязан GPS-трекер'}, status=400)

        # Собираем точки: координаты мастера на каждый момент истории
        history = OrderHistory.objects.filter(order=order).order_by('changed_at')
        result = []
        for h in history:
            result.append({
                'status': h.new_status,
                'changed_at': h.changed_at.isoformat() if h.changed_at else None,
                'lat': h.master_lat,
                'lon': h.master_lon,
            })

        # Текущая позиция мастера
        current = {
            'lat': device.last_latitude,
            'lon': device.last_longitude,
            'speed': device.last_speed,
            'is_online': device.is_online,
            'last_update': device.last_update.isoformat() if device.last_update else None,
        }

        return Response({'history': result, 'current': current})

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        """Комментарии/диалог внутри заявки"""
        order = self.get_object()

        if request.method == 'GET':
            qs = order.comments.select_related('author').order_by('created_at')
            return Response(OrderCommentSerializer(qs, many=True).data)

        # POST — добавить комментарий
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'Текст комментария обязателен'}, status=status.HTTP_400_BAD_REQUEST)

        event_type = request.data.get('event_type', 'comment')
        comment = OrderComment.objects.create(
            order=order,
            author=request.user,
            text=text,
            event_type=event_type
        )

        # Уведомляем всех, кто вовлечён в заявку (кроме автора)
        recipients = set()
        if order.master and order.master.user_id != request.user.id:
            recipients.add(order.master.user_id)
        for h in order.helpers.exclude(id=request.user.id):
            recipients.add(h.id)
        # Диспетчеры и админы тоже получают уведомление
        from django.contrib.auth.models import User as AuthUser
        staff = AuthUser.objects.filter(
            profile__role__in=['admin', 'dispatcher']
        ).exclude(id=request.user.id).values_list('id', flat=True)
        recipients.update(staff)

        for uid in recipients:
            try:
                send_push_notification(
                    uid,
                    f'💬 Заявка #{order.number}',
                    f'{request.user.get_full_name() or request.user.username}: {text[:100]}'
                )
            except Exception:
                pass

        return Response(OrderCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['report_type', 'status']
    search_fields = ['title']

    def get_queryset(self):
        queryset = Report.objects.all()
        user = self.request.user

        # Администратор и диспетчер видят все отчёты, мастер — только свои
        if user.is_authenticated:
            if user.is_staff:
                return queryset
            return queryset.filter(created_by=user)

        return queryset.none()

    @action(detail=False, methods=['post'])
    def generate_daily(self, request):
        """Сгенерировать ежедневный отчет"""
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        # Подсчет статистики
        orders_today = Order.objects.filter(created_at__date=today)
        orders_yesterday = Order.objects.filter(created_at__date=yesterday)
        completed_today = Order.objects.filter(status='completed', completed_at__date=today)
        new_orders = Order.objects.filter(status='new')
        in_progress = Order.objects.filter(status='in_progress')

        report_data = {
            'date': today.isoformat(),
            'summary': {
                'total_orders_today': orders_today.count(),
                'completed_today': completed_today.count(),
                'new_orders': new_orders.count(),
                'in_progress': in_progress.count(),
            },
            'orders': {
                'today': [
                    {
                        'number': order.number,
                        'type': order.get_order_type_display(),
                        'client': order.client.name,
                        'status': order.get_status_display()
                    }
                    for order in orders_today[:10]
                ],
                'completed_today': [
                    {
                        'number': order.number,
                        'completed_at': order.completed_at.isoformat() if order.completed_at else None
                    }
                    for order in completed_today
                ],
            }
        }

        report = Report.objects.create(
            title=f'Ежедневный отчет {today}',
            report_type='daily',
            period_start=today,
            period_end=today,
            data=report_data,
            created_by=request.user
        )

        return Response(ReportSerializer(report).data)

    @action(detail=False, methods=['post'])
    def generate_master_performance(self, request):
        """Сгенерировать отчет по производительности мастеров"""
        from datetime import date

        period_start = request.data.get('period_start', date.today().isoformat())
        period_end = request.data.get('period_end', date.today().isoformat())

        masters = Master.objects.all()
        master_stats = []

        for master in masters:
            orders = Order.objects.filter(
                master=master,
                created_at__date__gte=period_start,
                created_at__date__lte=period_end
            )

            completed = orders.filter(status='completed').count()
            total = orders.count()
            avg_completion_time = 0

            if completed > 0:
                from django.db.models import Avg
                completed_orders = orders.filter(completed_at__isnull=False)
                avg_completion_time = completed_orders.aggregate(
                    avg_time=Avg('completed_at')
                )['avg_time']

            master_stats.append({
                'master_id': master.id,
                'master_name': str(master),
                'total_orders': total,
                'completed_orders': completed,
                'completion_rate': (completed / total * 100) if total > 0 else 0,
                'avg_completion_time_hours': avg_completion_time
            })

        report_data = {
            'period_start': period_start,
            'period_end': period_end,
            'master_stats': master_stats
        }

        report = Report.objects.create(
            title=f'Отчет по производительности мастеров ({period_start} - {period_end})',
            report_type='custom',
            period_start=period_start,
            period_end=period_end,
            data=report_data,
            created_by=request.user
        )

        return Response(ReportSerializer(report).data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Сводка: мастера + диспетчеры"""
        today = timezone.localdate()
        month_start = today.replace(day=1)

        masters = Master.objects.all()
        master_stats = []
        for master in masters:
            orders = Order.objects.filter(master=master)
            month_orders = orders.filter(created_at__date__gte=month_start)
            total = month_orders.count()
            accepted = month_orders.filter(status__in=['accepted', 'in_progress', 'paused', 'need_help', 'completed', 'confirmed']).count()
            completed = month_orders.filter(status__in=['completed', 'confirmed']).count()
            in_work = orders.filter(status__in=['assigned', 'accepted', 'in_progress', 'paused', 'need_help']).count()
            try:
                from .models import TraccarMileage
                mileage = TraccarMileage.objects.filter(master=master, synced_at__date__gte=month_start).aggregate(s=Sum('distance_km'))['s'] or 0
            except Exception:
                mileage = 0
            master_stats.append({
                'master_id': master.id, 'master_name': str(master),
                'total_month': total, 'accepted': accepted, 'completed': completed,
                'in_work': in_work, 'completion_rate': round(completed / total * 100, 1) if total > 0 else 0,
                'mileage_km': round(mileage, 1),
            })

        dps = UserProfile.objects.filter(role='dispatcher')
        dp_stats = []
        for dp in dps:
            created = Order.objects.filter(confirmed_by=dp.user, created_at__date__gte=month_start).count()
            confirmed = Order.objects.filter(confirmed_by=dp.user, status='confirmed', confirmed_at__date__gte=month_start).count()
            dp_stats.append({'dispatcher_id': dp.user.id, 'name': str(dp.user), 'created_orders': created, 'confirmed_orders': confirmed})

        return Response({'date': today.isoformat(), 'masters': master_stats, 'dispatchers': dp_stats})


class BuildingViewSet(viewsets.ModelViewSet):
    """Дома (обслуживаемые адреса)"""
    queryset = Building.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['region', 'city', 'street_type', 'equipment_type']
    search_fields = ['street_name', 'house_number', 'building_number', 'city', 'notes']
    ordering_fields = ['street_name', 'house_number', 'created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BuildingDetailSerializer
        return BuildingSerializer

    def get_queryset(self):
        queryset = Building.objects.all()
        user = self.request.user

        # Мастер видит дома своего региона
        if user.is_authenticated and not user.is_staff:
            try:
                master = user.master_profile
                if master.region:
                    return queryset.filter(region=master.region)
            except Master.DoesNotExist:
                pass
        return queryset


class TraccarSettingsViewSet(viewsets.ModelViewSet):
    """Настройки интеграции с Traccar GPS (только один объект)"""
    queryset = TraccarSettings.objects.all()
    serializer_class = TraccarSettingsSerializer

    def list(self, request, *args, **kwargs):
        # Всегда возвращаем один объект настроек
        settings = TraccarSettings.objects.first()
        if not settings:
            settings = TraccarSettings.objects.create(
                server_url='http://localhost:8082',
                username='',
                password='',
                is_active=False,
                sync_interval_minutes=5
            )
        return Response(self.get_serializer(settings).data)

    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """Проверка соединения с сервером Traccar"""
        import requests
        settings = TraccarSettings.objects.first()
        if not settings:
            return Response({'error': 'Настройки не найдены'}, status=400)

        try:
            resp = requests.get(
                f"{settings.server_url.rstrip('/')}/api/server",
                auth=(settings.username, settings.password),
                timeout=5
            )
            return Response({'ok': resp.status_code == 200, 'status': resp.status_code, 'version': resp.json().get('version', '?')})
        except Exception as e:
            return Response({'ok': False, 'error': str(e)})

    @action(detail=False, methods=['post'])
    def discover(self, request):
        """Поиск устройств в Traccar и авто-заполнение internal_device_id"""
        import requests
        settings = TraccarSettings.objects.first()
        if not settings or not settings.is_active:
            return Response({'error': 'Интеграция не активна'}, status=400)

        try:
            resp = requests.get(
                f"{settings.server_url.rstrip('/')}/api/devices",
                auth=(settings.username, settings.password),
                timeout=10
            )
            if resp.status_code == 200:
                devices = resp.json()
                result = [{'id': d['id'], 'name': d['name'], 'uniqueId': d['uniqueId']} for d in devices]
                return Response({'count': len(result), 'devices': result})
            return Response({'error': f'Status {resp.status_code}'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class TraccarDeviceViewSet(viewsets.ModelViewSet):
    """GPS-устройства мастеров (привязка к Traccar)"""
    queryset = TraccarDevice.objects.all()
    serializer_class = TraccarDeviceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['master', 'is_online']
    search_fields = ['device_name', 'master__user__first_name', 'master__user__last_name']

    def create(self, request, *args, **kwargs):
        """Привязка GPS-устройства: по unique_id авто-находим internal_device_id"""
        import requests
        unique_id = str(request.data.get('unique_id', '')).strip()
        master_id = request.data.get('master_id')

        if not unique_id or not master_id:
            return Response({'error': 'unique_id и master_id обязательны'}, status=400)

        settings = TraccarSettings.objects.first()
        internal_id = None
        device_name = request.data.get('device_name', '')

        if settings and settings.is_active:
            try:
                resp = requests.get(
                    f"{settings.server_url.rstrip('/')}/api/devices",
                    auth=(settings.username, settings.password),
                    timeout=10
                )
                if resp.status_code == 200:
                    for dev in resp.json():
                        if str(dev.get('uniqueId', '')) == unique_id:
                            internal_id = dev['id']
                            device_name = device_name or dev.get('name', '')
                            break
            except Exception as e:
                return Response({'error': f'Ошибка связи с Traccar: {e}'}, status=400)

        if not internal_id:
            return Response(
                {'error': f'Устройство с uniqueId={unique_id} не найдено в Traccar. Проверьте настройки подключения.'},
                status=400
            )

        device = TraccarDevice.objects.create(
            master=Master.objects.get(id=master_id),
            internal_device_id=internal_id,
            unique_id=unique_id,
            device_name=device_name,
        )
        return Response(self.get_serializer(device).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def sync_position(self, request, pk=None):
        """Синхронизировать позицию устройства из Traccar"""
        import requests
        device = self.get_object()
        settings = TraccarSettings.objects.first()
        if not settings or not settings.is_active:
            return Response({'error': 'Интеграция не активна'}, status=400)

        try:
            resp = requests.get(
                f"{settings.server_url.rstrip('/')}/api/positions",
                auth=(settings.username, settings.password),
                params={'deviceId': device.internal_device_id},
                timeout=10
            )
            if resp.status_code == 200 and resp.json():
                pos = resp.json()[0]
                device.last_latitude = pos.get('latitude')
                device.last_longitude = pos.get('longitude')
                device.last_speed = round(pos.get('speed', 0) * 1.852, 1) if pos.get('speed') else None
                device.last_update = timezone.now()
                device.is_online = True
                device.save()
                return Response(self.get_serializer(device).data)
            return Response({'error': 'Нет данных с устройства'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class SystemSettingsViewSet(viewsets.ViewSet):
    """Системные настройки и операции"""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        settings, _ = SystemSettings.objects.get_or_create()
        return Response(SystemSettingsSerializer(settings).data)

    def update(self, request, pk=None):
        settings = SystemSettings.objects.first()
        if not settings:
            settings = SystemSettings.objects.create()
        serializer = SystemSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def lookup_company_by_inn(self, request):
        """Поиск компании по ИНН через DaData API"""
        import requests
        inn = request.query_params.get('inn', '').strip()
        if not inn or len(inn) < 10:
            return Response({'error': 'Укажите ИНН (10 или 12 цифр)'}, status=400)

        settings = SystemSettings.objects.first()
        token = settings.dadata_token if settings else ''
        if not token:
            return Response({'error': 'Не настроен DaData API токен в системных настройках'}, status=400)

        try:
            resp = requests.post(
                'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',
                json={'query': inn},
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': f'Token {token}'
                },
                timeout=10
            )
            data = resp.json()
            suggestions = data.get('suggestions', [])
            if not suggestions:
                return Response({'found': False, 'message': 'Компания не найдена'})

            s = suggestions[0]
            d = s.get('data', {})
            return Response({
                'found': True,
                'name': d.get('name', {}).get('full_with_opf', '') or s.get('value', ''),
                'short_name': d.get('name', {}).get('short_with_opf', ''),
                'inn': d.get('inn', inn),
                'kpp': d.get('kpp', ''),
                'ogrn': d.get('ogrn', ''),
                'legal_address': d.get('address', {}).get('unrestricted_value', '') or d.get('address', {}).get('value', ''),
                'director': d.get('management', {}).get('name', ''),
                'director_post': d.get('management', {}).get('post', ''),
                'status': d.get('state', {}).get('status', ''),
            })
        except Exception as e:
            return Response({'error': f'Ошибка запроса к DaData: {str(e)}'}, status=500)

    @action(detail=False, methods=['get'])
    def check_update(self, request):
        """Проверить наличие обновлений на GitHub"""
        import requests, re, os
        settings = SystemSettings.objects.first()
        if not settings or not settings.git_repo_url:
            return Response({'has_update': False, 'error': 'Не настроен GitHub репозиторий'})

        repo_url = settings.git_repo_url.rstrip('/').replace('.git', '')
        branch = settings.git_branch or 'main'
        headers = {'Accept': 'application/vnd.github.v3+json'}
        if settings.git_token:
            headers['Authorization'] = f'Bearer {settings.git_token}'

        m = re.search(r'github\.com[:/]([^/]+)/([^/\s]+)', repo_url)
        if not m:
            return Response({'has_update': False, 'error': 'Неверный формат URL репозитория'})
        owner, repo = m.group(1), m.group(2)

        try:
            # Получаем последний коммит из GitHub API
            api_url = f'https://api.github.com/repos/{owner}/{repo}/commits/{branch}'
            resp = requests.get(api_url, headers=headers, timeout=15)
            if resp.status_code != 200:
                return Response({'has_update': False, 'error': f'GitHub API: {resp.status_code} {resp.json().get("message", "")}'})
            remote_sha = resp.json().get('sha', '')[:7]
            remote_full = resp.json().get('sha', '')

            # Читаем локальный HEAD из .git
            head_path = '/app/.git/refs/heads/' + branch
            local_sha = ''
            if os.path.exists(head_path):
                with open(head_path) as f:
                    local_sha = f.read().strip()[:7]
            else:
                # Пробуем HEAD или packed-refs
                head_file = '/app/.git/HEAD'
                if os.path.exists(head_file):
                    with open(head_file) as f:
                        ref = f.read().strip()
                    if ref.startswith('ref: '):
                        ref_path = '/app/.git/' + ref[5:]
                        if os.path.exists(ref_path):
                            with open(ref_path) as f:
                                local_sha = f.read().strip()[:7]

            has_update = bool(remote_full and local_sha and remote_full[:7] != local_sha[:7])
            settings.last_update_check = timezone.now()
            settings.latest_commit = local_sha or ''
            settings.save(update_fields=['last_update_check', 'latest_commit'])
            return Response({
                'has_update': has_update,
                'local': local_sha[:7] if local_sha else '?',
                'remote': remote_sha,
                'checked_at': settings.last_update_check.isoformat(),
            })
        except Exception as e:
            return Response({'has_update': False, 'error': str(e)})

    @action(detail=False, methods=['post'])
    def update_now(self, request):
        """Обновить CRM из GitHub (скачивание архива репозитория)"""
        import requests, re, tempfile, shutil, os, subprocess
        settings = SystemSettings.objects.first()
        if not settings or not settings.git_repo_url:
            return Response({'ok': False, 'error': 'Не настроен GitHub репозиторий'})

        repo_url = settings.git_repo_url.rstrip('/').replace('.git', '')
        branch = settings.git_branch or 'main'
        headers = {'Accept': 'application/vnd.github.v3+json'}
        if settings.git_token:
            headers['Authorization'] = f'Bearer {settings.git_token}'

        m = re.search(r'github\.com[:/]([^/]+)/([^/\s]+)', repo_url)
        if not m:
            return Response({'ok': False, 'error': 'Неверный формат URL репозитория'})
        owner, repo = m.group(1), m.group(2)

        try:
            # 1. Бэкап текущего backend
            backup_dir = '/app_backup_' + timezone.now().strftime('%Y%m%d_%H%M%S')
            shutil.copytree('/app', backup_dir, dirs_exist_ok=True, symlinks=True)
            settings.backup_path = backup_dir
            settings.save(update_fields=['backup_path'])

            # 2. Скачиваем архив
            archive_url = f'https://api.github.com/repos/{owner}/{repo}/zipball/{branch}'
            resp = requests.get(archive_url, headers=headers, timeout=120, stream=True)
            if resp.status_code != 200:
                return Response({'ok': False, 'error': f'GitHub API: {resp.status_code}'})

            tmp_zip = '/tmp/repo.zip'
            with open(tmp_zip, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)

            # 3. Распаковываем
            extract_dir = '/tmp/repo_extracted'
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)
            os.makedirs(extract_dir)
            subprocess.run(['unzip', '-q', tmp_zip, '-d', extract_dir], timeout=30)
            os.remove(tmp_zip)

            # 4. Копируем backend из архива
            src = extract_dir
            dirs = os.listdir(src)
            if dirs:
                src = os.path.join(src, dirs[0])  # GitHub вкладывает в папку owner-repo-hash

            backend_src = os.path.join(src, 'backend')
            if not os.path.exists(backend_src):
                return Response({'ok': False, 'error': 'В архиве нет папки backend'})

            # Копируем все кроме models.py (чтобы не затереть данные)
            for item in os.listdir(backend_src):
                s = os.path.join(backend_src, item)
                d = os.path.join('/app', item)
                if os.path.isdir(s):
                    if item == 'migrations':
                        continue  # Не заменяем миграции
                    if os.path.exists(d):
                        shutil.rmtree(d)
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)

            # Очистка
            shutil.rmtree(extract_dir)

            # 5. Собираем фронтенд если есть node
            if os.path.exists('/app/../frontend/package.json'):
                subprocess.run(
                    'cd /app/.. && npm install && npm run build',
                    shell=True, timeout=120, capture_output=True
                )

            # 6. Перезапускаем Django
            subprocess.run(['touch', '/app/main/wsgi.py'], timeout=5)

            settings.last_update_check = timezone.now()
            settings.latest_commit = ''
            settings.save(update_fields=['last_update_check', 'latest_commit'])
            return Response({'ok': True, 'message': 'CRM обновлена! Бэкенд перезапущен.', 'backup': backup_dir})
        except Exception as e:
            return Response({'ok': False, 'error': str(e)})

    @action(detail=False, methods=['post'])
    def backup_db(self, request):
        """Ручной бэкап базы данных"""
        import subprocess
        import os
        settings = SystemSettings.objects.first()
        path = settings.backup_path if settings else '/var/backups/crm/'
        os.makedirs(path, exist_ok=True)
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        filename = f'{path}crm_backup_{timestamp}.sql'

        try:
            result = subprocess.run(
                ['pg_dump', '-h', 'localhost', '-U', 'crm_user', '-d', 'crm', '-f', filename],
                env={**os.environ, 'PGPASSWORD': 'crm_pass'},
                capture_output=True, text=True, timeout=60
            )
            if result.returncode == 0:
                return Response({'ok': True, 'file': filename, 'message': 'Бэкап создан'})
            return Response({'ok': False, 'error': result.stderr}, status=500)
        except Exception as e:
            return Response({'ok': False, 'error': str(e)}, status=500)


class UserProfileViewSet(viewsets.ModelViewSet):
    """Управление пользователями (админы/диспетчеры/мастера)"""
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'is_on_shift']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']

    @action(detail=False, methods=['get'])
    def dispatcher_stats(self, request):
        dps = UserProfile.objects.filter(role='dispatcher')
        stats = []
        for dp in dps:
            confirmed = Order.objects.filter(confirmed_by=dp.user).count()
            stats.append({'id': dp.id, 'name': str(dp.user), 'confirmed_orders': confirmed, 'is_on_shift': dp.is_on_shift})
        return Response(stats)


class WorkShiftViewSet(viewsets.ModelViewSet):
    """Рабочие смены"""
    queryset = WorkShift.objects.all()
    serializer_class = WorkShiftSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user', 'is_active']

    @action(detail=False, methods=['post'])
    def start(self, request):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            UserProfile.objects.create(user=request.user, role='master')
            profile = request.user.profile
        if profile.is_on_shift:
            return Response({'error': 'Смена уже начата'}, status=400)
        profile.is_on_shift = True
        profile.shift_started_at = timezone.now()
        profile.save()
        shift = WorkShift.objects.create(user=request.user, started_at=timezone.now())
        return Response(WorkShiftSerializer(shift).data, status=201)

    @action(detail=False, methods=['post'])
    def end(self, request):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            return Response({'error': 'Профиль не найден'}, status=400)
        shift = WorkShift.objects.filter(user=request.user, is_active=True).first()
        if not shift:
            return Response({'error': 'Нет активной смены'}, status=400)
        now = timezone.now()
        shift.ended_at = now
        shift.is_active = False
        orders = Order.objects.filter(master__user=request.user, updated_at__gte=shift.started_at, updated_at__lte=now)
        if not orders.exists():
            orders = Order.objects.filter(confirmed_by=request.user, updated_at__gte=shift.started_at, updated_at__lte=now)
        shift.orders_total = orders.count()
        shift.orders_completed = orders.filter(status__in=['completed', 'confirmed']).count()
        shift.total_cost = orders.aggregate(s=Sum('cost'))['s'] or 0
        try:
            from .models import TraccarMileage
            shift.total_mileage_km = TraccarMileage.objects.filter(master__user=request.user, synced_at__gte=shift.started_at, synced_at__lte=now).aggregate(s=Sum('distance_km'))['s'] or 0
        except Exception:
            pass
        shift.hours_worked = round((now - shift.started_at).total_seconds() / 3600, 1)
        shift.save()
        profile.is_on_shift = False
        profile.shift_started_at = None
        profile.save()
        return Response(WorkShiftSerializer(shift).data)

    @action(detail=False, methods=['get'])
    def my_today(self, request):
        today = timezone.localdate()
        shifts = WorkShift.objects.filter(user=request.user, started_at__date=today)
        return Response({
            'shifts': WorkShiftSerializer(shifts, many=True).data,
            'total_orders': sum(s.orders_total for s in shifts),
            'total_cost': float(sum(s.total_cost for s in shifts)),
            'total_mileage': round(sum(s.total_mileage_km for s in shifts), 1),
            'total_hours': round(sum(s.hours_worked for s in shifts), 1),
        })


class OrderMediaViewSet(viewsets.ModelViewSet):
    """Фото/видео отчёты по заявке"""
    queryset = OrderMedia.objects.all()
    serializer_class = OrderMediaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'file_type']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """Загрузка фото/видео для заявки (multipart: file, order_id, file_type)"""
        order_id = request.data.get('order_id')
        file_type = request.data.get('file_type', 'image')
        notes = request.data.get('notes', '')

        if not order_id:
            return Response({'error': 'order_id обязателен'}, status=400)

        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Заявка не найдена'}, status=404)

        if 'file' not in request.FILES:
            return Response({'error': 'Файл не прикреплён'}, status=400)

        media = OrderMedia.objects.create(
            order=order,
            file=request.FILES['file'],
            file_type=file_type,
            uploaded_by=request.user,
            notes=notes,
        )
        return Response(OrderMediaSerializer(media).data, status=201)


class PushTokenViewSet(viewsets.ModelViewSet):
    """Push-токены для уведомлений (Expo)"""
    queryset = PushToken.objects.all()
    serializer_class = PushTokenSerializer
    http_method_names = ['post', 'delete', 'get']

    def create(self, request, *args, **kwargs):
        """Регистрация push-токена"""
        token = request.data.get('token', '').strip()
        platform = request.data.get('platform', 'android')
        if not token:
            return Response({'error': 'token обязателен'}, status=400)
        obj, created = PushToken.objects.update_or_create(
            token=token,
            defaults={'user': request.user, 'platform': platform, 'is_active': True}
        )
        return Response(PushTokenSerializer(obj).data, status=201 if created else 200)

    def get_queryset(self):
        return PushToken.objects.filter(user=self.request.user)


def send_push_notification(user_id, title, body, data=None):
    """Отправить уведомление: сначала Max, затем Expo Push"""
    from .max_service import send_notification_to_user
    print(f'[Push] Sending to user_id={user_id}: title="{title}"')
    result = send_notification_to_user(user_id, title, body)
    print(f'[Push] Result for user_id={user_id}: via_max={result}')


# ==================== Auth endpoints ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Аутентификация пользователя, возвращает токен и данные пользователя"""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data['username']
    password = serializer.validated_data['password']

    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {'error': 'Неверные учетные данные'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'token': token.key,
        'user': UserSerializer(user).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Возвращает данные текущего пользователя"""
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_token_view(request):
    """Обновление токена (ротация)"""
    request.user.auth_token.delete()
    token = Token.objects.create(user=request.user)
    return Response({'token': token.key})


# ══════════════════════════════════════════════════════════════════
# Склад и оборудование
# ══════════════════════════════════════════════════════════════════

class InventoryItemViewSet(viewsets.ModelViewSet):
    """Склад: оборудование (приход, учёт, остатки)"""
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['item_type', 'status', 'storage_location']
    search_fields = ['name', 'serial_number', 'model_name', 'supplier', 'barcode']

    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        """Поиск товара по штрих-коду (для сканера)"""
        barcode = request.query_params.get('code', '').strip()
        if not barcode:
            return Response({'error': 'Передайте ?code=ШТРИХКОД'}, status=400)
        try:
            item = InventoryItem.objects.get(barcode=barcode)
            return Response(InventoryItemSerializer(item).data)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Товар с таким штрих-кодом не найден', 'barcode': barcode}, status=404)

    @action(detail=True, methods=['post'])
    def generate_barcode(self, request, pk=None):
        """Сгенерировать новый штрих-код для позиции"""
        item = self.get_object()
        import uuid
        item.barcode = f'SKU-{uuid.uuid4().hex[:8].upper()}'
        item.save(update_fields=['barcode', 'updated_at'])
        return Response(InventoryItemSerializer(item).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Сводка по складу"""
        items = InventoryItem.objects.all()
        total_items = items.count()
        in_stock = items.filter(status='in_stock').count()
        with_masters = items.filter(status='with_master').count()
        total_value = sum(
            (i.sale_price or 0) * i.quantity
            for i in items.filter(status__in=['in_stock', 'with_master'])
        )
        by_type = {}
        for t in InventoryItem.ITEM_TYPES:
            cnt = items.filter(item_type=t[0]).count()
            if cnt:
                by_type[str(t[1])] = cnt
        return Response({
            'total_items': total_items,
            'in_stock': in_stock,
            'with_masters': with_masters,
            'total_value': float(total_value),
            'by_type': by_type,
        })

    @action(detail=True, methods=['post'])
    def add_stock(self, request, pk=None):
        """Приход на склад (простой, без накладной)"""
        item = self.get_object()
        qty = int(request.data.get('quantity', 0))
        if qty <= 0:
            return Response({'error': 'Укажите количество > 0'}, status=400)
        InventoryMovement.objects.create(
            item=item, movement_type='in', quantity=qty,
            performed_by=request.user,
            notes=request.data.get('notes', 'Приход на склад')
        )
        return Response(InventoryItemSerializer(item).data)

    @action(detail=True, methods=['post'])
    def issue_to_master(self, request, pk=None):
        """Выдать мастеру"""
        item = self.get_object()
        master_id = request.data.get('master_id')
        qty = int(request.data.get('quantity', 1))
        if not master_id:
            return Response({'error': 'Укажите master_id'}, status=400)
        try:
            master = Master.objects.get(id=master_id)
        except Master.DoesNotExist:
            return Response({'error': 'Мастер не найден'}, status=404)
        if item.quantity < qty:
            return Response({'error': f'Недостаточно на складе (доступно: {item.quantity})'}, status=400)
        InventoryMovement.objects.create(
            item=item, movement_type='out_to_master', quantity=qty,
            master=master, performed_by=request.user,
            notes=request.data.get('notes', f'Выдано мастеру {master}')
        )
        return Response(InventoryItemSerializer(item).data)


class InventoryMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """Движения оборудования (только чтение)"""
    queryset = InventoryMovement.objects.select_related('item', 'master', 'master__user', 'order', 'performed_by', 'supply_invoice', 'supply_invoice__supplier')
    serializer_class = InventoryMovementSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['movement_type', 'master', 'item']

    def get_queryset(self):
        qs = super().get_queryset()
        master_id = self.request.query_params.get('master_id')
        if master_id:
            qs = qs.filter(master_id=master_id)
        return qs


# ══════════════════════════════════════════════════════════════════
# Поставщики и накладные
# ══════════════════════════════════════════════════════════════════

class SupplierViewSet(viewsets.ModelViewSet):
    """Поставщики оборудования"""
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'inn', 'phone', 'email']


class SupplyInvoiceViewSet(viewsets.ModelViewSet):
    """Накладные поставщиков"""
    queryset = SupplyInvoice.objects.select_related('supplier', 'received_by').prefetch_related('items__inventory_item')
    serializer_class = SupplyInvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'supplier']
    search_fields = ['invoice_number', 'supplier__name']

    def get_serializer_class(self):
        if self.action == 'create':
            return SupplyInvoiceCreateSerializer
        if self.action in ('receive', 'partial_update'):
            return SupplyInvoiceReceiveSerializer
        return SupplyInvoiceSerializer

    def create(self, request, *args, **kwargs):
        """Создать накладную с позициями одним запросом"""
        serializer = SupplyInvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        supplier = get_object_or_404(Supplier, id=data['supplier_id'])

        invoice = SupplyInvoice.objects.create(
            supplier=supplier,
            invoice_number=data['invoice_number'],
            invoice_date=data['invoice_date'],
            notes=data.get('notes', ''),
            status='draft'
        )

        items_data = data.get('items', [])
        for item_data in items_data:
            inv_item = get_object_or_404(InventoryItem, id=item_data['inventory_item_id'])
            SupplyInvoiceItem.objects.create(
                invoice=invoice,
                inventory_item=inv_item,
                quantity_ordered=item_data.get('quantity_ordered', 0),
                quantity_received=item_data.get('quantity_received', 0),
                unit_price=item_data.get('unit_price', inv_item.cost_price or 0),
                notes=item_data.get('notes', ''),
            )
        invoice.recalculate_totals()

        # Если все позиции уже приняты — сразу применяем
        if invoice.items.filter(quantity_received__gt=0).exists():
            invoice.apply_received(request.user)
            invoice.refresh_from_db()

        return Response(SupplyInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Принять товар по накладной: обновить quantity_received и оприходовать"""
        invoice = self.get_object()
        if invoice.status == 'cancelled':
            return Response({'error': 'Накладная отменена'}, status=400)

        serializer = SupplyInvoiceReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items_data = {it['inventory_item_id']: it for it in serializer.validated_data['items']}

        for item in invoice.items.all():
            if item.inventory_item_id in items_data:
                new_qty = items_data[item.inventory_item_id].get('quantity_received', item.quantity_received)
                item.quantity_received = min(new_qty, item.quantity_ordered)  # не больше заказанного
                item.save(update_fields=['quantity_received'])

        invoice.apply_received(request.user)
        invoice.recalculate_totals()
        invoice.refresh_from_db()

        return Response(SupplyInvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Добавить позицию в существующую накладную"""
        invoice = self.get_object()
        if invoice.status in ('received', 'cancelled'):
            return Response({'error': 'Нельзя редактировать принятую/отменённую накладную'}, status=400)

        inv_item = get_object_or_404(InventoryItem, id=request.data.get('inventory_item_id'))
        item, created = SupplyInvoiceItem.objects.update_or_create(
            invoice=invoice,
            inventory_item=inv_item,
            defaults={
                'quantity_ordered': request.data.get('quantity_ordered', 1),
                'quantity_received': request.data.get('quantity_received', 0),
                'unit_price': request.data.get('unit_price', inv_item.cost_price or 0),
                'notes': request.data.get('notes', ''),
            }
        )
        invoice.recalculate_totals()
        return Response(SupplyInvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def remove_item(self, request, pk=None):
        """Удалить позицию из накладной"""
        invoice = self.get_object()
        if invoice.status in ('received', 'cancelled'):
            return Response({'error': 'Нельзя редактировать принятую/отменённую накладную'}, status=400)

        item_id = request.data.get('item_id')
        SupplyInvoiceItem.objects.filter(id=item_id, invoice=invoice).delete()
        invoice.recalculate_totals()
        return Response(SupplyInvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Отменить накладную"""
        invoice = self.get_object()
        if invoice.status == 'received':
            return Response({'error': 'Нельзя отменить уже принятую накладную'}, status=400)
        invoice.status = 'cancelled'
        invoice.save()
        return Response(SupplyInvoiceSerializer(invoice).data)


# ══════════════════════════════════════════════════════════════════
# Склад v3: Расходные ордера и заявки на закупку
# ══════════════════════════════════════════════════════════════════

class IssueOrderViewSet(viewsets.ModelViewSet):
    """Расходные ордера — выдача материалов со склада под заявку"""
    queryset = IssueOrder.objects.select_related('order', 'master__user', 'issued_by').prefetch_related('items__inventory_item')
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'master', 'status']

    def get_serializer_class(self):
        if self.action == 'create':
            return IssueOrderCreateSerializer
        return IssueOrderSerializer

    def create(self, request):
        serializer = IssueOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = get_object_or_404(Order, id=data['order_id'])
        master = get_object_or_404(Master, id=data['master_id'])
        issue_order = IssueOrder.objects.create(order=order, master=master, issued_by=request.user, notes=data.get('notes', ''))
        for item_data in data.get('items', []):
            inv_item = get_object_or_404(InventoryItem, id=item_data['inventory_item_id'])
            qty = item_data.get('quantity_issued', 1)
            IssueOrderItem.objects.create(
                issue_order=issue_order, inventory_item=inv_item,
                quantity_issued=qty,
                need_return_old=item_data.get('need_return_old', False),
                old_item_description=item_data.get('old_item_description', ''),
                notes=item_data.get('notes', ''),
            )
            InventoryMovement.objects.create(item=inv_item, movement_type='out_to_master', quantity=qty, master=master, order=order, performed_by=request.user, notes=f'Ордер №{issue_order.id}')
        return Response(IssueOrderSerializer(issue_order).data, status=201)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Сотрудник подтверждает получение материалов"""
        issue_order = self.get_object()
        if issue_order.status != 'pending':
            return Response({'error': 'Ордер уже получен или закрыт'}, status=400)
        issue_order.status = 'received'
        issue_order.received_at = timezone.now()
        issue_order.save()
        return Response(IssueOrderSerializer(issue_order).data)

    @action(detail=True, methods=['post'])
    def report_usage(self, request, pk=None):
        """Сотрудник отчитывается: сколько использовал, сколько вернул"""
        issue_order = self.get_object()
        items_data = {it['item_id']: it for it in request.data.get('items', [])}
        for item in issue_order.items.all():
            if item.inventory_item_id in items_data:
                d = items_data[item.inventory_item_id]
                item.quantity_used = d.get('quantity_used', item.quantity_used)
                item.quantity_returned = d.get('quantity_returned', item.quantity_returned)
                item.old_item_returned = d.get('old_item_returned', item.old_item_returned)
                item.save()
                if item.quantity_returned > 0:
                    inv_item = item.inventory_item
                    inv_item.quantity += item.quantity_returned
                    inv_item.status = 'in_stock'
                    inv_item.save()
                    InventoryMovement.objects.create(item=inv_item, movement_type='return_from_master', quantity=item.quantity_returned, master=issue_order.master, order=issue_order.order, performed_by=request.user, notes=f'Возврат по ордеру №{issue_order.id}')
        from django.db.models import F as _F
        all_used = not issue_order.items.filter(quantity_issued__gt=_F('quantity_used') + _F('quantity_returned')).exists()
        issue_order.status = 'fully_used' if all_used else 'partially_used'
        issue_order.completed_at = timezone.now()
        issue_order.save()
        return Response(IssueOrderSerializer(issue_order).data)


class PurchaseRequestViewSet(viewsets.ModelViewSet):
    """Заявки на закупку"""
    queryset = PurchaseRequest.objects.select_related('estimate', 'order', 'created_by').prefetch_related('items')
    serializer_class = PurchaseRequestSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def create(self, request):
        data = request.data
        pr = PurchaseRequest.objects.create(
            estimate_id=data.get('estimate_id'),
            order_id=data.get('order_id'),
            created_by=request.user,
            notes=data.get('notes', ''),
            status='pending',
        )
        for item_data in data.get('items', []):
            PurchaseRequestItem.objects.create(
                purchase_request=pr,
                inventory_item_id=item_data.get('inventory_item_id'),
                name=item_data.get('name', 'Без названия'),
                quantity=item_data.get('quantity', 1),
                unit=item_data.get('unit', 'шт.'),
                estimated_price=item_data.get('estimated_price'),
                supplier_id=item_data.get('supplier_id'),
                notes=item_data.get('notes', ''),
            )
        return Response(PurchaseRequestSerializer(pr).data, status=201)

    @action(detail=True, methods=['post'])
    def mark_ordered(self, request, pk=None):
        pr = self.get_object()
        pr.status = 'ordered'
        pr.save()
        return Response(PurchaseRequestSerializer(pr).data)

    @action(detail=True, methods=['post'])
    def mark_received(self, request, pk=None):
        pr = self.get_object()
        pr.status = 'received'
        pr.save()
        return Response(PurchaseRequestSerializer(pr).data)


# ══════════════════════════════════════════════════════════════════
# Финансы
# ══════════════════════════════════════════════════════════════════

class PaymentViewSet(viewsets.ModelViewSet):
    """Оплаты по заявкам"""
    queryset = Payment.objects.select_related('order', 'order__client', 'received_by')
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['payment_method', 'is_received', 'order']

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Финансовая сводка за период"""
        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)
        payments = Payment.objects.filter(paid_at__gte=since, is_received=True)
        total = payments.aggregate(s=Sum('amount'))['s'] or 0
        by_method = {}
        for m in Payment.PAYMENT_METHODS:
            s = payments.filter(payment_method=m[0]).aggregate(s=Sum('amount'))['s'] or 0
            if s:
                by_method[str(m[1])] = float(s)
        return Response({
            'total': float(total),
            'count': payments.count(),
            'by_method': by_method,
            'days': days,
        })


class MasterSalaryViewSet(viewsets.ModelViewSet):
    """Зарплаты мастеров"""
    queryset = MasterSalary.objects.select_related('master', 'master__user')
    serializer_class = MasterSalarySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['master', 'status']

    @action(detail=False, methods=['post'])
    def calculate(self, request):
        """Рассчитать зарплату мастера за период"""
        master_id = request.data.get('master_id')
        period_start = request.data.get('period_start')
        period_end = request.data.get('period_end')
        commission = float(request.data.get('commission_percent', 30))

        if not master_id or not period_start or not period_end:
            return Response({'error': 'Укажите master_id, period_start, period_end'}, status=400)

        try:
            master = Master.objects.get(id=master_id)
        except Master.DoesNotExist:
            return Response({'error': 'Мастер не найден'}, status=404)

        orders = Order.objects.filter(
            master=master,
            confirmed_at__date__gte=period_start,
            confirmed_at__date__lte=period_end,
            status='confirmed',
        )

        total_orders = orders.count()
        total_revenue = orders.aggregate(s=Sum('cost'))['s'] or 0
        base_salary = float(total_revenue) * commission / 100
        bonus = float(request.data.get('bonus', 0))
        deduction = float(request.data.get('deduction', 0))
        total_salary = base_salary + bonus - deduction

        salary, _ = MasterSalary.objects.update_or_create(
            master=master, period_start=period_start, period_end=period_end,
            defaults={
                'orders_total': total_orders,
                'orders_completed': orders.count(),
                'total_revenue': total_revenue,
                'commission_percent': commission,
                'bonus': bonus,
                'deduction': deduction,
                'total_salary': max(0, total_salary),
                'notes': request.data.get('notes', ''),
            }
        )
        return Response(MasterSalarySerializer(salary).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        salary = self.get_object()
        salary.status = 'approved'
        salary.save(update_fields=['status'])
        return Response(MasterSalarySerializer(salary).data)

    @action(detail=False, methods=['get'])
    def master_debts(self, request):
        """Долги мастеров по наличным и оборудованию"""
        master_id = request.query_params.get('master_id')
        cash_qs = MasterCashDebt.objects.select_related('master', 'master__user', 'order')
        inv_qs = MasterInventoryDebt.objects.select_related('master', 'master__user', 'order', 'item')
        if master_id:
            cash_qs = cash_qs.filter(master_id=master_id, is_paid_to_office=False)
            inv_qs = inv_qs.filter(master_id=master_id, is_returned=False)
        return Response({
            'cash_debts': [{'id': d.id, 'master': str(d.master), 'order': d.order.number, 'amount': float(d.amount), 'is_paid': d.is_paid_to_office} for d in cash_qs],
            'inventory_debts': [{'id': d.id, 'master': str(d.master), 'order': d.order.number, 'description': d.description, 'is_returned': d.is_returned, 'condition': d.condition} for d in inv_qs],
        })



class MessageViewSet(viewsets.ModelViewSet):
    """Чат между сотрудниками"""
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['sender', 'recipient']
    ordering_fields = ['created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Message.objects.none()
        # Видим свои сообщения, адресованные нам, и broadcast
        return Message.objects.filter(
            Q(sender=user) | Q(recipient=user) | Q(is_broadcast=True)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        msg = self.get_object()
        msg.read_by.add(request.user)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        user = request.user
        count = Message.objects.filter(
            Q(recipient=user) | Q(is_broadcast=True)
        ).exclude(read_by=user).count()
        return Response({'unread': count})

    @action(detail=False, methods=['get'])
    def users(self, request):
        """Список сотрудников для выбора получателя"""
        from .models import User
        users = User.objects.filter(is_active=True).values('id', 'username', 'first_name', 'last_name')
        return Response([{
            'id': u['id'],
            'username': u['username'],
            'full_name': f"{u['first_name']} {u['last_name']}".strip() or u['username']
        } for u in users])


# ══════════════════════════════════════════════════════════════════
# Сметы и КП — viewsets
# ══════════════════════════════════════════════════════════════════

class LegalEntityViewSet(viewsets.ModelViewSet):
    """Юрлица компании"""
    queryset = LegalEntity.objects.all()
    serializer_class = LegalEntitySerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'short_name', 'inn']


class EstimateServiceViewSet(viewsets.ModelViewSet):
    """Справочник услуг и работ для смет"""
    queryset = EstimateService.objects.all()
    serializer_class = EstimateServiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name']
    ordering_fields = ['name', 'category', 'sale_price', 'cost_price']


class CommercialEstimateViewSet(viewsets.ModelViewSet):
    """Сметы и коммерческие предложения"""
    queryset = CommercialEstimate.objects.all()
    serializer_class = CommercialEstimateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'client', 'legal_entity', 'order']
    search_fields = ['number', 'name', 'client__name']
    ordering_fields = ['created_at', 'total', 'status', 'number']

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        obj.recalculate()

    def perform_update(self, serializer):
        obj = serializer.save()
        obj.recalculate()

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Добавить позицию в смету"""
        estimate = self.get_object()
        data = request.data.copy()
        data['estimate'] = estimate.id

        # Если материал со склада
        if data.get('item_type') == 'material' and data.get('inventory_item_id'):
            try:
                inv = InventoryItem.objects.get(id=data['inventory_item_id'])
                data['name'] = inv.name
                data['unit'] = inv.unit
                data['cost_price'] = inv.cost_price or 0
                data['sale_price'] = inv.sale_price or 0
            except InventoryItem.DoesNotExist:
                pass

        # Если услуга из справочника
        if data.get('item_type') == 'service' and data.get('service_id'):
            try:
                svc = EstimateService.objects.get(id=data['service_id'])
                data['name'] = svc.name
                data['unit'] = svc.unit
                data['cost_price'] = svc.cost_price
                data['sale_price'] = svc.sale_price
                data['installer_salary'] = svc.installer_salary
            except EstimateService.DoesNotExist:
                pass

        serializer = EstimateItemSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        estimate.recalculate()
        return Response(CommercialEstimateSerializer(estimate).data, status=201)

    @action(detail=True, methods=['post'])
    def remove_item(self, request, pk=None):
        """Удалить позицию из сметы"""
        estimate = self.get_object()
        item_id = request.data.get('item_id')
        if not item_id:
            return Response({'error': 'item_id обязателен'}, status=400)
        try:
            item = estimate.items.get(id=item_id)
            item.delete()
            estimate.recalculate()
            return Response(CommercialEstimateSerializer(estimate).data)
        except EstimateItem.DoesNotExist:
            return Response({'error': 'Позиция не найдена'}, status=404)

    @action(detail=True, methods=['post'])
    def update_item(self, request, pk=None):
        """Обновить позицию сметы"""
        estimate = self.get_object()
        item_id = request.data.pop('item_id', None)
        if not item_id:
            return Response({'error': 'item_id обязателен'}, status=400)
        try:
            item = estimate.items.get(id=item_id)
            for key, value in request.data.items():
                setattr(item, key, value)
            item.save()
            estimate.recalculate()
            return Response(CommercialEstimateSerializer(estimate).data)
        except EstimateItem.DoesNotExist:
            return Response({'error': 'Позиция не найдена'}, status=404)

    @action(detail=True, methods=['post'])
    def recalc(self, request, pk=None):
        """Принудительный пересчёт сметы"""
        estimate = self.get_object()
        estimate.recalculate()
        return Response(CommercialEstimateSerializer(estimate).data)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Генерация PDF/печатной формы коммерческого предложения"""
        estimate = self.get_object()
        settings_qs = SystemSettings.objects.first()
        settings_data = {}
        if settings_qs:
            from .serializers import SystemSettingsPublicSerializer
            settings_data = SystemSettingsPublicSerializer(settings_qs).data

        le = estimate.legal_entity
        le_data = None
        if le:
            le_data = {
                'name': le.name, 'short_name': le.short_name or le.name,
                'inn': le.inn, 'kpp': le.kpp, 'ogrn': le.ogrn,
                'legal_address': le.legal_address,
                'phone': le.phone, 'email': le.email,
                'bank_name': le.bank_name, 'bik': le.bik,
                'corr_account': le.corr_account,
                'settlement_account': le.settlement_account,
                'director': le.director,
            }

        client = estimate.client
        client_data = None
        if client:
            client_data = {
                'name': client.name, 'phone': client.phone, 'email': client.email,
                'inn': getattr(client, 'inn', ''),
                'legal_address': getattr(client, 'legal_address', ''),
                'director_name': getattr(client, 'director_name', ''),
            }

        items = estimate.items.all()
        from datetime import date, timedelta
        validity_date = (date.today() + timedelta(days=settings_data.get('cp_validity_days', 7))).strftime('%d.%m.%Y')

        color = settings_data.get('cp_color', '#1a3e60')
        logo_tag = ''
        if settings_data.get('cp_show_logo') and settings_data.get('cp_logo_url'):
            logo_tag = f'<img src="{settings_data["cp_logo_url"]}" style="max-height:60px;" />'

        items_html = ''
        for idx, item in enumerate(items, 1):
            items_html += f'''
            <tr>
                <td style="text-align:center;">{idx}</td>
                <td>{item.name}</td>
                <td style="text-align:center;">{item.unit}</td>
                <td style="text-align:center;">{item.quantity:.1f}</td>
                <td style="text-align:right;">{item.sale_price:,.2f} ₽</td>
                <td style="text-align:right;">{item.total_price:,.2f} ₽</td>
            </tr>'''

        html = f'''<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>КП №{estimate.number}</title>
<style>
@page {{ size: A4; margin: 15mm; }}
@page :first {{ margin-top: 25mm; }}
@media print {{
  body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .no-print {{ display: none !important; }}
}}
body {{ font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 11pt; color: #333; }}
.header {{ background: {color}; color: #fff; padding: 15px 20px; border-radius: 6px; margin-bottom: 20px; }}
.header h1 {{ margin: 0; font-size: 18pt; }}
.header .sub {{ font-size: 10pt; opacity: .85; margin-top: 5px; }}
.company-info {{ margin-bottom: 20px; }}
.company-info table {{ width: 100%; border-collapse: collapse; }}
.company-info td {{ vertical-align: top; padding: 8px; font-size: 10pt; }}
.company-info .label {{ color: #888; font-size: 9pt; }}
.client-info {{ margin-bottom: 20px; border: 1px solid #ddd; padding: 12px; border-radius: 6px; }}
.client-info h3 {{ margin: 0 0 10px; color: {color}; }}
.items-table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
.items-table th {{ background: {color}; color: #fff; padding: 8px; font-size: 10pt; }}
.items-table td {{ padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 10pt; }}
.items-table tr:nth-child(even) {{ background: #f9f9f9; }}
.totals {{ float: right; width: 300px; margin-top: 15px; }}
.totals table {{ width: 100%; border-collapse: collapse; }}
.totals td {{ padding: 4px 8px; font-size: 10pt; }}
.totals .total {{ font-weight: bold; font-size: 14pt; color: {color}; border-top: 2px solid {color}; }}
.footer {{ margin-top: 40px; font-size: 10pt; color: #666; }}
.validity {{ margin-top: 15px; font-size: 10pt; color: #888; }}
.print-btn {{ position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: {color}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 999; }}
.print-btn:hover {{ opacity: .9; }}
</style></head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Печать / Сохранить PDF</button>

<div class="header">
    {logo_tag}
    <h1>{settings_data.get('cp_header_text', 'Коммерческое предложение')} №{estimate.number}</h1>
    <div class="sub">от {estimate.created_at.strftime('%d.%m.%Y')}</div>
</div>

<div class="company-info">
    <table>
        <tr>
            <td width="50%">
                <div class="label">Исполнитель:</div>
                <strong>{le_data['short_name'] or le_data['name'] if le_data else 'Наша компания'}</strong><br>
                {'ИНН ' + le_data['inn'] + '<br>' if le_data and le_data.get('inn') else ''}
                {'КПП ' + le_data['kpp'] + '<br>' if le_data and le_data.get('kpp') else ''}
                {le_data['legal_address'] + '<br>' if le_data and le_data.get('legal_address') else ''}
                {'📞 ' + le_data['phone'] + '<br>' if le_data and le_data.get('phone') else ''}
            </td>
            <td width="50%">
                <div class="label">Заказчик:</div>
                <strong>{client_data['name'] if client_data else '—'}</strong><br>
                {'ИНН ' + client_data['inn'] + '<br>' if client_data and client_data.get('inn') else ''}
                {'📞 ' + client_data['phone'] + '<br>' if client_data and client_data.get('phone') else ''}
            </td>
        </tr>
    </table>
</div>

<table class="items-table">
    <tr><th>№</th><th>Наименование</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>
    {items_html}
</table>

<div class="totals">
    <table>
        <tr><td>Материалы:</td><td style="text-align:right;">{estimate.total_materials:,.2f} ₽</td></tr>
        <tr><td>Услуги:</td><td style="text-align:right;">{estimate.total_services:,.2f} ₽</td></tr>
        <tr><td>Подытог:</td><td style="text-align:right;">{estimate.subtotal:,.2f} ₽</td></tr>
        {f'<tr><td>Скидка:</td><td style="text-align:right;">-{estimate.discount}%</td></tr>' if estimate.discount and estimate.discount > 0 else ''}
        {f'<tr><td>Доставка:</td><td style="text-align:right;">{estimate.delivery_cost:,.2f} ₽</td></tr>' if estimate.delivery_cost and estimate.delivery_cost > 0 else ''}
        <tr class="total"><td>ИТОГО:</td><td style="text-align:right;">{estimate.total:,.2f} ₽</td></tr>
    </table>
</div>

<div style="clear:both;"></div>

<div class="validity">
    💡 Предложение действительно до: <strong>{validity_date}</strong>
</div>

<div class="footer">
    <p>{settings_data.get('cp_footer_text', 'С уважением, команда Видео Сервис')}</p>
    {f'<p>_________________ {settings_data.get("cp_signature_name", "")}<br><em>{settings_data.get("cp_signature_title", "")}</em></p>' if settings_data.get('cp_signature_name') else ''}
</div>
</body></html>'''

        from django.http import HttpResponse
        return HttpResponse(html, content_type='text/html; charset=utf-8')


class EstimateItemViewSet(viewsets.ModelViewSet):
    """Позиции сметы (для прямого редактирования)"""
    queryset = EstimateItem.objects.all()
    serializer_class = EstimateItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['estimate', 'item_type']


# ══════════════════════════════════════════════════════════════════
# Места хранения (StorageLocation)
# ══════════════════════════════════════════════════════════════════

class StorageLocationViewSet(viewsets.ModelViewSet):
    """Физические места хранения товаров на складе (ячейки, стеллажи, полки)"""
    queryset = StorageLocation.objects.all()
    serializer_class = StorageLocationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['zone', 'is_active']
    search_fields = ['code', 'barcode', 'zone', 'rack', 'shelf', 'notes']

    def get_serializer_class(self):
        if self.action == 'retrieve' or self.action == 'by_barcode':
            return StorageLocationDetailSerializer
        return StorageLocationSerializer

    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        """Поиск места хранения по штрихкоду (для сканера)"""
        barcode = request.query_params.get('code', '').strip()
        if not barcode:
            return Response({'error': 'Передайте ?code=ШТРИХКОД'}, status=400)
        try:
            loc = StorageLocation.objects.get(barcode=barcode)
            return Response(StorageLocationDetailSerializer(loc).data)
        except StorageLocation.DoesNotExist:
            return Response({'error': 'Место с таким штрихкодом не найдено', 'barcode': barcode}, status=404)

    @action(detail=True, methods=['post'])
    def move_items(self, request, pk=None):
        """Переместить товары из этого места в другое (тело: {target_location_id: N, item_ids: [...]})"""
        source = self.get_object()
        target_id = request.data.get('target_location_id')
        item_ids = request.data.get('item_ids', [])

        if not target_id:
            return Response({'error': 'Укажите target_location_id'}, status=400)
        try:
            target = StorageLocation.objects.get(id=target_id)
        except StorageLocation.DoesNotExist:
            return Response({'error': 'Целевое место не найдено'}, status=404)

        if target.is_full:
            return Response({'error': 'Целевое место заполнено'}, status=400)

        items = InventoryItem.objects.filter(id__in=item_ids, storage_location=source)
        moved_count = items.update(storage_location=target)

        return Response({
            'success': True,
            'moved_count': moved_count,
            'source': StorageLocationSerializer(source).data,
            'target': StorageLocationSerializer(target).data,
        })

    @action(detail=True, methods=['post'])
    def recount(self, request, pk=None):
        """Пересчёт: подтвердить список товаров в ячейке (тело: {item_ids: [...]})"""
        loc = self.get_object()
        confirmed_ids = request.data.get('item_ids', [])
        confirmed_set = set(confirmed_ids)

        # Товары, которые есть в ячейке, но не в списке — помечаем как missing
        current_items = InventoryItem.objects.filter(storage_location=loc)
        missing = []
        for item in current_items:
            if item.id not in confirmed_set:
                missing.append(item.id)

        return Response({
            'success': True,
            'location': StorageLocationDetailSerializer(loc).data,
            'confirmed_count': len(confirmed_set),
            'missing_item_ids': missing,
            'missing_count': len(missing),
        })


# ══════════════════════════════════════════════════════════════════
# Исходящие накладные (УПД)
# ══════════════════════════════════════════════════════════════════

class OutgoingInvoiceViewSet(viewsets.ModelViewSet):
    """Исходящие накладные (УПД) — выдача товаров со склада"""
    queryset = OutgoingInvoice.objects.prefetch_related('items__inventory_item', 'from_legal', 'to_client')
    serializer_class = OutgoingInvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'from_legal', 'to_client']
    search_fields = ['number', 'to_client__name', 'from_legal__name', 'basis']

    def get_serializer_class(self):
        if self.action == 'create':
            return OutgoingInvoiceCreateSerializer
        return OutgoingInvoiceSerializer

    def create(self, request, *args, **kwargs):
        """Создать УПД с позициями"""
        serializer = OutgoingInvoiceCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'error': f'Ошибка валидации: {serializer.errors}'}, status=400)
        data = serializer.validated_data

        from_legal_id = data.get('from_legal_id')
        to_client_id = data.get('to_client_id')
        items_data = data.get('items', [])

        if not from_legal_id:
            return Response({'error': 'Не указано отправитель (from_legal_id)'}, status=400)
        if not to_client_id:
            return Response({'error': 'Не указан получатель (to_client_id)'}, status=400)

        from .models import LegalEntity, Client, InventoryItem

        try:
            from_legal = LegalEntity.objects.get(id=from_legal_id)
        except LegalEntity.DoesNotExist:
            return Response({'error': f'Юрлицо id={from_legal_id} не найдено'}, status=400)

        try:
            to_client = Client.objects.get(id=to_client_id)
        except Client.DoesNotExist:
            return Response({'error': f'Клиент id={to_client_id} не найден'}, status=400)

        invoice = OutgoingInvoice.objects.create(
            from_legal=from_legal,
            to_client=to_client,
            basis=data.get('basis', ''),
            received_by_name=data.get('received_by_name', ''),
            notes=data.get('notes', ''),
        )

        errors = []
        for item_data in items_data:
            item_id = item_data.get('inventory_item')
            if not item_id:
                errors.append('Пропущена позиция без inventory_item')
                continue
            try:
                inv_item = InventoryItem.objects.get(id=item_id)
                qty = item_data.get('quantity', 1)
                price = item_data.get('unit_price', inv_item.sale_price or 0)
                OutgoingInvoiceItem.objects.create(
                    invoice=invoice,
                    inventory_item=inv_item,
                    quantity=qty,
                    unit_price=price,
                    vat_rate=item_data.get('vat_rate', '20%'),
                    notes=item_data.get('notes', ''),
                )
            except InventoryItem.DoesNotExist:
                errors.append(f"Товар id={item_id} не найден")

        return Response({
            'success': True,
            'invoice': OutgoingInvoiceSerializer(invoice).data,
            'errors': errors,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """Провести выдачу: списать товары со склада"""
        invoice = self.get_object()
        if invoice.status != 'draft':
            return Response({'error': 'Накладная уже проведена или аннулирована'}, status=400)
        try:
            invoice.issue(request.user)
            return Response({'success': True, 'invoice': OutgoingInvoiceSerializer(invoice).data})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Аннулировать накладную"""
        invoice = self.get_object()
        if invoice.status == 'cancelled':
            return Response({'error': 'Уже аннулирована'}, status=400)
        invoice.status = 'cancelled'
        invoice.save()
        return Response({'success': True, 'invoice': OutgoingInvoiceSerializer(invoice).data})

    @action(detail=False, methods=['get'])
    def print(self, request):
        """Данные для печати УПД"""
        invoice_id = request.query_params.get('id')
        if not invoice_id:
            return Response({'error': 'Укажите ?id=...'}, status=400)
        try:
            invoice = OutgoingInvoice.objects.prefetch_related(
                'items__inventory_item', 'from_legal', 'to_client'
            ).get(id=invoice_id)
        except OutgoingInvoice.DoesNotExist:
            return Response({'error': 'Накладная не найдена'}, status=404)

        return Response({
            'number': invoice.number,
            'date': invoice.date.isoformat(),
            'from_legal': {
                'name': invoice.from_legal.name,
                'short_name': invoice.from_legal.short_name,
                'inn': invoice.from_legal.inn,
                'kpp': invoice.from_legal.kpp,
                'address': invoice.from_legal.legal_address,
            },
            'to_client': {
                'name': invoice.to_client.name,
                'phone': invoice.to_client.phone,
                'address': invoice.to_client.address,
                'inn': invoice.to_client.inn,
                'is_legal': invoice.to_client.is_legal,
            },
            'basis': invoice.basis,
            'received_by_name': invoice.received_by_name,
            'total_amount': str(invoice.total_amount),
            'total_vat': str(invoice.total_vat),
            'items': [{
                'name': item.inventory_item.name,
                'barcode': item.inventory_item.barcode,
                'unit': item.inventory_item.unit,
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'amount': str(item.amount),
                'vat_rate': item.vat_rate,
            } for item in invoice.items.all()],
        })


# ══════════════════════════════════════════════════════════════════
# Asterisk PBX — управление телефонией
# ══════════════════════════════════════════════════════════════════

class AsteriskSipPeerViewSet(viewsets.ModelViewSet):
    """SIP-аккаунты (внутренние номера)"""
    queryset = AsteriskSipPeer.objects.all().order_by('name')
    serializer_class = AsteriskSipPeerSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'display_name', 'caller_id']

    def perform_create(self, serializer):
        # Генерируем пароль, если не задан
        if not serializer.validated_data.get('secret'):
            import secrets
            serializer.validated_data['secret'] = secrets.token_urlsafe(12)
        serializer.save()


class AsteriskTrunkViewSet(viewsets.ModelViewSet):
    """SIP-транки (подключение к провайдерам)"""
    queryset = AsteriskTrunk.objects.all().order_by('name')
    serializer_class = AsteriskTrunkSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'provider', 'host']


class AsteriskRouteViewSet(viewsets.ModelViewSet):
    """Маршруты звонков"""
    queryset = AsteriskRoute.objects.select_related('trunk').all().order_by('direction', 'priority')
    serializer_class = AsteriskRouteSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['direction', 'is_active']
    search_fields = ['name', 'match_pattern']


class AsteriskIvrViewSet(viewsets.ModelViewSet):
    """Голосовые меню (IVR)"""
    queryset = AsteriskIvr.objects.prefetch_related('options').all().order_by('name')
    serializer_class = AsteriskIvrSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    @action(detail=True, methods=['post'])
    def add_option(self, request, pk=None):
        """Добавить опцию в IVR-меню"""
        ivr = self.get_object()
        serializer = AsteriskIvrOptionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(ivr=ivr)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['delete'], url_path='remove-option/(?P<option_id>[^/.]+)')
    def remove_option(self, request, pk=None, option_id=None):
        """Удалить опцию из IVR-меню"""
        ivr = self.get_object()
        opt = get_object_or_404(AsteriskIvrOption, id=option_id, ivr=ivr)
        opt.delete()
        return Response({'ok': True})


class AsteriskIvrOptionViewSet(viewsets.ModelViewSet):
    """Опции IVR (без вложенности)"""
    queryset = AsteriskIvrOption.objects.all()
    serializer_class = AsteriskIvrOptionSerializer


class AsteriskVoicemailViewSet(viewsets.ModelViewSet):
    """Автоответчики / голосовая почта"""
    queryset = AsteriskVoicemail.objects.all().order_by('mailbox')
    serializer_class = AsteriskVoicemailSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['mailbox', 'display_name', 'email']


class AsteriskCallRecordingViewSet(viewsets.ReadOnlyModelViewSet):
    """Записи звонков"""
    queryset = AsteriskCallRecording.objects.select_related('client').all().order_by('-start_time')
    serializer_class = AsteriskCallRecordingSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['direction']
    search_fields = ['caller', 'callee', 'client__name']


# ══════════════════════════════════════════════════════════════════
# Ростелеком АТС — журнал звонков
# ══════════════════════════════════════════════════════════════════

class CallLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Журнал звонков (CDR) из Ростелеком АТС"""
    queryset = CallLog.objects.select_related('client').order_by('-start_time')
    serializer_class = CallLogSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['direction', 'status', 'call_type']
    search_fields = ['phone', 'client__name']


# ══════════════════════════════════════════════════════════════════
# ЕРЦ (Единый расчётный центр)
# ══════════════════════════════════════════════════════════════════

class ErcAccountViewSet(viewsets.ModelViewSet):
    """Лицевые счета ЕРЦ"""
    queryset = ErcAccount.objects.all()
    serializer_class = ErcAccountSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['account_number', 'full_name', 'address']


class ErcBillingRecordViewSet(viewsets.ModelViewSet):
    """Платёжные записи ЕРЦ"""
    queryset = ErcBillingRecord.objects.all()
    serializer_class = ErcBillingRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['account', 'period']
    search_fields = ['account__account_number', 'account__full_name', 'account__address']


# ══════════════════════════════════════════════════════════════════
# Эндпоинты импорта из Excel
# ══════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_clients_excel_view(request):
    """
    Импорт базы клиентов из Excel-файла.
    Принимает multipart/form-data с полем 'file'.
    """
    try:
        if 'file' not in request.FILES:
            return Response({'success': False, 'error': 'Файл не прикреплён'}, status=status.HTTP_400_BAD_REQUEST)

        uploaded = request.FILES['file']
        if not uploaded.name.lower().endswith(('.xlsx', '.xls')):
            return Response({'success': False, 'error': 'Поддерживаются только файлы .xlsx'}, status=status.HTTP_400_BAD_REQUEST)

        from .import_service import import_clients_from_excel
        # Принимаем опциональный column_map для гибкого маппинга колонок
        column_map = None
        if 'column_map' in request.data:
            try:
                import json
                raw_map = request.data['column_map']
                if isinstance(raw_map, str):
                    column_map = json.loads(raw_map)
                else:
                    column_map = dict(raw_map)
                # Конвертируем ключи в int
                column_map = {k: int(v) for k, v in column_map.items() if v}
            except (ValueError, TypeError):
                column_map = None

        result = import_clients_from_excel(uploaded.read(), request.user, column_map)
        return Response(result)
    except Exception as e:
        return Response({
            'success': False,
            'error': f'Ошибка импорта: {str(e)}',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_erc_excel_view(request):
    """
    Импорт данных ЕРЦ из Excel-файла (оборотная ведомость).
    """
    try:
        if 'file' not in request.FILES:
            return Response({'success': False, 'error': 'Файл не прикреплён'}, status=status.HTTP_400_BAD_REQUEST)

        uploaded = request.FILES['file']
        if not uploaded.name.lower().endswith(('.xlsx', '.xls')):
            return Response({'success': False, 'error': 'Поддерживаются только файлы .xlsx'}, status=status.HTTP_400_BAD_REQUEST)

        period_date = None
        period_str = request.data.get('period', '')
        if period_str:
            from datetime import datetime
            try:
                period_date = datetime.strptime(period_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'success': False, 'error': 'Формат периода: YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        from .import_service import import_erc_from_excel
        result = import_erc_from_excel(uploaded.read(), request.user, period_date)
        return Response(result)
    except Exception as e:
        return Response({
            'success': False,
            'error': f'Ошибка импорта ЕРЦ: {str(e)}',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_preview_view(request):
    """
    Предпросмотр Excel-файла (первые 10 строк).
    """
    if 'file' not in request.FILES:
        return Response({'success': False, 'error': 'Файл не прикреплён'}, status=status.HTTP_400_BAD_REQUEST)

    uploaded = request.FILES['file']
    if not uploaded.name.lower().endswith(('.xlsx', '.xls')):
        return Response({'success': False, 'error': 'Поддерживаются только файлы .xlsx'}, status=status.HTTP_400_BAD_REQUEST)

    from .import_service import preview_excel
    result = preview_excel(uploaded.read())
    return Response(result)


# ══════════════════════════════════════════════════════════════════
# Системная статистика, экспорт, очистка
# ══════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_stats_view(request):
    """Возвращает статистику системы: место на диске, размер медиафайлов."""
    import os, shutil
    from django.conf import settings as django_settings

    result = {
        'disk_total_gb': 0,
        'disk_used_gb': 0,
        'disk_free_gb': 0,
        'media_count': 0,
        'media_size_mb': 0,
        'media_path': '',
        'db_size_mb': 0,
    }

    # Место на диске
    try:
        media_root = getattr(django_settings, 'MEDIA_ROOT', '/app/media')
        stat = shutil.disk_usage(os.path.dirname(str(media_root)) if media_root else '/')
        result['disk_total_gb'] = round(stat.total / (1024**3), 1)
        result['disk_used_gb'] = round(stat.used / (1024**3), 1)
        result['disk_free_gb'] = round(stat.free / (1024**3), 1)
        result['media_path'] = str(media_root)
    except Exception:
        pass

    # Размер медиафайлов
    from .models import OrderMedia
    result['media_count'] = OrderMedia.objects.count()
    try:
        total_size = 0
        for m in OrderMedia.objects.all():
            try:
                total_size += m.file.size
            except Exception:
                pass
        result['media_size_mb'] = round(total_size / (1024**2), 1)
    except Exception:
        pass

    # Размер БД (приблизительно)
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_database_size(current_database())")
            db_size = cursor.fetchone()[0]
            result['db_size_mb'] = round(db_size / (1024**2), 1)
    except Exception:
        pass

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_clients_excel_view(request):
    """Экспорт всех клиентов в Excel-файл."""
    import openpyxl, io
    from .models import Client

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Клиенты"

    # Заголовки
    headers = ['ID', 'ФИО', 'Телефон', 'Email', 'Адрес', 'Л/счет', '№ парадной', 'УК/ТСЖ',
               'Район (мун.)', 'Источник', 'Дата добавления', 'Примечания']
    for col, h in enumerate(headers, 1):
        ws.cell(row=1, column=col, value=h)

    # Маппинг source на читаемые названия
    source_labels = {'manual': 'Ручной ввод', 'excel_import': 'Импорт (ТСЖ/УК)', 'erc': 'ЕРЦ'}

    for row_idx, c in enumerate(Client.objects.all().order_by('id'), 2):
        ws.cell(row=row_idx, column=1, value=c.id)
        ws.cell(row=row_idx, column=2, value=c.name)
        ws.cell(row=row_idx, column=3, value=c.phone)
        ws.cell(row=row_idx, column=4, value=c.email)
        ws.cell(row=row_idx, column=5, value=c.address)
        ws.cell(row=row_idx, column=6, value=c.personal_account_number or '')
        ws.cell(row=row_idx, column=7, value=c.entrance_number)
        ws.cell(row=row_idx, column=8, value=c.management_company)
        ws.cell(row=row_idx, column=9, value=c.district)
        ws.cell(row=row_idx, column=10, value=source_labels.get(c.source, c.source))
        ws.cell(row=row_idx, column=11, value=c.created_at.strftime('%d.%m.%Y %H:%M') if c.created_at else '')
        ws.cell(row=row_idx, column=12, value=c.notes)

    buf = io.BytesIO()
    wb.save(buf)

    response = HttpResponse(buf.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename=clients_export.xlsx'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cleanup_media_view(request):
    """Очистка медиафайлов (фото/видео отчётов) старше N дней или все."""
    from django.utils import timezone
    from .models import OrderMedia
    import os

    days = request.data.get('days')
    delete_all = request.data.get('delete_all', False)

    deleted_count = 0
    deleted_size = 0

    qs = OrderMedia.objects.all()

    if delete_all:
        pass  # удаляем все
    elif days:
        cutoff = timezone.now() - timezone.timedelta(days=int(days))
        qs = qs.filter(uploaded_at__lt=cutoff)
    else:
        return Response({'success': False, 'error': 'Укажите days или delete_all'}, status=400)

    for media in qs:
        try:
            if media.file:
                deleted_size += media.file.size
                media.file.delete(save=False)
            media.delete()
            deleted_count += 1
        except Exception as e:
            pass

    return Response({
        'success': True,
        'deleted_count': deleted_count,
        'deleted_size_mb': round(deleted_size / (1024**2), 1),
    })
