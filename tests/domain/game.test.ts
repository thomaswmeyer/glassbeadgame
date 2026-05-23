import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  addActiveSourceNode,
  addTurnToGameState,
  advanceGameTurn,
  createEmptyGameState,
  getTurnHistoryRowScore,
  getTurnHistoryRowSourceTopicText,
  getNextPlayerId,
  getGameOutcomeText,
  removeActiveSourceNode,
  selectActiveSourceNodeStatus,
  selectActiveSourceRows,
  selectCurrentEvaluation,
  selectGraphRenderData,
  selectHasBranchedSourceSelection,
  selectPlayerScoreRows,
  selectRootDefinitionTarget,
  selectSelectedGraphNodeView,
  selectSelectedNodePanels,
  selectSetupPlayerNames,
  selectShouldShowSelectedGraphNodePanel,
  selectSingleActiveSourceDefinitionTarget,
  selectTopicNodeIdByTopic,
  selectTurnHistoryRows,
  setGameStatus,
  setNodeDefinitionVisibility,
  setSelectedNodeIds,
  startGameState,
  updateNodeDefinition,
  type Player,
} from '../../src/domain/game';

const score = {
  semanticDistance: 6,
  relevanceQuality: 7,
  total: 13,
};

const players: Player[] = [
  { id: 'player-local', name: 'Local', kind: 'local' },
  { id: 'player-openclaw', name: 'OpenClaw', kind: 'ai', modelKey: 'openclaw' },
  { id: 'player-remote-ai', name: 'Remote AI', kind: 'ai', modelKey: 'remote' },
];

function startedState() {
  return startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: DEFAULT_HUMAN_PLAYER_ID,
    rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
  });
}

test('empty game state preserves custom players and falls back to the first player when current player is invalid', () => {
  const state = createEmptyGameState(8, 'missing-player', players);

  assert.deepEqual(state.playerOrder, ['player-local', 'player-openclaw', 'player-remote-ai']);
  assert.deepEqual(Object.keys(state.playersById), ['player-local', 'player-openclaw', 'player-remote-ai']);
  assert.equal(state.currentPlayerId, 'player-local');
  assert.equal(state.maxRounds, 8);
  assert.equal(state.gameStatus, 'setup');
  assert.deepEqual(state.nodesById, {});
  assert.deepEqual(state.edgesById, {});
  assert.deepEqual(state.turnsById, {});
});

test('started game state preserves custom player ownership for generated roots', () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: 'player-openclaw',
    rootCreatedByPlayerId: 'player-remote-ai',
    players,
  });

  assert.equal(state.currentPlayerId, 'player-openclaw');
  assert.equal(state.nodesById[state.rootNodeId].createdByPlayerId, 'player-remote-ai');
  assert.equal(state.playersById['player-remote-ai'].name, 'Remote AI');
  assert.deepEqual(state.activeSourceNodeIds, [state.rootNodeId]);
  assert.deepEqual(state.selectedNodeIds, [state.rootNodeId]);
});

test('definition updates are node-scoped and visibility can be toggled independently', () => {
  const state = startedState();

  const withDefinition = updateNodeDefinition(state, state.rootNodeId, 'A large important church.');
  assert.equal(withDefinition.nodesById[state.rootNodeId].definition, 'A large important church.');
  assert.equal(withDefinition.nodesById[state.rootNodeId].definitionVisible, true);

  const hidden = setNodeDefinitionVisibility(withDefinition, state.rootNodeId, false);
  assert.equal(hidden.nodesById[state.rootNodeId].definition, 'A large important church.');
  assert.equal(hidden.nodesById[state.rootNodeId].definitionVisible, false);

  assert.equal(updateNodeDefinition(hidden, 'missing-node', 'Ignored'), hidden);
  assert.equal(setNodeDefinitionVisibility(hidden, 'missing-node', true), hidden);
});

test('definition targets are selected from nodes rather than rebuilt by UI callers', () => {
  const state = startedState();
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const turn = withTurn.turnsById[withTurn.turnOrder[0]];

  assert.deepEqual(selectRootDefinitionTarget(withTurn), {
    nodeId: state.rootNodeId,
    topic: 'Cathedrals',
  });
  assert.deepEqual(selectSingleActiveSourceDefinitionTarget(withTurn), {
    nodeId: turn.destinationNodeId,
    topic: 'Flying buttresses',
  });

  const multiSource = addActiveSourceNode(withTurn, state.rootNodeId);
  assert.equal(selectSingleActiveSourceDefinitionTarget(multiSource), null);
});

