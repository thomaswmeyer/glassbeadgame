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
  selectTurnContextHistory,
  startGeneratedGame,
  type GameFlowServices,
} from '../../src/domain/gameFlow';

const defaultScore = {
  semanticDistance: 7,
  relevanceQuality: 8,
  total: 15,
};
const normalizedDefaultScore = {
  semanticDistance: 7,
  relevanceQuality: 8,
  total: 56,
};

test('starts a generated game by recording the generated root as a zero-point opening turn', async () => {
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
  assert.equal(state.gameStatus, 'showingResults');
  assert.equal(state.currentPlayerId, DEFAULT_HUMAN_PLAYER_ID);
  assert.equal(selectRootTopic(state), 'Cathedrals');
  assert.deepEqual(state.activeSourceNodeIds, [state.rootNodeId]);
  assert.deepEqual(state.selectedNodeIds, [state.rootNodeId]);
  assert.equal(state.nodesById[state.rootNodeId].createdByPlayerId, DEFAULT_HUMAN_PLAYER_ID);
  assert.equal(state.turnOrder.length, 1);
  assert.equal(state.turnsById[state.turnOrder[0]].totalScore, 0);
  assert.equal(state.turnsById[state.turnOrder[0]].round, 0);
  assert.equal(state.currentRound, 1);
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
    difficulty: 'undergrad',
    services,
  });

  assert.deepEqual(evaluateCalls, [{
    topic: 'Cathedrals',
    response: 'Flying buttresses',
    difficulty: 'undergrad',
  }]);
  assert.equal(result.state.gameStatus, 'showingResults');
  assert.equal(result.state.turnOrder.length, 1);
  assert.equal(result.currentEvaluation.topic, 'Cathedrals');
  assert.equal(result.currentEvaluation.response, 'Flying buttresses');
  assert.equal(result.currentEvaluation.scores.total, 56);

  const turn = result.state.turnsById[result.state.turnOrder[0]];
  const destination = result.state.nodesById[turn.destinationNodeId];
  const edge = result.state.edgesById[turn.edgeIds[0]];
  assert.equal(turn.totalScore, 56);
  assert.equal(destination.topic, 'Flying buttresses');
  assert.equal(edge.sourceNodeId, state.rootNodeId);
  assert.equal(edge.destinationNodeId, destination.id);
  assert.equal(edge.semanticDistanceScore, 7);
  assert.equal(edge.strengthScore, 8);
  assert.equal(edge.totalScore, 56);
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
    difficulty: 'undergrad',
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
    difficulty: 'undergrad',
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
    difficulty: 'undergrad',
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
    difficulty: 'undergrad',
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
  assert.deepEqual(
    turn.edgeIds.map(edgeId => result.state.edgesById[edgeId].totalScore),
    [56, 56]
  );
  assert.equal(turn.totalScore, 79);
  assert.equal(result.currentEvaluation.scores.total, 79);
  assert.match(result.currentEvaluation.evaluation, /Connection to "Cathedrals":/);
  assert.match(result.currentEvaluation.evaluation, /Connection to "Flying buttresses":/);
  assert.equal(selectCurrentSourceTopicText(multiSourceState), 'Cathedrals + Flying buttresses');
  assert.deepEqual(evaluateCalls, [
    {
      topic: 'Cathedrals',
      response: 'Flying buttresses',
      difficulty: 'undergrad',
    },
    {
      topic: 'Cathedrals',
      response: 'Load-bearing symbols',
      difficulty: 'undergrad',
    },
    {
      topic: 'Flying buttresses',
      response: 'Load-bearing symbols',
      difficulty: 'undergrad',
    },
  ]);
});

test('marks the final turn as completed without special circle-mode scoring', async () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 1,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const services = {
    async evaluateTurn(request) {
      assert.deepEqual(request, {
        topic: 'Cathedrals',
        response: 'Pilgrimage routes',
        difficulty: 'grad',
      });
      return {
        evaluation: 'Connects the selected source topic.',
        scores: defaultScore,
      };
    },
  } satisfies Pick<GameFlowServices, 'evaluateTurn'>;

  const result = await evaluateAndApplyTurn({
    state,
    response: 'Pilgrimage routes',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    difficulty: 'grad',
    services,
  });

  assert.equal(result.state.gameStatus, 'completed');
  assert.equal(result.currentEvaluation.evaluation, 'Connects the selected source topic.');
  assert.equal(result.currentEvaluation.scores.total, 56);
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
    difficulty: 'secondary',
    services,
  });

  assert.equal(response, 'Response to Cathedrals');
  assert.deepEqual(calls, [{
    topic: 'Cathedrals',
    availableNodes: [{
      id: state.rootNodeId,
      topic: 'Cathedrals',
      definition: undefined,
      subjectCategory: undefined,
      isCurrentSource: false,
    }],
    selectedSourceNodeIds: [],
    sourceSelectionMode: 'free',
    difficulty: 'secondary',
    gameHistory: [],
  }]);
});

test('AI response generation sends player-neutral turn context with multi-source history', async () => {
  const rootState = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: DEFAULT_AI_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
  const first = await evaluateAndApplyTurn({
    state: rootState,
    response: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    difficulty: 'undergrad',
    services: {
      async evaluateTurn() {
        return {
          evaluation: 'Strong connection.',
          scores: defaultScore,
        };
      },
    },
  });
  const firstTurn = first.state.turnsById[first.state.turnOrder[0]];
  const multiSourceState = {
    ...advanceGameTurn(first.state, DEFAULT_AI_PLAYER_ID),
    activeSourceNodeIds: [rootState.rootNodeId, firstTurn.destinationNodeId],
  };
  const calls: unknown[] = [];
  const services = {
    async generateAiResponse(request) {
      calls.push(request);
      return 'Sacred geometry';
    },
  } satisfies Pick<GameFlowServices, 'generateAiResponse'>;

  const response = await generateAiResponseForCurrentTurn({
    state: multiSourceState,
    difficulty: 'grad',
    services,
  });

  assert.equal(response, 'Sacred geometry');
  assert.deepEqual(calls, [{
    topic: 'Cathedrals + Flying buttresses',
    availableNodes: [
      {
        id: rootState.rootNodeId,
        topic: 'Cathedrals',
        definition: undefined,
        subjectCategory: undefined,
        isCurrentSource: false,
      },
      {
        id: firstTurn.destinationNodeId,
        topic: 'Flying buttresses',
        definition: undefined,
        subjectCategory: undefined,
        isCurrentSource: false,
      },
    ],
    selectedSourceNodeIds: [],
    sourceSelectionMode: 'free',
    difficulty: 'grad',
    gameHistory: [{
      round: 1,
      sourceTopics: ['Cathedrals'],
      destinationTopic: 'Flying buttresses',
      evaluation: 'Strong connection.',
      scores: normalizedDefaultScore,
      playerId: DEFAULT_HUMAN_PLAYER_ID,
      playerName: 'You',
      playerKind: 'local',
    }],
  }]);
  assert.deepEqual(selectTurnContextHistory(first.state), [{
    round: 1,
    sourceTopics: ['Cathedrals'],
    destinationTopic: 'Flying buttresses',
    evaluation: 'Strong connection.',
    scores: normalizedDefaultScore,
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    playerName: 'You',
    playerKind: 'local',
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
