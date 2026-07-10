"""
Экспорт и импорт в Битрикс24 через Webhook REST API.
Формат URL: https://domain.bitrix24.ru/rest/USER_ID/WEBHOOK_KEY/
Методы: GET для list, POST для add/update — с суффиксом .json
"""
import requests


class Bitrix24Service:
    """Сервис для взаимодействия с Битрикс24 через Webhook"""

    def __init__(self, webhook_url=None):
        self._webhook = webhook_url

    @property
    def webhook(self):
        if self._webhook:
            url = self._webhook.rstrip('/')
        else:
            try:
                from main.models import SystemSettings
                s = SystemSettings.objects.first()
                url = (s.bitrix24_webhook or '').rstrip('/') if s else ''
            except Exception:
                return ''
        # Убираем profile.json с конца — нам нужен только базовый путь /rest/USER/KEY
        if url.endswith('/profile.json'):
            url = url[:-13]
        elif url.endswith('.json'):
            url = url[:url.rindex('/')]
        return url

    @property
    def is_configured(self):
        return bool(self.webhook and self.webhook.startswith('https://'))

    def _call_get(self, method, params=None):
        """GET-запрос (для list-методов). Поддерживает array-параметры для Битрикс24."""
        if not self.is_configured:
            return {'error': 'Bitrix24 webhook не настроен'}
        url = f'{self.webhook}/{method}.json'
        # requests не умеет params={'select[]': [a,b]} → надо вручную развернуть в select[0]=...&select[1]=...
        flat_params = {}
        if params:
            for k, v in params.items():
                if isinstance(v, list):
                    for i, item in enumerate(v):
                        flat_params[f'{k.replace("[]","")}[{i}]'] = item
                else:
                    flat_params[k] = v
        try:
            resp = requests.get(url, params=flat_params or None, timeout=30)
            return resp.json()
        except Exception as e:
            return {'error': str(e)}

    def _call_post(self, method, data=None):
        """POST-запрос (для add/update)"""
        if not self.is_configured:
            return {'error': 'Bitrix24 webhook не настроен'}
        url = f'{self.webhook}/{method}.json'
        try:
            resp = requests.post(url, json=data or {}, timeout=30)
            return resp.json()
        except Exception as e:
            return {'error': str(e)}

    def export_clients(self, clients_queryset=None):
        """Экспорт клиентов CRM в контакты Битрикс24"""
        if not self.is_configured:
            return {'error': 'Не настроен webhook Битрикс24. Укажите URL в системных настройках.'}
        from main.models import Client
        clients = clients_queryset or Client.objects.all()
        results = {'created': 0, 'errors': []}
        for client in clients[:500]:
            name = (client.name or '').strip()
            parts = name.split(' ', 1)
            first_name = parts[0] if parts else name
            last_name = parts[1] if len(parts) > 1 else ''
            params = {
                'fields': {
                    'NAME': first_name,
                    'LAST_NAME': last_name,
                    'PHONE': [{'VALUE': client.phone or '', 'VALUE_TYPE': 'WORK'}],
                    'EMAIL': [{'VALUE': client.email or '', 'VALUE_TYPE': 'WORK'}],
                    'ADDRESS': client.address or '',
                    'COMMENTS': f'Источник: {client.get_source_display()}\nЛицевой счёт: {client.personal_account_number or ""}',
                }
            }
            try:
                result = self._call_post('crm.contact.add', params)
                if 'error' in result:
                    results['errors'].append(f'{name}: {result.get("error_description", result["error"])}')
                else:
                    results['created'] += 1
            except Exception as e:
                results['errors'].append(f'{name}: {str(e)}')
        return results

    def import_clients(self):
        """Загрузить контакты из Битрикс24 в CRM"""
        if not self.is_configured:
            return {'error': 'Не настроен webhook Битрикс24.'}
        from main.models import Client
        result = self._call_get('crm.contact.list')
        if 'error' in result:
            return {'error': result.get('error_description', result['error'])}
        contacts = result.get('result', [])
        created = 0
        errors = []
        for c in contacts:
            first = c.get('NAME') or ''
            last = c.get('LAST_NAME') or ''
            name = f"{first} {last}".strip()
            if not name:
                continue
            phone = ''
            phones = c.get('PHONE') or []
            if phones and isinstance(phones, list):
                phone = (phones[0].get('VALUE', '') if isinstance(phones[0], dict) else str(phones[0]))
            phone = phone or ''
            email = ''
            emails = c.get('EMAIL') or []
            if emails and isinstance(emails, list):
                email = (emails[0].get('VALUE', '') if isinstance(emails[0], dict) else str(emails[0]))
            email = email or ''
            address = c.get('ADDRESS') or ''
            try:
                if phone:
                    # Если есть телефон — ищем по нему, иначе создаём нового
                    client, _ = Client.objects.update_or_create(
                        phone=phone,
                        defaults={'name': name, 'email': email, 'address': address, 'source': 'bitrix24'},
                    )
                else:
                    # Без телефона — просто создаём (может быть дубль, но не теряем данные)
                    Client.objects.create(name=name, email=email, address=address, source='bitrix24')
                created += 1
            except Exception as e:
                errors.append(f'{name}: {str(e)}')
        return {'created': created, 'total_in_bitrix': len(contacts), 'errors': errors}

    def export_products(self, items_queryset=None):
        """Экспорт товаров со склада CRM в товары Битрикс24"""
        if not self.is_configured:
            return {'error': 'Не настроен webhook Битрикс24.'}
        from main.models import InventoryItem
        items = items_queryset or InventoryItem.objects.all()
        results = {'created': 0, 'errors': []}
        for item in items[:500]:
            params = {
                'fields': {
                    'NAME': f'{item.get_item_type_display()} {item.name}',
                    'CODE': item.barcode or '',
                    'PRICE': str(item.sale_price or 0),
                    'CURRENCY_ID': 'RUB',
                    'DESCRIPTION': f'Тип: {item.get_item_type_display()}\nМодель: {item.model_name or "—"}\nS/N: {item.serial_number or "—"}\nКол-во: {item.quantity} {item.unit}',
                }
            }
            try:
                result = self._call_post('crm.product.add', params)
                if 'error' in result:
                    results['errors'].append(f'{item.name}: {result.get("error_description", result["error"])}')
                else:
                    results['created'] += 1
            except Exception as e:
                results['errors'].append(f'{item.name}: {str(e)}')
        return results

    def import_products(self):
        """Загрузить товары из Битрикс24 в CRM"""
        if not self.is_configured:
            return {'error': 'Не настроен webhook Битрикс24.'}
        from main.models import InventoryItem
        result = self._call_get('crm.product.list')
        if 'error' in result:
            return {'error': result.get('error_description', result['error'])}
        products = result.get('result', [])
        created = 0
        errors = []
        for p in products:
            name = p.get('NAME', '')
            barcode = p.get('CODE', '') or None
            price = p.get('PRICE', 0)
            try:
                if barcode:
                    item = InventoryItem.objects.filter(barcode=barcode).first()
                    if item:
                        item.sale_price = price
                        item.save(update_fields=['sale_price', 'updated_at'])
                        continue
                InventoryItem.objects.create(name=name, barcode=barcode, sale_price=price, item_type='other')
                created += 1
            except Exception as e:
                errors.append(f'{name}: {str(e)}')
        return {'created': created, 'total_in_bitrix': len(products), 'errors': errors}


bitrix24 = Bitrix24Service()
