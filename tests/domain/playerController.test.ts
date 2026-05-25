import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_HUMAN_PLAYER_ID,
  addTurnToGameState,
  setGameStatus,
  startGameState,
  type Player,
} from '../../src/domain/game';
import {
  createDefaultPlayerController,
  createTurnExecutionKey,
  resolvePlayerController,
  resolveSubmittedSourceNodeIds,
  shouldAutoSubmitTurn,
  type PlayerTurnController,
} from '../../src/domain/playerController';

const localPlayer: Player = {
  id: 'player-local',
  name: 'Local',
  kind: 'local',
};

const aiPlayer: Player = {
  id: 'player-openclaw',
  name: 'OpenClaw',
  kind: 'ai',
  modelKey: 'openclaw',
};

function stateFor(player: Player) {
  return startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: player.id,
    rootCreatedByPlayerId: 'player-openclaw',
    players: [localPlayer, aiPlayer],
  });
}

test('default player controllers make local players manual and AI players automatic', () => {
  assert.deepEqual(createDefaultPlayerController(localPlayer), {
    playerId: 'player-local',
    mode: 'manual',
  });
  assert.deepEqual(createDefaultPlayerController(aiPlayer), {
    playerId: 'player-openclaw',
    mode: 'automatic',
  });
});

test('explicit player controllers override the default controller for that player', async () => {
  const controller: PlayerTurnController = {
    playerId: aiPlayer.id,
    mode: 'automatic',
    async submitTurn() {
      return {
        responseText: 'Sacred geometry',
        fallbackOnEvaluationFailure: true,
      };
    },
  };

  const resolved = resolvePlayerController(aiPlayer, [controller]);
  const state = stateFor(aiPlayer);
  assert.equal(resolved, controller);
  assert.deepEqual(await resolved.submitTurn?.({
    state,
    player: aiPlayer,
    topic: 'Cathedrals',
    availableNodes: Object.values(state.nodesById),
    selectedSourceNodeIds: [state.rootNodeId],
    difficulty: 'undergrad',
    gameHistory: [],
  }), {
    responseText: 'Sacred geometry',
    fallbackOnEvaluationFailure: true,
  });
});

test('automatic turn submission requires awaiting response, matching player, automatic mode, and a submitter', async () => {
  const state = stateFor(aiPlayer);
  const controller: PlayerTurnController = {
    playerId: aiPlayer.id,
    mode: 'automatic',
    async submitTurn() {
      return { responseText: 'Sacred geometry' };
    },
  };

  assert.equal(shouldAutoSubmitTurn(state, aiPlayer, controller), true);
  assert.equal(shouldAutoSubmitTurn(setGameStatus(state, 'aiThinking'), aiPlayer, controller), false);
  assert.equal(shouldAutoSubmitTurn(state, aiPlayer, { ...controller, playerId: DEFAULT_HUMAN_PLAYER_ID }), false);
  assert.equal(shouldAutoSubmitTurn(state, aiPlayer, { ...controller, mode: 'manual' }), false);
  assert.equal(shouldAutoSubmitTurn(state, aiPlayer, { playerId: aiPlayer.id, mode: 'automatic' }), false);
});

test('automatic player source selections are validated against the current graph', () => {
  const state = stateFor(aiPlayer);
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: localPlayer.id,
    sourceNodeIds: [state.rootNodeId],
  });
  const firstTurn = withTurn.turnsById[withTurn.turnOrder[0]];

  assert.deepEqual(resolveSubmittedSourceNodeIds(withTurn, {
    selectedSourceNodeIds: [firstTurn.destinationNodeId, state.rootNodeId, firstTurn.destinationNodeId, 'missing'],
  }), [firstTurn.destinationNodeId, state.rootNodeId]);
  assert.deepEqual(resolveSubmittedSourceNodeIds(withTurn, {
    selectedSourceNodeIds: ['missing'],
  }), withTurn.activeSourceNodeIds);
  assert.deepEqual(resolveSubmittedSourceNodeIds(withTurn, {}), withTurn.activeSourceNodeIds);
});

test('turn execution keys change when round, current player, or turn count changes', () => {
  const state = stateFor(localPlayer);
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: localPlayer.id,
    sourceNodeIds: [state.rootNodeId],
  });

  assert.equal(createTurnExecutionKey(state), '1:player-local:0');
  assert.equal(createTurnExecutionKey({ ...state, currentRound: 2 }), '2:player-local:0');
  assert.equal(createTurnExecutionKey({ ...state, currentPlayerId: 'player-openclaw' }), '1:player-openclaw:0');
  assert.equal(createTurnExecutionKey(withTurn), '1:player-local:1');
});
