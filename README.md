# Corporate Chat

Встраиваемый корпоративный чат-виджет для интеграции с внутренним порталом компании. Поддерживает личные и групповые диалоги, обсуждения в контексте бизнес-объектов портала, файлы, реакции, упоминания, поиск и доставку сообщений в реальном времени.

## Стек

- **Backend**: NestJS, PostgreSQL (Prisma ORM), Socket.IO, MinIO (S3-совместимое хранилище)
- **Frontend**: React, TypeScript, Vite, MUI
- **Portal Mock**: заглушка портала для разработки без реальной интеграции

## Структура репозитория

corporate-chat/
├── apps/
│ ├── chat-server/ # NestJS backend
│ ├── chat-widget/ # React frontend
│ └── portal-mock/ # заглушка портала для разработки/демо
├── docker-compose.yml
├── .env.example
└── INTEGRATION.md # подключение реального портала

## Запуск с нуля

### Требования

- Docker и Docker Compose
- Node.js 20+ (для локальной разработки фронтенда вне контейнера)

### Шаги

1. Склонируйте репозиторий:

```bash
   git clone <repository-url>
   cd corporate-chat
```

2. Скопируйте файл переменных окружения и при необходимости отредактируйте значения (для локальной разработки дефолтные значения рабочие):

```bash
   cp .env.example .env
```

3. Поднимите весь стек:

```bash
   docker compose up -d
```

Это поднимет 4 сервиса: `postgres`, `minio`, `portal-mock`, `chat-server`. При первом старте `chat-server` автоматически применит миграции базы данных и заполнит её тестовыми данными (4 пользователя, несколько каналов, история сообщений).

4. Запустите фронтенд отдельно (пока не контейнеризован для dev-режима):

```bash
   cd apps/chat-widget
   npm install
   npm run dev
```

5. Откройте `http://localhost:5174` — виджет запустится в dev-режиме с экраном выбора тестового пользователя (эмуляция того, что в проде делает портал через `portal:auth`).

6. Для проверки полной интеграции с порталом (обмен через `postMessage`) откройте демо-страницу заглушки портала:
   http://localhost:3001/demo.html

### Проверка, что всё поднялось

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ: `{"status":"ok","db":{"ok":true},"storage":{"ok":true}}`.

## Тестовые данные

После `docker compose up` в базе уже есть:

- 4 тестовых пользователя (доступны через `portal-mock`, `GET http://localhost:3001/users`)
- Direct-канал и групповой чат с историей сообщений

Получить токен для любого тестового пользователя:

```bash
curl http://localhost:3001/auth/token/<userId>
```

## Разработка

### Backend

```bash
cd apps/chat-server
npm install
npm run start:dev       # локальный запуск с watch-режимом (требует поднятых postgres/minio)
npm run lint             # проверка стиля кода
npx tsc --noEmit          # проверка типов
npm run test              # unit-тесты
npm run test:e2e          # интеграционные тесты (требуют отдельную тестовую БД, см. ниже)
```

Для e2e-тестов создайте отдельную тестовую базу данных:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE corporate_chat_test;"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/corporate_chat_test?schema=public npx prisma migrate deploy
```

### Frontend

```bash
cd apps/chat-widget
npm install
npm run dev
npx tsc --noEmit
```

### Пересборка после изменений в backend (Docker)

```bash
docker compose build chat-server
docker compose up -d chat-server
```

## Архитектура (кратко)

- **Авторизация** — JWT, выдаваемый порталом (в разработке — `portal-mock`). Виджет получает токен через `postMessage` от родительского окна.
- **Реальное время** — WebSocket (Socket.IO), пользователь автоматически подписывается на все свои каналы при подключении.
- **Файлы** — загружаются в MinIO, привязываются к сообщению по `attachmentId`.
- **Карточки объектов** — резолвятся через HTTP-запрос к порталу (`/api/integration/chat/objects/resolve`), результат снэпшотится в БД на момент отправки сообщения.
- **Поиск** — полнотекстовый, средствами PostgreSQL (`tsvector`/`GIN`-индекс).

Подробности контракта интеграции с реальным порталом — в [INTEGRATION.md](./INTEGRATION.md).
