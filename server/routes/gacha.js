import express from 'express';
import { auth } from '../middleware/auth.js';
import { many, one, tx } from '../db/pool.js';
import { checkAutoAchievements, pullOnce } from '../src/gacha.js';
import { publicUser } from '../src/security.js';

const router = express.Router();

router.get('/state', auth, async (req, res, next) => {
  try {
    const banner = await one('SELECT * FROM banners WHERE active=TRUE AND now() BETWEEN start_at AND end_at ORDER BY id DESC LIMIT 1');
    const bannerCards = banner ? await many(`
      SELECT c.* FROM banner_cards bc JOIN cards c ON c.id=bc.card_id WHERE bc.banner_id=$1 ORDER BY
        CASE c.rarity WHEN 'ONLYYOURS' THEN 5 WHEN 'UR' THEN 4 WHEN 'SSR' THEN 3 WHEN 'SR' THEN 2 ELSE 1 END DESC
      LIMIT 6
    `, [banner.id]) : [];
    const user = await one('SELECT * FROM users WHERE id=$1', [req.user.id]);
    res.json({
      user: publicUser(user),
      banner,
      bannerCards,
      pity: { sr: user.pity_sr, ur: user.pity_ur, srUntil: Math.max(0, 10 - user.pity_sr), urUntil: Math.max(0, 80 - user.pity_ur) },
      chances: {
        note: 'ONLYYOURS: 0.04% без гаранта; SR+ гарант до 10 круток; UR гарант до 80 круток; soft-pity UR начинается после 60 неудачных круток.'
      }
    });
  } catch (err) { next(err); }
});

router.post('/pull', auth, async (req, res, next) => {
  try {
    const count = Math.min(10, Math.max(1, Number(req.body.count || 1)));
    const bannerId = req.body.bannerId ? Number(req.body.bannerId) : null;
    const result = await tx(async client => {
      const user = (await client.query('SELECT spins FROM users WHERE id=$1 FOR UPDATE', [req.user.id])).rows[0];
      if (!user || user.spins < count) throw new Error('Недостаточно круток');
      const pulls = [];
      for (let i = 0; i < count; i++) pulls.push(await pullOnce(client, req.user.id, bannerId));
      const achievements = await checkAutoAchievements(client, req.user.id, pulls);
      const nextUser = (await client.query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
      return { pulls, achievements, user: nextUser };
    });
    res.json({ ...result, user: publicUser(result.user) });
  } catch (err) { next(err); }
});

router.get('/history', auth, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const rows = await many(`
      SELECT ph.id, ph.rarity, ph.is_duplicate, ph.echo_awarded, ph.created_at,
        c.id AS card_id, c.title, c.image_url, s.title AS series_title,
        b.title AS banner_title
      FROM pull_history ph
      LEFT JOIN cards c ON c.id = ph.card_id
      LEFT JOIN series s ON s.id = c.series_id
      LEFT JOIN banners b ON b.id = ph.banner_id
      WHERE ph.user_id = $1
      ORDER BY ph.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);
    res.json({ pulls: rows });
  } catch (err) { next(err); }
});

export default router;
