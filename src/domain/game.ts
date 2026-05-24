export type PlayerKind = 'local' | 'ai';

export type Score = {
  semanticDistance: number;
  relevanceQuality: number;
  total: number;
  originalTopicConnection?: number;
  currentConnection?: {
    semanticDistance: number;
    relevance?: number;
    similarity?: number;
    subtotal: number;
  };
  originalConnection?: {
    semanticDistance: number;
    relevance?: number;
    similarity?: number;
    subtotal: number;
  };
};

export type Player = {
  id: string;
  name: string;
  kind: PlayerKind;
  modelKey?: string;
};

export type TopicNode = {
  id: string;
  topic: string;
  definition?: string;
  definitionVisible: boolean;
  createdByPlayerId?: string;
  createdTurnId?: string;
  isRoot: boolean;
};

export type DefinitionTarget = {
  nodeId: string;
  topic: string;
};

export type TopicEdge = {
  id: string;
  sourceNodeId: string;
  destinationNodeId: string;
  playerId: string;
  turnId: string;
  strengthScore?: number;
  semanticDistanceScore?: number;
  totalScore?: number;
  scoringDescription?: string;
  semanticDistanceDescription?: string;
  strengthDescription?: string;
};

export type TurnEdgeEvaluation = {
  sourceNodeId: string;
  evaluation?: string;
  finalEvaluation?: string;
  scores?: Score;
  scoringDescription?: string;
  semanticDistanceDescription?: string;
  strengthDescription?: string;
};

export type Turn = {
  id: string;
  round: number;
  playerId: string;
  sourceNodeIds: string[];
  edgeIds: string[];
  destinationNodeId: string;
  evaluation?: string;
  finalEvaluation?: string;
  totalScore?: number;
  legacyScores?: Score;
  edgeEvaluations?: TurnEdgeEvaluation[];
};

export type GameStatus =
  | 'setup'
  | 'generatingTopic'
  | 'awaitingResponse'
  | 'aiThinking'
  | 'evaluating'
  | 'showingResults'
  | 'completed';

export type GameState = {
  playersById: Record<string, Player>;
  playerOrder: string[];
  nodesById: Record<string, TopicNode>;
  edgesById: Record<string, TopicEdge>;
  turnsById: Record<string, Turn>;
  turnOrder: string[];
  rootNodeId: string;
  activeSourceNodeIds: string[];
  selectedNodeIds: string[];
  currentPlayerId: string;
  currentRound: number;
  maxRounds: number;
  gameStatus: GameStatus;
};

export type GraphRenderNode = {
  id: string;
  label: string;
  topic: string;
  playerId?: string;
  playerKind?: PlayerKind;
  isRoot: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  isActiveSource: boolean;
};

export type GraphRenderEdge = {
  id: string;
  sourceNodeId: string;
  destinationNodeId: string;
  playerId: string;
  semanticDistanceScore?: number;
  strengthScore?: number;
  totalScore?: number;
  scoringDescription?: string;
  semanticDistanceDescription?: string;
  strengthDescription?: string;
};

export type TurnHistoryRow = {
  turn: Turn;
  player: Player;
  sourceNodes: TopicNode[];
  destinationNode: TopicNode;
  edgeScores: CurrentEvaluationEdgeScore[];
};

export type CurrentEvaluationView = {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  edgeScores: CurrentEvaluationEdgeScore[];
  playerId: string;
  playerKind: PlayerKind;
  playerName: string;
  finalEvaluation?: string;
};

export type CurrentEvaluationEdgeScore = {
  sourceNodeId: string;
  sourceTopic: string;
  evaluation?: string;
  finalEvaluation?: string;
  scores: Score;
};

export type PlayerScoreRow = {
  player: Player;
  totalScore: number;
  isCurrentPlayer: boolean;
};

export type ActiveSourceNodeStatus = {
  isActiveSource: boolean;
  canAddSource: boolean;
  canRemoveSource: boolean;
};

export type ActiveSourceRow = {
  node: TopicNode;
  canRemoveSource: boolean;
};

export type SetupPlayerNames = {
  localPlayerName: string;
  aiPlayerName: string;
};

