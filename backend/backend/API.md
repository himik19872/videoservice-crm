# 📡 Документация API — VideoService CRM

> **Базовый URL**: `http://ВАШ_IP:3000/api/`  
> **Аутентификация**: Token-based (DRF TokenAuthentication)  
> **Формат**: JSON (Content-Type: application/json)  
> **Кодировка**: UTF-8  

---

## 🔐 Аутентификация

Все эндпоинты (кроме `/auth/login/`, `/max/webhook/` и `/admin/`) требуют заголовок:

```
Authorization: Token <ваш_токен>
```

<details>
<summary><b>POST /api/auth/login/</b> — Вход</summary>

**Тело запроса:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Ответ (200):**
```json
{
  "token": "82075cca5f803523e1da394dc61b2c9c0d4db021",
  "user": {
    "id": 1, "username": "admin", "email": "",
    "first_name": "", "last_name": "",
    "role": "admin", "master_profile": null,
    "profile": { "role": "admin", "phone": "", "is_on_shift": false }
  }
}
```
</details>

<details>
<summary><b>POST /api/auth/refresh/</b> — Обновить токен</summary>

**Тело:** `{}` (пустой объект)  
**Ответ:** `{ "token": "новый_токен" }`
</details>

<details>
<summary><b>GET /api/users/me/</b> — Текущий пользователь</summary>

**Ответ:** `{ "id": 1, "username": "admin", "role": "admin", ... }`
</details>

---

## 👥 Пользователи и сотрудники

### `/api/users/` — UserProfile (ViewSet)

| Метод | URL | Описание | Параметры |
|-------|-----|----------|-----------|
| `GET` | `/api/users/` | Список сотрудников | `?search=имя&role=admin` |
| `POST` | `/api/users/` | Создать сотрудника | `{ username, password, email, first_name, last_name, role, phone, permissions }` |
| `GET` | `/api/users/{id}/` | Детали сотрудника | — |
| `PUT` | `/api/users/{id}/` | Полное обновление | Все поля |
| `PATCH` | `/api/users/{id}/` | Частичное обновление | Любые поля (включая `permissions`) |
| `DELETE` | `/api/users/{id}/` | Удалить сотрудника | — |
| `GET` | `/api/users/dispatcher_stats/` | Статистика диспетчеров | `?days=30` |

**Роли (`role`):** `admin`, `dispatcher`, `master`, `installer`, `engineer`, `chief_engineer`, `service_chief`, `tech_director`, `executive_director`, `general_director`, `clerk`, `accountant`, `cashier`, `secretary`

---

## 🗺️ Справочники

### `/api/regions/` — Районы обслуживания

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/regions/` | Список районов (`?search=`) |
| `POST` | `/api/regions/` | `{ name, description }` |
| `GET/PUT/PATCH/DELETE` | `/api/regions/{id}/` | CRUD |

### `/api/masters/` — Мастера

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/masters/` | Список (фильтры: `?region=&is_available=`; поиск: `?search=`) |
| `POST` | `/api/masters/` | Создать (авто-создаёт User + UserProfile) |
| `GET` | `/api/masters/{id}/` | Детали |
| `PUT/PATCH/DELETE` | `/api/masters/{id}/` | CRUD |

**Кастомные действия:**
| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/masters/locations/` | GPS-координаты **всех** мастеров (из Traccar или OrderHistory) |
| `GET` | `/api/masters/{id}/stats/` | Статистика мастера за месяц: заявки, среднее время, суммы |
| `POST` | `/api/masters/{id}/update_gps/` | Запросить свежие GPS-координаты из Traccar |

### `/api/clients/` — Клиенты

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/clients/` | Список (`?search=`, `?is_legal=true/false`, `?inn=`) |
| `POST` | `/api/clients/` | Создать |
| `GET/PUT/PATCH/DELETE` | `/api/clients/{id}/` | CRUD |
| `GET` | `/api/clients/{id}/erc_payments/` | История платежей ЕРЦ (по `personal_account_number`) |
| `GET` | `/api/clients/autocomplete/` | 🆕 **Автокомплит**: быстрый поиск по адресу, ИНН, названию, ФИО, телефону (`?q=запрос`, мин. 2 символа, до 15 результатов) |

