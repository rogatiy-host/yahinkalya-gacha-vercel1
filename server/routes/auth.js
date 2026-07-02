import express from 'express';
import { one, tx } from '../db/pool.js';
import { hashPassword, makeReferralCode, normalizeLogin, publicUser, signToken, verifyPassword } from '../src/security.js';
import { validateTelegramInitData } from '../src/telegram.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const login = normalizeLogin(req.body.login);
    const password = String(req.body.password || '');
    const referral = String(req.body.referral || '').trim().toUpperCase();
    if (login.length < 3) return res.status(400).json({ error: 'Логин минимум 3 символа' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    const result = await tx(async client => {
      const exists = (await client.query('SELECT id FROM users WHERE login=$1', [login])).rows[0];
      if (exists) throw new Error('Такой логин уже занят');
      const refUser = referral ? (await client.query('SELECT id FROM users WHERE referral_code=$1', [referral])).rows[0] : null;
      const passwordHash = await hashPassword(password);
      const user = (await client.query(`
        INSERT INTO users (login, password_hash, referral_code, referred_by, spins)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [login, passwordHash, makeReferralCode(login), refUser?.id || null, 10])).rows[0];
      if (refUser) {
        await client.query('UPDATE users SET spins=spins+2, echo=echo+25 WHERE id=$1', [refUser.id]);
        await client.query('UPDATE users SET spins=spins+1 WHERE id=$1', [user.id]);
      }
      return user;
    });
    const token = signToken(result);
    res.cookie('token', token, cookieOpts());
    res.json({ token, user: publicUser(result) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const login = normalizeLogin(req.body.login);
    const password = String(req.body.password || '');
    const user = await one('SELECT * FROM users WHERE login=$1', [login]);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    const token = signToken(user);
    res.cookie('token', token, cookieOpts());
    res.json({ token, user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/telegram', async (req, res, next) => {
  try {
    const tgUser = validateTelegramInitData(req.body.initData);
    if (!tgUser?.id) return res.status(401).json({ error: 'Не удалось проверить Telegram Mini App initData' });
    let user = await one('SELECT * FROM users WHERE telegram_id=$1', [tgUser.id]);
    if (!user && req.body.login && req.body.password) {
      const login = normalizeLogin(req.body.login);
      const password = String(req.body.password || '');
      if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });
      const passwordHash = await hashPassword(password);
      user = await one(`
        INSERT INTO users (login, password_hash, referral_code, telegram_id, telegram_username)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [login, passwordHash, makeReferralCode(login), tgUser.id, tgUser.username || null]);
    }
    if (!user) return res.status(404).json({ error: 'Telegram не привязан. Зарегистрируйтесь по логину/паролю.' });
    const token = signToken(user);
    res.cookie('token', token, cookieOpts());
    res.json({ token, user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.json({ user: null });
  try {
    const { verifyToken } = await import('../src/security.js');
    const data = verifyToken(token);
    const user = await one('SELECT * FROM users WHERE id=$1', [data.id]);
    res.json({ user: publicUser(user) });
  } catch {
    res.json({ user: null });
  }
});

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && String(process.env.APP_URL || '').startsWith('https://'),
    maxAge: 1000 * 60 * 60 * 24 * 30
  };
}

export default router;
