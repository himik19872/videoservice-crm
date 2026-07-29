# CRM Frontend Application

React приложение для CRM-системы управления заявками, клиентами и оборудованием.

## Запуск приложения

```bash
npm start
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере для просмотра.

## Структура проекта

```
frontend/
├── public/          # Статические файлы
├── src/             # Исходный код
│   ├── components/  # Переиспользуемые компоненты
│   ├── contexts/    # React Context (AuthContext)
│   ├── layouts/     # Компоненты макета (Layout)
│   ├── pages/       # Страницы приложения
│   ├── services/    # API сервисы
│   ├── types/       # TypeScript типы
│   └── utils/       # Утилиты
├── package.json
└── tsconfig.json
```

## Используемые технологии

- React 19
- TypeScript
- Ant Design 6.5
- React Router DOM 6
- Axios
- Day.js

## Роли пользователей

- **Администратор** - полный доступ ко всем функциям
- **Диспетчер** - управление заявками, клиентами, оборудованием
- **Мастер** - доступ к своим заявкам и профилю

## API

Приложение использует Django REST Framework backend по адресу:
`http://localhost:8000/api`
