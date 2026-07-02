import express from 'express';
import { auth } from '../middleware/auth.js';
import { many, one, tx } from '../db/pool.js';
import { checkTelegramSubscription } from '../src/telegram.js';
import { publicUser } from '../src/security.js';

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const rows = await many(`
      SELECT t.*, tc.status AS today_status, tc.completed_at
      FROM tasks t
      LEFT JOIN task_claims tc ON tc.task_id=t.id AND tc.user_id=$1 AND tc.claim_date=current_date
      WHERE t.active=TRUE
      ORDER BY t.sort_order, t.id
    `, [req.user.id]);
    res.json({ tasks: rows });
  } catch (err) { next(err); }
});

router.post('/:id/claim', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await tx(async client => {
      const task = (await client.query('SELECT * FROM tasks WHERE id=$1 AND active=TRUE FOR UPDATE', [id])).rows[0];
      if (!task) throw new Error('Задание не найдено');
      const exists = (await client.query('SELECT * FROM task_claims WHERE user_id=$1 AND task_id=$2 AND claim_date=current_date', [req.user.id, id])).rows[0];
      if (exists) throw new Error('Сегодня это задание уже выполнено');

      if (task.type === 'telegram_subscribe') {
        const user = (await client.query('SELECT telegram_id FROM users WHERE id=$1', [req.user.id])).rows[0];
        const check = await checkTelegramSubscription(user?.telegram_id);
        if (!check.ok && process.env.TELEGRAM_BOT_TOKEN) throw new Error('Подписка на канал не подтверждена');
      }

      let rewardSpins = task.reward_spins;
      let rewardEcho = task.reward_echo;
      if (task.type === 'daily_login') {
        const user = (await client.query('SELECT daily_streak, last_daily_at FROM users WHERE id=$1 FOR UPDATE', [req.user.id])).rows[0];
        const streakRes = await client.query(`
          SELECT CASE
            WHEN $1::date = current_date - interval '1 day' THEN $2::int + 1
            WHEN $1::date = current_date THEN $2::int
            ELSE 1
          END AS streak
        `, [user.last_daily_at, user.daily_streak]);
        const streak = Number(streakRes.rows[0].streak || 1);
        rewardSpins += streak % 7 === 0 ? 3 : 0;
        await client.query('UPDATE users SET daily_streak=$1, last_daily_at=current_date WHERE id=$2', [streak, req.user.id]);
      }

      await client.query(`
        INSERT INTO task_claims (user_id, task_id, claim_date, status) VALUES ($1,$2,current_date,'done')
      `, [req.user.id, id]);
      await client.query('UPDATE users SET spins=spins+$1, echo=echo+$2 WHERE id=$3', [rewardSpins, rewardEcho, req.user.id]);
      const user = (await client.query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
      return { task, rewardSpins, rewardEcho, user };
    });
    res.json({ ok: true, ...result, user: publicUser(result.user) });
  } catch (err) { next(err); }
});

router.post('/promocode', auth, async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const result = await tx(async client => {
      const promo = (await client.query('SELECT * FROM promocodes WHERE code=$1 AND active=TRUE FOR UPDATE', [code])).rows[0];
      if (!promo) throw new Error('Промокод не найден или отключён');
      const globalUses = Number((await client.query('SELECT count(*) FROM promocode_uses WHERE promocode_id=$1', [promo.id])).rows[0].count);
      if (globalUses >= promo.max_global_uses) throw new Error('Лимит использований промокода уже закончился');
      const userUses = Number((await client.query('SELECT count(*) FROM promocode_uses WHERE promocode_id=$1 AND user_id=$2', [promo.id, req.user.id])).rows[0].count);
      if (userUses >= promo.max_per_user) throw new Error('Вы уже использовали этот промокод');
      await client.query('INSERT INTO promocode_uses (user_id, promocode_id) VALUES ($1,$2)', [req.user.id, promo.id]);
      await client.query('UPDATE users SET spins=spins+$1, echo=echo+$2 WHERE id=$3', [promo.spins, promo.echo, req.user.id]);
      const user = (await client.query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
      return { promo, user };
    });
    res.json({ ok: true, promo: result.promo, user: publicUser(result.user) });
  } catch (err) { next(err); }
});

export default router;
