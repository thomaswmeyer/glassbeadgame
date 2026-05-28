import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import test from 'node:test';
import {
  addOpeningTopicTurnToGameState,
  addTurnToGameState,
  createEmptyGameState,
  setGameStatus,
  startGameState,
  type GameState,
  type Player,
} from '../../src/domain/game';

type CountRow = { count: number };
type SavedGameRow = {
  status: string;
  current_round: number;
  current_game_player_id: string | null;
  root_topic_id: string | null;
};
type EdgeRow = {
  semantic_distance_score: number;
  relevance_score: number;
  final_edge_score: number;
};

const players: Player[] = [
  { id: 'player-a', name: 'AI 1', kind: 'ai', modelKey: 'gemini-pro' },
  { id: 'player-b', name: 'AI 2', kind: 'ai', modelKey: 'claude-sonnet' },
];

function createPersistableState(): GameState {
  const empty = createEmptyGameState(4, 'player-a', players);
  const withOpening = addOpeningTopicTurnToGameState(empty, {
    topic: 'Apophenia',
    playerId: 'player-a',
    subjectCategory: 'psychology',
  });

  return setGameStatus(addTurnToGameState({
    ...withOpening,
    currentPlayerId: 'player-b',
  }, {
    destinationTopic: 'Augury',
    playerId: 'player-b',
    sourceNodeIds: [withOpening.rootNodeId],
    evaluation: 'A symbolic practice for pattern-finding in signs.',
    totalScore: 70,
    legacyScores: {
      semanticDistance: 7,
      relevanceQuality: 10,
      total: 70,
    },
    edgeEvaluations: [{
      sourceNodeId: withOpening.rootNodeId,
      evaluation: 'A symbolic practice for pattern-finding in signs.',
      scores: {
        semanticDistance: 7,
        relevanceQuality: 10,
        total: 70,
      },
    }],
    destinationSubjectCategory: 'religion',
  }), 'showingResults');
}

function tableCount(db: Database.Database, tableName: string) {
  return (db.prepare(`SELECT count(*) AS count FROM ${tableName}`).get() as CountRow).count;
}

test('Drizzle SQLite repository saves a game snapshot into normalized tables', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'gbg-drizzle-')), 'game.sqlite');
  process.env.DATABASE_URL = `file:${databasePath}`;

  const {
    loadGameSnapshot,
    saveGameSnapshot,
  } = await import('../../src/server/persistence/gameSnapshotRepository');
  const {
    closeSqliteDatabaseForTests,
  } = await import('../../src/server/db/sqlite');

  try {
    const gameId = '11111111-1111-4111-8111-111111111111';
    const state = createPersistableState();

    saveGameSnapshot({
      gameId,
      state,
      sourceEnvironment: 'test',
    });
    saveGameSnapshot({
      gameId,
      state,
      sourceEnvironment: 'test',
    });
    const loaded = loadGameSnapshot(gameId);
    assert.ok(loaded);
    assert.equal(loaded.gameId, gameId);
    assert.equal(loaded.difficulty, 'undergrad');
    assert.deepEqual(loaded.state.playerOrder, state.playerOrder);
    assert.deepEqual(loaded.state.turnOrder, state.turnOrder);
    assert.equal(loaded.state.currentPlayerId, state.currentPlayerId);
    assert.equal(loaded.state.nodesById[state.rootNodeId].topic, 'Apophenia');
    assert.equal(
      loaded.state.edgesById[state.turnsById[state.turnOrder[1]].edgeIds[0]].totalScore,
      70
    );
    closeSqliteDatabaseForTests();

    const db = new Database(databasePath, { readonly: true });
    try {
      assert.equal(tableCount(db, 'games'), 1);
      assert.equal(tableCount(db, 'players'), 2);
      assert.equal(tableCount(db, 'game_players'), 2);
      assert.equal(tableCount(db, 'topics'), 2);
      assert.equal(tableCount(db, 'turns'), 2);
      assert.equal(tableCount(db, 'turn_sources'), 1);
      assert.equal(tableCount(db, 'edges'), 1);

      const savedGame = db
        .prepare('SELECT status, current_round, current_game_player_id, root_topic_id FROM games WHERE id = ?')
        .get(gameId) as SavedGameRow;
      assert.equal(savedGame.status, 'showing_results');
      assert.equal(savedGame.current_round, 1);
      assert.equal(typeof savedGame.current_game_player_id, 'string');
      assert.equal(typeof savedGame.root_topic_id, 'string');

      const edge = db
        .prepare('SELECT semantic_distance_score, relevance_score, final_edge_score FROM edges')
        .get() as EdgeRow;
      assert.deepEqual(edge, {
        semantic_distance_score: 7,
        relevance_score: 10,
        final_edge_score: 70,
      });
    } finally {
      db.close();
    }
  } finally {
    closeSqliteDatabaseForTests();
  }
});