**Поля клиента:** `name`, `phone`, `address`, `city`, `street`, `house`, `building`, `apartment`, `entrance`, `is_legal`, `inn`, `personal_account_number`, `max_user_id`, `source` (`manual`/`import`/`bitrix24`)

### `/api/buildings/` — Дома (обслуживаемые адреса)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/buildings/` | Список домов |
| `POST` | `/api/buildings/` | `{ city, street, house, ... }` |
| `GET/PUT/PATCH/DELETE` | `/api/buildings/{id}/` | CRUD (детали — `BuildingDetailSerializer`) |

### `/api/equipment/` — Типы оборудования

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/equipment/` | Список |
| `POST` | `/api/equipment/` | `{ name, description, warranty_months, ... }` |
| `GET/PUT/PATCH/DELETE` | `/api/equipment/{id}/` | CRUD |

---

## 📋 Заявки

### `/api/orders/` — Основной ресурс

| Метод | URL | Описание | Параметры |
|-------|-----|----------|-----------|
| `GET` | `/api/orders/` | Список заявок | `?status=&master=&region=&search=&page_size=500` |
| `POST` | `/api/orders/` | Создать заявку | `{ client, address, equipment_type, description, master, cost, ... }` |
| `GET` | `/api/orders/{id}/` | Детали (включая историю) | — |
| `PUT` | `/api/orders/{id}/` | Обновить статус | `{ status, ... }` (через `OrderStatusUpdateSerializer`) |
| `PATCH` | `/api/orders/{id}/` | Частичное обновление | — |
| `DELETE` | `/api/orders/{id}/` | Удалить заявку | — |

**Статусы заявки:** `new` → `assigned` → `accepted` → `in_progress` → `paused` / `need_help` → `completed` → `confirmed` / `canceled`

**Кастомные действия:**

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/orders/calendar/` | Календарь заявок (с `scheduled_at`, `?month=&year=`) |
| `POST` | `/api/orders/{id}/assign/` | Назначить сотрудника: `{ user_id }` |
| `POST` | `/api/orders/{id}/start/` | Начать выполнение (статус → `in_progress`) |
| `POST` | `/api/orders/{id}/complete/` | Завершить (статус → `completed`): `{ photos, notes, signature }` |
| `POST` | `/api/orders/{id}/receive_payment/` | Мастер принимает оплату: `{ amount, payment_type }` |
| `POST` | `/api/orders/{id}/submit_cash/` | Сдать наличные в кассу: `{ amount }` |
| `POST` | `/api/orders/{id}/return_item/` | Возврат оборудования на склад: `{ item_id, reason }` |
| `POST` | `/api/orders/{id}/helpers/` | Управление помощниками: `{ action: "add"/"remove", user_id }` |
| `POST` | `/api/orders/{id}/cancel/` | Отменить заявку: `{ reason }` |
| `POST` | `/api/orders/{id}/confirm/` | Диспетчер подтверждает выполнение (→ `confirmed`) |
| `POST` | `/api/orders/{id}/rework/` | Вернуть в работу |
| `GET` | `/api/orders/{id}/gps_history/` | GPS-история мастера по заявке |
| `GET` | `/api/orders/{id}/comments/` | Получить комментарии |
| `POST` | `/api/orders/{id}/comments/` | Добавить комментарий: `{ text }` |

---

## 📦 Склад и оборудование

### `/api/inventory/` — Товары (InventoryItem)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/inventory/` | Список товаров (`?search=`, `?storage_location=`) |
| `POST` | `/api/inventory/` | Создать товар (авто-привязка к первой свободной ячейке) |
| `GET/PUT/PATCH/DELETE` | `/api/inventory/{id}/` | CRUD |

