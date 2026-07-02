import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sanitize from 'sanitize-filename';
import slugify from 'slugify';
import { auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';
import { many, one, tx } from '../db/pool.js';

const router = express.Router();
const isVercel = Boolean(process.env.VERCEL);
const uploadDir = process.env.UPLOAD_DIR || 'public/uploads';

let storage;
if (isVercel) {
  // На Vercel нельзя надёжно хранить загруженные файлы в папке проекта.
  // Поэтому карточки лучше добавлять по URL картинки: Cloudinary, ImgBB, GitHub raw и т.п.
  storage = multer.memoryStorage();
} else {
  fs.mkdirSync(path.join(uploadDir, 'cards'), { recursive: true });
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(uploadDir, 'cards')),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const base = sanitize(path.basename(file.originalname, ext)).slice(0, 40) || 'card';
      cb(null, `${Date.now()}-${base}${ext}`);
    }
  });
}
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

router.use(auth, adminOnly);

router.get('/dashboard', async (_req, res, next) => {
  try {
    const stats = await one(`
      SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM cards) AS cards,
        (SELECT count(*) FROM pull_history) AS pulls,
        (SELECT count(*) FROM trades WHERE status='pending') AS pending_trades,
        (SELECT count(*) FROM promocode_uses) AS promo_uses
    `);
    res.json({ stats });
  } catch (err) { next(err); }
});