export const DEFAULT_HUMAN_PLAYER_ID = 'player-human';
export const DEFAULT_AI_PLAYER_ID = 'player-ai';
export const DEFAULT_ROOT_NODE_ID = 'root';

export function createDefaultPlayers() {
  const players: Player[] = [
    { id: DEFAULT_HUMAN_PLAYER_ID, name: 'You', kind: 'local' },
    { id: DEFAULT_AI_PLAYER_ID, name: 'AI', kind: 'ai', modelKey: 'gemini_flash' },
  ];

  return {
    playersById: Object.fromEntries(players.map(player => [player.id, player])),
    playerOrder: players.map(player => player.id),
  };
}

export function createPlayerIndex(players: Player[]) {
  return {
    playersById: Object.fromEntries(players.map(player => [player.id, player])),
    playerOrder: players.map(player => player.id),
  };
}

export function createEmptyGameState(
  maxRounds: number,
  currentPlayerId?: string,
  players = Object.values(createDefaultPlayers().playersById)
): GameState {
  const { playersById, playerOrder } = createPlayerIndex(players);
  const resolvedCurrentPlayerId = currentPlayerId && playersById[currentPlayerId]
    ? currentPlayerId
    : playerOrder[0] || '';

  return {
    playersById,
    playerOrder,
    nodesById: {},
    edgesById: {},
    turnsById: {},
    turnOrder: [],
    rootNodeId: '',
    activeSourceNodeIds: [],
    selectedNodeIds: [],
    currentPlayerId: resolvedCurrentPlayerId,
    currentRound: 1,
    maxRounds,
    gameStatus: 'setup',
  };
}

export function startGameState(params: {
  rootTopic: string;
  maxRounds: number;
  currentPlayerId: string;
  rootCreatedByPlayerId?: string;
  players?: Player[];
}): GameState {
  const state = createEmptyGameState(params.maxRounds, params.currentPlayerId, params.players);
  const rootNode: TopicNode = {
    id: DEFAULT_ROOT_NODE_ID,
    topic: params.rootTopic,
    definitionVisible: false,
    createdByPlayerId: params.rootCreatedByPlayerId,
    isRoot: true,
  };

  return {
    ...state,
    nodesById: { [rootNode.id]: rootNode },
    rootNodeId: rootNode.id,
    activeSourceNodeIds: [rootNode.id],
    selectedNodeIds: [rootNode.id],
    gameStatus: 'awaitingResponse',
  };
}

export function addTurnToGameState(
  state: GameState,
  params: {
    destinationTopic: string;
    playerId: string;
    sourceNodeIds: string[];
    evaluation?: string;
    finalEvaluation?: string;
    totalScore?: number;
    legacyScores?: Score;
    edgeEvaluations?: TurnEdgeEvaluation[];
    scoringDescription?: string;
    semanticDistanceDescription?: string;
    strengthDescription?: string;
  }
): GameState {
  const turnIndex = state.turnOrder.length;
  const turnId = `turn-${turnIndex}`;
  const destinationNodeId = `node-${turnIndex + 1}`;
  const sourceNodeIds = params.sourceNodeIds.length > 0 ? params.sourceNodeIds : state.activeSourceNodeIds;
  const edgeIds = sourceNodeIds.map((sourceNodeId, index) => `edge-${turnIndex}-${index}`);
  const edgeEvaluationBySourceId = new Map(
    params.edgeEvaluations?.map(edgeEvaluation => [edgeEvaluation.sourceNodeId, edgeEvaluation])
  );

  const destinationNode: TopicNode = {
    id: destinationNodeId,
    topic: params.destinationTopic,
    definitionVisible: false,
    createdByPlayerId: params.playerId,
    createdTurnId: turnId,
    isRoot: false,
  };

  const newEdges = Object.fromEntries(
    sourceNodeIds.map((sourceNodeId, index) => {
      const edgeEvaluation = edgeEvaluationBySourceId.get(sourceNodeId);
      const scores = edgeEvaluation?.scores || params.legacyScores;
      const edge: TopicEdge = {
        id: edgeIds[index],
        sourceNodeId,
        destinationNodeId,
        playerId: params.playerId,
        turnId,
        semanticDistanceScore: scores?.semanticDistance,
        strengthScore: scores?.relevanceQuality,
        totalScore: scores?.total,
        scoringDescription: (
          edgeEvaluation?.scoringDescription ||
          edgeEvaluation?.evaluation ||
          params.scoringDescription ||
          params.evaluation
        ),
        semanticDistanceDescription: (
          edgeEvaluation?.semanticDistanceDescription ||
          params.semanticDistanceDescription
        ),
        strengthDescription: edgeEvaluation?.strengthDescription || params.strengthDescription,
      };
      return [edge.id, edge];
    })
  );

  const turn: Turn = {
    id: turnId,
    round: state.currentRound,
    playerId: params.playerId,
    sourceNodeIds,
    edgeIds,
    destinationNodeId,
    evaluation: params.evaluation,
    finalEvaluation: params.finalEvaluation,
    totalScore: params.totalScore,
    legacyScores: params.legacyScores,
    edgeEvaluations: params.edgeEvaluations,
  };

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [destinationNode.id]: destinationNode,
    },
    edgesById: {
      ...state.edgesById,
      ...newEdges,
    },
    turnsById: {
      ...state.turnsById,
      [turn.id]: turn,
    },
    turnOrder: [...state.turnOrder, turn.id],
    activeSourceNodeIds: [destinationNode.id],
    selectedNodeIds: [destinationNode.id],
  };
}