**Кастомные действия:**
| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/inventory/by_barcode/` | Поиск по штрихкоду: `?code=SKU-12345678` |
| `POST` | `/api/inventory/{id}/generate_barcode/` | Сгенерировать новый штрихкод |
| `GET` | `/api/inventory/summary/` | Сводка склада: всего/на складе/у мастеров, стоимость, типы |
| `POST` | `/api/inventory/{id}/add_stock/` | Приход на склад: `{ quantity, purchase_price, sell_price, supplier }` |
| `POST` | `/api/inventory/{id}/issue_to_master/` | Выдать мастеру: `{ master_id, quantity }` |

### `/api/inventory-movements/` — Движения (ReadOnly)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/inventory-movements/` | История движений |
| `GET` | `/api/inventory-movements/{id}/` | Детали движения |

**Типы движений:** `receipt` (приход), `issue` (выдача), `return` (возврат), `install` (установка), `defect` (брак), `write_off` (списание)

### `/api/storage-locations/` — Места хранения (ячейки)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/storage-locations/` | Список ячеек (`?search=`, `?is_active=`) |
| `POST` | `/api/storage-locations/` | `{ code, zone, rack, shelf, capacity, is_active }` |
| `GET` | `/api/storage-locations/{id}/` | Детали + содержимое (сериализатор `StorageLocationDetailSerializer`) |
| `PUT/PATCH/DELETE` | `/api/storage-locations/{id}/` | CRUD |

**Кастомные действия:**
| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/storage-locations/by_barcode/` | Поиск ячейки по штрихкоду: `?code=LOC-12345678` |
| `POST` | `/api/storage-locations/{id}/move_items/` | Переместить товары: `{ item_ids: [...], target_location_id }` |
| `POST` | `/api/storage-locations/{id}/recount/` | Пересчёт: `{ item_ids: [...] }` — подтвердить список |

### `/api/suppliers/` — Поставщики

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/suppliers/` | Список (`?search=`) |
| `POST` | `/api/suppliers/` | `{ name, phone, email, inn, ... }` |
| `GET/PUT/PATCH/DELETE` | `/api/suppliers/{id}/` | CRUD |

### `/api/supply-invoices/` — Накладные поставщиков

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/supply-invoices/` | Список |
| `POST` | `/api/supply-invoices/` | Создать с позициями: `{ supplier, items: [{ inventory_item, quantity, unit_price }] }` |
| `GET/PUT/PATCH/DELETE` | `/api/supply-invoices/{id}/` | CRUD |
| `POST` | `/api/supply-invoices/{id}/receive/` | **Принять товар** (оприходовать на склад) |
| `POST` | `/api/supply-invoices/{id}/add_item/` | Добавить позицию |
| `POST` | `/api/supply-invoices/{id}/remove_item/` | Удалить позицию |
| `POST` | `/api/supply-invoices/{id}/cancel/` | Отменить накладную |

### `/api/issue-orders/` — Расходные ордера (выдача мастерам)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/issue-orders/` | Список ордеров |
| `POST` | `/api/issue-orders/` | Создать: `{ master, items: [{ inventory_item, quantity }] }` |
| `GET/PUT/PATCH/DELETE` | `/api/issue-orders/{id}/` | CRUD |
| `POST` | `/api/issue-orders/{id}/receive/` | Мастер подтверждает получение |
| `POST` | `/api/issue-orders/{id}/report_usage/` | Отчитаться: сколько использовал, сколько вернул |

