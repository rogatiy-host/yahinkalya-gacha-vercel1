# Запуск на Vercel + Neon

Эта версия подготовлена под Vercel: корневой `app.js` экспортирует Express-приложение, `vercel.json` направляет запросы в сервер.

## Переменные окружения в Vercel

- NODE_ENV=production
- DATABASE_URL=строка из Neon с `sslmode=require`
- DATABASE_SSL=true
- JWT_SECRET=длинная секретная строка
- ADMIN_LOGIN=admin
- ADMIN_PASSWORD=сильный пароль
- TELEGRAM_BOT_TOKEN=токен бота, если нужен Telegram Mini App
- TELEGRAM_CHANNEL_ID=@канал
- TELEGRAM_CHANNEL_URL=https://t.me/канал

## Важно по картинкам

На Vercel нельзя надёжно хранить загруженные файлы внутри проекта после деплоя. Для карточек лучше вставлять URL картинки из Cloudinary/ImgBB/другого хранилища в поле `URL картинки` в админке.

## База

В Neon открой SQL Editor, вставь содержимое `postgres/init.sql`, нажми Run.
