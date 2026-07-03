import express from 'express';
import { auth } from '../middleware/auth.js';
import { many, one, tx } from '../db/pool.js';

const router = express.Router();

router.get('/search', auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json({ users: [] });
    const users = await many(`
      SELECT id, login, avatar_emoji, created_at FROM users
      WHERE login ILIKE $1 AND id <> $2
      ORDER BY login LIMIT 20
    `, [`%${q}%`, req.user.id]);
    res.json({ users });
  } catch (err) { next(err); }
});

router.get('/notifications', auth, async (req, res, next) => {
  try {
    const row = await one(`
      SELECT
        (SELECT count(*)::int FROM friendships WHERE addressee_id=$1 AND status='pending' AND seen_by_addressee=FALSE) AS incoming_friends,
        (SELECT count(*)::int FROM trades WHERE to_user_id=$1 AND status='pending' AND seen_by_to=FALSE) AS incoming_trades,
        (SELECT count(*)::int FROM trades WHERE from_user_id=$1 AND status IN ('accepted','rejected') AND seen_by_from=FALSE) AS resolved_trades
    `, [req.user.id]);
    res.json({
      incomingFriends: row.incoming_friends,
      incomingTrades: row.incoming_trades,
      resolvedTrades: row.resolved_trades,
      total: row.incoming_friends + row.incoming_trades + row.resolved_trades
    });
  } catch (err) { next(err); }
});