### `/api/purchase-requests/` — Заявки на закупку

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/purchase-requests/` | Список |
| `POST` | `/api/purchase-requests/` | `{ item_name, quantity, reason, ... }` |
| `GET/PUT/PATCH/DELETE` | `/api/purchase-requests/{id}/` | CRUD |
| `POST` | `/api/purchase-requests/{id}/mark_ordered/` | Отметить «заказано» |
| `POST` | `/api/purchase-requests/{id}/mark_received/` | Отметить «получено» |

### Выдача ЗИП без заявки

| Метод | URL | Описание |
|-------|-----|----------|
| `POST` | `/api/inventory/issue-zip/` | Выдать набор мастеру: `{ master_id, items: [{ inventory_item, quantity }] }` |
| `GET` | `/api/masters/{master_id}/inventory/` | Остатки у конкретного мастера |

---

## 💰 Финансы

### `/api/payments/` — Оплаты

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/payments/` | Список (`?order=`, `?page_size=500`) |
| `POST` | `/api/payments/` | `{ order, amount, payment_type, notes }` |
| `GET/PUT/PATCH/DELETE` | `/api/payments/{id}/` | CRUD |
| `GET` | `/api/payments/summary/` | Сводка за период: `?days=30` (сумма по типам оплат) |

**Типы оплат:** `cash` (наличные), `card` (карта), `transfer` (перевод), `online` (онлайн)

### `/api/master-salaries/` — Зарплаты мастеров

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/master-salaries/` | Список |
| `POST` | `/api/master-salaries/` | Создать запись |
| `GET/PUT/PATCH/DELETE` | `/api/master-salaries/{id}/` | CRUD |
| `POST` | `/api/master-salaries/calculate/` | Рассчитать: `{ master_id, period_start, period_end }` |
| `POST` | `/api/master-salaries/{id}/approve/` | Утвердить зарплату (→ `approved`) |
| `GET` | `/api/master-salaries/master_debts/` | Долги мастеров по наличным и оборудованию |

### `/api/outgoing-invoices/` — Исходящие накладные (УПД)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/outgoing-invoices/` | Список УПД |
| `POST` | `/api/outgoing-invoices/` | Создать: `{ from_legal_id, to_client_id, items: [{ inventory_item, quantity, unit_price, vat_rate }] }` |
| `GET/PUT/PATCH/DELETE` | `/api/outgoing-invoices/{id}/` | CRUD |
| `POST` | `/api/outgoing-invoices/{id}/issue/` | **Провести выдачу** (списать товары) |
| `POST` | `/api/outgoing-invoices/{id}/cancel/` | Аннулировать |
| `GET` | `/api/outgoing-invoices/print/` | Данные для печати УПД: `?id=...` |

---

## 📊 Сметы и КП

### `/api/estimates/` — Сметы (коммерческие предложения)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/estimates/` | Список |
| `POST` | `/api/estimates/` | Создать смету (авто-пересчёт) |
| `GET/PUT/PATCH/DELETE` | `/api/estimates/{id}/` | CRUD (put/patch с авто-пересчётом) |
| `POST` | `/api/estimates/{id}/add_item/` | Добавить позицию: `{ type: "material"/"service", id, quantity }` |
| `POST` | `/api/estimates/{id}/remove_item/` | Удалить позицию: `{ item_id }` |
| `POST` | `/api/estimates/{id}/update_item/` | Обновить позицию: `{ item_id, quantity, unit_price }` |
| `POST` | `/api/estimates/{id}/recalc/` | Принудительный пересчёт |
| `GET` | `/api/estimates/{id}/pdf/` | HTML-форма КП для печати/PDF |

### `/api/estimate-items/` — Позиции смет (ReadOnly)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/estimate-items/` | Список позиций |
| `GET` | `/api/estimate-items/{id}/` | Детали |

### `/api/estimate-services/` — Справочник услуг

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/estimate-services/` | Список услуг |
| `POST/PUT/PATCH/DELETE` | `/api/estimate-services/{id}/` | CRUD |

### `/api/legal-entities/` — Юридические лица

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/legal-entities/` | Список юрлиц |
| `POST/PUT/PATCH/DELETE` | `/api/legal-entities/{id}/` | CRUD |

---

## 🏢 ЕРЦ (Единый расчётный центр)

