PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS validate_games_root_topic;
DROP TRIGGER IF EXISTS validate_turn_sources_same_game;
DROP TRIGGER IF EXISTS validate_edges_same_game;

CREATE TABLE IF NOT EXISTS topics_new (
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO topics_new (
  id,
  game_id,
  text,
  normalized_text,
  subject_category,
  subject_subcategory,
  created_by_game_player_id,
  created_turn_id,
  is_root,
  selected_definition_id,
  selected_judge_evaluation_id,
  layout_x,
  layout_y,
  metadata,
  created_at
)
SELECT
  id,
  game_id,
  text,
  normalized_text,
  subject_category,
  subject_subcategory,
  created_by_game_player_id,
  created_turn_id,
  is_root,
  selected_definition_id,
  selected_judge_evaluation_id,
  layout_x,
  layout_y,
  metadata,
  created_at
FROM topics;

DROP TABLE topics;
ALTER TABLE topics_new RENAME TO topics;

CREATE INDEX IF NOT EXISTS idx_topics_game_id ON topics(game_id);
CREATE INDEX IF NOT EXISTS idx_topics_normalized_text ON topics(normalized_text);

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

PRAGMA foreign_keys = ON;
