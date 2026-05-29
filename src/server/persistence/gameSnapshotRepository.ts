/* eslint-disable @typescript-eslint/no-explicit-any -- Drizzle's SQLite and Postgres drivers do not share a practical typed execution interface; keep dialect casts inside this repository boundary. */
import { createHash } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import {
  GameStatus,
  GameState,
  Player,
  Score,
  TopicEdge,
  TopicNode,
  Turn,
  selectPlayerScoreTotals,
} from '../../domain/game';
import { SubjectCategoryId } from '../../domain/subjectCategories';
import { getGameDatabase } from '../db/database';
import { resolveModelProviderInfo } from '../../config/llm';

type SourceEnvironment = 'local' | 'test' | 'render_prod' | 'render_preview' | 'imported' | 'external';

type SaveGameSnapshotParams = {
  gameId: string;
  state: GameState;
  sourceEnvironment?: SourceEnvironment;
  difficulty?: 'secondary' | 'undergrad' | 'grad' | 'unlimited';
};

type LoadGameSnapshotResult = {
  gameId: string;
  difficulty: 'secondary' | 'undergrad' | 'grad' | 'unlimited';
  state: GameState;
};

type MaybePromise<T> = T | Promise<T>;
type AnyDatabase = any;

function isPromise<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof (value as Promise<T> | undefined)?.then === 'function';
}

function chain<T>(previous: MaybePromise<unknown>, next: () => MaybePromise<T>): MaybePromise<T> {
  return isPromise(previous) ? previous.then(next) : next();
}

function runMutation(query: any): MaybePromise<unknown> {
  return typeof query.run === 'function' ? query.run() : query;
}

async function allRows<T>(query: any): Promise<T[]> {
  return typeof query.all === 'function' ? query.all() : await query;
}

async function firstRow<T>(query: any): Promise<T | undefined> {
  if (typeof query.get === 'function') return query.get();

  const rows = await query.limit(1);
  return rows[0];
}

const DEFAULT_RULES_VERSION = 'prototype-v1';
const DEFAULT_SCORING_VERSION = 'multiplicative-v1';
const DEFAULT_PROMPT_SET_VERSION = 'prototype-v1';