### `/api/erc-accounts/` — Лицевые счета

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/erc-accounts/` | Список (`?search=`) |
| `POST` | `/api/erc-accounts/` | `{ account_number, address, client, ... }` |
| `GET/PUT/PATCH/DELETE` | `/api/erc-accounts/{id}/` | CRUD |

### `/api/erc-billing/` — Платёжные записи

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/erc-billing/` | Список |
| `POST` | `/api/erc-billing/` | Создать запись |
| `GET/PUT/PATCH/DELETE` | `/api/erc-billing/{id}/` | CRUD |

---

## 📁 Импорт и экспорт

| Метод | URL | Описание | Параметры |
|-------|-----|----------|-----------|
| `POST` | `/api/import/clients/` | Импорт клиентов из Excel (multipart: `file`) | Поддержка ТСЖ/УК форматов |
| `POST` | `/api/import/erc/` | Импорт ЕРЦ из Excel | 4 формата: СПб, ЛО, Агалатово, Коммунар |
| `POST` | `/api/import/preview/` | Предпросмотр Excel (первые 10 строк) | `file` (multipart) |
| `GET` | `/api/system/export-clients/` | Экспорт всех клиентов в Excel | — |
| `GET` | `/api/system/stats/` | Системная статистика (диск, медиа, БД) | — |
| `POST` | `/api/system/cleanup-media/` | Очистка медиафайлов | `{ days: 90 }` или `{ all: true }` |

---

## ☎️ Asterisk PBX — Телефония

### `/api/asterisk/` — Управляющие эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/dashboard/` | **Дашборд**: версия Asterisk, онлайн/офлайн, активные каналы, uptime, количество SIP/транков/IVR/записей |
| `POST` | `/api/asterisk/generate-configs/` | Сгенерировать `pjsip.conf` + `extensions.conf` + `voicemail.conf` из моделей — **предпросмотр** (не применяется) |
| `POST` | `/api/asterisk/push-configs/` | Сгенерировать и **отправить на сервер по SSH** + выполнить `module reload` |

<details>
<summary><b>GET /api/asterisk/dashboard/</b> — Пример ответа</summary>

```json
{
  "success": true,
  "connected": true,
  "version": "20.6.0",
  "active_channels": 0,
  "uptime": "0",
  "sip_peers_count": 5,
  "trunks_count": 1,
  "routes_count": 3,
  "ivrs_count": 1,
  "recordings_count": 42,
  "channels": []
}
```
</details>

<details>
<summary><b>POST /api/asterisk/generate-configs/</b> — Пример ответа</summary>

```json
{
  "success": true,
  "configs": {
    "pjsip.conf": "[global]\ntype=global\n...",
    "extensions.conf": "[internal]\nexten => 101,1,Dial(PJSIP/101,30)\n...",
    "voicemail.conf": "[general]\nformat=wav49|wav\n..."
  },
  "stats": {
    "peers": 5, "trunks": 1, "routes": 3, "ivrs": 1, "voicemails": 2
  }
}
```
</details>

### `/api/asterisk/sip-peers/` — SIP-аккаунты (внутренние номера)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/sip-peers/` | Список (`?search=`) |
| `POST` | `/api/asterisk/sip-peers/` | Создать (пароль генерируется автоматически) |
| `GET/PUT/PATCH/DELETE` | `/api/asterisk/sip-peers/{id}/` | CRUD |

**Поля:** `name` (номер, напр. `101`), `display_name`, `secret` (write-only), `caller_id`, `codecs`, `context`, `mailbox`, `nat`, `allow`, `user`, `is_active`

### `/api/asterisk/trunks/` — SIP-транки (провайдеры)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/trunks/` | Список (`?search=`) |
| `POST` | `/api/asterisk/trunks/` | Создать транк |
| `GET/PUT/PATCH/DELETE` | `/api/asterisk/trunks/{id}/` | CRUD |

**Поля:** `name`, `provider`, `host`, `port` (5060), `username`, `secret` (write-only), `auth_username`, `from_user`, `from_domain`, `caller_id`, `context` (inbound), `transport`, `codecs`, `max_channels`, `register`, `is_active`

