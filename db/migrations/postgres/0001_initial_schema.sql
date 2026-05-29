DO $$ BEGIN CREATE TYPE game_status AS ENUM ('setup', 'awaiting_response', 'ai_thinking', 'evaluating', 'showing_results', 'completed', 'abandoned', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE game_mode AS ENUM ('casual', 'rated', 'benchmark', 'experiment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE difficulty_level AS ENUM ('secondary', 'undergrad', 'grad', 'unlimited'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE source_environment AS ENUM ('local', 'test', 'render_prod', 'render_preview', 'imported', 'external'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE player_kind AS ENUM ('human', 'ai', 'agent', 'openclaw', 'test'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE player_controller_kind AS ENUM ('local_human', 'local_ai', 'remote_human', 'remote_ai', 'openclaw', 'test'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subject_category AS ENUM ('philosophy', 'science', 'mathematics', 'arts', 'history', 'psychology', 'sociology', 'technology', 'religion', 'economics', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE model_invocation_purpose AS ENUM ('generate_topic', 'ai_move', 'definition', 'topic_judge', 'edge_judge', 'turn_judge', 'game_judge', 'calibration'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE judge_target_type AS ENUM ('topic', 'edge', 'turn', 'game'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE experiment_batch_status AS ENUM ('draft', 'running', 'complete', 'promoted', 'rejected', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rating_system AS ENUM ('elo', 'glicko2', 'trueskill'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rating_pool AS ENUM ('casual', 'rated', 'benchmark', 'experimental'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS experiment_batches (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  source_environment source_environment NOT NULL,
  status experiment_batch_status NOT NULL,
  model_set TEXT NOT NULL DEFAULT '{}',
  judge_set TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  promoted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  kind player_kind NOT NULL,
  provider TEXT,
  model_id TEXT,
  model_version TEXT,
  agent_endpoint TEXT,
  owner_user_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  status game_status NOT NULL,
  mode game_mode NOT NULL,
  difficulty difficulty_level NOT NULL,
  max_rounds INTEGER NOT NULL CHECK (max_rounds > 0),
  current_round INTEGER NOT NULL DEFAULT 0 CHECK (current_round >= 0),
  current_game_player_id UUID,
  root_topic_id UUID,
  winner_game_player_id UUID,
  rules_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  prompt_set_version TEXT NOT NULL,
  source_environment source_environment NOT NULL,
  experiment_batch_id UUID REFERENCES experiment_batches(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  seat_index INTEGER NOT NULL CHECK (seat_index >= 0),
  display_name TEXT NOT NULL,
  controller_kind player_controller_kind NOT NULL,
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
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  subject_category subject_category NOT NULL,
  subject_subcategory TEXT,
  created_by_game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE RESTRICT,
  created_turn_id UUID,
  is_root INTEGER NOT NULL DEFAULT 0 CHECK (is_root IN (0, 1)),
  selected_definition_id UUID,
  selected_judge_evaluation_id UUID,
  layout_x REAL,
  layout_y REAL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_invocations (
  id UUID PRIMARY KEY,
  purpose model_invocation_purpose NOT NULL,
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
  source_environment source_environment NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topic_definitions (
  id UUID PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  definition TEXT NOT NULL,
  model_invocation_id UUID REFERENCES model_invocations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_version TEXT,
  prompt_version TEXT NOT NULL,
  is_selected INTEGER NOT NULL DEFAULT 0 CHECK (is_selected IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 0),
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE RESTRICT,
  destination_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  response_text TEXT NOT NULL,
  combined_score INTEGER NOT NULL DEFAULT 0,
  selected_judge_evaluation_id UUID,
  model_invocation_id UUID REFERENCES model_invocations(id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  UNIQUE (game_id, round_number)
);

CREATE TABLE IF NOT EXISTS turn_sources (
  id UUID PRIMARY KEY,
  turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  source_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  source_order INTEGER NOT NULL CHECK (source_order >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (turn_id, source_order),
  UNIQUE (turn_id, source_topic_id)
);

CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  source_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  destination_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE RESTRICT,
  semantic_distance_score INTEGER CHECK (semantic_distance_score BETWEEN 1 AND 10),
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  novelty_score INTEGER CHECK (novelty_score BETWEEN 1 AND 10),
  raw_edge_score REAL,
  final_edge_score INTEGER,
  scoring_description TEXT,
  semantic_distance_description TEXT,
  relevance_description TEXT,
  selected_judge_evaluation_id UUID,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (turn_id, source_topic_id, destination_topic_id)
);

CREATE TABLE IF NOT EXISTS judge_evaluations (
  id UUID PRIMARY KEY,
  target_type judge_target_type NOT NULL,
  target_id UUID NOT NULL,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  model_invocation_id UUID REFERENCES model_invocations(id) ON DELETE SET NULL,
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
  source_environment source_environment NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_aesthetic_evaluations (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  judge_evaluation_id UUID NOT NULL REFERENCES judge_evaluations(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  rating_system rating_system NOT NULL,
  rating_pool rating_pool NOT NULL,
  rating_before REAL NOT NULL,
  rating_after REAL NOT NULL,
  rating_delta REAL NOT NULL,
  uncertainty_before REAL,
  uncertainty_after REAL,
  result_summary TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE games
  ADD CONSTRAINT fk_games_current_game_player
  FOREIGN KEY (current_game_player_id) REFERENCES game_players(id) ON DELETE SET NULL;
ALTER TABLE games
  ADD CONSTRAINT fk_games_root_topic
  FOREIGN KEY (root_topic_id) REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE games
  ADD CONSTRAINT fk_games_winner_game_player
  FOREIGN KEY (winner_game_player_id) REFERENCES game_players(id) ON DELETE SET NULL;
ALTER TABLE topics
  ADD CONSTRAINT fk_topics_created_turn
  FOREIGN KEY (created_turn_id) REFERENCES turns(id) ON DELETE SET NULL;
ALTER TABLE topics
  ADD CONSTRAINT fk_topics_selected_definition
  FOREIGN KEY (selected_definition_id) REFERENCES topic_definitions(id) ON DELETE SET NULL;
ALTER TABLE topics
  ADD CONSTRAINT fk_topics_selected_judge_evaluation
  FOREIGN KEY (selected_judge_evaluation_id) REFERENCES judge_evaluations(id) ON DELETE SET NULL;
ALTER TABLE turns
  ADD CONSTRAINT fk_turns_selected_judge_evaluation
  FOREIGN KEY (selected_judge_evaluation_id) REFERENCES judge_evaluations(id) ON DELETE SET NULL;
ALTER TABLE edges
  ADD CONSTRAINT fk_edges_selected_judge_evaluation
  FOREIGN KEY (selected_judge_evaluation_id) REFERENCES judge_evaluations(id) ON DELETE SET NULL;

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

CREATE OR REPLACE FUNCTION validate_games_current_game_player() RETURNS trigger AS $$
BEGIN
  IF NEW.current_game_player_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE id = NEW.current_game_player_id AND game_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'current_game_player_id must reference a game_player in the same game';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_games_current_game_player_insert ON games;
CREATE TRIGGER validate_games_current_game_player_insert
BEFORE INSERT OR UPDATE OF current_game_player_id ON games
FOR EACH ROW EXECUTE FUNCTION validate_games_current_game_player();

CREATE OR REPLACE FUNCTION validate_games_root_topic() RETURNS trigger AS $$
BEGIN
  IF NEW.root_topic_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM topics
    WHERE id = NEW.root_topic_id AND game_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'root_topic_id must reference a topic in the same game';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_games_root_topic_update ON games;
CREATE TRIGGER validate_games_root_topic_update
BEFORE UPDATE OF root_topic_id ON games
FOR EACH ROW EXECUTE FUNCTION validate_games_root_topic();

CREATE OR REPLACE FUNCTION validate_turn_sources_same_game() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM turns
    JOIN topics ON topics.id = NEW.source_topic_id
    WHERE turns.id = NEW.turn_id AND topics.game_id = turns.game_id
  ) THEN
    RAISE EXCEPTION 'turn source topic must belong to the same game as the turn';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_turn_sources_same_game_insert ON turn_sources;
CREATE TRIGGER validate_turn_sources_same_game_insert
BEFORE INSERT ON turn_sources
FOR EACH ROW EXECUTE FUNCTION validate_turn_sources_same_game();

CREATE OR REPLACE FUNCTION validate_edges_same_game() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
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
  ) THEN
    RAISE EXCEPTION 'edge endpoints and player must belong to the same game as the edge';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_edges_same_game_insert ON edges;
CREATE TRIGGER validate_edges_same_game_insert
BEFORE INSERT ON edges
FOR EACH ROW EXECUTE FUNCTION validate_edges_same_game();