function stableUuid(input: string) {
  const hex = createHash('sha1').update(input).digest('hex').slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asScore(value: unknown): Score | undefined {
  if (typeof value !== 'object' || value === null) return undefined;

  const record = value as Partial<Score>;
  return typeof record.semanticDistance === 'number' &&
    typeof record.relevanceQuality === 'number' &&
    typeof record.total === 'number'
    ? {
      semanticDistance: record.semanticDistance,
      relevanceQuality: record.relevanceQuality,
      total: record.total,
    }
    : undefined;
}

function asTurnEdgeEvaluations(value: unknown): Turn['edgeEvaluations'] {
  return Array.isArray(value) ? value as Turn['edgeEvaluations'] : undefined;
}

function normalizeTopicText(topic: string) {
  return topic.trim().toLocaleLowerCase();
}

function toPersistedGameStatus(status: GameState['gameStatus']) {
  switch (status) {
    case 'generatingTopic':
    case 'awaitingResponse':
      return 'awaiting_response';
    case 'aiThinking':
      return 'ai_thinking';
    case 'evaluating':
      return 'evaluating';
    case 'showingResults':
      return 'showing_results';
    case 'completed':
      return 'completed';
    case 'setup':
    default:
      return 'setup';
  }
}

function toGameStatus(status: string): GameStatus {
  switch (status) {
    case 'awaiting_response':
      return 'awaitingResponse';
    case 'ai_thinking':
      return 'aiThinking';
    case 'evaluating':
      return 'evaluating';
    case 'showing_results':
      return 'showingResults';
    case 'completed':
      return 'completed';
    case 'setup':
    default:
      return 'setup';
  }
}

function toPersistedPlayerKind(player: Player) {
  return player.kind === 'ai' ? 'ai' : 'human';
}

function toPersistedControllerKind(player: Player) {
  return player.kind === 'ai' ? 'local_ai' : 'local_human';
}

function getProvider(player: Player) {
  return player.kind === 'ai' ? resolveModelProviderInfo(player.modelKey).provider : null;
}

function getModelId(player: Player) {
  return player.kind === 'ai' ? resolveModelProviderInfo(player.modelKey).modelId : null;
}

function getSubjectCategory(node: TopicNode): SubjectCategoryId | 'other' {
  return node.subjectCategory || 'other';
}

function persistedPlayerId(playerId: string) {
  return stableUuid(`player:${playerId}`);
}

function persistedGamePlayerId(gameId: string, playerId: string) {
  return stableUuid(`${gameId}:game-player:${playerId}`);
}

function persistedTopicId(gameId: string, nodeId: string) {
  return stableUuid(`${gameId}:topic:${nodeId}`);
}

function persistedTurnId(gameId: string, turnId: string) {
  return stableUuid(`${gameId}:turn:${turnId}`);
}

function persistedEdgeId(gameId: string, edgeId: string) {
  return stableUuid(`${gameId}:edge:${edgeId}`);
}

function persistedDefinitionId(gameId: string, nodeId: string) {
  return stableUuid(`${gameId}:definition:${nodeId}`);
}

function persistedTurnSourceId(gameId: string, turnId: string, sourceNodeId: string) {
  return stableUuid(`${gameId}:turn-source:${turnId}:${sourceNodeId}`);
}

function getWinningPlayerId(state: GameState) {
  if (state.gameStatus !== 'completed') return null;

  const scoreTotals = selectPlayerScoreTotals(state);
  const orderedScores = state.playerOrder.map(playerId => ({
    playerId,
    score: scoreTotals[playerId] || 0,
  }));
  const highScore = Math.max(...orderedScores.map(row => row.score));
  const winners = orderedScores.filter(row => row.score === highScore);

  return winners.length === 1 ? winners[0].playerId : null;
}

function getTurnCreatedAtMetadata(turn: Turn) {
  return json({
    sourceNodeIds: turn.sourceNodeIds,
    edgeIds: turn.edgeIds,
    legacyScores: turn.legacyScores,
    edgeEvaluations: turn.edgeEvaluations,
    evaluation: turn.evaluation,
  });
}

function getEdgeMetadata(edge: TopicEdge) {
  return json({
    legacyStrengthScore: edge.strengthScore,
  });
}

export async function saveGameSnapshot({
  gameId,
  state,
  sourceEnvironment = 'local',
  difficulty = 'undergrad',
}: SaveGameSnapshotParams) {
  const connection = getGameDatabase();
  const db: AnyDatabase = connection.db;
  const schema: any = connection.schema;
  const {
    edges,
    gamePlayers,
    games,
    players,
    topicDefinitions,
    topics,
    turnSources,
    turns,
  } = schema;
  const scoreTotals = selectPlayerScoreTotals(state);
  const winningPlayerId = getWinningPlayerId(state);

  const writeSnapshot = (tx: AnyDatabase) => {
    let pending: MaybePromise<unknown> = undefined;
    const enqueue = (query: any) => {
      pending = chain(pending, () => runMutation(query));
    };

    enqueue(tx.delete(games).where(eq(games.id, gameId)));

    Object.values(state.playersById).forEach(player => {
      enqueue(tx.insert(players)
        .values({
          id: persistedPlayerId(player.id),
          displayName: player.name,
          kind: toPersistedPlayerKind(player),
          provider: getProvider(player),
          modelId: getModelId(player),
          metadata: json({
            inMemoryPlayerId: player.id,
            modelKey: player.modelKey,
          }),
        })
        .onConflictDoUpdate({
          target: players.id,
          set: {
            displayName: player.name,
            kind: toPersistedPlayerKind(player),
            provider: getProvider(player),
            modelId: getModelId(player),
            metadata: json({
              inMemoryPlayerId: player.id,
              modelKey: player.modelKey,
            }),
          },
        }));
    });

    enqueue(tx.insert(games)
      .values({
        id: gameId,
        status: toPersistedGameStatus(state.gameStatus),
        mode: 'casual',
        difficulty,
        maxRounds: state.maxRounds,
        currentRound: state.currentRound,
        rulesVersion: DEFAULT_RULES_VERSION,
        scoringVersion: DEFAULT_SCORING_VERSION,
        promptSetVersion: DEFAULT_PROMPT_SET_VERSION,
        sourceEnvironment,
        metadata: json({
          activeSourceNodeIds: state.activeSourceNodeIds,
          selectedNodeIds: state.selectedNodeIds,
          inMemoryCurrentPlayerId: state.currentPlayerId,
        }),
      }));

    state.playerOrder.forEach((playerId, seatIndex) => {
      const player = state.playersById[playerId];
      if (!player) return;

      enqueue(tx.insert(gamePlayers)
        .values({
          id: persistedGamePlayerId(gameId, player.id),
          gameId,
          playerId: persistedPlayerId(player.id),
          seatIndex,
          displayName: player.name,
          controllerKind: toPersistedControllerKind(player),
          provider: getProvider(player),
          modelId: getModelId(player),
          promptConfigVersion: player.modelKey || null,
          finalScore: scoreTotals[player.id] || 0,
          ratingParticipantKey: player.kind === 'ai'
            ? `${getProvider(player) || 'unknown'}:${getModelId(player) || player.id}:${player.modelKey || 'default'}`
            : `human:${player.id}`,
          metadata: json({ inMemoryPlayerId: player.id }),
        }));
    });

    Object.values(state.nodesById).forEach(node => {
      enqueue(tx.insert(topics)
        .values({
          id: persistedTopicId(gameId, node.id),
          gameId,
          text: node.topic,
          normalizedText: normalizeTopicText(node.topic),
          subjectCategory: getSubjectCategory(node),
          createdByGamePlayerId: persistedGamePlayerId(gameId, node.createdByPlayerId || state.playerOrder[0] || ''),
          isRoot: node.isRoot ? 1 : 0,
          metadata: json({
            inMemoryNodeId: node.id,
            definitionVisible: node.definitionVisible,
          }),
        }));
    });

    Object.values(state.nodesById)
      .filter(node => Boolean(node.definition))
      .forEach(node => {
        const definitionId = persistedDefinitionId(gameId, node.id);
        enqueue(tx.insert(topicDefinitions)
          .values({
            id: definitionId,
            topicId: persistedTopicId(gameId, node.id),
            definition: node.definition || '',
            provider: 'unknown',
            modelId: 'unknown',
            promptVersion: 'unknown',
            isSelected: 1,
            metadata: json({
              definitionVisible: node.definitionVisible,
            }),
          }));

        enqueue(tx.update(topics)
          .set({ selectedDefinitionId: definitionId })
          .where(eq(topics.id, persistedTopicId(gameId, node.id))));
      });

    state.turnOrder.forEach(turnId => {
      const turn = state.turnsById[turnId];
      enqueue(tx.insert(turns)
        .values({
          id: persistedTurnId(gameId, turn.id),
          gameId,
          roundNumber: turn.round,
          gamePlayerId: persistedGamePlayerId(gameId, turn.playerId),
          destinationTopicId: persistedTopicId(gameId, turn.destinationNodeId),
          responseText: state.nodesById[turn.destinationNodeId]?.topic || '',
          combinedScore: turn.totalScore || 0,
          appliedAt: new Date().toISOString(),
          metadata: getTurnCreatedAtMetadata(turn),
        }));

      turn.sourceNodeIds.forEach((sourceNodeId, sourceOrder) => {
        enqueue(tx.insert(turnSources)
          .values({
            id: persistedTurnSourceId(gameId, turn.id, sourceNodeId),
            turnId: persistedTurnId(gameId, turn.id),
            sourceTopicId: persistedTopicId(gameId, sourceNodeId),
            sourceOrder,
          }));
      });
    });

    Object.values(state.edgesById).forEach(edge => {
      enqueue(tx.insert(edges)
        .values({
          id: persistedEdgeId(gameId, edge.id),
          gameId,
          turnId: persistedTurnId(gameId, edge.turnId),
          sourceTopicId: persistedTopicId(gameId, edge.sourceNodeId),
          destinationTopicId: persistedTopicId(gameId, edge.destinationNodeId),
          gamePlayerId: persistedGamePlayerId(gameId, edge.playerId),
          semanticDistanceScore: edge.semanticDistanceScore || null,
          relevanceScore: edge.strengthScore || null,
          rawEdgeScore: edge.totalScore || null,
          finalEdgeScore: edge.totalScore || null,
          scoringDescription: edge.scoringDescription || null,
          semanticDistanceDescription: edge.semanticDistanceDescription || null,
          relevanceDescription: edge.strengthDescription || null,
          metadata: getEdgeMetadata(edge),
        }));
    });

    Object.values(state.nodesById).forEach(node => {
      if (!node.createdTurnId) return;

      enqueue(tx.update(topics)
        .set({ createdTurnId: persistedTurnId(gameId, node.createdTurnId) })
        .where(eq(topics.id, persistedTopicId(gameId, node.id))));
    });

    enqueue(tx.update(games)
      .set({
        currentGamePlayerId: state.currentPlayerId
          ? persistedGamePlayerId(gameId, state.currentPlayerId)
          : null,
        rootTopicId: state.rootNodeId ? persistedTopicId(gameId, state.rootNodeId) : null,
        winnerGamePlayerId: winningPlayerId ? persistedGamePlayerId(gameId, winningPlayerId) : null,
        completedAt: state.gameStatus === 'completed' ? new Date().toISOString() : null,
      })
      .where(eq(games.id, gameId)));

    return pending;
  };

  await db.transaction((tx: AnyDatabase) => writeSnapshot(tx));

  return { gameId };
}

export async function loadGameSnapshot(gameId: string): Promise<LoadGameSnapshotResult | null> {
  const connection = getGameDatabase();
  const db: AnyDatabase = connection.db;
  const schema: any = connection.schema;
  const {
    edges,
    gamePlayers,
    games,
    players,
    topicDefinitions,
    topics,
    turnSources,
    turns,
  } = schema;
  const game = await firstRow<any>(
    db.select().from(games).where(eq(games.id, gameId))
  );
  if (!game) return null;

  const gameMetadata = parseJsonObject(game.metadata);
  const gamePlayerRows = await allRows<any>(db.select()
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId))
    .orderBy(asc(gamePlayers.seatIndex)));
  const playerRows = await allRows<any>(db.select().from(players));
  const playerRowsById = new Map(playerRows.map(player => [player.id, player]));
  const inMemoryPlayerIdByGamePlayerId = new Map<string, string>();

  const playerEntries = gamePlayerRows.map(gamePlayer => {
    const player = playerRowsById.get(gamePlayer.playerId);
    const playerMetadata = parseJsonObject(player?.metadata);
    const gamePlayerMetadata = parseJsonObject(gamePlayer.metadata);
    const inMemoryPlayerId = typeof gamePlayerMetadata.inMemoryPlayerId === 'string'
      ? gamePlayerMetadata.inMemoryPlayerId
      : gamePlayer.id;
    inMemoryPlayerIdByGamePlayerId.set(gamePlayer.id, inMemoryPlayerId);

    return {
      id: inMemoryPlayerId,
      name: gamePlayer.displayName,
      kind: player?.kind === 'human' ? 'local' : 'ai',
      modelKey: gamePlayer.promptConfigVersion ||
        (typeof playerMetadata.modelKey === 'string' ? playerMetadata.modelKey : undefined),
    } satisfies Player;
  });
  const playersById = Object.fromEntries(playerEntries.map(player => [player.id, player]));
  const playerOrder = playerEntries.map(player => player.id);

  const topicRows = await allRows<any>(db.select()
    .from(topics)
    .where(eq(topics.gameId, gameId)));
  const definitionRows = await allRows<any>(db.select().from(topicDefinitions));
  const definitionsById = new Map(definitionRows.map(definition => [definition.id, definition]));
  const inMemoryNodeIdByTopicId = new Map<string, string>();

  topicRows.forEach(topic => {
    const topicMetadata = parseJsonObject(topic.metadata);
    const inMemoryNodeId = typeof topicMetadata.inMemoryNodeId === 'string'
      ? topicMetadata.inMemoryNodeId
      : topic.id;
    inMemoryNodeIdByTopicId.set(topic.id, inMemoryNodeId);
  });

  const turnRows = await allRows<any>(db.select()
    .from(turns)
    .where(eq(turns.gameId, gameId))
    .orderBy(asc(turns.roundNumber)));
  const persistedTurnIdToInMemoryTurnId = new Map<string, string>();
  turnRows.forEach((turn, index) => {
    persistedTurnIdToInMemoryTurnId.set(turn.id, `turn-${index}`);
  });

  const nodesById = Object.fromEntries(topicRows.map(topic => {
    const topicMetadata = parseJsonObject(topic.metadata);
    const nodeId = inMemoryNodeIdByTopicId.get(topic.id) || topic.id;
    const definition = topic.selectedDefinitionId
      ? definitionsById.get(topic.selectedDefinitionId)?.definition
      : undefined;
    const createdByPlayerId = inMemoryPlayerIdByGamePlayerId.get(topic.createdByGamePlayerId);
    const createdTurnId = topic.createdTurnId
      ? persistedTurnIdToInMemoryTurnId.get(topic.createdTurnId)
      : undefined;

    const node: TopicNode = {
      id: nodeId,
      topic: topic.text,
      definition,
      definitionVisible: topicMetadata.definitionVisible === true,
      createdByPlayerId,
      createdTurnId,
      subjectCategory: topic.subjectCategory === 'other' ? undefined : topic.subjectCategory,
      isRoot: topic.isRoot === 1,
    };

    return [node.id, node];
  }));

  const turnSourceRows = await allRows<any>(db.select().from(turnSources));
  const turnSourcesByTurnId = new Map<string, string[]>();
  turnSourceRows
    .filter(turnSource => persistedTurnIdToInMemoryTurnId.has(turnSource.turnId))
    .sort((left, right) => left.sourceOrder - right.sourceOrder)
    .forEach(turnSource => {
      const sourceNodeId = inMemoryNodeIdByTopicId.get(turnSource.sourceTopicId);
      if (!sourceNodeId) return;

      const existing = turnSourcesByTurnId.get(turnSource.turnId) || [];
      existing.push(sourceNodeId);
      turnSourcesByTurnId.set(turnSource.turnId, existing);
    });

  const turnsById = Object.fromEntries(turnRows.map((turn, index) => {
    const turnId = persistedTurnIdToInMemoryTurnId.get(turn.id) || `turn-${index}`;
    const metadata = parseJsonObject(turn.metadata);
    const sourceNodeIds = stringArray(metadata.sourceNodeIds);
    const edgeIds = stringArray(metadata.edgeIds);
    const fallbackSourceNodeIds = turnSourcesByTurnId.get(turn.id) || [];
    const turnModel: Turn = {
      id: turnId,
      round: turn.roundNumber,
      playerId: inMemoryPlayerIdByGamePlayerId.get(turn.gamePlayerId) || turn.gamePlayerId,
      sourceNodeIds: sourceNodeIds.length > 0 ? sourceNodeIds : fallbackSourceNodeIds,
      edgeIds,
      destinationNodeId: inMemoryNodeIdByTopicId.get(turn.destinationTopicId) || turn.destinationTopicId,
      evaluation: typeof metadata.evaluation === 'string' ? metadata.evaluation : undefined,
      totalScore: turn.combinedScore,
      legacyScores: asScore(metadata.legacyScores),
      edgeEvaluations: asTurnEdgeEvaluations(metadata.edgeEvaluations),
    };

    return [turnModel.id, turnModel];
  }));
  const turnOrder = turnRows.map((turn, index) => persistedTurnIdToInMemoryTurnId.get(turn.id) || `turn-${index}`);

  const edgeRows = await allRows<any>(db.select()
    .from(edges)
    .where(eq(edges.gameId, gameId)));
  const edgesById = Object.fromEntries(edgeRows.map(edge => {
    const turnId = persistedTurnIdToInMemoryTurnId.get(edge.turnId) || edge.turnId;
    const turn = turnsById[turnId];
    const sourceNodeId = inMemoryNodeIdByTopicId.get(edge.sourceTopicId) || edge.sourceTopicId;
    const sourceIndex = turn?.sourceNodeIds.indexOf(sourceNodeId) ?? -1;
    const edgeId = sourceIndex >= 0
      ? turn?.edgeIds[sourceIndex] || `edge-${turnOrder.indexOf(turnId)}-${sourceIndex}`
      : edge.id;
    const metadata = parseJsonObject(edge.metadata);
    const edgeModel: TopicEdge = {
      id: edgeId,
      sourceNodeId,
      destinationNodeId: inMemoryNodeIdByTopicId.get(edge.destinationTopicId) || edge.destinationTopicId,
      playerId: inMemoryPlayerIdByGamePlayerId.get(edge.gamePlayerId) || edge.gamePlayerId,
      turnId,
      strengthScore: edge.relevanceScore ?? undefined,
      semanticDistanceScore: edge.semanticDistanceScore ?? undefined,
      totalScore: edge.finalEdgeScore ?? undefined,
      scoringDescription: edge.scoringDescription ?? undefined,
      semanticDistanceDescription: edge.semanticDistanceDescription ?? undefined,
      strengthDescription: edge.relevanceDescription ?? undefined,
    };

    if (edgeModel.strengthScore === undefined && typeof metadata.legacyStrengthScore === 'number') {
      edgeModel.strengthScore = metadata.legacyStrengthScore;
    }

    return [edgeModel.id, edgeModel];
  }));

  const rootNodeId = game.rootTopicId
    ? inMemoryNodeIdByTopicId.get(game.rootTopicId) || ''
    : '';
  const currentPlayerId = typeof gameMetadata.inMemoryCurrentPlayerId === 'string'
    ? gameMetadata.inMemoryCurrentPlayerId
    : game.currentGamePlayerId
      ? inMemoryPlayerIdByGamePlayerId.get(game.currentGamePlayerId) || playerOrder[0] || ''
      : playerOrder[0] || '';
  const activeSourceNodeIds = stringArray(gameMetadata.activeSourceNodeIds)
    .filter(nodeId => Boolean(nodesById[nodeId]));
  const selectedNodeIds = stringArray(gameMetadata.selectedNodeIds)
    .filter(nodeId => Boolean(nodesById[nodeId]));

  return {
    gameId,
    difficulty: game.difficulty,
    state: {
      playersById,
      playerOrder,
      nodesById,
      edgesById,
      turnsById,
      turnOrder,
      rootNodeId,
      activeSourceNodeIds,
      selectedNodeIds,
      currentPlayerId,
      currentRound: game.currentRound,
      maxRounds: game.maxRounds,
      gameStatus: toGameStatus(game.status),
    },
  };
}
