from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import authenticate
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
from .models import Region, Master, Client, Equipment, Order, OrderHistory, Report, Building, TraccarSettings, TraccarDevice, SystemSettings, UserProfile, WorkShift, OrderMedia, PushToken
from .models import MaxBotSettings, MaxUserLink
from .models import InventoryItem, InventoryMovement, Payment, MasterSalary
from django.db.models import Q
from .serializers import (
    RegionSerializer, MasterSerializer, ClientSerializer,
    EquipmentSerializer, OrderSerializer, OrderCreateSerializer,
    OrderStatusUpdateSerializer, ReportSerializer, UserSerializer, LoginSerializer,
    BuildingSerializer, BuildingDetailSerializer, TraccarSettingsSerializer, TraccarDeviceSerializer,
    SystemSettingsSerializer, UserProfileSerializer, WorkShiftSerializer, OrderMediaSerializer, PushTokenSerializer
)
from .serializers import InventoryItemSerializer, InventoryMovementSerializer, PaymentSerializer, MasterSalarySerializer


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
    filterset_fields = ['region']
    search_fields = ['name', 'phone', 'email', 'address']

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
    search_fields = ['number', 'address', 'description']
    ordering_fields = ['created_at', 'priority', 'status']

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
                return queryset.filter(Q(master=master) | Q(helpers=user))
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

        # Добавляем помощников
        helper_ids = request.data.get('helper_ids', [])
        if helper_ids:
            from django.contrib.auth.models import User as AuthUser
            order.helpers.set(AuthUser.objects.filter(id__in=helper_ids))

        # Создаем запись в истории
        OrderHistory.objects.create(
            order=order,
            changed_by=request.user,
            old_status='',
            new_status=order.status
        )

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

            # Если на паузе — обязательный комментарий
            if order.status == 'paused' and not notes:
                return Response(
                    {'error': 'Для статуса "На паузе" обязательно укажите причину (notes)'},
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

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Назначить заявку мастеру (сразу или на конкретную дату)"""
        order = self.get_object()
        master_id = request.data.get('master_id')
        scheduled_at = request.data.get('scheduled_at')  # Отложенное назначение

        if not master_id:
            return Response({'error': 'Не указан ID мастера'}, status=400)

        try:
            master = Master.objects.get(id=master_id)
        except Master.DoesNotExist:
            return Response({'error': 'Мастер не найден'}, status=404)

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
            notes=f'Заявка назначена мастеру: {master}'
        )

        # Уведомление мастеру
        send_push_notification(master.user_id,
            'Новая заявка',
            f'#{order.number} — {order.get_order_type_display()}, {order.address}')

        # Max-уведомление клиенту: назначен мастер
        if order.client:
            try:
                from .max_service import notify_client_order_assigned
                notify_client_order_assigned(
                    client_id=order.client_id,
                    order_number=order.number,
                    order_type=order.get_order_type_display(),
                    address=order.full_address,
                    master_name=master.user.get_full_name() or master.user.username,
                    master_phone=master.phone or 'не указан',
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
    send_notification_to_user(user_id, title, body)


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
    filterset_fields = ['item_type', 'status']
    search_fields = ['name', 'serial_number', 'model_name', 'supplier']

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
        """Приход на склад"""
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
    queryset = InventoryMovement.objects.select_related('item', 'master', 'master__user', 'order', 'performed_by')
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