export function updateNodeDefinition(state: GameState, nodeId: string, definition: string): GameState {
  const node = state.nodesById[nodeId];
  if (!node) return state;

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [nodeId]: {
        ...node,
        definition,
        definitionVisible: true,
      },
    },
  };
}

export function setNodeDefinitionVisibility(state: GameState, nodeId: string, definitionVisible: boolean): GameState {
  const node = state.nodesById[nodeId];
  if (!node) return state;

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [nodeId]: {
        ...node,
        definitionVisible,
      },
    },
  };
}

export function setSelectedNodeIds(state: GameState, selectedNodeIds: string[]): GameState {
  return {
    ...state,
    selectedNodeIds: selectedNodeIds.filter(nodeId => state.nodesById[nodeId]),
  };
}

export function setSingleActiveSourceNode(state: GameState, nodeId: string): GameState {
  if (!state.nodesById[nodeId]) return state;

  return {
    ...state,
    activeSourceNodeIds: [nodeId],
    selectedNodeIds: [nodeId],
  };
}

export function addActiveSourceNode(state: GameState, nodeId: string): GameState {
  if (!state.nodesById[nodeId] || state.activeSourceNodeIds.includes(nodeId)) return state;

  return {
    ...state,
    activeSourceNodeIds: [...state.activeSourceNodeIds, nodeId],
  };
}

export function removeActiveSourceNode(state: GameState, nodeId: string): GameState {
  if (state.activeSourceNodeIds.length <= 1) return state;

  return {
    ...state,
    activeSourceNodeIds: state.activeSourceNodeIds.filter(sourceNodeId => sourceNodeId !== nodeId),
  };
}

export function selectActiveSourceNodeStatus(state: GameState, nodeId: string): ActiveSourceNodeStatus {
  const nodeExists = Boolean(state.nodesById[nodeId]);
  const isActiveSource = state.activeSourceNodeIds.includes(nodeId);

  return {
    isActiveSource,
    canAddSource: nodeExists && !isActiveSource,
    canRemoveSource: isActiveSource && state.activeSourceNodeIds.length > 1,
  };
}

export function selectActiveSourceRows(state: GameState): ActiveSourceRow[] {
  return state.activeSourceNodeIds
    .map(nodeId => state.nodesById[nodeId])
    .filter((node): node is TopicNode => Boolean(node))
    .map(node => ({
      node,
      canRemoveSource: state.activeSourceNodeIds.length > 1,
    }));
}

export function selectHasBranchedSourceSelection(state: GameState) {
  const latestTurnId = state.turnOrder[state.turnOrder.length - 1];
  const defaultSourceNodeId = latestTurnId
    ? state.turnsById[latestTurnId]?.destinationNodeId
    : state.rootNodeId;

  return Boolean(
    defaultSourceNodeId &&
    (
      state.activeSourceNodeIds.length !== 1 ||
      state.activeSourceNodeIds[0] !== defaultSourceNodeId
    )
  );
}

