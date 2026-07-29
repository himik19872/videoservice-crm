"""
API для интеграции с Ростелеком АТС.
Синхронизация истории звонков (CDR) и управление настройками интеграции.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from datetime import datetime, timedelta
from .rostelecom_service import RostelecomAPI
from .models import CallLog, Client, SystemSettings


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rostelecom_get_calls_view(request):
    """
    Получение последних звонков из Ростелеком АТС.
    
    Параметры запроса:
    - days: количество дней для получения звонков (по умолчанию 1)
    - limit: лимит записей (по умолчанию 100)
    
    Возвращает список звонков без сохранения в БД.
    """
    try:
        days = int(request.query_params.get('days', 1))
        limit = int(request.query_params.get('limit', 100))
        
        # Получаем настройки Ростелеком
        settings = SystemSettings.objects.first()
        if not settings or not settings.rostelecom_active:
            return Response({
                'success': False,
                'error': 'Интеграция с Ростелеком АТС не активирована'
            })
        
        # Инициализируем API
        rostelecom = RostelecomAPI(
            account_id=settings.rostelecom_account_id,
            api_token=settings.rostelecom_api_token
        )
        
        # Вычисляем дату начала периода
        start_date = datetime.now() - timedelta(days=days)
        
        # Получаем звонки
        result = rostelecom.get_calls(start_date=start_date, limit=limit)
        
        if 'error' in result:
            return Response({
                'success': False,
                'error': result['error']
            })
        
        calls = result.get('calls', [])
        
        return Response({
            'success': True,
            'count': len(calls),
            'calls': calls
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rostelecom_sync_calls_view(request):
    """
    Запуск синхронизации звонков из Ростелеком АТС в CRM.
    
    Тело запроса (опционально):
    - days: количество дней для синхронизации (по умолчанию 1)
    - dry_run: если true, только предварительный просмотр (по умолчанию false)
    
    Возвращает результат синхронизации:
    - total_found: найдено звонков
    - synced: синхронизировано новых
    - updated: обновлено существующих
    - failed: ошибок
    """
    try:
        days = int(request.data.get('days', 1))
        dry_run = bool(request.data.get('dry_run', False))
        
        # Получаем настройки Ростелеком
        settings = SystemSettings.objects.first()
        if not settings or not settings.rostelecom_active:
            return Response({
                'success': False,
                'error': 'Интеграция с Ростелеком АТС не активирована'
            })
        
        # Инициализируем API
        rostelecom = RostelecomAPI(
            account_id=settings.rostelecom_account_id,
            api_token=settings.rostelecom_api_token
        )
        
        # Вычисляем дату начала периода
        start_date = datetime.now() - timedelta(days=days)
        
        if dry_run:
            # Режим предварительного просмотра
            result = rostelecom.get_calls(start_date=start_date, limit=1000)
            
            if 'error' in result:
                return Response({
                    'success': False,
                    'error': result['error']
                })
            
            calls = result.get('calls', [])
            
            # Считаем, сколько новых и обновленных
            new_count = 0
            updated_count = 0
            for call_data in calls:
                # Нормализуем номер телефона
                phone = call_data.get('phone', '')
                normalized_phone = ''.join(filter(str.isdigit, phone))
                
                # Ищем существующую запись
                existing = CallLog.objects.filter(
                    phone__endswith=normalized_phone[-10:]
                ).filter(
                    start_time__gte=start_date,
                    start_time__lte=datetime.now()
                ).first()
                
                if existing:
                    updated_count += 1
                else:
                    new_count += 1
            
            return Response({
                'success': True,
                'dry_run': True,
                'total_found': len(calls),
                'new': new_count,
                'updated': updated_count
            })
        else:
            # Реальная синхронизация
            result = rostelecom.sync_calls_to_db(start_date=start_date)
            
            return Response({
                'success': True,
                **result
            })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rostelecom_status_view(request):
    """
    Проверка статуса интеграции с Ростелеком АТС.
    
    Возвращает:
    - active: активна ли интеграция
    - last_sync: время последней синхронизации
    - total_calls: общее количество звонков в БД
    - settings_present: заполнены ли настройки
    """
    try:
        settings = SystemSettings.objects.first()
        
        # Проверяем настройки
        settings_present = bool(
            settings and 
            settings.rostelecom_account_id and 
            settings.rostelecom_api_token
        )
        
        # Получаем статистику
        total_calls = CallLog.objects.count()
        last_sync = CallLog.objects.order_by('-synced_at').first()
        
        return Response({
            'success': True,
            'active': settings.rostelecom_active if settings else False,
            'settings_present': settings_present,
            'last_sync': last_sync.synced_at.isoformat() if last_sync else None,
            'total_calls': total_calls
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rostelecom_test_connection_view(request):
    """
    Тестовое подключение к Ростелеком АТС API.
    
    Тело запроса:
    - account_id: Account ID Ростелеком
    - api_token: API токен Ростелеком
    
    Возвращает результат тестового подключения.
    """
    try:
        account_id = request.data.get('account_id', '').strip()
        api_token = request.data.get('api_token', '').strip()
        
        if not account_id or not api_token:
            return Response({
                'success': False,
                'error': 'Необходимо указать account_id и api_token'
            })
        
        # Инициализируем API с тестовыми данными
        rostelecom = RostelecomAPI(account_id=account_id, api_token=api_token)
        
        # Пытаемся получить звонки за 1 день (только проверка подключения)
        result = rostelecom.test_connection()
        
        return Response({
            'success': True,
            'message': 'Подключение успешно',
            **result
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rostelecom_update_settings_view(request):
    """
    Обновление настроек интеграции с Ростелеком АТС.
    
    Тело запроса (опционально):
    - account_id: Account ID Ростелеком
    - api_token: API токен Ростелеком
    - active: активировать/деактивировать интеграцию
    
    Возвращает обновленные настройки.
    """
    try:
        settings = SystemSettings.objects.first()
        
        if not settings:
            return Response({
                'success': False,
                'error': 'Системные настройки не найдены'
            })
        
        # Обновляем поля
        if 'account_id' in request.data:
            settings.rostelecom_account_id = request.data['account_id'].strip()
        if 'api_token' in request.data:
            settings.rostelecom_api_token = request.data['api_token'].strip()
        if 'active' in request.data:
            settings.rostelecom_active = bool(request.data['active'])
        
        settings.save()
        
        return Response({
            'success': True,
            'message': 'Настройки обновлены',
            'settings': {
                'account_id': settings.rostelecom_account_id,
                'active': settings.rostelecom_active
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        })
