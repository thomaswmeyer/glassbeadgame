import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  addActiveSourceNode,
  advanceGameTurn,
  getNextPlayerId,
  removeActiveSourceNode,
  startGameState,
} from '../../src/domain/game';
import {
  evaluateAndApplyTurn,
  generateAiResponseForCurrentTurn,
  selectCurrentSourceTopicText,
  selectRootTopic,
  startGeneratedGame,
  type GameFlowServices,
} from '../../src/domain/gameFlow';

const defaultScore = {
  semanticDistance: 7,
  relevanceQuality: 8,
  total: 15,
};

test('starts a generated game with an AI-created root topic', async () => {
  const calls: unknown[] = [];
  const services = {
    async generateTopic(request) {
      calls.push(request);
      return 'Cathedrals';
    },
  } satisfies Pick<GameFlowServices, 'generateTopic'>;

  const state = await startGeneratedGame({
    maxRounds: 6,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
    difficulty: 'undergrad',
    services,
  });

  assert.deepEqual(calls, [{ difficulty: 'undergrad' }]);
  assert.equal(state.gameStatus, 'awaitingResponse');
  assert.equal(state.currentPlayerId, DEFAULT_HUMAN_PLAYER_ID);
  assert.equal(selectRootTopic(state), 'Cathedrals');
  assert.deepEqual(state.activeSourceNodeIds, [state.rootNodeId]);
  assert.deepEqual(state.selectedNodeIds, [state.rootNodeId]);
  assert.equal(state.nodesById[state.rootNodeId].createdByPlayerId, DEFAULT_AI_PLAYER_ID);
});

test('applies a turn by evaluating the active source topic with mocked LLM services', async () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 4,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const evaluateCalls: unknown[] = [];
  const services = {
    async evaluateTurn(request) {
      evaluateCalls.push(request);
      return {
        evaluation: 'Strong architectural connection.',
        scores: defaultScore,
      };
    },
  } satisfies Pick<GameFlowServices, 'evaluateTurn'>;

  const result = await evaluateAndApplyTurn({
    state,
    response: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    originalTopic: 'Cathedrals',
    difficulty: 'undergrad',
    circleEnabled: false,
    services,
  });

  assert.deepEqual(evaluateCalls, [{
    topic: 'Cathedrals',
    originalTopic: 'Cathedrals',
    response: 'Flying buttresses',
    difficulty: 'undergrad',
    isFinalCircleRound: false,
  }]);
  assert.equal(result.state.gameStatus, 'showingResults');
  assert.equal(result.state.turnOrder.length, 1);
  assert.equal(result.currentEvaluation.topic, 'Cathedrals');
  assert.equal(result.currentEvaluation.response, 'Flying buttresses');
  assert.equal(result.currentEvaluation.scores.total, 15);

  const turn = result.state.turnsById[result.state.turnOrder[0]];
  const destination = result.state.nodesById[turn.destinationNodeId];
  const edge = result.state.edgesById[turn.edgeIds[0]];
  assert.equal(destination.topic, 'Flying buttresses');
  assert.equal(edge.sourceNodeId, state.rootNodeId);
  assert.equal(edge.destinationNodeId, destination.id);
  assert.equal(edge.semanticDistanceScore, 7);
  assert.equal(edge.strengthScore, 8);
  assert.equal(edge.scoringDescription, 'Strong architectural connection.');
});

test('branches from an older selected node instead of forcing a linear chain', async () => {
  const rootState = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const services = {
    async evaluateTurn() {
      return {
        evaluation: 'ok',
        scores: defaultScore,
      };
    },
  } satisfies Pick<GameFlowServices, 'evaluateTurn'>;

  const first = await evaluateAndApplyTurn({
    state: rootState,
    response: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    originalTopic: 'Cathedrals',
    difficulty: 'undergrad',
    circleEnabled: false,
    services,
  });
  const nextState = advanceGameTurn(first.state, getNextPlayerId(first.state));
  const branchedSourceState = {
    ...nextState,
    activeSourceNodeIds: [nextState.rootNodeId],
  };
  const branch = await evaluateAndApplyTurn({
    state: branchedSourceState,
    response: 'Sacred geometry',
    playerId: DEFAULT_AI_PLAYER_ID,
    originalTopic: 'Cathedrals',
    difficulty: 'undergrad',
    circleEnabled: false,
    services,
  });

  const secondTurn = branch.state.turnsById[branch.state.turnOrder[1]];
  const secondEdge = branch.state.edgesById[secondTurn.edgeIds[0]];
  assert.equal(secondEdge.sourceNodeId, branch.state.rootNodeId);
  assert.notEqual(secondEdge.sourceNodeId, first.state.turnsById[first.state.turnOrder[0]].destinationNodeId);
  assert.equal(branch.state.nodesById[secondTurn.destinationNodeId].topic, 'Sacred geometry');
});

