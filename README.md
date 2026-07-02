# Yahinkalya ONLY — Gacha Cards

Готовый стартовый сайт гача-системы: регистрация по логину/паролю, Telegram Mini App-ready вход, карточки, редкости, pity/soft-pity, ONLYYOURS без гаранта, галерея, профиль, витрина, друзья, трейды, задания, рефералы, промокоды, магазин и админ-панель.

## Что уже реализовано

- Регистрация и вход по логину/паролю.
- 10 стартовых круток новым игрокам.
- JWT-сессия в httpOnly cookie.
- PostgreSQL база.
- Админ-панель внутри сайта.
- Загрузка изображений карточек через админку.
- Редкости: `R`, `SR`, `SSR`, `UR`, `ONLYYOURS`.
- ONLYYOURS: шанс `0.04%`, без гаранта и без сброса pity.
- Pity:
  - SR+ гарант до 10 круток.
  - UR гарант до 80 круток.
  - Soft-pity UR начинается после 60 неудачных круток.
- Wishlist: карты из wishlist получают повышенный вес при гаранте.
- Баннеры событий с повышением веса выбранной серии.
- Дубликаты обычных карт автоматически превращаются в валюту `Эхо`.
- Дубликаты ONLYYOURS сохраняются числом `×N` на карте.
- Галерея с фильтрами по серии и редкости.
- Не полученные карты затемнены силуэтом.
- Не полученные ONLYYOURS полностью чёрные и под знаком вопроса.
- Профиль игрока.
- Витрина из 5 карт.
- Эмодзи-аватарки.
- Возможность поставить ONLYYOURS-карту как аватар-карту.
- Достижения/медальки, включая ручную выдачу `Ветеран`.
- Друзья по поиску логина.
- Предложения обмена картами.
- Ежедневные задания.
- Ежедневный вход со стриком и бонусом на 7-й день.
- Промокод `YAHINKALYAONLY`: +20 круток, 1 раз на аккаунт, 6 использований всего.
- Магазин круток за `Эхо`.
- Магазин обычных карт за большую цену.
- Адаптив под телефон, планшет и десктоп.
- Хроматика/tilt-эффекты карточек, редкостная анимация выбивания, кнопка пропуска анимации.

## Быстрый запуск через Docker

```bash
cp .env.example .env
# открой .env и поменяй JWT_SECRET, ADMIN_PASSWORD, APP_URL

docker compose up --build -d
```

После запуска сайт будет доступен на:

```text
http://localhost:8080
```

На сервере подключите домен и HTTPS через Nginx/Caddy/Traefik. Для Telegram Mini App HTTPS обязателен.

## Админ-панель

Первый администратор создаётся автоматически при старте приложения из `.env`:

```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD=change_admin_password
```

Войдите этим логином и паролем, затем откройте раздел `Админка`.

В админке можно:

- добавлять карточки;
- загружать изображения карточек;
- добавлять серии;
- создавать задания;
- создавать промокоды;
- смотреть игроков;
- выдавать медаль `Ветеран`;
- смотреть статистику через API.

## Telegram Mini App

Проект уже поддерживает безопасную серверную проверку `initData`.

Настройки в `.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHANNEL_ID=@your_channel_username
TELEGRAM_CHANNEL_URL=https://t.me/your_channel_username
```

Что нужно сделать:

1. Создать бота через BotFather.
2. Включить Web App / Mini App и указать HTTPS-адрес сайта.
3. Добавить бота администратором в канал, если нужно проверять подписку через `getChatMember`.
4. Указать токен бота и канал в `.env`.
5. Перезапустить приложение.

Проверка подписки уже заложена в задании типа `telegram_subscribe`. Проверка реакции на конкретный пост зависит от того, как вы будете получать события от Telegram-бота; в базовой версии это задание можно держать ручным или доработать вебхуком.

## Структура проекта

```text
.
├── Dockerfile
├── docker-compose.yml
├── package.json
├── postgres
│   └── init.sql
├── public
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── assets/cards/*.svg
└── server
    ├── db/pool.js
    ├── middleware
    ├── routes
    └── src
```

## Основные API

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/telegram

GET  /api/gacha/state
POST /api/gacha/pull

GET  /api/catalog/cards
GET  /api/catalog/series
POST /api/catalog/wishlist/:cardId
DELETE /api/catalog/wishlist/:cardId

GET  /api/profile/me
PATCH /api/profile/me
POST /api/profile/showcase

GET  /api/tasks
POST /api/tasks/:id/claim
POST /api/tasks/promocode

GET  /api/shop
POST /api/shop/buy-spins
POST /api/shop/buy-card/:cardId

GET  /api/social/search?q=login
GET  /api/social/friends
POST /api/social/friends/:login
POST /api/social/trades
POST /api/social/trades/:id/respond

GET/POST /api/admin/cards
GET/POST /api/admin/series
GET/POST /api/admin/tasks
GET/POST /api/admin/promocodes
GET      /api/admin/users
POST     /api/admin/users/:id/veteran
```

## Важные настройки гача

Файл: `server/src/gacha.js`

Там можно изменить:

- шанс ONLYYOURS;
- soft-pity;
- гарант UR/SR+;
- валюту за дубликаты;
- веса редкостей;
- усиление wishlist;
- усиление event-баннера.

## Что можно улучшить следующим этапом

- Telegram webhook для автоматической проверки реакций на конкретные посты.
- Отдельная модерация трейдов.
- Сезонный боевой пропуск.
- Рейтинг коллекционеров.
- Альбомы/подвиды внутри серий.
- Реальные платежи, если они будут нужны.
- Отдельная страница публичного профиля без входа.
