# Подключение реального портала

Этот документ описывает, что нужно настроить на стороне портала и в конфигурации чата, чтобы заменить `portal-mock` на реальную интеграцию.

## 1. Переменные окружения чата

Все настройки задаются через `.env` в корне репозитория (см. `.env.example` с пояснениями). При подключении реального портала измените:

`JWT_SECRET` - Секрет для проверки подписи JWT-токенов, выданных порталом. **Должен совпадать** с секретом, которым портал подписывает токены.
`PORTAL_API_URL` - Базовый URL API портала для служебных запросов (резолвинг объектов).
`PORTAL_SERVICE_TOKEN` - Служебный токен, которым чат аутентифицируется перед порталом при запросах к `/api/integration/chat/*`. Выдаётся порталом отдельно от пользовательских JWT.
`PORTAL_PUBLIC_URLS` - Список доменов портала (через запятую), на которых распознаются ссылки на объекты вида `/dashboard/object/{uuid}`.
`ALLOWED_ORIGINS` - Список источников (origin), с которых разрешён доступ к API чата и постмессадж-обмен. Должен включать домен, откуда портал встраивает виджет.

После смены переменных — пересоберите и перезапустите `chat-server`:

```bash
docker compose build chat-server
docker compose up -d chat-server
```

## 2. Что должен предоставлять портал

### 2.1 Аутентификация (раздел 5.1)

Портал выпускает JWT-токен для текущего пользователя и передаёт его виджету через `postMessage` (см. раздел 4 ниже). Токен должен содержать поля:

```json
{
  "sub": "<uuid пользователя>",
  "name": "<имя>",
  "email": "<email>",
  "role": "<роль>",
  "exp": <unix timestamp истечения>
}
```

Подписан тем же секретом, что указан в `JWT_SECRET` чата.

### 2.2 Список пользователей (раздел 5.2)

Портал должен предоставлять эндпоинт для получения списка пользователей (используется чатом при создании новых диалогов/групп). Контракт аналогичен `portal-mock`:
GET {PORTAL_API_URL}/api/integration/chat/users?query=&limit=

Ответ — массив `{ id, name, email }`.

### 2.3 Резолвинг объектов (раздел 5.3)

POST {PORTAL_API_URL}/api/integration/chat/objects/resolve
Headers: X-Service-Token: <PORTAL_SERVICE_TOKEN>
Body: { "objectIds": ["uuid1", "uuid2"], "forUserId": "uuid-пользователя" }

Ответ — массив объектов на каждый запрошенный id:

```json
[
  {
    "id": "uuid1",
    "exists": true,
    "canRead": true,
    "title": "Название",
    "typeName": "Тип",
    "icon": "IconName",
    "url": "/dashboard/object/uuid1"
  },
  { "id": "uuid2", "exists": true, "canRead": false }
]
```

Запросы группируются чатом — один вызов на все объекты, упомянутые в загруженной порции сообщений, не по одному на объект. Ответы кэшируются чатом на стороне сервера не дольше 5 минут.
Если `canRead: false` — чат не раскрывает `title`/`typeName`/`icon`, показывает пользователю плейсхолдер «Объект недоступен».

## 3. Формат ссылок на объекты

В тексте сообщения чат распознаёт ссылки вида:
{домен из PORTAL_PUBLIC_URLS}/dashboard/object/{uuid}
и автоматически резолвит их в карточки через эндпоинт из п. 2.3.

## 4. Встраивание виджета — обмен через `postMessage`

Виджет встраивается в `<iframe>`. Взаимодействие идёт через `window.postMessage` в обе стороны. **Обе стороны обязаны проверять `event.origin`** перед обработкой сообщения.

### От чата к порталу

События:

`chat:ready` `{}` иджет инициализирован и ожидает `portal:auth`. Портал не должен слать токен раньше этого события.
`chat:unread-count` `{ total }` При каждом изменении суммарного счётчика непрочитанных.
`chat:open-object` `{ objectId }` Пользователь кликнул по карточке объекта в сообщении. Переход на страницу объекта выполняет портал, чат сам не осуществляет навигацию.
`chat:token-expired` `{}` Токен истёк или стал невалидным — портал должен прислать свежий `portal:auth`.

### От портала к чату

События:

`portal:auth` `{ token }` | Первичная передача и последующее обновление JWT. Отправляется только после получения `chat:ready`. 4
`portal:open` `{ channelId | contextObjectId | userId } ` Открыть канал. `channelId` — открыть существующий канал напрямую. `contextObjectId` — найти или создать контекстный канал для этого объекта. `userId` — найти или создать direct-канал с этим пользователем.
`portal:theme` `{ mode: 'light' | 'dark' }` Смена темы интерфейса.
`portal:locale` `{ locale: 'ru' \| 'en' }` Смена языка интерфейса. Портал получает язык из настроек пользователя (`User.locale`). По умолчанию — `ru`.

### Эквивалент через URL (для отладки/прямых ссылок)

Помимо `postMessage`, виджет поддерживает открытие конкретного канала/объекта через query-параметры URL фрейма:
https://chat.company.com/?channel=<uuid>
https://chat.company.com/?context=<objectId>

### Пример инициализации со стороны портала

```js
const iframe = document.getElementById("chat-frame");
const CHAT_ORIGIN = "https://chat.company.com";

window.addEventListener("message", (event) => {
  if (event.origin !== CHAT_ORIGIN) return;

  switch (event.data.type) {
    case "chat:ready":
      iframe.contentWindow.postMessage(
        { type: "portal:auth", token: getCurrentUserToken() },
        CHAT_ORIGIN,
      );
      break;
    case "chat:unread-count":
      updateUnreadBadge(event.data.total);
      break;
    case "chat:open-object":
      navigateToObject(event.data.objectId);
      break;
    case "chat:token-expired":
      iframe.contentWindow.postMessage(
        { type: "portal:auth", token: refreshToken() },
        CHAT_ORIGIN,
      );
      break;
  }
});
```

## 5. Чек-лист перед переключением на реальный портал

- `JWT_SECRET` в `.env` чата совпадает с секретом подписи токенов портала
- Портал реализует `GET /api/integration/chat/users`
- Портал реализует `POST /api/integration/chat/objects/resolve` с проверкой `X-Service-Token`
- `PORTAL_SERVICE_TOKEN` сгенерирован порталом и прописан в `.env` чата
- `PORTAL_PUBLIC_URLS` содержит реальный домен портала
- `ALLOWED_ORIGINS` включает домен, с которого портал встраивает iframe
- Портал отправляет `portal:auth` только после получения `chat:ready`
- Портал проверяет `event.origin` при приёме сообщений от чата
- Пройден сквозной сценарий: открытие виджета → получение токена → создание/открытие канала → отправка сообщения → обновление счётчика непрочитанных в интерфейсе портала

## 6. Известные отклонения от контракта

- Путь загрузки файлов реализован как `POST /channels/:id/attachments` (вложенный в канал), а не как плоский `POST /api/attachments` — это внутренний REST API самого чата, не часть интеграционного контракта с порталом (раздел 5), поэтому не влияет на интеграцию.