router.get('/users', async (_req, res, next) => {
  try {
    const users = await many(`
      SELECT id, login, role, spins, echo, avatar_emoji, referral_code, telegram_id, daily_streak, pity_sr, pity_ur, created_at
      FROM users ORDER BY created_at DESC LIMIT 200
    `);
    res.json({ users });
  } catch (err) { next(err); }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const user = await one('UPDATE users SET spins=$1, echo=$2, role=$3 WHERE id=$4 RETURNING id, login, role, spins, echo', [
      Number(req.body.spins), Number(req.body.echo), req.body.role === 'admin' ? 'admin' : 'player', Number(req.params.id)
    ]);
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

router.post('/users/:id/veteran', async (req, res, next) => {
  try {
    const result = await tx(async client => {
      const ach = (await client.query("SELECT * FROM achievements WHERE code='veteran'")).rows[0];
      if (!ach) throw new Error('Достижение veteran не найдено');
      await client.query('INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [Number(req.params.id), ach.id]);
      return ach;
    });
    res.json({ ok: true, achievement: result });
  } catch (err) { next(err); }
});

router.get('/series', async (_req, res, next) => {
  try { res.json({ series: await many('SELECT * FROM series ORDER BY id DESC') }); } catch (err) { next(err); }
});

router.post('/series', async (req, res, next) => {
  try {
    const slug = slugify(req.body.slug || req.body.title, { lower: true, strict: true });
    const row = await one('INSERT INTO series (title, slug, description, color) VALUES ($1,$2,$3,$4) RETURNING *', [req.body.title, slug, req.body.description || '', req.body.color || '#9b5cff']);
    res.json({ ok: true, series: row });
  } catch (err) { next(err); }
});

router.get('/cards', async (_req, res, next) => {
  try {
    const cards = await many(`SELECT c.*, s.title AS series_title FROM cards c LEFT JOIN series s ON s.id=c.series_id ORDER BY c.id DESC`);
    res.json({ cards });
  } catch (err) { next(err); }
});

router.post('/cards', upload.single('image'), async (req, res, next) => {
  try {
    const imageUrl = (!isVercel && req.file) ? `/uploads/cards/${req.file.filename}` : req.body.image_url;
    if (!imageUrl) throw new Error(isVercel ? 'На Vercel вставь URL картинки, загрузка файла в папку сайта не сохраняется' : 'Нужно изображение карты');
    const card = await one(`
      INSERT INTO cards (title, caption, rarity, series_id, image_url, frame_css, shop_price, event_weight, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [req.body.title, req.body.caption || '', req.body.rarity, Number(req.body.series_id) || null, imageUrl, req.body.frame_css || '', Number(req.body.shop_price || 0), Number(req.body.event_weight || 100), req.body.is_active !== 'false']);
    res.json({ ok: true, card });
  } catch (err) { next(err); }
});

router.patch('/cards/:id', upload.single('image'), async (req, res, next) => {
  try {
    const current = await one('SELECT * FROM cards WHERE id=$1', [Number(req.params.id)]);
    if (!current) throw new Error('Карта не найдена');
    const imageUrl = (!isVercel && req.file) ? `/uploads/cards/${req.file.filename}` : (req.body.image_url || current.image_url);
    const card = await one(`
      UPDATE cards SET title=$1, caption=$2, rarity=$3, series_id=$4, image_url=$5, frame_css=$6, shop_price=$7, event_weight=$8, is_active=$9
      WHERE id=$10 RETURNING *
    `, [req.body.title || current.title, req.body.caption ?? current.caption, req.body.rarity || current.rarity, Number(req.body.series_id) || current.series_id, imageUrl, req.body.frame_css ?? current.frame_css, Number(req.body.shop_price ?? current.shop_price), Number(req.body.event_weight ?? current.event_weight), String(req.body.is_active ?? current.is_active) !== 'false', Number(req.params.id)]);
    res.json({ ok: true, card });
  } catch (err) { next(err); }
});

router.get('/tasks', async (_req, res, next) => {
  try { res.json({ tasks: await many('SELECT * FROM tasks ORDER BY sort_order, id') }); } catch (err) { next(err); }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const task = await one(`
      INSERT INTO tasks (title, description, type, reward_spins, reward_echo, payload, active, daily, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [req.body.title, req.body.description || '', req.body.type || 'manual', Number(req.body.reward_spins || 0), Number(req.body.reward_echo || 0), JSON.stringify(req.body.payload || {}), req.body.active !== false, req.body.daily !== false, Number(req.body.sort_order || 100)]);
    res.json({ ok: true, task });
  } catch (err) { next(err); }
});

router.patch('/tasks/:id', async (req, res, next) => {
  try {
    const task = await one(`
      UPDATE tasks SET title=$1, description=$2, type=$3, reward_spins=$4, reward_echo=$5, payload=$6, active=$7, daily=$8, sort_order=$9
      WHERE id=$10 RETURNING *
    `, [req.body.title, req.body.description || '', req.body.type || 'manual', Number(req.body.reward_spins || 0), Number(req.body.reward_echo || 0), JSON.stringify(req.body.payload || {}), req.body.active !== false, req.body.daily !== false, Number(req.body.sort_order || 100), Number(req.params.id)]);
    res.json({ ok: true, task });
  } catch (err) { next(err); }
});

router.get('/promocodes', async (_req, res, next) => {
  try {
    const codes = await many(`
      SELECT p.*, count(u.id) AS uses FROM promocodes p LEFT JOIN promocode_uses u ON u.promocode_id=p.id
      GROUP BY p.id ORDER BY p.created_at DESC
    `);
    res.json({ promocodes: codes });
  } catch (err) { next(err); }
});

router.post('/promocodes', async (req, res, next) => {
  try {
    const promo = await one(`
      INSERT INTO promocodes (code, spins, echo, max_global_uses, max_per_user, active)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [String(req.body.code || '').toUpperCase(), Number(req.body.spins || 0), Number(req.body.echo || 0), Number(req.body.max_global_uses || 1), Number(req.body.max_per_user || 1), req.body.active !== false]);
    res.json({ ok: true, promo });
  } catch (err) { next(err); }
});

router.get('/banners', async (_req, res, next) => {
  try { res.json({ banners: await many('SELECT * FROM banners ORDER BY id DESC') }); } catch (err) { next(err); }
});

router.post('/banners', async (req, res, next) => {
  try {
    const banner = await one(`
      INSERT INTO banners (title, description, boost_series_id, active, start_at, end_at)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [req.body.title, req.body.description || '', Number(req.body.boost_series_id) || null, req.body.active !== false, req.body.start_at || new Date(), req.body.end_at || null]);
    res.json({ ok: true, banner });
  } catch (err) { next(err); }
});

router.get('/achievements', async (_req, res, next) => {
  try { res.json({ achievements: await many('SELECT * FROM achievements ORDER BY id') }); } catch (err) { next(err); }
});

router.post('/achievements', async (req, res, next) => {
  try {
    const ach = await one(`
      INSERT INTO achievements (code, title, description, medal_emoji, reward_spins, reward_echo, auto_rule)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [req.body.code, req.body.title, req.body.description || '', req.body.medal_emoji || '🏅', Number(req.body.reward_spins || 0), Number(req.body.reward_echo || 0), req.body.auto_rule || 'manual']);
    res.json({ ok: true, achievement: ach });
  } catch (err) { next(err); }
});

export default router;
