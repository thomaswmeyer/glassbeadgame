PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS experiment_batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  source_environment TEXT NOT NULL CHECK (
    source_environment IN ('local', 'test', 'render_prod', 'render_preview', 'imported', 'external')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'running', 'complete', 'promoted', 'rejected', 'archived')
  ),
  model_set TEXT NOT NULL DEFAULT '{}',
  judge_set TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  promoted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'ai', 'agent', 'openclaw', 'test')),
  provider TEXT,
  model_id TEXT,
  model_version TEXT,
  agent_endpoint TEXT,
  owner_user_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN (
      'setup',
      'awaiting_response',
      'ai_thinking',
      'evaluating',
      'showing_results',
      'completed',
      'abandoned',
      'error'
    )
  ),
  mode TEXT NOT NULL CHECK (mode IN ('casual', 'rated', 'benchmark', 'experiment')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('secondary', 'undergrad', 'grad', 'unlimited')),
  max_rounds INTEGER NOT NULL CHECK (max_rounds > 0),
  current_round INTEGER NOT NULL DEFAULT 0 CHECK (current_round >= 0),
  current_game_player_id TEXT REFERENCES game_players(id) ON DELETE SET NULL,
  root_topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  winner_game_player_id TEXT REFERENCES game_players(id) ON DELETE SET NULL,
  rules_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  prompt_set_version TEXT NOT NULL,
  source_environment TEXT NOT NULL CHECK (
    source_environment IN ('local', 'test', 'render_prod', 'render_preview', 'imported', 'external')
  ),
  experiment_batch_id TEXT REFERENCES experiment_batches(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  seat_index INTEGER NOT NULL CHECK (seat_index >= 0),
  display_name TEXT NOT NULL,
  controller_kind TEXT NOT NULL CHECK (
    controller_kind IN ('local_human', 'local_ai', 'remote_human', 'remote_ai', 'openclaw', 'test')
  ),
  provider TEXT,
  model_id TEXT,
  model_version TEXT,
  prompt_config_version TEXT,
  final_score INTEGER NOT NULL DEFAULT 0,
  rating_participant_key TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, seat_index)
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  subject_category TEXT NOT NULL CHECK (
    subject_category IN (
      'philosophy',
      'science',
      'mathematics',
      'arts',
      'history',
      'psychology',
      'sociology',
      'technology',
      'religion',
      'economics',
      'other'
    )
  ),
  subject_subcategory TEXT,
  created_by_game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE RESTRICT,
  created_turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL,
  is_root INTEGER NOT NULL DEFAULT 0 CHECK (is_root IN (0, 1)),
  selected_definition_id TEXT REFERENCES topic_definitions(id) ON DELETE SET NULL,
  selected_judge_evaluation_id TEXT REFERENCES judge_evaluations(id) ON DELETE SET NULL,
  layout_x REAL,
  layout_y REAL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, normalized_text)
);

