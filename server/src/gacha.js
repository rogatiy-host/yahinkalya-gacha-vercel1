const RARITY_ORDER = ['R', 'SR', 'SSR', 'UR', 'ONLYYOURS'];
const ECHO_DUPES = { R: 5, SR: 25, SSR: 80, UR: 250, ONLYYOURS: 0 };
const RARITY_COLOR = { R: '#75a7ff', SR: '#b967ff', SSR: '#ffd166', UR: '#00f5d4', ONLYYOURS: '#ff2bd6' };

function chooseWeighted(items, weightFn) {
  const pool = items.filter(Boolean);
  const total = pool.reduce((sum, item) => sum + Math.max(1, Number(weightFn(item) || 1)), 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= Math.max(1, Number(weightFn(item) || 1));
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1];
}

function rarityWeightForUser(rarity, user, forced) {
  if (forced === 'UR') return rarity === 'UR' ? 1 : 0;
  if (forced === 'SR_PLUS') {
    if (rarity === 'SR') return 760;
    if (rarity === 'SSR') return 210;
    if (rarity === 'UR') return 30 + softUrBoost(user.pity_ur);
    return 0;
  }
  const ur = 14.5 + softUrBoost(user.pity_ur);
  return ({ R: 720, SR: 200, SSR: 65, UR: ur, ONLYYOURS: 0 })[rarity] || 0;
}

function softUrBoost(pityUr = 0) {
  if (pityUr < 60) return 0;
  return Math.min(650, (pityUr - 59) * 35);
}

function forcedRarity(user) {
  if (user.pity_ur >= 79) return 'UR';
  if (user.pity_sr >= 9) return 'SR_PLUS';
  return null;
}

export function rarityMeta(rarity) {
  return {
    rarity,
    color: RARITY_COLOR[rarity] || '#fff',
    echoDuplicate: ECHO_DUPES[rarity] || 0,
    rank: RARITY_ORDER.indexOf(rarity)
  };
}

