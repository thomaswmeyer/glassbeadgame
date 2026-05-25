import {
  GameState,
  Score,
  addOpeningTopicTurnToGameState,
  addTurnToGameState,
  createEmptyGameState,
  selectTurnHistoryRows,
  setGameStatus,
} from './game';
import {
  SourceTurnEvaluation,
  combineSourceScores,
  formatCombinedEvaluation,
  formatCombinedFinalEvaluation,
  normalizeScore,
} from './turnScoring';
import { SubjectCategoryId, normalizeSubjectCategoryId } from './subjectCategories';
import type { AiSourceSelectionMode } from './llmPrompts';

export type DifficultyLevel = 'secondary' | 'undergrad' | 'grad' | 'unlimited';

export type TurnEvaluation = {
  evaluation: string;
  finalEvaluation?: string;
  destinationSubjectCategory?: SubjectCategoryId;
  scores: Score;
  edgeEvaluations?: SourceTurnEvaluation[];
};

export type CurrentEvaluation = {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  playerId: string;
  destinationSubjectCategory?: SubjectCategoryId;
  finalEvaluation?: string;
};

export type GenerateTopicRequest = {
  difficulty: DifficultyLevel;
};

export type GeneratedTopic = {
  topic: string;
  subjectCategory?: SubjectCategoryId;
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
  availableNodes: {
    id: string;
    topic: string;
    definition?: string;
    subjectCategory?: string;
    isCurrentSource: boolean;
  }[];
  selectedSourceNodeIds: string[];
  sourceSelectionMode: AiSourceSelectionMode;
  originalTopic: string;
  difficulty: DifficultyLevel;
  circleEnabled: boolean;
  isFinalCircleRound: boolean;
  gameHistory: TurnContextHistoryItem[];
};

export type GameFlowServices = {
  generateTopic(request: GenerateTopicRequest): Promise<string | GeneratedTopic>;
  evaluateTurn(request: EvaluateTurnRequest): Promise<TurnEvaluation>;
  generateAiResponse(request: GenerateAiResponseRequest): Promise<string>;
};

function resolveGeneratedTopic(result: string | GeneratedTopic): GeneratedTopic {
  return typeof result === 'string' ? { topic: result } : result;
}

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
  const rootTopicResult = resolveGeneratedTopic(await params.services.generateTopic({
    difficulty: params.difficulty,
  }));

  return setGameStatus(addOpeningTopicTurnToGameState(createEmptyGameState(
    params.maxRounds,
    params.currentPlayerId
  ), {
    topic: rootTopicResult.topic,
    playerId: params.currentPlayerId,
    subjectCategory: rootTopicResult.subjectCategory,
  }), 'showingResults');
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
  const sourceNodes = params.state.activeSourceNodeIds
    .map(nodeId => params.state.nodesById[nodeId])
    .filter(Boolean);
  const topic = sourceNodes.map(node => node.topic).join(' + ');
  const isFinalCircleRound = params.state.currentRound === params.state.maxRounds && params.circleEnabled;
  const edgeEvaluations = await Promise.all(
    sourceNodes.map(async sourceNode => {
      const evaluation = await params.services.evaluateTurn({
        topic: sourceNode.topic,
        originalTopic: params.originalTopic,
        response: params.response,
        difficulty: params.difficulty,
        isFinalCircleRound,
      });

      return {
        sourceNodeId: sourceNode.id,
        sourceTopic: sourceNode.topic,
        evaluation: evaluation.evaluation,
        finalEvaluation: evaluation.finalEvaluation,
        destinationSubjectCategory: normalizeSubjectCategoryId(evaluation.destinationSubjectCategory),
        scores: normalizeScore(evaluation.scores),
      } satisfies SourceTurnEvaluation;
    })
  );
  const combinedScores = combineSourceScores(edgeEvaluations.map(edgeEvaluation => edgeEvaluation.scores));
  const combinedEvaluation = formatCombinedEvaluation(edgeEvaluations);
  const combinedFinalEvaluation = formatCombinedFinalEvaluation(edgeEvaluations);
  const destinationSubjectCategory = normalizeSubjectCategoryId(
    edgeEvaluations
      .map(edgeEvaluation => edgeEvaluation.destinationSubjectCategory)
      .find(Boolean)
  );

  const stateWithTurn = addTurnToGameState(params.state, {
    destinationTopic: params.response,
    playerId: params.playerId,
    sourceNodeIds: params.state.activeSourceNodeIds,
    evaluation: combinedEvaluation,
    finalEvaluation: combinedFinalEvaluation,
    totalScore: combinedScores.total,
    legacyScores: combinedScores,
    edgeEvaluations,
    destinationSubjectCategory,
    scoringDescription: combinedEvaluation,
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
      evaluation: combinedEvaluation,
      finalEvaluation: combinedFinalEvaluation,
      destinationSubjectCategory,
      scores: combinedScores,
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
    availableNodes: Object.values(params.state.nodesById).map(node => ({
      id: node.id,
      topic: node.topic,
      definition: node.definition,
      subjectCategory: node.subjectCategory,
      isCurrentSource: false,
    })),
    selectedSourceNodeIds: [],
    sourceSelectionMode: 'free',
    originalTopic: params.originalTopic,
    difficulty: params.difficulty,
    circleEnabled: params.circleEnabled,
    isFinalCircleRound: params.state.currentRound === params.state.maxRounds && params.circleEnabled,
    gameHistory: selectTurnContextHistory(params.state),
  });

  return response.trim() || `Response to ${topic}`;
}
