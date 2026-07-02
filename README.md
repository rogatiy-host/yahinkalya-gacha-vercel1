# Yahinkalya Gacha — Vercel + Neon

Готовая версия под Vercel.

## Что важно

- `package.json` исправлен и является валидным JSON.
- `vercel.json` валидный и нейтральный, без опасных rewrites.
- API лежит в `api/index.js` и `api/[...path].js`.
- Секретный промокод не зашит в интерфейс и не лежит в базе.
- Для Vercel картинки карточек лучше добавлять по URL, а не загрузкой файла в папку сайта.

## Как залить

1. Распаковать архив.
2. На GitHub открыть репозиторий.
3. Удалить старые файлы или заменить их содержимым этой папки.
4. В корне репозитория должны лежать:
   - `api`
   - `server`
   - `public`
   - `postgres`
   - `package.json`
   - `vercel.json`
   - `app.js`

## Переменные Vercel

Добавить в Vercel → Project → Settings → Environment Variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
DATABASE_SSL=true
JWT_SECRET=replace_with_long_random_secret
ADMIN_LOGIN=admin
ADMIN_PASSWORD=replace_with_strong_password
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=@your_channel
TELEGRAM_CHANNEL_URL=https://t.me/your_channel
```

## База Neon

В Neon → SQL Editor вставить и выполнить содержимое файла:

```text
postgres/init.sql
```

## Проверка

После деплоя открыть:

```text
https://твой-сайт.vercel.app/api/health
```

Если база подключена, будет:

```json
{"ok":true}
```
