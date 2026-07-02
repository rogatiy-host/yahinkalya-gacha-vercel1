import express from 'express';
import { auth } from '../middleware/auth.js';
import { many, one } from '../db/pool.js';

const router = express.Router();

router.get('/series', async (_req, res, next) => {
  try { res.json({ series: await many('SELECT * FROM series ORDER BY title') }); } catch (err) { next(err); }
});

router.get('/cards', auth, async (req, res, next) => {
  try {
    const { rarity, series } = req.query;
    const params = [req.user.id];
    const where = ['c.is_active=TRUE'];
    if (rarity) { params.push(rarity); where.push(`c.rarity=$${params.length}`); }
    if (series) { params.push(series); where.push(`s.slug=$${params.length}`); }
    const cards = await many(`
      SELECT c.*, s.title AS series_title, s.slug AS series_slug, s.color AS series_color,
        COALESCE(i.qty,0) AS owned_qty,
        i.first_obtained_at,
        EXISTS(SELECT 1 FROM wishlist w WHERE w.user_id=$1 AND w.card_id=c.id) AS wishlisted
      FROM cards c
      LEFT JOIN series s ON s.id=c.series_id
      LEFT JOIN inventory i ON i.card_id=c.id AND i.user_id=$1
      WHERE ${where.join(' AND ')}
      ORDER BY CASE c.rarity WHEN 'ONLYYOURS' THEN 5 WHEN 'UR' THEN 4 WHEN 'SSR' THEN 3 WHEN 'SR' THEN 2 ELSE 1 END DESC, c.id
    `, params);
    res.json({ cards });
  } catch (err) { next(err); }
});

router.post('/wishlist/:cardId', auth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.cardId);
    await one('INSERT INTO wishlist (user_id, card_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *', [req.user.id, cardId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/wishlist/:cardId', auth, async (req, res, next) => {
  try {
    await one('DELETE FROM wishlist WHERE user_id=$1 AND card_id=$2 RETURNING *', [req.user.id, Number(req.params.cardId)]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
