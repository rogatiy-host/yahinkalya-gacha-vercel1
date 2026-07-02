import express from 'express';
import { auth } from '../middleware/auth.js';
import { one, tx } from '../db/pool.js';
import { checkAutoAchievements, pullOnce } from '../src/gacha.js';
import { publicUser } from '../src/security.js';

const router = express.Router();

router.get('/state', auth, async (req, res, next) => {
  try {
    const banner = await one('SELECT * FROM banners WHERE active=TRUE AND now() BETWEEN start_at AND end_at ORDER BY id DESC LIMIT 1');
    const user = await one('SELECT * FROM users WHERE id=$1', [req.user.id]);
    res.json({
      user: publicUser(user),
      banner,
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

export default router;