CREATE TABLE IF NOT EXISTS model_invocations (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (
    purpose IN (
      'generate_topic',
      'ai_move',
      'definition',
      'topic_judge',
      'edge_judge',
      'turn_judge',
      'game_judge',
      'calibration'
    )
  ),
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_version TEXT,
  prompt_version TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  request_payload TEXT NOT NULL DEFAULT '{}',
  raw_response TEXT,
  parsed_response TEXT,
  finish_reason TEXT,
  usage_metadata TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  source_environment TEXT NOT NULL CHECK (
    source_environment IN ('local', 'test', 'render_prod', 'render_preview', 'imported', 'external')
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topic_definitions (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  definition TEXT NOT NULL,
  model_invocation_id TEXT REFERENCES model_invocations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_version TEXT,
  prompt_version TEXT NOT NULL,
  is_selected INTEGER NOT NULL DEFAULT 0 CHECK (is_selected IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 0),
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE RESTRICT,
  destination_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  response_text TEXT NOT NULL,
  combined_score INTEGER NOT NULL DEFAULT 0,
  selected_judge_evaluation_id TEXT REFERENCES judge_evaluations(id) ON DELETE SET NULL,
  model_invocation_id TEXT REFERENCES model_invocations(id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  UNIQUE (game_id, round_number)
);

CREATE TABLE IF NOT EXISTS turn_sources (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  source_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  source_order INTEGER NOT NULL CHECK (source_order >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (turn_id, source_order),
  UNIQUE (turn_id, source_topic_id)
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  source_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  destination_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE RESTRICT,
  semantic_distance_score INTEGER CHECK (semantic_distance_score BETWEEN 1 AND 10),
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  novelty_score INTEGER CHECK (novelty_score BETWEEN 1 AND 10),
  raw_edge_score REAL,
  final_edge_score INTEGER,
  scoring_description TEXT,
  semantic_distance_description TEXT,
  relevance_description TEXT,
  selected_judge_evaluation_id TEXT REFERENCES judge_evaluations(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (turn_id, source_topic_id, destination_topic_id)
);

CREATE TABLE IF NOT EXISTS judge_evaluations (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('topic', 'edge', 'turn', 'game')),
  target_id TEXT NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  model_invocation_id TEXT REFERENCES model_invocations(id) ON DELETE SET NULL,
  judge_provider TEXT NOT NULL,
  judge_model_id TEXT NOT NULL,
  judge_model_version TEXT,
  prompt_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  semantic_distance_score INTEGER CHECK (semantic_distance_score BETWEEN 1 AND 10),
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  novelty_score INTEGER CHECK (novelty_score BETWEEN 1 AND 10),
  recognizability_score INTEGER CHECK (recognizability_score BETWEEN 1 AND 10),
  combined_score INTEGER,
  aesthetic_scores TEXT NOT NULL DEFAULT '{}',
  description TEXT,
  parsed_output TEXT NOT NULL DEFAULT '{}',
  raw_output TEXT,
  is_selected INTEGER NOT NULL DEFAULT 0 CHECK (is_selected IN (0, 1)),
  source_environment TEXT NOT NULL CHECK (
    source_environment IN ('local', 'test', 'render_prod', 'render_preview', 'imported', 'external')
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_aesthetic_evaluations (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  judge_evaluation_id TEXT NOT NULL REFERENCES judge_evaluations(id) ON DELETE CASCADE,
  interestingness_score INTEGER CHECK (interestingness_score BETWEEN 1 AND 10),
  beauty_score INTEGER CHECK (beauty_score BETWEEN 1 AND 10),
  balance_score INTEGER CHECK (balance_score BETWEEN 1 AND 10),
  thematic_coherence_score INTEGER CHECK (thematic_coherence_score BETWEEN 1 AND 10),
  surprise_score INTEGER CHECK (surprise_score BETWEEN 1 AND 10),
  restraint_score INTEGER CHECK (restraint_score BETWEEN 1 AND 10),
  hesse_like_composition_score INTEGER CHECK (hesse_like_composition_score BETWEEN 1 AND 10),
  review TEXT,
  is_selected INTEGER NOT NULL DEFAULT 0 CHECK (is_selected IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rating_events (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  rating_system TEXT NOT NULL CHECK (rating_system IN ('elo', 'glicko2', 'trueskill')),
  rating_pool TEXT NOT NULL CHECK (rating_pool IN ('casual', 'rated', 'benchmark', 'experimental')),
  rating_before REAL NOT NULL,
  rating_after REAL NOT NULL,
  rating_delta REAL NOT NULL,
  uncertainty_before REAL,
  uncertainty_after REAL,
  result_summary TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_mode ON games(mode);
CREATE INDEX IF NOT EXISTS idx_games_experiment_batch_id ON games(experiment_batch_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_topics_game_id ON topics(game_id);
CREATE INDEX IF NOT EXISTS idx_topics_normalized_text ON topics(normalized_text);
CREATE INDEX IF NOT EXISTS idx_topic_definitions_topic_id ON topic_definitions(topic_id);
CREATE INDEX IF NOT EXISTS idx_turns_game_id_round_number ON turns(game_id, round_number);
CREATE INDEX IF NOT EXISTS idx_turn_sources_turn_id ON turn_sources(turn_id);
CREATE INDEX IF NOT EXISTS idx_edges_game_id ON edges(game_id);
CREATE INDEX IF NOT EXISTS idx_edges_turn_id ON edges(turn_id);
CREATE INDEX IF NOT EXISTS idx_edges_source_destination ON edges(source_topic_id, destination_topic_id);
CREATE INDEX IF NOT EXISTS idx_model_invocations_purpose ON model_invocations(purpose);
CREATE INDEX IF NOT EXISTS idx_judge_evaluations_target ON judge_evaluations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_judge_evaluations_game_id ON judge_evaluations(game_id);
CREATE INDEX IF NOT EXISTS idx_game_aesthetic_evaluations_game_id ON game_aesthetic_evaluations(game_id);
CREATE INDEX IF NOT EXISTS idx_rating_events_game_player_id ON rating_events(game_player_id);

CREATE TRIGGER IF NOT EXISTS validate_games_current_game_player
BEFORE INSERT ON games
WHEN NEW.current_game_player_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'current_game_player_id must reference a game_player in the same game')
  WHERE NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE id = NEW.current_game_player_id AND game_id = NEW.id
  );
END;

CREATE TRIGGER IF NOT EXISTS validate_games_current_game_player_update
BEFORE UPDATE OF current_game_player_id ON games
WHEN NEW.current_game_player_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'current_game_player_id must reference a game_player in the same game')
  WHERE NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE id = NEW.current_game_player_id AND game_id = NEW.id
  );
END;

CREATE TRIGGER IF NOT EXISTS validate_games_root_topic
BEFORE UPDATE OF root_topic_id ON games
WHEN NEW.root_topic_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'root_topic_id must reference a topic in the same game')
  WHERE NOT EXISTS (
    SELECT 1 FROM topics
    WHERE id = NEW.root_topic_id AND game_id = NEW.id
  );
END;

CREATE TRIGGER IF NOT EXISTS validate_turn_sources_same_game
BEFORE INSERT ON turn_sources
BEGIN
  SELECT RAISE(ABORT, 'turn source topic must belong to the same game as the turn')
  WHERE NOT EXISTS (
    SELECT 1
    FROM turns
    JOIN topics ON topics.id = NEW.source_topic_id
    WHERE turns.id = NEW.turn_id AND topics.game_id = turns.game_id
  );
END;

CREATE TRIGGER IF NOT EXISTS validate_edges_same_game
BEFORE INSERT ON edges
BEGIN
  SELECT RAISE(ABORT, 'edge endpoints and player must belong to the same game as the edge')
  WHERE NOT EXISTS (
    SELECT 1
    FROM topics source_topic
    JOIN topics destination_topic ON destination_topic.id = NEW.destination_topic_id
    JOIN game_players ON game_players.id = NEW.game_player_id
    JOIN turns ON turns.id = NEW.turn_id
    WHERE source_topic.id = NEW.source_topic_id
      AND source_topic.game_id = NEW.game_id
      AND destination_topic.game_id = NEW.game_id
      AND game_players.game_id = NEW.game_id
      AND turns.game_id = NEW.game_id
  );
END;
