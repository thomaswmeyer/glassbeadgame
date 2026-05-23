import {
  DEFAULT_AI_PLAYER_ID,
  GameState,
  Score,
  addTurnToGameState,
  selectTurnHistoryRows,
  setGameStatus,
  startGameState,
} from './game';

export type DifficultyLevel = 'secondary' | 'undergrad' | 'grad' | 'unlimited';

export type TurnEvaluation = {
  evaluation: string;
  finalEvaluation?: string;
  scores: Score;
};

export type CurrentEvaluation = {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  playerId: string;
  finalEvaluation?: string;
};

export type GenerateTopicRequest = {
  difficulty: DifficultyLevel;
};

export type EvaluateTurnRequest = {
  topic: string;
  originalTopic: string;
  response: string;
  difficulty: DifficultyLevel;
  isFinalCircleRound: boolean;
};

export type TurnContextHistoryItem = {
  round: number;
  sourceTopics: string[];
  destinationTopic: string;
  evaluation: string;
  scores: Score;
  playerId: string;
  playerName: string;
  playerKind: 'local' | 'ai';
};

export type GenerateAiResponseRequest = {
  topic: string;
  originalTopic: string;
  difficulty: DifficultyLevel;
  circleEnabled: boolean;
  isFinalCircleRound: boolean;
  gameHistory: TurnContextHistoryItem[];
};

export type GameFlowServices = {
  generateTopic(request: GenerateTopicRequest): Promise<string>;
  evaluateTurn(request: EvaluateTurnRequest): Promise<TurnEvaluation>;
  generateAiResponse(request: GenerateAiResponseRequest): Promise<string>;
};

export function selectCurrentSourceTopicText(state: GameState) {
  const activeSourceNodes = state.activeSourceNodeIds
    .map(nodeId => state.nodesById[nodeId])
    .filter(Boolean);

  return activeSourceNodes.map(node => node.topic).join(' + ');
}

export function selectRootTopic(state: GameState) {
  return state.rootNodeId ? state.nodesById[state.rootNodeId]?.topic || '' : '';
}

export function selectTurnContextHistory(state: GameState): TurnContextHistoryItem[] {
  return selectTurnHistoryRows(state).map(row => ({
    round: row.turn.round,
    sourceTopics: row.sourceNodes.map(node => node.topic),
    destinationTopic: row.destinationNode.topic,
    evaluation: row.turn.evaluation || '',
    scores: row.turn.legacyScores || {
      semanticDistance: 0,
      relevanceQuality: 0,
      total: row.turn.totalScore || 0,
    },
    playerId: row.player.id,
    playerName: row.player.name,
    playerKind: row.player.kind,
  }));
}

export async function startGeneratedGame(params: {
  maxRounds: number;
  currentPlayerId: string;
  rootCreatedByPlayerId?: string;
  difficulty: DifficultyLevel;
  services: Pick<GameFlowServices, 'generateTopic'>;
}) {
  const rootTopic = await params.services.generateTopic({
    difficulty: params.difficulty,
  });

  return startGameState({
    rootTopic,
    maxRounds: params.maxRounds,
    currentPlayerId: params.currentPlayerId,
    rootCreatedByPlayerId: params.rootCreatedByPlayerId || DEFAULT_AI_PLAYER_ID,
  });
}

export async function evaluateAndApplyTurn(params: {
  state: GameState;
  response: string;
  playerId: string;
  originalTopic: string;
  difficulty: DifficultyLevel;
  circleEnabled: boolean;
  services: Pick<GameFlowServices, 'evaluateTurn'>;
}) {
  const topic = selectCurrentSourceTopicText(params.state);
  const evaluation = await params.services.evaluateTurn({
    topic,
    originalTopic: params.originalTopic,
    response: params.response,
    difficulty: params.difficulty,
    isFinalCircleRound: params.state.currentRound === params.state.maxRounds && params.circleEnabled,
  });

  const stateWithTurn = addTurnToGameState(params.state, {
    destinationTopic: params.response,
    playerId: params.playerId,
    sourceNodeIds: params.state.activeSourceNodeIds,
    evaluation: evaluation.evaluation,
    finalEvaluation: evaluation.finalEvaluation,
    totalScore: evaluation.scores.total,
    legacyScores: evaluation.scores,
    scoringDescription: evaluation.evaluation,
  });

  const nextStatus = params.state.currentRound === params.state.maxRounds
    ? 'completed'
    : 'showingResults';

  return {
    state: setGameStatus(stateWithTurn, nextStatus),
    currentEvaluation: {
      topic,
      response: params.response,
      playerId: params.playerId,
      evaluation: evaluation.evaluation,
      finalEvaluation: evaluation.finalEvaluation,
      scores: evaluation.scores,
    } satisfies CurrentEvaluation,
  };
}

export async function generateAiResponseForCurrentTurn(params: {
  state: GameState;
  originalTopic: string;
  difficulty: DifficultyLevel;
  circleEnabled: boolean;
  services: Pick<GameFlowServices, 'generateAiResponse'>;
}) {
  const topic = selectCurrentSourceTopicText(params.state);
  const response = await params.services.generateAiResponse({
    topic,
    originalTopic: params.originalTopic,
    difficulty: params.difficulty,
    circleEnabled: params.circleEnabled,
    isFinalCircleRound: params.state.currentRound === params.state.maxRounds && params.circleEnabled,
    gameHistory: selectTurnContextHistory(params.state),
  });

  return response.trim() || `Response to ${topic}`;
}
