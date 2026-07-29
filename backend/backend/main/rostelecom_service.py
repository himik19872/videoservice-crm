"""
Интеграция с Ростелеком АТС (виртуальная АТС).
Сервис для получения истории звонков (CDR) через API Ростелеком.
"""
import requests
from datetime import datetime, timedelta



class RostelecomAPI:
    """
    Сервис для взаимодействия с API Ростелеком АТС.
    
    TODO: Заполнить реальными данными после получения документации:
    - BASE_URL (endpoint для получения CDR)
    - endpoинты для аутентификации/получения токена
    - формат запросов и ответов
    - параметры фильтрации (дата, номер, account_id)
    """

    def __init__(self, account_id=None, api_token=None):
        self._account_id = account_id
        self._api_token = api_token
        self.base_url = "https://api.rostelecom.ru/ats"  # TODO: уточнить реальный URL
        self._auth_token = None
        self._token_expires = None

    @property
    def account_id(self):
        if self._account_id:
            return self._account_id
        try:
            from main.models import SystemSettings
            s = SystemSettings.objects.first()
            return s.rostelecom_account_id if s else ''
        except Exception:
            return ''

    @property
    def api_token(self):
        if self._api_token:
            return self._api_token
        try:
            from main.models import SystemSettings
            s = SystemSettings.objects.first()
            return s.rostelecom_api_token if s else ''
        except Exception:
            return ''

    @property
    def is_configured(self):
        return bool(self.account_id and self.api_token)

    def _get_auth_token(self):
        """
        Получение или обновление токена аутентификации.
        TODO: Реализовать реальный метод аутентификации после получения документации.
        Возможные варианты:
        - OAuth2 client_credentials
        - API token в header
        - Basic Auth
        """
        if self._auth_token and self._token_expires and datetime.now() < self._token_expires:
            return self._auth_token
        
        # TODO: Заменить на реальный endpoint аутентификации
        auth_url = f"{self.base_url}/auth/token"
        
        # TODO: Уточнить формат запроса для получения токена
        try:
            response = requests.post(
                auth_url,
                json={
                    "account_id": self.account_id,
                    "api_key": self.api_token
                },
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            self._auth_token = data.get("access_token") or data.get("token")
            expires_in = data.get("expires_in", 3600)
            self._token_expires = datetime.now() + timedelta(seconds=expires_in)
            
            return self._auth_token
        except Exception as e:
            raise Exception(f"Ошибка аутентификации в Ростелеком: {str(e)}")

    def _call_api(self, method, endpoint, params=None, data=None):
        """
        Выполнение API-запроса с автоматической аутентификацией.
        """
        if not self.is_configured:
            raise Exception("Ростелеком АТС не настроен (нет account_id или api_token)")
        
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self._get_auth_token()}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Неподдерживаемый метод: {method}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 401:
                # Токен просрочен, пробуем снова
                self._auth_token = None
                self._token_expires = None
                headers["Authorization"] = f"Bearer {self._get_auth_token()}"
                response = requests.get(url, headers=headers, params=params, timeout=30)
                response.raise_for_status()
                return response.json()
            raise Exception(f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            raise Exception(f"Ошибка API Ростелеком: {str(e)}")

    def get_calls(self, start_date=None, end_date=None, phone=None, limit=1000):
        """
        Получение истории звонков за период.
        
        Args:
            start_date: Начальная дата (datetime или str в формате 'YYYY-MM-DD')
            end_date: Конечная дата (datetime или str в формате 'YYYY-MM-DD')
            phone: Фильтр по номеру телефона (опционально)
            limit: Максимальное количество записей
            
        Returns:
            list: Список звонков с полями:
                - call_id: ID звонка
                - phone: Номер звонящего
                - direction: 'incoming' или 'outgoing'
                - start_time: Время начала звонка
                - duration: Длительность в секундах
                - call_type: Тип звонка (voip, mobile, landline)
                - status: Статус звонка (completed, missed, busy)
        """
        if not self.is_configured:
            return {'error': 'Ростелеком АТС не настроен'}
        
        # TODO: Заменить на реальный endpoint получения CDR
        endpoint = "/cdr/list"
        
        # Форматирование дат
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        # По умолчанию - последние 24 часа
        if not start_date:
            start_date = datetime.now() - timedelta(hours=24)
        if not end_date:
            end_date = datetime.now()
        
        params = {
            "start_date": start_date.strftime("%Y-%m-%d %H:%M:%S"),
            "end_date": end_date.strftime("%Y-%m-%d %H:%M:%S"),
            "limit": limit
        }
        
        if phone:
            params["phone"] = phone
        
        try:
            result = self._call_api("GET", endpoint, params=params)
            
            # TODO: Адаптировать под реальную структуру ответа API
            # Пример ожидаемой структуры:
            cdr_records = []
            
            # Заглушка - заменить на реальную обработку
            if isinstance(result, dict) and "data" in result:
                for record in result.get("data", []):
                    cdr_records.append({
                        "call_id": record.get("call_id"),
                        "phone": record.get("phone"),
                        "direction": record.get("direction"),
                        "start_time": record.get("start_time"),
                        "duration": record.get("duration", 0),
                        "call_type": record.get("call_type", "unknown"),
                        "status": record.get("status", "completed")
                    })
            
            return {'calls': cdr_records, 'count': len(cdr_records)}
            
        except Exception as e:
            return {'error': str(e)}

    def test_connection(self):
        """
        Тестовое подключение к API Ростелеком АТС.
        
        Returns:
            dict: Результат теста
        """
        if not self.is_configured:
            return {
                'success': False,
                'message': 'Ростелеком АТС не настроен (нет account_id или api_token)'
            }
        
        try:
            # Пытаемся получить токен (проверка учётных данных)
            token = self._get_auth_token()
            
            if not token:
                return {
                    'success': False,
                    'message': 'Не удалось получить токен аутентификации'
                }
            
            # Тестовый запрос к API (получение метаданных или списка звонков)
            # TODO: Заменить на реальный endpoint для проверки подключения
            result = self._call_api("GET", "/cdr/list", params={"limit": 1})
            
            return {
                'success': True,
                'message': 'Подключение успешно',
                'account_id': self.account_id,
                'api_url': self.base_url
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Ошибка подключения: {str(e)}'
            }

    def sync_calls_to_db(self, start_date=None, end_date=None):
        """
        Синхронизация звонков из Ростелеком в базу данных CRM.
        Создает или обновляет записи CallLog.
        
        Returns:
            dict: Результат синхронизации
        """
        from main.models import CallLog, Client
        
        if not self.is_configured:
            return {'error': 'Ростелеком АТС не настроен'}
        
        result = self.get_calls(start_date=start_date, end_date=end_date)
        
        if 'error' in result:
            return result
        
        calls = result.get('calls', [])
        created = 0
        updated = 0
        errors = []
        
        for call in calls:
            try:
                phone = call.get('phone', '')
                if not phone:
                    continue
                
                # Проверка на дубликат по call_id или уникальным параметрам
                call_id = call.get('call_id')
                if call_id:
                    existing = CallLog.objects.filter(call_id=call_id).first()
                else:
                    # Если нет call_id, ищем по параметрам
                    existing = CallLog.objects.filter(
                        phone=phone,
                        direction=call.get('direction'),
                        start_time=call.get('start_time')
                    ).first()
                
                # Привязка к клиенту по номеру телефона
                client = None
                if phone:
                    # Нормализация номера (убираем +, пробелы, дефисы)
                    normalized_phone = ''.join(filter(str.isdigit, phone))
                    
                    # Ищем клиента по полному номеру
                    client = Client.objects.filter(phone__endswith=normalized_phone).first()
                    
                    # Если не нашли, пробуем по номеру без кода страны
                    if not client and len(normalized_phone) > 10:
                        local_number = normalized_phone[-10:]  # Последние 10 цифр
                        client = Client.objects.filter(phone__endswith=local_number).first()
                
                call_data = {
                    'phone': phone,
                    'direction': call.get('direction', 'incoming'),
                    'start_time': call.get('start_time'),
                    'duration': call.get('duration', 0),
                    'call_type': call.get('call_type', 'unknown'),
                    'status': call.get('status', 'completed'),
                    'client': client,
                    'raw_data': call  # Сохраняем полные данные
                }
                
                if existing:
                    # Обновляем существующую запись
                    for key, value in call_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    updated += 1
                else:
                    # Создаем новую запись
                    CallLog.objects.create(**call_data)
                    created += 1
                    
            except Exception as e:
                errors.append(f"Ошибка при обработке звонка {call.get('call_id', 'unknown')}: {str(e)}")
        
        return {
            'total': len(calls),
            'created': created,
            'updated': updated,
            'errors': errors
        }


rostelecom = RostelecomAPI()