### `/api/asterisk/routes/` — Маршруты звонков

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/routes/` | Список (`?direction=inbound/outbound/internal`, `?is_active=`) |
| `POST` | `/api/asterisk/routes/` | Создать маршрут |
| `GET/PUT/PATCH/DELETE` | `/api/asterisk/routes/{id}/` | CRUD |

**Поля:** `name`, `direction`, `match_pattern` (`_X.`, `_8XXXXXXXXXX`, `_+7XXXXXXXXXX`, `_XXXX`), `priority`, `trunk`, `prepend` (напр. `8`), `strip`, `destination`, `caller_id_override`, `failover_destination`, `is_active`

### `/api/asterisk/ivrs/` — IVR-меню (голосовые меню)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/ivrs/` | Список (с вложенными `options`) |
| `POST` | `/api/asterisk/ivrs/` | Создать IVR |
| `GET/PUT/PATCH/DELETE` | `/api/asterisk/ivrs/{id}/` | CRUD |
| `POST` | `/api/asterisk/ivrs/{id}/add_option/` | Добавить опцию: `{ digit, action, destination, description }` |
| `DELETE` | `/api/asterisk/ivrs/{id}/remove-option/{option_id}/` | Удалить опцию |

**Поля IVR:** `name`, `description`, `greeting_audio`, `timeout` (5с), `max_attempts` (3), `invalid_audio`, `exit_destination`, `is_active`

**Опции IVR — действия (`action`):** `extension`, `queue`, `ivr`, `playback`, `voicemail`, `hangup`, `dial`

**Опции IVR — цифры (`digit`):** `0-9`, `*`, `#`, `t` (таймаут), `i` (неверный ввод)

### `/api/asterisk/voicemails/` — Автоответчики

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/voicemails/` | Список (`?search=`) |
| `POST` | `/api/asterisk/voicemails/` | Создать |
| `GET/PUT/PATCH/DELETE` | `/api/asterisk/voicemails/{id}/` | CRUD |

**Поля:** `mailbox` (напр. `101@default`), `password` (write-only), `display_name`, `email`, `email_attachment`, `delete_after_email`, `max_messages`, `max_seconds`, `min_seconds`, `greeting`, `user`, `is_active`

### `/api/asterisk/recordings/` — Записи звонков (ReadOnly)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/asterisk/recordings/` | Список (`?direction=incoming/outgoing`, `?search=`) |
| `GET` | `/api/asterisk/recordings/{id}/` | Детали записи |

---

## 📞 Ростелеком АТС

| Метод | URL | Описание | Параметры |
|-------|-----|----------|-----------|
| `GET` | `/api/rostelecom/get-calls/` | Получить CDR из РТК | `?days=7&limit=100` |
| `POST` | `/api/rostelecom/sync-calls/` | Синхронизировать CDR в CRM | `{ days: 1, dry_run: false }` |
| `GET` | `/api/rostelecom/status/` | Статус интеграции | — |
| `POST` | `/api/rostelecom/test-connection/` | Тест подключения | `{ account_id, api_token }` |
| `POST` | `/api/rostelecom/update-settings/` | Обновить настройки | `{ account_id, api_token, active }` |

### `/api/call-logs/` — Журнал звонков (ReadOnly)

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/call-logs/` | Список CDR (`?direction=incoming/outgoing`, `?status=completed/missed`, `?search=телефон`) |
| `GET` | `/api/call-logs/{id}/` | Детали звонка |

**Поля:** `call_id`, `phone`, `direction_display` (Входящий/Исходящий/Внутренний), `start_time`, `duration` (сек), `call_type_display`, `status_display`, `client_name`, `raw_data`

---

## 🔄 Битрикс24

| Метод | URL | Описание |
|-------|-----|----------|
| `POST` | `/api/bitrix24/clients/to-bitrix/` | Экспорт клиентов CRM → Битрикс24 (Контакты) |
| `POST` | `/api/bitrix24/clients/from-bitrix/` | Импорт клиентов Битрикс24 → CRM |
| `POST` | `/api/bitrix24/products/to-bitrix/` | Экспорт товаров CRM → Битрикс24 (Товары) |
| `POST` | `/api/bitrix24/products/from-bitrix/` | Импорт товаров Битрикс24 → CRM |

**Настройка вебхука**: Системные настройки → вкладка «Битрикс24» → указать URL вебхука и включить интеграцию.

---

## 🤖 Max Бот

### `/api/max-settings/` — Настройки Max

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/max-settings/` | Получить настройки (из `SystemSettings`) |
| `POST` | `/api/max-settings/` | Создать/обновить |
| `PATCH` | `/api/max-settings/{id}/` | Частичное обновление |
| `POST` | `/api/max-settings/test/` | Отправить тестовое сообщение админу |

