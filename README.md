# 🏠 VideoService CRM

Система управления заявками домофонной компании с мобильным приложением для мастеров, GPS-трекингом и уведомлениями через мессенджер Max.

![Stack](https://img.shields.io/badge/Backend-Django%204.2-092e20?logo=django)
![Stack](https://img.shields.io/badge/Frontend-React%2019-61dafb?logo=react)
![Stack](https://img.shields.io/badge/Mobile-Expo%2054-000020?logo=expo)
![Stack](https://img.shields.io/badge/DB-PostgreSQL%2015-4169e1?logo=postgresql)
![Stack](https://img.shields.io/badge/Deploy-Docker-2496ed?logo=docker)

---

## 📋 Возможности

| Модуль | Описание |
|--------|----------|
| 📋 Заявки | Создание, назначение мастера, смена статусов, история, фильтры, заметки |
| 👨‍🔧 Мастера | Распределение по районам, GPS-трекинг, смены, зарплата |
| 👥 Клиенты | База клиентов, история заявок, привязка к Max |
| 🏢 Дома | Адреса обслуживания, типы оборудования |
| 📸 Фото/видео | Отчёты мастеров с медиа-фиксацией, камера из приложения |
| 🗺️ GPS | Координаты при смене статуса, история на карте, Traccar |
| 🤖 Max Бот | Уведомления клиентам о статусе заявок, webhook для линковки |
| 📊 Отчёты | Дашборд, статистика, рейтинги мастеров |
| 🛠️ Оборудование | Учёт домофонов, камер, серийные номера, гарантии |
| 📞 Навигация | Построение маршрутов через Yandex Maps, DaData-подсказки |
| 🔔 Push | Уведомления мастеров о новых заявках (Expo Push) |
| ✍️ Подпись | Экран для росписи клиента в мобильном приложении |

## 👥 Роли

| Роль | Доступ |
|------|--------|
| 👑 Администратор | Полный доступ ко всему |
| 📋 Диспетчер | Заявки, клиенты, назначение мастеров |
| 🔧 Мастер | Свои заявки, GPS, фото/видео отчёты |
| 🛠️ Инженер | Заявки «требуется помощь», ТО |
| 👁️ Руководитель сервисной службы | Контроль заявок, подтверждение |

## 🏗️ Архитектура

```
                    ┌─────────┐
                    │  Nginx  │  (опционально)
                    └────┬────┘
                         │ :443/:80
                    ┌────▼────┐
                    │ Express │  Прокси :3000
                    │ / → React SPA (build/)
                    │ /api/* → Django :8000
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
     ┌────────────────┐   ┌────────────────┐
     │ Django + DRF   │   │ PostgreSQL 15  │
     │ (Docker) :8000 │◄──│ (Docker) :5432 │
     └────────────────┘   └────────────────┘

Внешние сервисы:
  🤖 Max (platform-api2.max.ru) — уведомления клиентам
  📍 DaData (suggestions.dadata.ru) — подсказки адресов
  🗺️ Yandex Maps — навигация
  📡 Traccar GPS — маяки мастеров
```

## 🚀 Быстрый старт

### Одна команда (новый сервер)

```bash
git clone https://github.com/YOUR_USER/videoservice-crm.git
cd videoservice-crm
sudo chmod +x install.sh && sudo ./install.sh
```

После установки:
- CRM: **http://ВАШ_IP:3000**
- API: **http://ВАШ_IP:3000/api/**
- Логин: **admin** / **admin123**

### Локальная разработка

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata regions.json users.json masters.json user_profiles.json
python manage.py runserver

# 2. Frontend (другой терминал)
cd frontend
npm install
npm start

# 3. Прокси (третий терминал)
cd server
npm install
node server.js

# Открой http://localhost:3000
```

### Только backend (Docker)

```bash
docker compose up -d
# API на http://localhost:8000/api/
```

## 🔧 Переменные окружения

Создай `backend/.env`:

```env
SECRET_KEY=секретный-ключ
DEBUG=True
ALLOWED_HOSTS=*
DB_NAME=crm
DB_USER=crm_user
DB_PASSWORD=crm_pass
DB_HOST=localhost
DB_PORT=5432
```

## 📡 API

### Аутентификация
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/login/` | Вход (username, password → token) |
| GET | `/api/users/me/` | Текущий пользователь |

### Заявки
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/orders/` | Список (фильтры: status, master, region) |
| POST | `/api/orders/` | Создать |
| GET | `/api/orders/{id}/` | Детали + история |
| POST | `/api/orders/{id}/assign/` | Назначить мастера |
| POST | `/api/orders/{id}/start/` | Начать |
| POST | `/api/orders/{id}/complete/` | Завершить |
| POST | `/api/orders/{id}/confirm/` | Подтвердить (диспетчер) |
| POST | `/api/orders/{id}/cancel/` | Отменить |

### Справочники
`/api/clients/` `/api/masters/` `/api/buildings/` `/api/equipment/` `/api/regions/`

### Max Бот
| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/max-settings/` | Настройки |
| POST | `/api/max/webhook/` | Webhook |

### GPS
`/api/masters/locations/` — координаты всех мастеров

## 🤖 Max Бот

1. Получить токен: [dev.max.ru](https://dev.max.ru)
2. CRM → Системные настройки → Max Бот → вставить токен
3. Webhook URL: `https://ВАШ_IP:3000/api/max/webhook/`

**Цепочка уведомлений:**
```
📋 Назначен мастер → Клиенту: 👨‍🔧 ФИО + телефон мастера
✅ Подтверждено    → Клиенту: Заявка выполнена + 📸 фото/видео
```

## 📱 Мобильное приложение (Expo)

```bash
cd mobile
npm install
npx expo start        # Dev
eas build --platform android --profile preview  # APK
```

Возможности: список заявок, GPS, фото/видео, подпись, push, смены, навигация.

## 🗂️ Структура

```
videoservice-crm/
├── backend/              # Django API
│   ├── main/models.py    # Order, Client, Master, Building, Equipment, ...
│   ├── main/views.py     # ViewSets, assign/complete/confirm actions
│   ├── main/max_service.py  # Max-уведомления
│   ├── main/max_views.py    # Max webhook + настройки
│   ├── main/fixtures/       # regions, users, masters, user_profiles
│   └── requirements.txt
├── frontend/             # React 19 + TypeScript + Ant Design 6
│   └── src/pages/        # orders, clients, masters, buildings, reports, ...
├── mobile/               # Expo 54
│   └── src/screens/      # Login, Orders, OrderDetail, Signature, Map
├── server/               # Express прокси (порт 3000)
├── docker-compose.yml    # PostgreSQL + Django
├── install.sh            # Автоустановка одной командой
├── DEV_PLAN.md           # План разработки
└── README.md
```

## 📊 Статус

- ✅ Заявки, клиенты, мастера, роли
- ✅ GPS, карта, навигация
- ✅ DaData, фото/видео, подпись
- ✅ Max-уведомления + webhook
- ✅ Дашборд, смены, Push
- ✅ Мобильное приложение APK
- ⬜ Каталог оборудования и выдача
- ⬜ Финансы и зарплата
- ⬜ 1С / Битрикс24

Подробнее: [DEV_PLAN.md](DEV_PLAN.md)

## 🛟 Команды

```bash
# Статус
systemctl status videoservice-crm
docker compose ps

# Логи
docker compose logs web
docker compose logs db

# Перезапуск
systemctl restart videoservice-crm

# Django shell
docker exec -it crm_web python manage.py shell
```

## 📄 Лицензия

MIT