export function selectNodeDefinitionTarget(state: GameState, nodeId: string | null | undefined): DefinitionTarget | null {
  if (!nodeId) return null;

  const node = state.nodesById[nodeId];
  if (!node) return null;

  return {
    nodeId: node.id,
    topic: node.topic,
  };
}

export function selectSingleActiveSourceDefinitionTarget(state: GameState): DefinitionTarget | null {
  if (state.activeSourceNodeIds.length !== 1) return null;

  return selectNodeDefinitionTarget(state, state.activeSourceNodeIds[0]);
}

export function selectRootDefinitionTarget(state: GameState): DefinitionTarget | null {
  return selectNodeDefinitionTarget(state, state.rootNodeId);
}

export function advanceGameTurn(state: GameState, nextPlayerId: string): GameState {
  return {
    ...state,
    currentRound: state.currentRound + 1,
    currentPlayerId: nextPlayerId,
    gameStatus: 'awaitingResponse',
  };
}

export function setGameStatus(state: GameState, gameStatus: GameStatus): GameState {
  return {
    ...state,
    gameStatus,
  };
}

export function selectCurrentPlayer(state: GameState) {
  return state.playersById[state.currentPlayerId];
}

export function selectGraphRenderData(state: GameState): { nodes: GraphRenderNode[]; edges: GraphRenderEdge[] } {
  const currentSourceNodeIds = new Set(state.activeSourceNodeIds);
  const selectedNodeIds = new Set(state.selectedNodeIds);

  return {
    nodes: Object.values(state.nodesById).map(node => {
      const player = node.createdByPlayerId ? state.playersById[node.createdByPlayerId] : undefined;
      return {
        id: node.id,
        label: node.topic,
        topic: node.topic,
        playerId: node.createdByPlayerId,
        playerKind: player?.kind,
        isRoot: node.isRoot,
        isCurrent: currentSourceNodeIds.has(node.id),
        isSelected: selectedNodeIds.has(node.id),
        isActiveSource: currentSourceNodeIds.has(node.id),
      };
    }),
    edges: Object.values(state.edgesById).map(edge => ({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      destinationNodeId: edge.destinationNodeId,
      playerId: edge.playerId,
      semanticDistanceScore: edge.semanticDistanceScore,
      strengthScore: edge.strengthScore,
      totalScore: edge.totalScore,
      scoringDescription: edge.scoringDescription,
      semanticDistanceDescription: edge.semanticDistanceDescription,
      strengthDescription: edge.strengthDescription,
    })),
  };
}

function selectEdgeScoresForTurn(
  state: GameState,
  turn: Turn,
  sourceNodes: TopicNode[]
): CurrentEvaluationEdgeScore[] {
  const edgeEvaluationBySourceId = new Map(
    turn.edgeEvaluations?.map(edgeEvaluation => [edgeEvaluation.sourceNodeId, edgeEvaluation])
  );

  return sourceNodes.map(sourceNode => {
    const edgeEvaluation = edgeEvaluationBySourceId.get(sourceNode.id);
    const edge = turn.edgeIds
      .map(edgeId => state.edgesById[edgeId])
      .find(candidateEdge => candidateEdge?.sourceNodeId === sourceNode.id);

    return {
      sourceNodeId: sourceNode.id,
      sourceTopic: sourceNode.topic,
      evaluation: edgeEvaluation?.evaluation || edge?.scoringDescription,
      finalEvaluation: edgeEvaluation?.finalEvaluation,
      scores: edgeEvaluation?.scores || {
        semanticDistance: edge?.semanticDistanceScore || 0,
        relevanceQuality: edge?.strengthScore || 0,
        total: edge?.totalScore || 0,
      },
    };
  });
}

export function selectTurnHistoryRows(state: GameState): TurnHistoryRow[] {
  return state.turnOrder.map(turnId => {
    const turn = state.turnsById[turnId];
    const sourceNodes = turn.sourceNodeIds.map(nodeId => state.nodesById[nodeId]).filter(Boolean);
    return {
      turn,
      player: state.playersById[turn.playerId],
      sourceNodes,
      destinationNode: state.nodesById[turn.destinationNodeId],
      edgeScores: selectEdgeScoresForTurn(state, turn, sourceNodes),
    };
  });
}

