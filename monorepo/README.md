# File Manager Platform

Мини-платформа управления файлами с монорепозиторием.

## Архитектура

```
monorepo/
├── apps/
│   ├── api/          # Fastify + tRPC Backend
│   └── web/          # Next.js Frontend
├── packages/
│   ├── types/        # Общие TypeScript типы
│   ├── ui/           # Переиспользуемые UI компоненты
│   └── config/       # Общие конфигурации
└── docker-compose.yml # PostgreSQL, MinIO, Kafka
```

## Технологический стек

### Backend (`/apps/api`)
- **Fastify** - быстрый web framework
- **tRPC** - end-to-end type safety
- **Prisma** - ORM для PostgreSQL
- **MinIO** - S3-совместимое хранилище файлов
- **Kafka** - публикация событий
- **Zod** - валидация данных

### Frontend (`/apps/web`)
- **Next.js** - React framework
- **tRPC Client** - типизированные API вызовы
- **Tailwind CSS** - utility-first CSS
- **React** - UI библиотека

### Shared (`/packages`)
- **types** - общие TypeScript интерфейсы
- **ui** - переиспользуемые компоненты
- **config** - конфигурации для всех приложений

## Функционал

- ✅ Загрузка файлов (до 200МБ)
- ✅ Отображение списка файлов
- ✅ Удаление файлов
- ✅ Мультизагрузка с прогрессом
- ✅ Kafka события при загрузке/удалении
- ✅ Синхронизация S3 ↔ PostgreSQL

## Быстрый старт

### 1. Установка зависимостей
\`\`\`bash
npm install
\`\`\`

### 2. Запуск Docker окружения
\`\`\`bash
npm run docker:up
\`\`\`

### 3. Настройка базы данных
\`\`\`bash
npm run db:generate
npm run db:migrate
\`\`\`

### 4. Запуск в режиме разработки
\`\`\`bash
npm run dev
\`\`\`

## Доступные команды

- `npm run dev` - запуск всех приложений в dev режиме
- `npm run build` - сборка всех приложений
- `npm run lint` - проверка кода
- `npm run type-check` - проверка типов TypeScript
- `npm run docker:up` - запуск Docker контейнеров
- `npm run docker:down` - остановка Docker контейнеров

## Порты

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **MinIO Console**: http://localhost:9001
- **Kafka**: localhost:9092

## Разработка

Проект использует Turborepo для оптимизации сборки и кеширования.
Все пакеты связаны через npm workspaces. 