### `/api/max/webhook/` — Webhook (открытый)

| Метод | URL | Описание |
|-------|-----|----------|
| `POST` | `/api/max/webhook/` | Приём сообщений от Max (без аутентификации, `AllowAny`) |

---

## 📡 GPS и смены

### `/api/traccar/settings/` — Настройки Traccar

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/traccar/settings/` | Получить настройки |
| `POST` | `/api/traccar/settings/` | Создать |
| `POST` | `/api/traccar/settings/test_connection/` | Проверить соединение с сервером Traccar |
| `POST` | `/api/traccar/settings/discover/` | Найти устройства в Traccar |

### `/api/traccar/devices/` — GPS-устройства

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/traccar/devices/` | Список устройств |
| `POST` | `/api/traccar/devices/` | Привязать устройство (авто-поиск по `unique_id`) |
| `POST` | `/api/traccar/devices/{id}/sync_position/` | Синхронизировать позицию из Traccar |

### `/api/shifts/` — Рабочие смены

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/shifts/` | Список смен |
| `POST` | `/api/shifts/start/` | Начать смену |
| `POST` | `/api/shifts/end/` | Завершить смену (подсчёт заявок, км, часов) |
| `GET` | `/api/shifts/my_today/` | Мои смены за сегодня + агрегация |

---

## 💬 Сообщения (внутренний чат)

### `/api/messages/` — Сообщения

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/messages/` | Список сообщений (свои + адресованные + broadcast) |
| `POST` | `/api/messages/` | Отправить: `{ text, recipient_id, is_broadcast }` |
| `GET` | `/api/messages/{id}/` | Детали |
| `DELETE` | `/api/messages/{id}/` | Удалить |
| `POST` | `/api/messages/{id}/read/` | Отметить прочитанным |
| `GET` | `/api/messages/unread_count/` | Количество непрочитанных |
| `GET` | `/api/messages/users/` | Список сотрудников для выбора получателя |

---

## 📸 Медиа

### `/api/order-media/` — Фото/видео заявок

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/order-media/` | Список медиафайлов |
| `POST` | `/api/order-media/upload/` | Загрузить файл (multipart: `file`, `order_id`, `file_type`: image/video) |
| `DELETE` | `/api/order-media/{id}/` | Удалить |

---

## 📱 Push-уведомления

### `/api/push-tokens/` — Expo Push

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/push-tokens/` | Мои токены |
| `POST` | `/api/push-tokens/` | Зарегистрировать: `{ token, platform: "ios"/"android" }` |
| `DELETE` | `/api/push-tokens/{id}/` | Удалить токен |

---

## ⚙️ Системные настройки