test('server turn command rejects incomplete scored turns before persistence', async () => {
  const {
    commitCompletedTurn,
  } = await import('../../src/server/game/turnCommitService');
  const state = createPersistableState();
  const latestTurnId = state.turnOrder[state.turnOrder.length - 1];
  const invalidState: GameState = {
    ...state,
    turnsById: {
      ...state.turnsById,
      [latestTurnId]: {
        ...state.turnsById[latestTurnId],
        totalScore: undefined,
        legacyScores: undefined,
      },
    },
  };

  assert.throws(() => commitCompletedTurn({
    gameId: '22222222-2222-4222-8222-222222222222',
    state: invalidState,
    turnId: latestTurnId,
    difficulty: 'undergrad',
    sourceEnvironment: 'test',
  }), /must include applied scores/);
});

test('server turn command rejects edges that do not match turn sources', async () => {
  const {
    commitCompletedTurn,
  } = await import('../../src/server/game/turnCommitService');
  const state = createPersistableState();
  const latestTurnId = state.turnOrder[state.turnOrder.length - 1];
  const latestTurn = state.turnsById[latestTurnId];
  const edgeId = latestTurn.edgeIds[0];
  const invalidState: GameState = {
    ...state,
    edgesById: {
      ...state.edgesById,
      [edgeId]: {
        ...state.edgesById[edgeId],
        sourceNodeId: latestTurn.destinationNodeId,
      },
    },
  };

  assert.throws(() => commitCompletedTurn({
    gameId: '33333333-3333-4333-8333-333333333333',
    state: invalidState,
    turnId: latestTurnId,
    difficulty: 'undergrad',
    sourceEnvironment: 'test',
  }), /edge source mismatch/);
});

test('server submit turn command evaluates, applies, and persists a scored turn', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'gbg-submit-turn-')), 'game.sqlite');
  process.env.DATABASE_URL = `file:${databasePath}`;

  const {
    submitTurn,
  } = await import('../../src/server/game/submitTurnService');
  const {
    closeSqliteDatabaseForTests,
  } = await import('../../src/server/db/sqlite');

  try {
    const gameId = '44444444-4444-4444-8444-444444444444';
    const state = startGameState({
      rootTopic: 'Cathedrals',
      maxRounds: 4,
      currentPlayerId: 'player-a',
      rootCreatedByPlayerId: 'player-b',
      players,
    });
    const result = await submitTurn({
      gameId,
      state,
      playerId: 'player-a',
      responseText: 'Flying buttresses',
      difficulty: 'undergrad',
      sourceEnvironment: 'test',
      services: {
        async evaluateTurn(request) {
          assert.deepEqual(request, {
            topic: 'Cathedrals',
            response: 'Flying buttresses',
            difficulty: 'undergrad',
          });

          return {
            evaluation: 'Strong architectural connection.',
            destinationSubjectCategory: 'arts',
            scores: {
              semanticDistance: 7,
              relevanceQuality: 8,
              total: 56,
            },
          };
        },
      },
    });

    assert.equal(result.state.gameStatus, 'showingResults');
    assert.equal(result.committedTurnId, 'turn-0');
    assert.equal(result.inlineEvaluation, null);
    assert.equal(result.state.turnOrder.length, 1);

    const turn = result.state.turnsById[result.committedTurnId];
    const destination = result.state.nodesById[turn.destinationNodeId];
    assert.equal(destination.topic, 'Flying buttresses');
    assert.equal(turn.totalScore, 56);

    closeSqliteDatabaseForTests();

    const db = new Database(databasePath, { readonly: true });
    try {
      assert.equal(tableCount(db, 'games'), 1);
      assert.equal(tableCount(db, 'topics'), 2);
      assert.equal(tableCount(db, 'turns'), 1);
      assert.equal(tableCount(db, 'edges'), 1);
    } finally {
      db.close();
    }
  } finally {
    closeSqliteDatabaseForTests();
  }
});

