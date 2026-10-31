-- =============================================================
-- HACK-O-LANTERN 2026: Shared Event Schema
-- Covers: Evaluation, Leaderboard, and Snacks
-- =============================================================

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(32) PRIMARY KEY, -- e.g. 'VHK-1011'
  name VARCHAR(100) NOT NULL,
  normalised_name VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finalist', 'dropped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_normalised_name ON teams(normalised_name);

-- 2. Evaluators Table
CREATE TABLE IF NOT EXISTS evaluators (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'evaluator' CHECK (role IN ('evaluator', 'admin')),
  password_hash VARCHAR(255) NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluators_username ON evaluators(username);

-- 3. Rounds Table
CREATE TABLE IF NOT EXISTS rounds (
  round_number INT PRIMARY KEY CHECK (round_number BETWEEN 1 AND 4),
  label VARCHAR(50) NOT NULL,
  max_marks NUMERIC(5,2),
  evaluators_per_team INT NOT NULL DEFAULT 3,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'open', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Marks Table (Atomic 3-evaluators limit per team per round)
CREATE TABLE IF NOT EXISTS marks (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(32) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  evaluator_id INT NOT NULL REFERENCES evaluators(id) ON DELETE CASCADE,
  round_number INT NOT NULL REFERENCES rounds(round_number) ON DELETE CASCADE,
  value NUMERIC(5,2) NOT NULL,
  removed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_evaluator_round UNIQUE (team_id, evaluator_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_marks_team_round ON marks(team_id, round_number);
CREATE INDEX IF NOT EXISTS idx_marks_evaluator ON marks(evaluator_id);

-- 5. Mark History (Complete audit trail for changes, removals, overrides)
CREATE TABLE IF NOT EXISTS mark_history (
  id SERIAL PRIMARY KEY,
  mark_id INT REFERENCES marks(id) ON DELETE SET NULL,
  team_id VARCHAR(32) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  evaluator_id INT NOT NULL REFERENCES evaluators(id) ON DELETE CASCADE,
  round_number INT NOT NULL REFERENCES rounds(round_number) ON DELETE CASCADE,
  old_value NUMERIC(5,2),
  new_value NUMERIC(5,2),
  action VARCHAR(50) NOT NULL,
  changed_by VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mark_history_team ON mark_history(team_id);
CREATE INDEX IF NOT EXISTS idx_mark_history_created ON mark_history(created_at DESC);

-- 6. Event Settings (Single row config)
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  leaderboard_mode VARCHAR(20) NOT NULL DEFAULT 'live' CHECK (leaderboard_mode IN ('live', 'frozen', 'hidden')),
  leaderboard_scope VARCHAR(20) NOT NULL DEFAULT 'finalists_only' CHECK (leaderboard_scope IN ('finalists_only', 'all_teams')),
  final_ranking_rule VARCHAR(20) CHECK (final_ranking_rule IS NULL OR final_ranking_rule IN ('final_only', 'cumulative')),
  round_weights JSONB NOT NULL DEFAULT '{"1":1, "2":1, "3":1}',
  final_weight NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  tie_break_order JSONB NOT NULL DEFAULT '[3, 2, 1]',
  number_of_finalists INT NOT NULL DEFAULT 10,
  frozen_snapshot JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Snack Slots Table
CREATE TABLE IF NOT EXISTS snack_slots (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Snack Given Table (Unique per team and slot)
CREATE TABLE IF NOT EXISTS snack_given (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(32) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slot_id INT NOT NULL REFERENCES snack_slots(id) ON DELETE CASCADE,
  given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  given_by VARCHAR(100) NOT NULL,
  undone_at TIMESTAMPTZ,
  undone_by VARCHAR(100),
  undo_reason TEXT,
  CONSTRAINT uq_team_slot UNIQUE (team_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_snack_given_team ON snack_given(team_id);
CREATE INDEX IF NOT EXISTS idx_snack_given_slot ON snack_given(slot_id);

-- =============================================================
-- Row Level Security (RLS) - Deny direct anonymous/browser writes
-- =============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mark_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE snack_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snack_given ENABLE ROW LEVEL SECURITY;
-- No public policies created. Backend server routes connect using DATABASE_URL.