export async function pullOnce(client, userId, bannerId = null) {
  const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
  if (!user) throw new Error('Пользователь не найден');
  if (user.spins <= 0) throw new Error('Недостаточно круток');

  const banner = bannerId
    ? (await client.query('SELECT * FROM banners WHERE id=$1 AND active=TRUE', [bannerId])).rows[0]
    : (await client.query('SELECT * FROM banners WHERE active=TRUE AND now() BETWEEN start_at AND end_at ORDER BY id DESC LIMIT 1')).rows[0];
  const bannerCardIds = banner
    ? new Set((await client.query('SELECT card_id FROM banner_cards WHERE banner_id=$1', [banner.id])).rows.map(r => r.card_id))
    : new Set();

  const cards = (await client.query(`
    SELECT c.*, s.title AS series_title, s.slug AS series_slug, s.color AS series_color,
      EXISTS(SELECT 1 FROM wishlist w WHERE w.user_id=$1 AND w.card_id=c.id) AS in_wishlist
    FROM cards c
    LEFT JOIN series s ON s.id=c.series_id
    WHERE c.is_active=TRUE
  `, [userId])).rows;
  if (!cards.length) throw new Error('В админке ещё нет активных карточек');

  function isBoosted(card) {
    if (!banner) return false;
    if (banner.boost_series_id && card.series_id === banner.boost_series_id) return true;
    if (bannerCardIds.has(card.id)) return true;
    if (Array.isArray(banner.tags) && banner.tags.length && Array.isArray(card.tags)) {
      return card.tags.some(t => banner.tags.includes(t));
    }
    return false;
  }

  const onlyPool = cards.filter(c => c.rarity === 'ONLYYOURS');
  const onlyChance = 0.0004; // 0.04%, без гаранта и не сбрасывает pity.
  let selected;
  let selectedRarity;
  let hitOnly = false;

  if (onlyPool.length && Math.random() < onlyChance) {
    selectedRarity = 'ONLYYOURS';
    selected = chooseWeighted(onlyPool, c => c.event_weight);
    hitOnly = true;
  } else {
    const forced = forcedRarity(user);
    const rarities = ['R', 'SR', 'SSR', 'UR'];
    selectedRarity = chooseWeighted(rarities, r => rarityWeightForUser(r, user, forced));
    const pool = cards.filter(c => c.rarity === selectedRarity);
    selected = chooseWeighted(pool, c => {
      let weight = c.event_weight || 100;
      if (isBoosted(c)) weight *= 1.8;
      if ((forced === 'SR_PLUS' || forced === 'UR') && c.in_wishlist) weight *= 3.5;
      return weight;
    });
  }

  if (!selected) throw new Error(`Нет активных карт редкости ${selectedRarity}`);

  const inv = (await client.query('SELECT * FROM inventory WHERE user_id=$1 AND card_id=$2 FOR UPDATE', [userId, selected.id])).rows[0];
  const isDuplicate = Boolean(inv);
  let echoAwarded = 0;

  if (inv) {
    if (selected.rarity === 'ONLYYOURS') {
      await client.query('UPDATE inventory SET qty=qty+1 WHERE user_id=$1 AND card_id=$2', [userId, selected.id]);
    } else {
      echoAwarded = ECHO_DUPES[selected.rarity] || 0;
      await client.query('UPDATE users SET echo=echo+$1 WHERE id=$2', [echoAwarded, userId]);
    }
  } else {
    await client.query('INSERT INTO inventory (user_id, card_id, qty) VALUES ($1,$2,1)', [userId, selected.id]);
  }

  let nextSr = user.pity_sr;
  let nextUr = user.pity_ur;
  if (!hitOnly) {
    nextSr = ['SR','SSR','UR'].includes(selected.rarity) ? 0 : user.pity_sr + 1;
    nextUr = selected.rarity === 'UR' ? 0 : user.pity_ur + 1;
  }

  await client.query('UPDATE users SET spins=spins-1, pity_sr=$1, pity_ur=$2 WHERE id=$3', [nextSr, nextUr, userId]);
  await client.query(`INSERT INTO pull_history (user_id, card_id, rarity, is_duplicate, echo_awarded, banner_id)
    VALUES ($1,$2,$3,$4,$5,$6)`, [userId, selected.id, selected.rarity, isDuplicate, echoAwarded, banner?.id || null]);

  return {
    card: selected,
    isDuplicate,
    echoAwarded,
    pity: { sr: nextSr, ur: nextUr, srUntil: Math.max(0, 10 - nextSr), urUntil: Math.max(0, 80 - nextUr) },
    banner: banner ? { id: banner.id, title: banner.title } : null,
    meta: rarityMeta(selected.rarity)
  };
}

export async function checkAutoAchievements(client, userId, lastPulls = []) {
  const unlocked = [];
  async function grant(code) {
    const ach = (await client.query('SELECT * FROM achievements WHERE code=$1', [code])).rows[0];
    if (!ach) return;
    const inserted = (await client.query(`
      INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1,$2)
      ON CONFLICT DO NOTHING RETURNING *
    `, [userId, ach.id])).rows[0];
    if (inserted) {
      await client.query('UPDATE users SET spins=spins+$1, echo=echo+$2 WHERE id=$3', [ach.reward_spins, ach.reward_echo, userId]);
      unlocked.push(ach);
    }
  }

  if (lastPulls.some(p => p.card.rarity === 'UR')) await grant('first_ur');
  if (lastPulls.some(p => p.card.rarity === 'ONLYYOURS')) await grant('onlyyours');

  const fullSeries = await client.query(`
    SELECT s.id, s.title
    FROM series s
    WHERE NOT EXISTS (
      SELECT 1 FROM cards c
      WHERE c.series_id=s.id AND c.is_active=TRUE
      AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.user_id=$1 AND i.card_id=c.id)
    )
  `, [userId]);
  if (fullSeries.rows.length) await grant('full_series');
  return unlocked;
}