export function selectTopicNodeIdByTopic(
  state: GameState,
  topicValue: string,
  beforeHistoryIndex = state.turnOrder.length
) {
  const normalizedTopic = topicValue.trim();
  if (!normalizedTopic) return null;

  const rootTopic = state.rootNodeId ? state.nodesById[state.rootNodeId]?.topic : '';
  if (normalizedTopic === rootTopic) {
    return state.rootNodeId || DEFAULT_ROOT_NODE_ID;
  }

  const historyRows = selectTurnHistoryRows(state);
  for (let index = Math.min(beforeHistoryIndex - 1, historyRows.length - 1); index >= 0; index--) {
    if (historyRows[index].destinationNode.topic === normalizedTopic) {
      return historyRows[index].destinationNode.id || null;
    }
  }

  return null;
}

export function getTurnHistoryRowSourceTopicText(row: TurnHistoryRow) {
  return row.sourceNodes.map(node => node.topic).join(' + ');
}

export function getTurnHistoryRowScore(row: TurnHistoryRow): Score {
  return row.turn.legacyScores || {
    semanticDistance: 0,
    relevanceQuality: 0,
    total: row.turn.totalScore || 0,
  };
}

export function selectPlayerScoreTotals(state: GameState): Record<string, number> {
  return state.turnOrder.reduce<Record<string, number>>((totals, turnId) => {
    const turn = state.turnsById[turnId];
    totals[turn.playerId] = (totals[turn.playerId] || 0) + (turn.totalScore || 0);
    return totals;
  }, {});
}

export function selectPlayerScoreRows(state: GameState): PlayerScoreRow[] {
  const scoreTotals = selectPlayerScoreTotals(state);

  return state.playerOrder
    .map(playerId => state.playersById[playerId])
    .filter((player): player is Player => Boolean(player))
    .map(player => ({
      player,
      totalScore: scoreTotals[player.id] || 0,
      isCurrentPlayer: player.id === state.currentPlayerId,
    }));
}

export function selectSetupPlayerNames(playerScoreRows: PlayerScoreRow[]): SetupPlayerNames {
  return {
    localPlayerName: playerScoreRows.find(row => row.player.kind === 'local')?.player.name || 'Local player',
    aiPlayerName: playerScoreRows.find(row => row.player.kind === 'ai')?.player.name || 'AI player',
  };
}

export function getGameOutcomeText(playerScoreRows: PlayerScoreRow[]) {
  const winningScore = playerScoreRows.length > 0
    ? Math.max(...playerScoreRows.map(row => row.totalScore))
    : 0;
  const winningPlayers = playerScoreRows.filter(row => row.totalScore === winningScore);

  return winningPlayers.length === 1
    ? `${winningPlayers[0].player.name} won.`
    : "It's a tie!";
}

export function selectCurrentEvaluation(state: GameState): CurrentEvaluationView | null {
  if (state.gameStatus !== 'showingResults' && state.gameStatus !== 'completed') return null;

  const latestTurnId = state.turnOrder[state.turnOrder.length - 1];
  const turn = latestTurnId ? state.turnsById[latestTurnId] : null;
  if (!turn) return null;

  const destinationNode = state.nodesById[turn.destinationNodeId];
  const sourceNodes = turn.sourceNodeIds
    .map(nodeId => state.nodesById[nodeId])
    .filter(Boolean);
  const player = state.playersById[turn.playerId];
  const edgeScores = selectEdgeScoresForTurn(state, turn, sourceNodes);

  return {
    topic: sourceNodes.map(node => node.topic).join(' + '),
    response: destinationNode?.topic || '',
    evaluation: turn.evaluation || '',
    finalEvaluation: turn.finalEvaluation,
    scores: turn.legacyScores || {
      semanticDistance: 0,
      relevanceQuality: 0,
      total: turn.totalScore || 0,
    },
    edgeScores,
    playerId: turn.playerId,
    playerKind: player?.kind || 'local',
    playerName: player?.name || 'Player',
  };
}

export function getNextPlayerId(state: GameState) {
  const currentIndex = state.playerOrder.indexOf(state.currentPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.playerOrder.length;
  return state.playerOrder[nextIndex] || state.currentPlayerId;
}
