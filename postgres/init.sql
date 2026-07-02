CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT NOT NULL UNIQUE CHECK (length(login) BETWEEN 3 AND 24),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','admin')),
  spins INTEGER NOT NULL DEFAULT 10 CHECK (spins >= 0),
  echo INTEGER NOT NULL DEFAULT 0 CHECK (echo >= 0),
  avatar_emoji TEXT NOT NULL DEFAULT '✨',
  avatar_card_id INTEGER,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_daily_at DATE,
  pity_sr INTEGER NOT NULL DEFAULT 0,
  pity_ur INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#9b5cff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL CHECK (rarity IN ('R','SR','SSR','UR','ONLYYOURS')),
  series_id INTEGER REFERENCES series(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  frame_css TEXT DEFAULT '',
  shop_price INTEGER NOT NULL DEFAULT 0,
  event_weight INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  first_obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS showcase (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, slot)
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  boost_series_id INTEGER REFERENCES series(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  start_at TIMESTAMPTZ DEFAULT now(),
  end_at TIMESTAMPTZ DEFAULT now() + interval '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pull_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rarity TEXT NOT NULL,
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  echo_awarded INTEGER NOT NULL DEFAULT 0,
  banner_id INTEGER REFERENCES banners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('daily_login','telegram_subscribe','telegram_react','open_link','manual')),
  reward_spins INTEGER NOT NULL DEFAULT 0,
  reward_echo INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  daily BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_claims (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL DEFAULT current_date,
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('pending','done','rejected')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id, claim_date)
);

CREATE TABLE IF NOT EXISTS promocodes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  spins INTEGER NOT NULL DEFAULT 0,
  echo INTEGER NOT NULL DEFAULT 0,
  max_global_uses INTEGER NOT NULL DEFAULT 1,
  max_per_user INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promocode_uses (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promocode_id INTEGER NOT NULL REFERENCES promocodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  to_card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  medal_emoji TEXT NOT NULL DEFAULT '🏅',
  reward_spins INTEGER NOT NULL DEFAULT 0,
  reward_echo INTEGER NOT NULL DEFAULT 0,
  auto_rule TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO series (title, slug, description, color) VALUES
('Start Pack', 'start-pack', 'Базовая стартовая серия для первого запуска.', '#7c5cff'),
('Neon Dreams', 'neon-dreams', 'Неоновая серия с яркой подсветкой.', '#00e5ff'),
('Secret Vault', 'secret-vault', 'Скрытая серия для ультра-редких находок.', '#ffd166')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO cards (title, caption, rarity, series_id, image_url, shop_price, event_weight) VALUES
('Spark Rookie', 'Первый свет коллекции', 'R', (SELECT id FROM series WHERE slug='start-pack'), '/assets/cards/r-spark.svg', 30, 120),
('Moon Glitch', 'Лунный сдвиг реальности', 'R', (SELECT id FROM series WHERE slug='neon-dreams'), '/assets/cards/r-moon.svg', 35, 100),
('Violet Pulse', 'Пульс редкого сияния', 'SR', (SELECT id FROM series WHERE slug='neon-dreams'), '/assets/cards/sr-violet.svg', 140, 80),
('Golden Flare', 'Золотая вспышка баннера', 'SSR', (SELECT id FROM series WHERE slug='start-pack'), '/assets/cards/ssr-gold.svg', 520, 40),
('Aurora Crown', 'Корона северной ауры', 'UR', (SELECT id FROM series WHERE slug='secret-vault'), '/assets/cards/ur-aurora.svg', 1800, 12),
('ONLY YOURS: Black Star', 'Личная легенда. Без гаранта.', 'ONLYYOURS', (SELECT id FROM series WHERE slug='secret-vault'), '/assets/cards/only-blackstar.svg', 0, 1)
ON CONFLICT DO NOTHING;

INSERT INTO banners (title, description, boost_series_id, active) VALUES
('Neon Wish', 'Временный баннер с повышением веса серии Neon Dreams.', (SELECT id FROM series WHERE slug='neon-dreams'), TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO tasks (title, description, type, reward_spins, reward_echo, payload, active, daily, sort_order) VALUES
('Ежедневный вход', 'Забери награду за вход. На 7-й день стрика будет бонус.', 'daily_login', 1, 10, '{}', TRUE, TRUE, 1),
('Подписка на Telegram', 'Подпишись на канал и получи крутки.', 'telegram_subscribe', 2, 0, '{"channel":"env"}', TRUE, TRUE, 2),
('Реакция на пост', 'Поставь реакцию на пост дня. Проверка может быть ручной или через бота.', 'telegram_react', 1, 15, '{"url":"https://t.me/your_channel_username"}', TRUE, TRUE, 3)
ON CONFLICT DO NOTHING;

INSERT INTO promocodes (code, spins, echo, max_global_uses, max_per_user, active)
VALUES ('YAHINKALYAONLY', 20, 0, 6, 1, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO achievements (code, title, description, medal_emoji, reward_spins, reward_echo, auto_rule) VALUES
('veteran', 'Ветеран', 'Выдаётся вручную через админ-панель.', '🛡️', 0, 0, 'manual'),
('first_ur', 'Охотник за сиянием', 'Выбить первую UR-карту.', '💎', 2, 100, 'first_ur'),
('full_series', 'Коллекционер серии', 'Собрать все карты одной серии.', '👑', 5, 300, 'full_series'),
('onlyyours', 'Слишком личное', 'Получить карту ONLYYOURS.', '🖤', 10, 1000, 'onlyyours')
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_pull_history_user_created ON pull_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_claims_user_date ON task_claims(user_id, claim_date DESC);
