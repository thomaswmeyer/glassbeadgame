export type PlayerKind = 'local' | 'ai';

export type Score = {
  semanticDistance: number;
  relevanceQuality: number;
  total: number;
  originalTopicConnection?: number;
  currentConnection?: {
    semanticDistance: number;
    similarity: number;
    subtotal: number;
  };
  originalConnection?: {
    semanticDistance: number;
    similarity: number;
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

export type TopicEdge = {
  id: string;
  sourceNodeId: string;
  destinationNodeId: string;
  playerId: string;
  turnId: string;
  strengthScore?: number;
  semanticDistanceScore?: number;
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
};

export type SelectedNodePanel = {
  node: TopicNode;
  player?: Player;
  createdTurn?: Turn;
};

export type TurnHistoryRow = {
  turn: Turn;
  player: Player;
  sourceNodes: TopicNode[];
  destinationNode: TopicNode;
};

export type CurrentEvaluationView = {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  playerId: string;
  playerKind: PlayerKind;
  playerName: string;
  finalEvaluation?: string;
};

export type PlayerScoreRow = {
  player: Player;
  totalScore: number;
  isCurrentPlayer: boolean;
};

export type LegacyGameHistoryItem = {
  round: number;
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  player: 'human' | 'ai';
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
  }
): GameState {
  const turnIndex = state.turnOrder.length;
  const turnId = `turn-${turnIndex}`;
  const destinationNodeId = `node-${turnIndex + 1}`;
  const sourceNodeIds = params.sourceNodeIds.length > 0 ? params.sourceNodeIds : state.activeSourceNodeIds;
  const edgeIds = sourceNodeIds.map((sourceNodeId, index) => `edge-${turnIndex}-${index}`);

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
      const edge: TopicEdge = {
        id: edgeIds[index],
        sourceNodeId,
        destinationNodeId,
        playerId: params.playerId,
        turnId,
        semanticDistanceScore: params.legacyScores?.semanticDistance,
        strengthScore: params.legacyScores?.relevanceQuality,
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
    })),
  };
}

export function selectSelectedNodePanels(state: GameState): SelectedNodePanel[] {
  return state.selectedNodeIds
    .map(nodeId => state.nodesById[nodeId])
    .filter((node): node is TopicNode => Boolean(node))
    .map(node => ({
      node,
      player: node.createdByPlayerId ? state.playersById[node.createdByPlayerId] : undefined,
      createdTurn: node.createdTurnId ? state.turnsById[node.createdTurnId] : undefined,
    }));
}

export function selectTurnHistoryRows(state: GameState): TurnHistoryRow[] {
  return state.turnOrder.map(turnId => {
    const turn = state.turnsById[turnId];
    return {
      turn,
      player: state.playersById[turn.playerId],
      sourceNodes: turn.sourceNodeIds.map(nodeId => state.nodesById[nodeId]).filter(Boolean),
      destinationNode: state.nodesById[turn.destinationNodeId],
    };
  });
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
    playerId: turn.playerId,
    playerKind: player?.kind || 'local',
    playerName: player?.name || 'Player',
  };
}

export function selectLegacyGameHistory(state: GameState): LegacyGameHistoryItem[] {
  return state.turnOrder.map(turnId => {
    const turn = state.turnsById[turnId];
    const destinationNode = state.nodesById[turn.destinationNodeId];
    const firstSourceNode = state.nodesById[turn.sourceNodeIds[0]];
    const player = state.playersById[turn.playerId];

    return {
      round: turn.round,
      topic: firstSourceNode?.topic || '',
      response: destinationNode?.topic || '',
      evaluation: turn.evaluation || '',
      scores: turn.legacyScores || {
        semanticDistance: 0,
        relevanceQuality: 0,
        total: turn.totalScore || 0,
      },
      player: player?.kind === 'ai' ? 'ai' : 'human',
    };
  });
}

export function getNextPlayerId(state: GameState) {
  const currentIndex = state.playerOrder.indexOf(state.currentPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.playerOrder.length;
  return state.playerOrder[nextIndex] || state.currentPlayerId;
}