test('server submit turn command honors selected source ids over persisted active source fallback', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'gbg-submit-multi-source-')), 'game.sqlite');
  process.env.DATABASE_URL = `file:${databasePath}`;

  const {
    loadGameSnapshot,
    saveGameSnapshot,
  } = await import('../../src/server/persistence/gameSnapshotRepository');
  const {
    submitTurn,
  } = await import('../../src/server/game/submitTurnService');
  const {
    closeSqliteDatabaseForTests,
  } = await import('../../src/server/db/sqlite');

  try {
    const gameId = '55555555-5555-4555-8555-555555555555';
    const staleActiveSourceState: GameState = setGameStatus({
      ...createPersistableState(),
      currentRound: 2,
      currentPlayerId: 'player-a',
    }, 'awaitingResponse');
    saveGameSnapshot({
      gameId,
      state: staleActiveSourceState,
      sourceEnvironment: 'test',
    });

    const loaded = loadGameSnapshot(gameId);
    assert.ok(loaded);

    const rootNodeId = loaded.state.rootNodeId;
    const previousTurn = loaded.state.turnsById[loaded.state.turnOrder[loaded.state.turnOrder.length - 1]];
    const previousDestinationNodeId = previousTurn.destinationNodeId;
    assert.deepEqual(loaded.state.activeSourceNodeIds, [previousDestinationNodeId]);

    const evaluateCalls: unknown[] = [];
    const result = await submitTurn({
      gameId,
      state: loaded.state,
      playerId: 'player-a',
      responseText: 'Hermeneutics',
      difficulty: loaded.difficulty,
      selectedSourceNodeIds: [rootNodeId, previousDestinationNodeId],
      sourceEnvironment: 'test',
      services: {
        async evaluateTurn(request) {
          evaluateCalls.push(request);
          return {
            evaluation: `Connection from ${request.topic}.`,
            destinationSubjectCategory: 'philosophy',
            scores: {
              semanticDistance: 6,
              relevanceQuality: 7,
              total: 42,
            },
          };
        },
      },
    });

    const turn = result.state.turnsById[result.committedTurnId];
    assert.deepEqual(turn.sourceNodeIds, [rootNodeId, previousDestinationNodeId]);
    assert.equal(turn.edgeIds.length, 2);
    assert.deepEqual(
      turn.edgeIds.map(edgeId => result.state.edgesById[edgeId].sourceNodeId),
      [rootNodeId, previousDestinationNodeId]
    );
    assert.deepEqual(evaluateCalls, [
      {
        topic: 'Apophenia',
        response: 'Hermeneutics',
        difficulty: 'undergrad',
      },
      {
        topic: 'Augury',
        response: 'Hermeneutics',
        difficulty: 'undergrad',
      },
    ]);
  } finally {
    closeSqliteDatabaseForTests();
  }
});

test('server advance turn command persists the next current player before automatic submissions', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'gbg-advance-turn-')), 'game.sqlite');
  process.env.DATABASE_URL = `file:${databasePath}`;

  const {
    advancePersistedTurn,
  } = await import('../../src/server/game/advanceTurnService');
  const {
    loadGameSnapshot,
    saveGameSnapshot,
  } = await import('../../src/server/persistence/gameSnapshotRepository');
  const {
    closeSqliteDatabaseForTests,
  } = await import('../../src/server/db/sqlite');

  try {
    const gameId = '66666666-6666-4666-8666-666666666666';
    const showingResultsState = createPersistableState();
    saveGameSnapshot({
      gameId,
      state: showingResultsState,
      sourceEnvironment: 'test',
    });

    const result = advancePersistedTurn({
      gameId,
      sourceEnvironment: 'test',
    });

    assert.equal(result.state.gameStatus, 'awaitingResponse');
    assert.equal(result.state.currentPlayerId, 'player-a');
    assert.equal(result.state.currentRound, 2);

    const loaded = loadGameSnapshot(gameId);
    assert.ok(loaded);
    assert.equal(loaded.state.gameStatus, 'awaitingResponse');
    assert.equal(loaded.state.currentPlayerId, 'player-a');
    assert.equal(loaded.state.currentRound, 2);
  } finally {
    closeSqliteDatabaseForTests();
  }
});