test('selection filters unknown nodes and selected node panels include player and turn metadata', () => {
  const state = addTurnToGameState(startedState(), {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [],
    evaluation: 'Strong connection.',
    totalScore: score.total,
    legacyScores: score,
  });
  const turn = state.turnsById[state.turnOrder[0]];
  const selected = setSelectedNodeIds(state, [turn.destinationNodeId, 'missing-node']);

  assert.deepEqual(selected.selectedNodeIds, [turn.destinationNodeId]);

  const panels = selectSelectedNodePanels(selected);
  assert.equal(panels.length, 1);
  assert.equal(panels[0].node.topic, 'Flying buttresses');
  assert.equal(panels[0].player?.id, DEFAULT_HUMAN_PLAYER_ID);
  assert.equal(panels[0].createdTurn?.id, turn.id);
});

test('selected graph node view resolves root nodes and created topic history', () => {
  const state = addTurnToGameState(startedState(), {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [],
    evaluation: 'Strong connection.',
    totalScore: score.total,
    legacyScores: score,
  });
  const turn = state.turnsById[state.turnOrder[0]];

  assert.deepEqual(selectSelectedGraphNodeView(state, state.rootNodeId), {
    id: state.rootNodeId,
    title: 'Cathedrals',
    subtitle: 'Original topic',
    topicForDefinition: 'Cathedrals',
    historyItem: null,
  });

  const selectedTurnView = selectSelectedGraphNodeView(state, turn.destinationNodeId);
  assert.equal(selectedTurnView?.id, turn.destinationNodeId);
  assert.equal(selectedTurnView?.title, 'Flying buttresses');
  assert.equal(selectedTurnView?.subtitle, 'You topic');
  assert.equal(selectedTurnView?.topicForDefinition, 'Flying buttresses');
  assert.equal(selectedTurnView?.historyItem?.turn.id, turn.id);

  assert.equal(selectSelectedGraphNodeView(state, 'missing-node'), null);
  assert.equal(selectSelectedGraphNodeView(state, null), null);
});

test('active source mutations ignore duplicate and unknown nodes and preserve at least one source', () => {
  const state = startedState();
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const turn = withTurn.turnsById[withTurn.turnOrder[0]];

  assert.deepEqual(removeActiveSourceNode(state, state.rootNodeId).activeSourceNodeIds, [state.rootNodeId]);
  assert.deepEqual(addActiveSourceNode(state, 'missing-node').activeSourceNodeIds, [state.rootNodeId]);
  assert.deepEqual(addActiveSourceNode(state, state.rootNodeId).activeSourceNodeIds, [state.rootNodeId]);

  const withSecondSource = addActiveSourceNode(withTurn, state.rootNodeId);
  assert.deepEqual(withSecondSource.activeSourceNodeIds, [turn.destinationNodeId, state.rootNodeId]);

  const afterRemoval = removeActiveSourceNode(withSecondSource, turn.destinationNodeId);
  assert.deepEqual(afterRemoval.activeSourceNodeIds, [state.rootNodeId]);
});

test('active source status exposes add and remove affordances without UI state peeking into arrays', () => {
  const state = startedState();
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const turn = withTurn.turnsById[withTurn.turnOrder[0]];

  assert.deepEqual(selectActiveSourceNodeStatus(withTurn, turn.destinationNodeId), {
    isActiveSource: true,
    canAddSource: false,
    canRemoveSource: false,
  });

  const withSecondSource = addActiveSourceNode(withTurn, state.rootNodeId);
  assert.deepEqual(selectActiveSourceNodeStatus(withSecondSource, turn.destinationNodeId), {
    isActiveSource: true,
    canAddSource: false,
    canRemoveSource: true,
  });
  assert.deepEqual(selectActiveSourceNodeStatus(withSecondSource, 'missing-node'), {
    isActiveSource: false,
    canAddSource: false,
    canRemoveSource: false,
  });
});

test('active source rows expose source nodes with removable state', () => {
  const state = startedState();
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const turn = withTurn.turnsById[withTurn.turnOrder[0]];

  assert.deepEqual(selectActiveSourceRows(withTurn).map(row => ({
    nodeId: row.node.id,
    topic: row.node.topic,
    canRemoveSource: row.canRemoveSource,
  })), [
    {
      nodeId: turn.destinationNodeId,
      topic: 'Flying buttresses',
      canRemoveSource: false,
    },
  ]);

  const withSecondSource = addActiveSourceNode(withTurn, state.rootNodeId);
  assert.deepEqual(selectActiveSourceRows(withSecondSource).map(row => ({
    nodeId: row.node.id,
    topic: row.node.topic,
    canRemoveSource: row.canRemoveSource,
  })), [
    {
      nodeId: turn.destinationNodeId,
      topic: 'Flying buttresses',
      canRemoveSource: true,
    },
    {
      nodeId: state.rootNodeId,
      topic: 'Cathedrals',
      canRemoveSource: true,
    },
  ]);
});

