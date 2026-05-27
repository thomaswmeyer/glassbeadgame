import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  GameState,
  Player,
  TopicEdge,
  TopicNode,
  Turn,
  selectPlayerScoreTotals,
} from '../../domain/game';
import { SubjectCategoryId } from '../../domain/subjectCategories';
import { getSqliteDatabase } from '../db/sqlite';
import {
  edges,
  gamePlayers,
  games,
  players,
  topicDefinitions,
  topics,
  turnSources,
  turns,
} from '../db/schema';

type SourceEnvironment = 'local' | 'test' | 'render_prod' | 'render_preview' | 'imported' | 'external';

type SaveGameSnapshotParams = {
  gameId: string;
  state: GameState;
  sourceEnvironment?: SourceEnvironment;
  difficulty?: 'secondary' | 'undergrad' | 'grad' | 'unlimited';
};

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

function toPersistedPlayerKind(player: Player) {
  return player.kind === 'ai' ? 'ai' : 'human';
}

function toPersistedControllerKind(player: Player) {
  return player.kind === 'ai' ? 'local_ai' : 'local_human';
}

function getProvider(player: Player) {
  return player.kind === 'ai' ? 'google' : null;
}

function getModelId(player: Player) {
  return player.kind === 'ai' ? 'gemini' : null;
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

export function saveGameSnapshot({
  gameId,
  state,
  sourceEnvironment = 'local',
  difficulty = 'undergrad',
}: SaveGameSnapshotParams) {
  const db = getSqliteDatabase();
  const scoreTotals = selectPlayerScoreTotals(state);
  const winningPlayerId = getWinningPlayerId(state);

  db.transaction(() => {
    db.delete(games).where(eq(games.id, gameId)).run();

    Object.values(state.playersById).forEach(player => {
      db.insert(players)
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
        })
        .run();
    });

    db.insert(games)
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
      })
      .run();

    state.playerOrder.forEach((playerId, seatIndex) => {
      const player = state.playersById[playerId];
      if (!player) return;

      db.insert(gamePlayers)
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
        })
        .run();
    });

    Object.values(state.nodesById).forEach(node => {
      db.insert(topics)
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
        })
        .run();
    });

    Object.values(state.nodesById)
      .filter(node => Boolean(node.definition))
      .forEach(node => {
        const definitionId = persistedDefinitionId(gameId, node.id);
        db.insert(topicDefinitions)
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
          })
          .run();

        db.update(topics)
          .set({ selectedDefinitionId: definitionId })
          .where(eq(topics.id, persistedTopicId(gameId, node.id)))
          .run();
      });

    state.turnOrder.forEach(turnId => {
      const turn = state.turnsById[turnId];
      db.insert(turns)
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
        })
        .run();

      turn.sourceNodeIds.forEach((sourceNodeId, sourceOrder) => {
        db.insert(turnSources)
          .values({
            id: persistedTurnSourceId(gameId, turn.id, sourceNodeId),
            turnId: persistedTurnId(gameId, turn.id),
            sourceTopicId: persistedTopicId(gameId, sourceNodeId),
            sourceOrder,
          })
          .run();
      });
    });

    Object.values(state.edgesById).forEach(edge => {
      db.insert(edges)
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
        })
        .run();
    });

    Object.values(state.nodesById).forEach(node => {
      if (!node.createdTurnId) return;

      db.update(topics)
        .set({ createdTurnId: persistedTurnId(gameId, node.createdTurnId) })
        .where(eq(topics.id, persistedTopicId(gameId, node.id)))
        .run();
    });

    db.update(games)
      .set({
        currentGamePlayerId: state.currentPlayerId
          ? persistedGamePlayerId(gameId, state.currentPlayerId)
          : null,
        rootTopicId: state.rootNodeId ? persistedTopicId(gameId, state.rootNodeId) : null,
        winnerGamePlayerId: winningPlayerId ? persistedGamePlayerId(gameId, winningPlayerId) : null,
        completedAt: state.gameStatus === 'completed' ? new Date().toISOString() : null,
      })
      .where(eq(games.id, gameId))
      .run();
  });

  return { gameId };
}
