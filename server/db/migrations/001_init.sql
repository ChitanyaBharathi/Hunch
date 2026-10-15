-- Hunch schema v1. Three separated areas:
--   game      rooms, rounds, players, guesses           (names live here, never in research)
--   identity  respondents, player_respondent_link, consents
--   research  responses                                  (no name, phone, email or room code)
-- plus catalog and business tables. Keep SQL portable: TEXT/INTEGER only, ISO-8601 timestamps,
-- money as integer cents, booleans as 0/1.

-- ── Catalog ──────────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  brand            TEXT,
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  image_url        TEXT,
  description      TEXT,
  unit_size        TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  sponsor_study_id INTEGER REFERENCES studies(id) ON DELETE SET NULL
);

CREATE TABLE product_prices (
  id          INTEGER PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  currency    TEXT NOT NULL DEFAULT 'SGD',
  retailer    TEXT,
  source_url  TEXT,
  observed_on TEXT NOT NULL            -- YYYY-MM-DD
);
CREATE INDEX product_prices_lookup ON product_prices (product_id, observed_on);

-- ── Game ─────────────────────────────────────────────────────────────────────
CREATE TABLE rooms (
  id               INTEGER PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  host_player_id   TEXT,
  created_at       TEXT NOT NULL,
  ended_at         TEXT,
  status           TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'finished')),
  current_round_no INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE rounds (
  id                   INTEGER PRIMARY KEY,
  room_id              INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_no             INTEGER NOT NULL,
  product_id           TEXT NOT NULL REFERENCES products(id),
  price_id             INTEGER REFERENCES product_prices(id),
  price_snapshot_cents INTEGER NOT NULL,
  started_at           TEXT,
  revealed_at          TEXT,
  UNIQUE (room_id, round_no)
);

CREATE TABLE players (
  id           TEXT PRIMARY KEY,
  room_id      INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  joined_at    TEXT NOT NULL
);
CREATE INDEX players_room ON players (room_id);

CREATE TABLE guesses (
  id              INTEGER PRIMARY KEY,
  round_id        INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id       TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guess_cents     INTEGER NOT NULL CHECK (guess_cents > 0),
  max_pay_cents   INTEGER CHECK (max_pay_cents >= 0),
  too_cheap_cents INTEGER CHECK (too_cheap_cents >= 0),
  submitted_at    TEXT NOT NULL,
  ms_to_answer    INTEGER,
  UNIQUE (round_id, player_id)
);

-- ── Identity and consent ─────────────────────────────────────────────────────
CREATE TABLE respondents (
  id                 TEXT PRIMARY KEY,   -- random UUID, the pseudonymous research identity
  key_hash           TEXT UNIQUE,        -- hash of the browser-held key; cleared on withdrawal
  created_at         TEXT NOT NULL,
  age_band           TEXT,
  gender             TEXT,
  region             TEXT,
  shops_online_freq  TEXT,
  profile_asked_at   TEXT,
  is_seed            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE player_respondent_link (
  player_id     TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  respondent_id TEXT NOT NULL REFERENCES respondents(id)
);
CREATE INDEX link_respondent ON player_respondent_link (respondent_id);

CREATE TABLE consents (
  id                INTEGER PRIMARY KEY,
  respondent_id     TEXT NOT NULL REFERENCES respondents(id),
  consent_version   TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  granted_at        TEXT NOT NULL,
  withdrawn_at      TEXT
);
CREATE INDEX consents_respondent ON consents (respondent_id);

-- ── Research (append-only; written at reveal for consented players only) ────
CREATE TABLE responses (
  id                       INTEGER PRIMARY KEY,
  respondent_id            TEXT NOT NULL REFERENCES respondents(id),
  product_id               TEXT NOT NULL REFERENCES products(id),
  round_position           INTEGER NOT NULL CHECK (round_position BETWEEN 1 AND 10),
  prev_product_price_cents INTEGER,
  actual_price_cents       INTEGER NOT NULL,
  guess_cents              INTEGER NOT NULL,
  max_pay_cents            INTEGER,
  too_cheap_cents          INTEGER,
  ms_to_answer             INTEGER,
  answered_at              TEXT NOT NULL,
  study_id                 INTEGER REFERENCES studies(id) ON DELETE SET NULL,
  is_seed                  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX responses_product ON responses (product_id, answered_at);
CREATE INDEX responses_respondent ON responses (respondent_id);

-- ── Business ─────────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  contact_email TEXT,
  created_at    TEXT NOT NULL,
  is_seed       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE studies (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  starts_on     TEXT NOT NULL,
  ends_on       TEXT NOT NULL,
  min_responses INTEGER NOT NULL DEFAULT 30,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed'))
);

-- The brief lists studies.product_ids; a join table keeps it queryable and portable to Postgres.
CREATE TABLE study_products (
  study_id   INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  PRIMARY KEY (study_id, product_id)
);

CREATE TABLE company_users (
  id                    INTEGER PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL UNIQUE,
  magic_link_token_hash TEXT,
  magic_link_expires_at TEXT,
  last_login_at         TEXT
);

CREATE TABLE report_access_log (
  id              INTEGER PRIMARY KEY,
  company_user_id INTEGER REFERENCES company_users(id) ON DELETE SET NULL,
  study_id        INTEGER REFERENCES studies(id) ON DELETE SET NULL,
  viewed_at       TEXT NOT NULL,
  exported        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
