import { verifyToken } from '../src/security.js';
import { one } from '../db/pool.js';

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const cookie = req.cookies?.token;
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookie;
    if (!token) return res.status(401).json({ error: 'Нужна авторизация' });
    const data = verifyToken(token);
    const user = await one('SELECT * FROM users WHERE id=$1', [data.id]);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Сессия устарела. Войдите заново.' });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const cookie = req.cookies?.token;
  const token = header.startsWith('Bearer ') ? header.slice(7) : cookie;
  if (!token) return next();
  try { req.tokenData = verifyToken(token); } catch {}
  next();
}