test('supports multi-source turns with one edge per active source', async () => {
  const rootState = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const evaluateCalls: unknown[] = [];
  const services = {
    async evaluateTurn(request) {
      evaluateCalls.push(request);
      return {
        evaluation: 'ok',
        scores: defaultScore,
      };
    },
  } satisfies Pick<GameFlowServices, 'evaluateTurn'>;

  const first = await evaluateAndApplyTurn({
    state: rootState,
    response: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    originalTopic: 'Cathedrals',
    difficulty: 'undergrad',
    circleEnabled: false,
    services,
  });
  const firstTurn = first.state.turnsById[first.state.turnOrder[0]];
  const firstDestinationId = firstTurn.destinationNodeId;
  const multiSourceState = {
    ...advanceGameTurn(first.state, getNextPlayerId(first.state)),
    activeSourceNodeIds: [rootState.rootNodeId, firstDestinationId],
  };

  const result = await evaluateAndApplyTurn({
    state: multiSourceState,
    response: 'Load-bearing symbols',
    playerId: DEFAULT_AI_PLAYER_ID,
    originalTopic: 'Cathedrals',
    difficulty: 'undergrad',
    circleEnabled: false,
    services,
  });

  const turn = result.state.turnsById[result.state.turnOrder[1]];
  assert.deepEqual(turn.sourceNodeIds, [rootState.rootNodeId, firstDestinationId]);
  assert.equal(turn.edgeIds.length, 2);
  assert.deepEqual(
    turn.edgeIds.map(edgeId => result.state.edgesById[edgeId].sourceNodeId),
    [rootState.rootNodeId, firstDestinationId]
  );
  assert.deepEqual(
    turn.edgeIds.map(edgeId => result.state.edgesById[edgeId].scoringDescription),
    ['ok', 'ok']
  );
  assert.equal(selectCurrentSourceTopicText(multiSourceState), 'Cathedrals + Flying buttresses');
  assert.deepEqual(evaluateCalls, [
    {
      topic: 'Cathedrals',
      originalTopic: 'Cathedrals',
      response: 'Flying buttresses',
      difficulty: 'undergrad',
      isFinalCircleRound: false,
    },
    {
      topic: 'Cathedrals + Flying buttresses',
      originalTopic: 'Cathedrals',
      response: 'Load-bearing symbols',
      difficulty: 'undergrad',
      isFinalCircleRound: false,
    },
  ]);
});

test('marks final circle-mode evaluation as completed and sends final-round context', async () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 1,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const services = {
    async evaluateTurn(request) {
      assert.equal(request.isFinalCircleRound, true);
      return {
        evaluation: 'Connects current topic.',
        finalEvaluation: 'Connects back to root topic.',
        scores: {
          ...defaultScore,
          currentConnection: {
            semanticDistance: 7,
            similarity: 8,
            subtotal: 15,
          },
          originalConnection: {
            semanticDistance: 6,
            similarity: 8,
            subtotal: 14,
          },
        },
      };
    },
  } satisfies Pick<GameFlowServices, 'evaluateTurn'>;

  const result = await evaluateAndApplyTurn({
    state,
    response: 'Pilgrimage routes',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    originalTopic: 'Cathedrals',
    difficulty: 'grad',
    circleEnabled: true,
    services,
  });

  assert.equal(result.state.gameStatus, 'completed');
  assert.equal(result.currentEvaluation.finalEvaluation, 'Connects back to root topic.');
});

test('AI response generation uses graph context and falls back for empty responses', async () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 4,
    currentPlayerId: DEFAULT_AI_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const calls: unknown[] = [];
  const services = {
    async generateAiResponse(request) {
      calls.push(request);
      return '   ';
    },
  } satisfies Pick<GameFlowServices, 'generateAiResponse'>;

  const response = await generateAiResponseForCurrentTurn({
    state,
    originalTopic: 'Cathedrals',
    difficulty: 'secondary',
    circleEnabled: true,
    services,
  });

  assert.equal(response, 'Response to Cathedrals');
  assert.deepEqual(calls, [{
    topic: 'Cathedrals',
    originalTopic: 'Cathedrals',
    difficulty: 'secondary',
    circleEnabled: true,
    isFinalCircleRound: false,
    gameHistory: [],
  }]);
});

test('active source removal preserves at least one source', () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 4,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });

  assert.deepEqual(removeActiveSourceNode(state, state.rootNodeId).activeSourceNodeIds, [state.rootNodeId]);
  assert.deepEqual(addActiveSourceNode(state, state.rootNodeId).activeSourceNodeIds, [state.rootNodeId]);
});
