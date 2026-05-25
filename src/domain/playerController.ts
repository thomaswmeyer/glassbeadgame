import {
  GameState,
  Player,
  TopicNode,
} from './game';
import { DifficultyLevel, TurnContextHistoryItem } from './gameFlow';
import { SubjectCategoryId } from './subjectCategories';

export type PlayerControllerMode = 'manual' | 'automatic';

export type PlayerTurnContext = {
  state: GameState;
  player: Player;
  topic: string;
  availableNodes: TopicNode[];
  selectedSourceNodeIds: string[];
  difficulty: DifficultyLevel;
  gameHistory: TurnContextHistoryItem[];
};

export type PlayerTurnSubmission = {
  responseText: string;
  destinationSubjectCategory?: SubjectCategoryId;
  selectedSourceNodeIds?: string[];
  fallbackOnEvaluationFailure?: boolean;
  clearResponseOnSuccess?: boolean;
};

export type PlayerTurnController = {
  playerId: string;
  mode: PlayerControllerMode;
  submitTurn?: (context: PlayerTurnContext) => Promise<PlayerTurnSubmission>;
};

export function createDefaultPlayerController(player: Player): PlayerTurnController {
  return {
    playerId: player.id,
    mode: player.kind === 'local' ? 'manual' : 'automatic',
  };
}

export function resolvePlayerController(
  player: Player,
  controllers: PlayerTurnController[]
): PlayerTurnController {
  return controllers.find(controller => controller.playerId === player.id)
    || createDefaultPlayerController(player);
}

export function shouldAutoSubmitTurn(
  state: GameState,
  player: Player,
  controller: PlayerTurnController
) {
  return (
    state.gameStatus === 'awaitingResponse' &&
    controller.playerId === player.id &&
    controller.mode === 'automatic' &&
    typeof controller.submitTurn === 'function'
  );
}

export function resolveSubmittedSourceNodeIds(
  state: Pick<GameState, 'nodesById' | 'activeSourceNodeIds'>,
  submission: Pick<PlayerTurnSubmission, 'selectedSourceNodeIds'>
) {
  const validNodeIds = (submission.selectedSourceNodeIds || [])
    .filter((nodeId, index, nodeIds) => Boolean(state.nodesById[nodeId]) && nodeIds.indexOf(nodeId) === index);

  return validNodeIds.length > 0 ? validNodeIds : state.activeSourceNodeIds;
}

export function createTurnExecutionKey(state: GameState) {
  return `${state.currentRound}:${state.currentPlayerId}:${state.turnOrder.length}`;
}
