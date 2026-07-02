import express from 'express';
import { auth } from '../middleware/auth.js';
import { many, tx } from '../db/pool.js';
import { publicUser } from '../src/security.js';

const router = express.Router();

router.get('/', auth, async (_req, res, next) => {
  try {
    const cards = await many(`
      SELECT c.*, s.title AS series_title FROM cards c LEFT JOIN series s ON s.id=c.series_id
      WHERE c.is_active=TRUE AND c.rarity <> 'ONLYYOURS' AND c.shop_price > 0
      ORDER BY c.shop_price, c.rarity
    `);
    res.json({ spinPacks: [{ spins: 1, price: 50 }, { spins: 5, price: 230 }, { spins: 10, price: 430 }], cards });
  } catch (err) { next(err); }
});

router.post('/buy-spins', auth, async (req, res, next) => {
  try {
    const spins = Math.min(50, Math.max(1, Number(req.body.spins || 1)));
    const price = spins >= 10 ? Math.ceil(spins * 43) : spins >= 5 ? Math.ceil(spins * 46) : spins * 50;
    const result = await tx(async client => {
      const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user.id])).rows[0];
      if (user.echo < price) throw new Error('Не хватает Эха');
      const next = (await client.query('UPDATE users SET echo=echo-$1, spins=spins+$2 WHERE id=$3 RETURNING *', [price, spins, req.user.id])).rows[0];
      return next;
    });
    res.json({ ok: true, user: publicUser(result), price });
  } catch (err) { next(err); }
});

router.post('/buy-card/:cardId', auth, async (req, res, next) => {
  try {
    const cardId = Number(req.params.cardId);
    const result = await tx(async client => {
      const card = (await client.query('SELECT * FROM cards WHERE id=$1 AND is_active=TRUE AND rarity <> $2 FOR UPDATE', [cardId, 'ONLYYOURS'])).rows[0];
      if (!card || !card.shop_price) throw new Error('Карта недоступна в магазине');
      const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user.id])).rows[0];
      if (user.echo < card.shop_price) throw new Error('Не хватает Эха');
      await client.query('UPDATE users SET echo=echo-$1 WHERE id=$2', [card.shop_price, req.user.id]);
      await client.query(`
        INSERT INTO inventory (user_id, card_id, qty) VALUES ($1,$2,1)
        ON CONFLICT (user_id, card_id) DO UPDATE SET qty=inventory.qty+1
      `, [req.user.id, card.id]);
      return (await client.query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
    });
    res.json({ ok: true, user: publicUser(result) });
  } catch (err) { next(err); }
});

export default router;