test('branched source selection compares active sources to the default latest topic', () => {
  const state = startedState();
  assert.equal(selectHasBranchedSourceSelection(state), false);

  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const withRootSource = {
    ...withTurn,
    activeSourceNodeIds: [state.rootNodeId],
  };

  assert.equal(selectHasBranchedSourceSelection(withTurn), false);
  assert.equal(selectHasBranchedSourceSelection(withRootSource), true);
  assert.equal(selectHasBranchedSourceSelection(addActiveSourceNode(withTurn, state.rootNodeId)), true);
});

test('selected node panel visibility hides the sole active source but shows selected branches and multi-source selections', () => {
  const state = startedState();
  const withTurn = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const turn = withTurn.turnsById[withTurn.turnOrder[0]];

  assert.equal(selectShouldShowSelectedGraphNodePanel(withTurn, turn.destinationNodeId), false);
  assert.equal(selectShouldShowSelectedGraphNodePanel(withTurn, state.rootNodeId), true);
  assert.equal(
    selectShouldShowSelectedGraphNodePanel(addActiveSourceNode(withTurn, state.rootNodeId), turn.destinationNodeId),
    true
  );
  assert.equal(selectShouldShowSelectedGraphNodePanel(withTurn, 'missing-node'), false);
});

test('topic node lookup resolves roots and duplicate destination topics by history position', () => {
  const state = startedState();
  const first = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
  });
  const firstTurn = first.turnsById[first.turnOrder[0]];
  const second = addTurnToGameState(advanceGameTurn(first, DEFAULT_AI_PLAYER_ID), {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_AI_PLAYER_ID,
    sourceNodeIds: [firstTurn.destinationNodeId],
  });
  const secondTurn = second.turnsById[second.turnOrder[1]];

  assert.equal(selectTopicNodeIdByTopic(second, 'Cathedrals'), state.rootNodeId);
  assert.equal(selectTopicNodeIdByTopic(second, 'Flying buttresses'), secondTurn.destinationNodeId);
  assert.equal(selectTopicNodeIdByTopic(second, 'Flying buttresses', 1), firstTurn.destinationNodeId);
  assert.equal(selectTopicNodeIdByTopic(second, '  '), null);
  assert.equal(selectTopicNodeIdByTopic(second, 'Missing topic'), null);
});

test('player score rows support more than two players and preserve configured order', () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: 'player-openclaw',
    rootCreatedByPlayerId: 'player-remote-ai',
    players,
  });
  const first = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: 'player-local',
    sourceNodeIds: [state.rootNodeId],
    totalScore: 11,
  });
  const second = addTurnToGameState(advanceGameTurn(first, 'player-openclaw'), {
    destinationTopic: 'Sacred geometry',
    playerId: 'player-openclaw',
    sourceNodeIds: [first.rootNodeId],
    totalScore: 17,
  });

  assert.deepEqual(
    selectPlayerScoreRows(second).map(row => ({
      id: row.player.id,
      totalScore: row.totalScore,
      isCurrentPlayer: row.isCurrentPlayer,
    })),
    [
      { id: 'player-local', totalScore: 11, isCurrentPlayer: false },
      { id: 'player-openclaw', totalScore: 17, isCurrentPlayer: true },
      { id: 'player-remote-ai', totalScore: 0, isCurrentPlayer: false },
    ]
  );
});

test('setup player names expose local and ai player labels with fallbacks', () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: 'player-local',
    rootCreatedByPlayerId: 'player-remote-ai',
    players,
  });

  assert.deepEqual(selectSetupPlayerNames(selectPlayerScoreRows(state)), {
    localPlayerName: 'Local',
    aiPlayerName: 'OpenClaw',
  });
  assert.deepEqual(selectSetupPlayerNames([]), {
    localPlayerName: 'Local player',
    aiPlayerName: 'AI player',
  });
});

test('game outcome text reports a winner or tie from player score rows', () => {
  const scoreRows = players.map((player, index) => ({
    player,
    totalScore: index === 1 ? 12 : 6,
    isCurrentPlayer: false,
  }));

  assert.equal(getGameOutcomeText(scoreRows), 'OpenClaw won.');
  assert.equal(getGameOutcomeText([
    { ...scoreRows[0], totalScore: 12 },
    scoreRows[1],
    scoreRows[2],
  ]), "It's a tie!");
  assert.equal(getGameOutcomeText([]), "It's a tie!");
});

