import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const migrationPath = resolve('db/migrations/sqlite/0001_initial_schema.sql');

function runSql(databasePath: string, sql: string) {
  const result = spawnSync('sqlite3', [databasePath], {
    input: sql,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function runSqlExpectingFailure(databasePath: string, sql: string) {
  const result = spawnSync('sqlite3', [databasePath], {
    input: sql,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, 'Expected sqlite3 command to fail');
  return `${result.stderr}\n${result.stdout}`;
}

test('SQLite schema migration creates core tables and constraints', () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'gbg-schema-')), 'schema.sqlite');

  runSql(databasePath, readFileSync(migrationPath, 'utf8'));

  const tables = runSql(databasePath, `
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `).split('\n');

  assert.deepEqual(tables, [
    'edges',
    'experiment_batches',
    'game_aesthetic_evaluations',
    'game_players',
    'games',
    'judge_evaluations',
    'model_invocations',
    'players',
    'rating_events',
    'topic_definitions',
    'topics',
    'turn_sources',
    'turns',
  ]);

  runSql(databasePath, `
    PRAGMA foreign_keys = ON;

    INSERT INTO players (id, display_name, kind)
    VALUES ('player-1', 'Gemini Pro', 'ai');

    INSERT INTO games (
      id,
      status,
      mode,
      difficulty,
      max_rounds,
      rules_version,
      scoring_version,
      prompt_set_version,
      source_environment
    )
    VALUES (
      'game-1',
      'awaiting_response',
      'experiment',
      'unlimited',
      10,
      'rules-v1',
      'scoring-v1',
      'prompts-v1',
      'test'
    );

    INSERT INTO game_players (
      id,
      game_id,
      player_id,
      seat_index,
      display_name,
      controller_kind
    )
    VALUES ('seat-1', 'game-1', 'player-1', 0, 'AI 1', 'local_ai');

    UPDATE games SET current_game_player_id = 'seat-1' WHERE id = 'game-1';

    INSERT INTO topics (
      id,
      game_id,
      text,
      normalized_text,
      subject_category,
      created_by_game_player_id,
      is_root
    )
    VALUES (
      'topic-1',
      'game-1',
      'Apophenia',
      'apophenia',
      'psychology',
      'seat-1',
      1
    );

    UPDATE games SET root_topic_id = 'topic-1' WHERE id = 'game-1';
  `);

  const invalidDifficultyError = runSqlExpectingFailure(databasePath, `
    INSERT INTO games (
      id,
      status,
      mode,
      difficulty,
      max_rounds,
      rules_version,
      scoring_version,
      prompt_set_version,
      source_environment
    )
    VALUES (
      'game-invalid',
      'awaiting_response',
      'experiment',
      'middle_school',
      10,
      'rules-v1',
      'scoring-v1',
      'prompts-v1',
      'test'
    );
  `);
  assert.match(invalidDifficultyError, /CHECK constraint failed/);

  const invalidCurrentPlayerError = runSqlExpectingFailure(databasePath, `
    UPDATE games SET current_game_player_id = 'missing-seat' WHERE id = 'game-1';
  `);
  assert.match(invalidCurrentPlayerError, /current_game_player_id must reference/);
});
