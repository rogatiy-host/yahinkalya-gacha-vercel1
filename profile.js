import crypto from 'crypto';
import { request } from 'undici';

export function validateTelegramInitData(initData, botToken = process.env.TELEGRAM_BOT_TOKEN) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
  if (!valid) return null;
  const userRaw = params.get('user');
  return userRaw ? JSON.parse(userRaw) : null;
}

export async function checkTelegramSubscription(telegramId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel || !telegramId) {
    return { ok: false, reason: 'telegram_not_configured' };
  }
  const url = `https://api.telegram.org/bot${token}/getChatMember`;
  const { body } = await request(url, {
    method: 'POST',
    body: new URLSearchParams({ chat_id: channel, user_id: String(telegramId) }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' }
  });
  const data = await body.json();
  if (!data.ok) return { ok: false, reason: data.description || 'telegram_error' };
  const status = data.result?.status;
  return { ok: ['creator', 'administrator', 'member'].includes(status), status };
}