test('next player cycles through the configured player order', () => {
  const state = startGameState({
    rootTopic: 'Cathedrals',
    maxRounds: 6,
    currentPlayerId: 'player-local',
    rootCreatedByPlayerId: 'player-remote-ai',
    players,
  });

  assert.equal(getNextPlayerId(state), 'player-openclaw');
  assert.equal(getNextPlayerId({ ...state, currentPlayerId: 'player-openclaw' }), 'player-remote-ai');
  assert.equal(getNextPlayerId({ ...state, currentPlayerId: 'player-remote-ai' }), 'player-local');
  assert.equal(getNextPlayerId({ ...state, currentPlayerId: 'missing-player' }), 'player-local');
});

test('current evaluation is derived only for result states and includes latest player metadata', () => {
  const state = addTurnToGameState(startedState(), {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [],
    evaluation: 'Strong connection.',
    finalEvaluation: 'Back to the root.',
    totalScore: score.total,
    legacyScores: score,
  });

  assert.equal(selectCurrentEvaluation(state), null);

  const showingResults = setGameStatus(state, 'showingResults');
  assert.deepEqual(selectCurrentEvaluation(showingResults), {
    topic: 'Cathedrals',
    response: 'Flying buttresses',
    evaluation: 'Strong connection.',
    finalEvaluation: 'Back to the root.',
    scores: score,
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    playerKind: 'local',
    playerName: 'You',
  });
});

test('turn history and graph render selectors expose edge scoring details', () => {
  const state = addTurnToGameState(startedState(), {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [],
    evaluation: 'Strong connection.',
    totalScore: score.total,
    legacyScores: score,
    scoringDescription: 'Overall scoring rationale.',
    semanticDistanceDescription: 'Distant but coherent.',
    strengthDescription: 'Strong structural similarity.',
  });
  const turn = state.turnsById[state.turnOrder[0]];

  const historyRows = selectTurnHistoryRows(state);
  assert.equal(historyRows.length, 1);
  assert.equal(historyRows[0].sourceNodes[0].topic, 'Cathedrals');
  assert.equal(historyRows[0].destinationNode.topic, 'Flying buttresses');

  const graphData = selectGraphRenderData(state);
  assert.equal(graphData.nodes.find(node => node.id === state.rootNodeId)?.isRoot, true);
  assert.equal(graphData.nodes.find(node => node.id === turn.destinationNodeId)?.isActiveSource, true);
  assert.deepEqual(graphData.edges, [{
    id: turn.edgeIds[0],
    sourceNodeId: state.rootNodeId,
    destinationNodeId: turn.destinationNodeId,
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    semanticDistanceScore: 6,
    strengthScore: 7,
    scoringDescription: 'Overall scoring rationale.',
    semanticDistanceDescription: 'Distant but coherent.',
    strengthDescription: 'Strong structural similarity.',
  }]);
});

test('turn history rows preserve multiple source nodes for direct UI rendering', () => {
  const state = startedState();
  const first = addTurnToGameState(state, {
    destinationTopic: 'Flying buttresses',
    playerId: DEFAULT_HUMAN_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId],
    totalScore: 11,
  });
  const firstTurn = first.turnsById[first.turnOrder[0]];
  const second = addTurnToGameState({
    ...advanceGameTurn(first, DEFAULT_AI_PLAYER_ID),
    activeSourceNodeIds: [state.rootNodeId, firstTurn.destinationNodeId],
  }, {
    destinationTopic: 'Load-bearing symbols',
    playerId: DEFAULT_AI_PLAYER_ID,
    sourceNodeIds: [state.rootNodeId, firstTurn.destinationNodeId],
    totalScore: 17,
  });

  const rows = selectTurnHistoryRows(second);
  assert.deepEqual(
    rows[1].sourceNodes.map(node => node.topic),
    ['Cathedrals', 'Flying buttresses']
  );
  assert.equal(getTurnHistoryRowSourceTopicText(rows[1]), 'Cathedrals + Flying buttresses');
  assert.deepEqual(getTurnHistoryRowScore(rows[1]), {
    semanticDistance: 0,
    relevanceQuality: 0,
    total: 17,
  });
  assert.equal(rows[1].destinationNode.topic, 'Load-bearing symbols');
  assert.equal(rows[1].player.id, DEFAULT_AI_PLAYER_ID);
});
