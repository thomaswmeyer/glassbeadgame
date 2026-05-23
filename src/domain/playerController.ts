import {
  GameState,
  Player,
} from './game';
import { DifficultyLevel, TurnContextHistoryItem } from './gameFlow';

export type PlayerControllerMode = 'manual' | 'automatic';

export type PlayerTurnContext = {
  state: GameState;
  player: Player;
  topic: string;
  originalTopic: string;
  difficulty: DifficultyLevel;
  circleEnabled: boolean;
  isFinalCircleRound: boolean;
  gameHistory: TurnContextHistoryItem[];
};

export type PlayerTurnSubmission = {
  responseText: string;
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

export function createTurnExecutionKey(state: GameState) {
  return `${state.currentRound}:${state.currentPlayerId}:${state.turnOrder.length}`;
}
