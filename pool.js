import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, one } from '../db/pool.js';
import { hashPassword, makeReferralCode } from './security.js';
import authRoutes from '../routes/auth.js';
import catalogRoutes from '../routes/catalog.js';
import gachaRoutes from '../routes/gacha.js';
import taskRoutes from '../routes/tasks.js';
import shopRoutes from '../routes/shop.js';
import profileRoutes from '../routes/profile.js';
import socialRoutes from '../routes/social.js';
import adminRoutes from '../routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "https://telegram.org"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "https://api.telegram.org"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "frame-ancestors": ["'self'", "https://web.telegram.org", "https://*.telegram.org"]
    }
  }
}));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/gacha', gachaRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(root, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 400).json({ error: err.message || 'Ошибка сервера' });
});

export async function ensureAdmin() {
  const login = process.env.ADMIN_LOGIN || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const exists = await one('SELECT id FROM users WHERE login=$1', [login]);
  if (exists) return;
  const hash = await hashPassword(password);
  await pool.query(`
    INSERT INTO users (login, password_hash, role, referral_code, spins, echo, avatar_emoji)
    VALUES ($1,$2,'admin',$3,999,9999,'👑')
  `, [login, hash, makeReferralCode(login)]);
  console.log(`Admin created: ${login}`);
}

export const ready = ensureAdmin().catch(err => {
  console.error('Startup failed:', err);
  if (!process.env.VERCEL) process.exit(1);
});

export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 8080);
  ready.then(() => app.listen(port, () => console.log(`Yahinkalya Gacha listening on :${port}`)));
}
