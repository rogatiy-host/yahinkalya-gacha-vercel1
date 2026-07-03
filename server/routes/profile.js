import express from 'express';
import { auth } from '../middleware/auth.js';
import { many, one, tx } from '../db/pool.js';
import { publicUser } from '../src/security.js';

const router = express.Router();
const EMOJIS = ['✨','🖤','💎','🔥','🌙','🦊','🐉','🦄','👑','⚡','🌸','🍓','🧿','🪽','🪐','💫','🎮','🎲','🪄','🛡️','🧸','🍒','🦋','🐾','💜','🩷','🩵','🧡','🤍','🧁'];

router.get('/me', auth, async (req, res, next) => {
  try { res.json(await buildProfile(req.user.id, req.user.id)); } catch (err) { next(err); }
});

router.get('/u/:login', auth, async (req, res, next) => {
  try {
    const user = await one('SELECT id FROM users WHERE login=$1', [String(req.params.login).toLowerCase()]);
    if (!user) return res.status(404).json({ error: 'Профиль не найден' });
    res.json(await buildProfile(user.id, req.user.id));
  } catch (err) { next(err); }
});

router.get('/emojis', (_req, res) => res.json({ emojis: EMOJIS }));

router.patch('/me', auth, async (req, res, next) => {
  try {
    const avatarEmoji = EMOJIS.includes(req.body.avatar_emoji) ? req.body.avatar_emoji : req.user.avatar_emoji;
    const avatarCardId = req.body.avatar_card_id ? Number(req.body.avatar_card_id) : null;
    const bannerProvided = Object.prototype.hasOwnProperty.call(req.body, 'profile_banner_url');
    const result = await tx(async client => {
      if (avatarCardId) {
        const owns = (await client.query(`
          SELECT c.id FROM inventory i JOIN cards c ON c.id=i.card_id
          WHERE i.user_id=$1 AND i.card_id=$2 AND c.rarity='ONLYYOURS'
        `, [req.user.id, avatarCardId])).rows[0];
        if (!owns) throw new Error('На аватар можно поставить только вашу карту ONLYYOURS');
      }
      let bannerUrl = req.user.profile_banner_url;
      if (bannerProvided) {
        const url = String(req.body.profile_banner_url || '').trim();
        if (!url) {
          bannerUrl = null;
        } else {
          const owns = (await client.query('SELECT 1 FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=$1 AND c.image_url=$2', [req.user.id, url])).rows[0];
          if (!owns) throw new Error('Фон шапки можно поставить только с картинки уже выбитой вами карты');
          bannerUrl = url;
        }
      }
      return (await client.query('UPDATE users SET avatar_emoji=$1, avatar_card_id=$2, profile_banner_url=$3 WHERE id=$4 RETURNING *', [avatarEmoji, avatarCardId, bannerUrl, req.user.id])).rows[0];
    });
    res.json({ ok: true, user: publicUser(result) });
  } catch (err) { next(err); }
});

router.post('/showcase', auth, async (req, res, next) => {
  try {
    const slots = Array.isArray(req.body.slots) ? req.body.slots.slice(0, 5) : [];
    await tx(async client => {
      for (let i = 0; i < slots.length; i++) {
        const cardId = slots[i] ? Number(slots[i]) : null;
        if (cardId) {
          const owns = (await client.query('SELECT 1 FROM inventory WHERE user_id=$1 AND card_id=$2', [req.user.id, cardId])).rows[0];
          if (!owns) throw new Error('В витрину можно поставить только полученные карты');
        }
        await client.query(`
          INSERT INTO showcase (user_id, slot, card_id) VALUES ($1,$2,$3)
          ON CONFLICT (user_id, slot) DO UPDATE SET card_id=$3
        `, [req.user.id, i + 1, cardId]);
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

async function buildProfile(userId, viewerId) {
  const user = await one(`
    SELECT u.*, ac.image_url AS avatar_card_image, ac.rarity AS avatar_card_rarity
    FROM users u LEFT JOIN cards ac ON ac.id=u.avatar_card_id
    WHERE u.id=$1
  `, [userId]);
  const inventory = await many(`
    SELECT c.*, s.title AS series_title, s.slug AS series_slug, i.qty, i.first_obtained_at
    FROM inventory i
    JOIN cards c ON c.id=i.card_id
    LEFT JOIN series s ON s.id=c.series_id
    WHERE i.user_id=$1
    ORDER BY CASE c.rarity WHEN 'ONLYYOURS' THEN 5 WHEN 'UR' THEN 4 WHEN 'SSR' THEN 3 WHEN 'SR' THEN 2 ELSE 1 END DESC, i.first_obtained_at DESC
  `, [userId]);
  const showcase = await many(`
    SELECT sh.slot, c.*, s.title AS series_title, i.qty
    FROM showcase sh
    LEFT JOIN cards c ON c.id=sh.card_id
    LEFT JOIN series s ON s.id=c.series_id
    LEFT JOIN inventory i ON i.user_id=sh.user_id AND i.card_id=c.id
    WHERE sh.user_id=$1 ORDER BY sh.slot
  `, [userId]);
  const achievements = await many(`
    SELECT a.*, ua.earned_at FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id
    WHERE ua.user_id=$1 ORDER BY ua.earned_at DESC
  `, [userId]);
  const friendship = viewerId === userId ? null : await one(`
    SELECT * FROM friendships
    WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)
  `, [viewerId, userId]);
  return { user: publicUser(user), inventory, showcase, achievements, friendship };
}

export default router;
