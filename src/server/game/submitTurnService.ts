import {
  CurrentEvaluationView,
  GameState,
  Score,
  addOpeningTopicTurnToGameState,
  advanceGameTurn,
  getNextPlayerId,
  selectCurrentEvaluation,
} from '../../domain/game';
import {
  DifficultyLevel,
  GameFlowServices,
  SubmitTurnRequest,
  SubmitTurnResult,
  TurnEvaluation,
  evaluateAndApplyTurn,
} from '../../domain/gameFlow';
import { resolveSubmittedSourceNodeIds } from '../../domain/playerController';
import {
  SourceEnvironment,
  commitCompletedTurn,
} from './turnCommitService';

type SubmitTurnCommand = SubmitTurnRequest & {
  sourceEnvironment?: SourceEnvironment;
  services: Pick<GameFlowServices, 'evaluateTurn'>;
};

export class SubmitTurnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmitTurnValidationError';
  }
}

function invalidTurnSubmission(message: string): never {
  throw new SubmitTurnValidationError(message);
}

function fallbackEvaluation(): TurnEvaluation {
  const fallbackScores: Score = {
    semanticDistance: 5,
    relevanceQuality: 5,
    total: 25,
  };

  return {
    evaluation: "I couldn't evaluate this response properly. Here's a default score.",
    destinationSubjectCategory: 'science',
    scores: fallbackScores,
  };
}

function createEvaluationServices(params: {
  fallbackOnEvaluationFailure?: boolean;
  services: Pick<GameFlowServices, 'evaluateTurn'>;
}): Pick<GameFlowServices, 'evaluateTurn'> {
  return {
    async evaluateTurn(request) {
      let lastError: unknown;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await params.services.evaluateTurn(request);
        } catch (error) {
          lastError = error;
        }
      }

      if (params.fallbackOnEvaluationFailure) {
        return fallbackEvaluation();
      }

      throw lastError;
    },
  };
}

function assertCanSubmitTurn(state: GameState, playerId: string, responseText: string) {
  if (!state.playersById[playerId]) {
    invalidTurnSubmission(`Unknown submitting player: ${playerId}`);
  }

  if (state.currentPlayerId !== playerId) {
    invalidTurnSubmission(`It is not ${playerId}'s turn`);
  }

  if (!responseText.trim()) {
    invalidTurnSubmission('Submitted topic is required');
  }

  if (state.gameStatus !== 'awaitingResponse' && state.gameStatus !== 'aiThinking') {
    invalidTurnSubmission(`Cannot submit a turn while game status is ${state.gameStatus}`);
  }
}

function latestTurnId(state: GameState) {
  return state.turnOrder[state.turnOrder.length - 1];
}

function commitTurn(params: {
  gameId: string;
  state: GameState;
  committedTurnId: string;
  difficulty: DifficultyLevel;
  sourceEnvironment?: SourceEnvironment;
}) {
  commitCompletedTurn({
    gameId: params.gameId,
    state: params.state,
    turnId: params.committedTurnId,
    difficulty: params.difficulty,
    sourceEnvironment: params.sourceEnvironment,
  });
}

export async function submitTurn(command: SubmitTurnCommand): Promise<SubmitTurnResult> {
  const responseText = command.responseText.trim();
  assertCanSubmitTurn(command.state, command.playerId, responseText);

  if (!command.state.rootNodeId) {
    const stateWithOpeningTopic = addOpeningTopicTurnToGameState(command.state, {
      topic: responseText,
      playerId: command.playerId,
      subjectCategory: command.destinationSubjectCategory,
    });
    const committedTurnId = latestTurnId(stateWithOpeningTopic);
    const advancedState = advanceGameTurn(stateWithOpeningTopic, getNextPlayerId(stateWithOpeningTopic), {
      incrementRound: false,
    });

    commitTurn({
      gameId: command.gameId,
      state: advancedState,
      committedTurnId,
      difficulty: command.difficulty,
      sourceEnvironment: command.sourceEnvironment,
    });

    return {
      state: advancedState,
      committedTurnId,
      inlineEvaluation: null,
    };
  }

  const selectedSourceNodeIds = resolveSubmittedSourceNodeIds(
    {
      nodesById: command.state.nodesById,
      activeSourceNodeIds: command.state.activeSourceNodeIds,
    },
    { selectedSourceNodeIds: command.selectedSourceNodeIds }
  );

  const evaluationState: GameState = {
    ...command.state,
    activeSourceNodeIds: selectedSourceNodeIds,
    selectedNodeIds: selectedSourceNodeIds,
    gameStatus: 'evaluating',
  };
  const result = await evaluateAndApplyTurn({
    state: evaluationState,
    response: responseText,
    playerId: command.playerId,
    difficulty: command.difficulty,
    services: createEvaluationServices({
      fallbackOnEvaluationFailure: command.fallbackOnEvaluationFailure,
      services: command.services,
    }),
  });
  const committedTurnId = latestTurnId(result.state);
  const resultEvaluation = selectCurrentEvaluation(result.state);
  let stateToReturn = result.state;
  let inlineEvaluation: CurrentEvaluationView | null = null;

  if (command.advanceAfterScoring && result.state.gameStatus !== 'completed') {
    inlineEvaluation = resultEvaluation;
    stateToReturn = advanceGameTurn(result.state, getNextPlayerId(result.state));
  }

  commitTurn({
    gameId: command.gameId,
    state: stateToReturn,
    committedTurnId,
    difficulty: command.difficulty,
    sourceEnvironment: command.sourceEnvironment,
  });

  return {
    state: stateToReturn,
    committedTurnId,
    inlineEvaluation,
  };
}
