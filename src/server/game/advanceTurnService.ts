import {
  advanceGameTurn,
  getNextPlayerId,
  selectCurrentEvaluation,
} from '../../domain/game';
import { AdvanceTurnResult } from '../../domain/gameFlow';
import {
  loadGameSnapshot,
  saveGameSnapshot,
} from '../persistence/gameSnapshotRepository';
import { SourceEnvironment } from './turnCommitService';

type AdvanceTurnCommand = {
  gameId: string;
  sourceEnvironment?: SourceEnvironment;
};

export class AdvanceTurnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvanceTurnValidationError';
  }
}

function invalidAdvance(message: string): never {
  throw new AdvanceTurnValidationError(message);
}

export function advancePersistedTurn(command: AdvanceTurnCommand): AdvanceTurnResult {
  const snapshot = loadGameSnapshot(command.gameId);
  if (!snapshot) {
    invalidAdvance(`Unknown game: ${command.gameId}`);
  }

  const state = snapshot.state;
  if (state.gameStatus === 'completed') {
    invalidAdvance('Cannot advance a completed game');
  }

  const currentEvaluation = selectCurrentEvaluation(state);
  if (!currentEvaluation) {
    invalidAdvance(`Cannot advance while game status is ${state.gameStatus}`);
  }

  const advancedState = advanceGameTurn(state, getNextPlayerId(state), {
    incrementRound: !currentEvaluation.isOpeningTurn,
  });

  saveGameSnapshot({
    gameId: command.gameId,
    state: advancedState,
    difficulty: snapshot.difficulty,
    sourceEnvironment: command.sourceEnvironment,
  });

  return {
    gameId: command.gameId,
    state: advancedState,
  };
}