### `/api/system-settings/` — Все настройки в одном объекте

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/system-settings/` | Получить все системные настройки |
| `PUT` | `/api/system-settings/{id}/` | Полное обновление |
| `PATCH` | `/api/system-settings/{id}/` | Частичное обновление (удобно для отдельных полей) |

<details>
<summary><b>GET /api/system-settings/</b> — Все поля настроек</summary>

```json
{
  "id": 1,
  "auto_backup": false,
  "backup_time": "03:00",
  "backup_keep_days": 30,
  "media_max_size_mb": 50,
  "media_allowed_types": "jpg,jpeg,png,mp4,mov,avi",
  "external_ip": "83.243.73.86",
  "internal_ip": "192.168.1.38",
  "external_port": 3000,
  "internal_port": 8000,
  "dns_name": "",
  "api_base_url": "/api",
  
  "dadata_token": "",
  "dadata_secret": "",
  
  "max_bot_token": "",
  "max_bot_name": "CRM Bot",
  "max_bot_active": false,
  "max_api_url": "https://business.max.ru",
  
  "traccar_url": "http://localhost:8082",
  "traccar_user": "",
  "traccar_pass": "",
  "traccar_active": false,
  
  "cp_logo_url": "",
  "cp_header_text": "Коммерческое предложение",
  "cp_footer_text": "С уважением, команда Видео Сервис",
  "cp_signature_name": "",
  "cp_signature_title": "",
  "cp_validity_days": 7,
  "cp_color": "#1a3e60",
  "cp_show_logo": true,
  
  "git_repo_url": "https://github.com/himik19872/videoservice-crm.git",
  "git_branch": "main",
  "git_token": "",
  "auto_update_enabled": false,
  "current_version": "1.0.0",
  
  "bitrix24_webhook": "",
  "bitrix24_active": false,
  
  "rostelecom_account_id": "",
  "rostelecom_api_token": "",
  "rostelecom_active": false,
  
  "asterisk_host": "192.168.1.68",
  "asterisk_port": 5038,
  "asterisk_user": "crm_admin",
  "asterisk_secret": "",
  "asterisk_ssh_user": "himik",
  "asterisk_ssh_password": "",
  "asterisk_ssh_port": 22,
  "asterisk_active": false,
  
  "updated_at": "2026-07-11T00:00:00+00:00"
}
```
</details>

**Кастомные действия:**
| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/system-settings/lookup_company_by_inn/` | Поиск компании по ИНН через DaData (`?inn=`) |
| `GET` | `/api/system-settings/check_update/` | Проверить обновления на GitHub |
| `POST` | `/api/system-settings/update_now/` | Обновить CRM из GitHub (бэкап → архив → перезапуск) |
| `POST` | `/api/system-settings/backup_db/` | Ручной бэкап БД (`pg_dump`) |

---

## 📊 Отчёты

### `/api/reports/` — Отчёты

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/reports/` | Список отчётов |
| `POST` | `/api/reports/` | Создать отчёт |
| `POST` | `/api/reports/generate_daily/` | Сгенерировать ежедневный |
| `POST` | `/api/reports/generate_master_performance/` | Производительность мастеров |
| `GET` | `/api/reports/dashboard/` | **Сводка**: мастера + диспетчеры за месяц |

---

## 🔧 Админка Django

| URL | Описание |
|-----|----------|
| `/admin/` | Стандартная админ-панель Django |

---

## 📌 Общие примечания

### Аутентификация
Все защищённые эндпоинты возвращают `401 Unauthorized` без токена:
```json
{ "detail": "Учетные данные не были предоставлены." }
```

### Пагинация
Стандартная DRF-пагинация. Параметры: `?page=1&page_size=50`. Ответ содержит:
```json
{
  "count": 150,
  "next": "http://.../?page=2",
  "previous": null,
  "results": [...]
}
```

### Фильтрация и поиск
Большинство list-эндпоинтов поддерживают:
- `?search=текст` — полнотекстовый поиск
- `?field=value` — фильтрация по полю (зависит от ViewSet)

### Сортировка
Некоторые эндпоинты поддерживают сортировку через `?ordering=field` или `?-field` (обратный порядок).

### Ошибки
- **400** — ошибка валидации (тело: `{ "field": ["сообщение"] }`)
- **401** — не авторизован
- **403** — нет прав
- **404** — не найдено
- **500** — внутренняя ошибка сервера

---

> **Версия API**: v2.1  
> **Последнее обновление**: 2026-07-11  
> **Всего эндпоинтов**: 250+