router.post('/seen', auth, async (req, res, next) => {
  try {
    await tx(async client => {
      await client.query('UPDATE friendships SET seen_by_addressee=TRUE WHERE addressee_id=$1 AND status=\'pending\'', [req.user.id]);
      await client.query('UPDATE trades SET seen_by_to=TRUE WHERE to_user_id=$1 AND status=\'pending\'', [req.user.id]);
      await client.query('UPDATE trades SET seen_by_from=TRUE WHERE from_user_id=$1 AND status IN (\'accepted\',\'rejected\')', [req.user.id]);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/friends', auth, async (req, res, next) => {
  try {
    const friends = await many(`
      SELECT f.*, u.id AS friend_id, u.login, u.avatar_emoji
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id=$1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id=$1 OR f.addressee_id=$1) AND f.status='accepted'
      ORDER BY u.login
    `, [req.user.id]);
    const incoming = await many(`
      SELECT f.*, u.login, u.avatar_emoji FROM friendships f JOIN users u ON u.id=f.requester_id
      WHERE f.addressee_id=$1 AND f.status='pending' ORDER BY f.created_at DESC
    `, [req.user.id]);
    res.json({ friends, incoming });
  } catch (err) { next(err); }
});

router.post('/friends/:login', auth, async (req, res, next) => {
  try {
    const target = await one('SELECT id FROM users WHERE login=$1', [String(req.params.login).toLowerCase()]);
    if (!target || target.id === req.user.id) throw new Error('Пользователь не найден');
    await one(`
      INSERT INTO friendships (requester_id, addressee_id) VALUES ($1,$2)
      ON CONFLICT (requester_id, addressee_id) DO NOTHING RETURNING *
    `, [req.user.id, target.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/friends/:id/respond', auth, async (req, res, next) => {
  try {
    const status = req.body.accept ? 'accepted' : 'rejected';
    await one('UPDATE friendships SET status=$1, updated_at=now() WHERE id=$2 AND addressee_id=$3 RETURNING *', [status, Number(req.params.id), req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/trades', auth, async (req, res, next) => {
  try {
    const trades = await many(`
      SELECT tr.*, fu.login AS from_login, tu.login AS to_login,
        fc.title AS from_card_title, fc.image_url AS from_card_image, fc.rarity AS from_card_rarity,
        tc.title AS to_card_title, tc.image_url AS to_card_image, tc.rarity AS to_card_rarity
      FROM trades tr
      JOIN users fu ON fu.id=tr.from_user_id
      JOIN users tu ON tu.id=tr.to_user_id
      JOIN cards fc ON fc.id=tr.from_card_id
      JOIN cards tc ON tc.id=tr.to_card_id
      WHERE tr.from_user_id=$1 OR tr.to_user_id=$1
      ORDER BY tr.created_at DESC LIMIT 50
    `, [req.user.id]);
    res.json({ trades });
  } catch (err) { next(err); }
});

router.post('/trades', auth, async (req, res, next) => {
  try {
    const toLogin = String(req.body.to_login || '').toLowerCase();
    const fromCard = Number(req.body.from_card_id);
    const toCard = Number(req.body.to_card_id);
    const message = String(req.body.message || '').slice(0, 220);
    const trade = await tx(async client => {
      const to = (await client.query('SELECT id FROM users WHERE login=$1', [toLogin])).rows[0];
      if (!to || to.id === req.user.id) throw new Error('Друг не найден');
      const friendship = (await client.query(`
        SELECT 1 FROM friendships WHERE status='accepted' AND ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1))
      `, [req.user.id, to.id])).rows[0];
      if (!friendship) throw new Error('Сначала добавьте пользователя в друзья');
      const own = (await client.query('SELECT qty FROM inventory WHERE user_id=$1 AND card_id=$2', [req.user.id, fromCard])).rows[0];
      const other = (await client.query('SELECT qty FROM inventory WHERE user_id=$1 AND card_id=$2', [to.id, toCard])).rows[0];
      if (!own || !other) throw new Error('Одна из карт отсутствует в коллекции');
      return (await client.query(`
        INSERT INTO trades (from_user_id, to_user_id, from_card_id, to_card_id, message)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [req.user.id, to.id, fromCard, toCard, message])).rows[0];
    });
    res.json({ ok: true, trade });
  } catch (err) { next(err); }
});

router.post('/trades/:id/respond', auth, async (req, res, next) => {
  try {
    const accept = Boolean(req.body.accept);
    const result = await tx(async client => {
      const trade = (await client.query('SELECT * FROM trades WHERE id=$1 FOR UPDATE', [Number(req.params.id)])).rows[0];
      if (!trade || trade.to_user_id !== req.user.id || trade.status !== 'pending') throw new Error('Трейд не найден или уже закрыт');
      if (!accept) {
        return (await client.query('UPDATE trades SET status=$1, updated_at=now() WHERE id=$2 RETURNING *', ['rejected', trade.id])).rows[0];
      }
      const a = (await client.query('SELECT qty FROM inventory WHERE user_id=$1 AND card_id=$2 FOR UPDATE', [trade.from_user_id, trade.from_card_id])).rows[0];
      const b = (await client.query('SELECT qty FROM inventory WHERE user_id=$1 AND card_id=$2 FOR UPDATE', [trade.to_user_id, trade.to_card_id])).rows[0];
      if (!a || !b) throw new Error('У одного из игроков карта уже отсутствует');
      await moveCard(client, trade.from_user_id, trade.to_user_id, trade.from_card_id);
      await moveCard(client, trade.to_user_id, trade.from_user_id, trade.to_card_id);
      return (await client.query('UPDATE trades SET status=$1, updated_at=now() WHERE id=$2 RETURNING *', ['accepted', trade.id])).rows[0];
    });
    res.json({ ok: true, trade: result });
  } catch (err) { next(err); }
});

async function moveCard(client, fromUser, toUser, cardId) {
  const inv = (await client.query('SELECT qty FROM inventory WHERE user_id=$1 AND card_id=$2 FOR UPDATE', [fromUser, cardId])).rows[0];
  if (!inv) throw new Error('Карта отсутствует');
  if (inv.qty <= 1) await client.query('DELETE FROM inventory WHERE user_id=$1 AND card_id=$2', [fromUser, cardId]);
  else await client.query('UPDATE inventory SET qty=qty-1 WHERE user_id=$1 AND card_id=$2', [fromUser, cardId]);
  await client.query(`
    INSERT INTO inventory (user_id, card_id, qty) VALUES ($1,$2,1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET qty=inventory.qty+1
  `, [toUser, cardId]);
}

export default router;
