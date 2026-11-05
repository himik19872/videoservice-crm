"""Интеграция с Traccar: треки мастеров, дневной пробег, расход топлива.

Функции модуля используются:
  • management-командой `sync_traccar_mileage` (по cron каждые 10 минут),
  • действиями API `POST /api/traccar/devices/sync/`,
  • ручным обновлением GPS в карточке мастера.
"""
import math
from datetime import datetime, time, timedelta, timezone as dt_timezone

import requests
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import (
    Master, MasterDailyMileage, MasterTrackPoint,
    OrderHistory, TraccarDevice, TraccarSettings,
)

KNOTS_TO_KMH = 1.852
MIN_STEP_KM = 0.03       # «дрожание» GPS — шаги меньше 30 м не считаем
MAX_SPEED_KMH = 180.0    # отсечка «телепортов» и ошибок позиционирования


# ── Настройки и HTTP ─────────────────────────────────────────────────────────
def get_active_settings():
    settings = TraccarSettings.objects.first()
    return settings if settings and settings.is_active else None


def _api_get(settings, path, params, timeout=25):
    url = '{}{}'.format(settings.server_url.rstrip('/'), path)
    resp = requests.get(url, auth=(settings.username, settings.password), params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _parse_ts(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, dt_timezone.utc)
    return dt


# ── Геометрия ────────────────────────────────────────────────────────────────
def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _day_bounds(day):
    """Границы суток в локальной таймзоне"""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = start + timedelta(days=1)
    return start, end


# ── Загрузка точек из Traccar ────────────────────────────────────────────────
def fetch_positions(settings, device_ids, dt_from, dt_to):
    """Позиции за период. Запрашиваем по одному устройству — так надёжнее.

    Ошибки авторизации (401/403) НЕ игнорируются — иначе синхронизация молча
    возвращает пустой трек и кажется, что всё работает.
    """
    positions = []
    last_error = ''
    for device_id in device_ids:
        try:
            positions.extend(_api_get(settings, '/api/positions', {
                'deviceId': device_id,
                'from': dt_from.astimezone(dt_timezone.utc).isoformat(),
                'to': dt_to.astimezone(dt_timezone.utc).isoformat(),
            }))
        except requests.HTTPError as e:
            code = getattr(getattr(e, 'response', None), 'status_code', None)
            if code in (401, 403):
                msg = ('Traccar отклонил авторизацию (HTTP {}). '
                       'Проверьте логин/пароль в настройках интеграции.'.format(code))
                try:
                    settings.last_error = msg
                    settings.save(update_fields=['last_error', 'updated_at'])
                except Exception:
                    pass
                raise RuntimeError(msg)
            last_error = str(e)
            continue
        except Exception as e:
            last_error = str(e)
            continue
    if last_error and not positions:
        try:
            settings.last_error = last_error[:500]
            settings.save(update_fields=['last_error', 'updated_at'])
        except Exception:
            pass
    return positions


def save_points(master, positions, source='traccar'):
    """Сохранить позиции в трек мастера (дубликаты по времени пропускаются)"""
    created = 0
    for pos in sorted(positions, key=lambda p: p.get('fixTime') or p.get('deviceTime') or ''):
        ts = _parse_ts(pos.get('fixTime') or pos.get('deviceTime'))
        lat, lon = pos.get('latitude'), pos.get('longitude')
        if ts is None or lat is None or lon is None:
            continue
        speed = pos.get('speed')
        _, was_created = MasterTrackPoint.objects.get_or_create(
            master=master, source=source, recorded_at=ts,
            defaults={
                'latitude': lat,
                'longitude': lon,
                'speed_kmh': round(speed * KNOTS_TO_KMH, 1) if speed else None,
                'accuracy': pos.get('accuracy'),
            },
        )
        if was_created:
            created += 1
    return created


def import_app_points(master, day):
    """Перенести в трек отметки из мобильного приложения (OrderHistory.master_lat/lon)"""
    start, end = _day_bounds(day)
    history = OrderHistory.objects.filter(
        order__master=master,
        master_lat__isnull=False, master_lon__isnull=False,
        changed_at__gte=start, changed_at__lt=end,
    ).order_by('changed_at')
    created = 0
    for h in history:
        _, was_created = MasterTrackPoint.objects.get_or_create(
            master=master, source='app', recorded_at=h.changed_at,
            defaults={'latitude': h.master_lat, 'longitude': h.master_lon},
        )
        if was_created:
            created += 1
    return created


# ── Расчёт пробега ───────────────────────────────────────────────────────────
def _apply_distances(points):
    """Проставить каждой точке расстояние от предыдущей (с фильтрацией шума)"""
    prev = None
    total = 0.0
    for point in points:
        step = 0.0
        if prev is not None:
            step = haversine_km(prev.latitude, prev.longitude, point.latitude, point.longitude)
            seconds = max((point.recorded_at - prev.recorded_at).total_seconds(), 1)
            speed = step / (seconds / 3600.0)
            if step < MIN_STEP_KM or speed > MAX_SPEED_KMH:
                step = 0.0
        if point.distance_km != step:
            point.distance_km = step
            point.save(update_fields=['distance_km'])
        total += step
        prev = point
    return total


def recalc_daily_mileage(master, day):
    """Пересчитать дневной пробег, топливо и вернуть объект MasterDailyMileage"""
    start, end = _day_bounds(day)

    track_points = list(MasterTrackPoint.objects.filter(
        master=master, source='traccar', recorded_at__gte=start, recorded_at__lt=end,
    ).order_by('recorded_at'))
    app_points = list(MasterTrackPoint.objects.filter(
        master=master, source='app', recorded_at__gte=start, recorded_at__lt=end,
    ).order_by('recorded_at'))

    distance = _apply_distances(track_points)
    app_distance = _apply_distances(app_points)

    consumption = float(master.fuel_consumption or 0)
    price = float(master.fuel_price or 0)
    fuel_liters = round(distance * consumption / 100.0, 2)
    fuel_cost = round(fuel_liters * price, 2)

    all_points = track_points + app_points
    first_at = min((p.recorded_at for p in all_points), default=None)
    last_at = max((p.recorded_at for p in all_points), default=None)

    obj, _ = MasterDailyMileage.objects.update_or_create(
        master=master, date=day,
        defaults={
            'distance_km': round(distance, 2),
            'app_distance_km': round(app_distance, 2),
            'points_count': len(all_points),
            'fuel_liters': fuel_liters,
            'fuel_cost': fuel_cost,
            'first_point_at': first_at,
            'last_point_at': last_at,
        },
    )
    return obj


# ── Синхронизация ────────────────────────────────────────────────────────────
def sync_master_day(master, day, settings=None):
    """Скачать трек мастера за день и пересчитать пробег"""
    settings = settings or get_active_settings()
    start, end = _day_bounds(day)
    device = getattr(master, 'traccar_device', None)
    saved = 0

    if settings and device:
        positions = fetch_positions(settings, [device.internal_device_id], start, end)
        saved = save_points(master, positions, source='traccar')
        latest = positions[-1] if positions else None
        if latest:
            device.last_latitude = latest.get('latitude')
            device.last_longitude = latest.get('longitude')
            speed = latest.get('speed')
            device.last_speed = round(speed * KNOTS_TO_KMH, 1) if speed else None
            device.last_update = _parse_ts(latest.get('fixTime')) or timezone.now()
            device.is_online = (timezone.now() - device.last_update).total_seconds() < 3600
            device.save(update_fields=['last_latitude', 'last_longitude', 'last_speed',
                                       'last_update', 'is_online'])

    import_app_points(master, day)
    daily = recalc_daily_mileage(master, day)
    return {'master_id': master.id, 'date': str(day), 'saved_points': saved,
            'distance_km': daily.distance_km, 'fuel_liters': daily.fuel_liters}


def sync_day(day=None, settings=None):
    """Синхронизировать всех мастеров с маяками за конкретный день"""
    day = day or timezone.localdate()
    settings = settings or get_active_settings()
    masters = Master.objects.select_related('traccar_device', 'user').all()
    results = [sync_master_day(m, day, settings) for m in masters]
    if settings:
        try:
            settings.last_sync_at = timezone.now()
            settings.save(update_fields=['last_sync_at', 'updated_at'])
        except Exception:
            pass
    return {
        'date': str(day),
        'masters': len(results),
        'distance_km': round(sum(r['distance_km'] for r in results), 2),
        'details': results,
    }


def sync_days(days=1):
    """Синхронизация за последние N дней (включая сегодня)"""
    today = timezone.localdate()
    summary = []
    for offset in range(days - 1, -1, -1):
        summary.append(sync_day(today - timedelta(days=offset)))
    return summary


def track_for_day(master, day):
    """Точки трека за день — для карты в карточке мастера"""
    start, end = _day_bounds(day)
    points = MasterTrackPoint.objects.filter(
        master=master, recorded_at__gte=start, recorded_at__lt=end,
    ).order_by('recorded_at')
    return [{
        'lat': p.latitude,
        'lon': p.longitude,
        'source': p.source,
        'speed': p.speed_kmh,
        'distance_km': p.distance_km,
        'time': p.recorded_at.isoformat(),
    } for p in points]
