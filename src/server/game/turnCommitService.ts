import { GameState } from '@/domain/game';
import { saveGameSnapshot } from '../persistence/gameSnapshotRepository';

type SourceEnvironment = 'local' | 'test' | 'render_prod' | 'render_preview' | 'imported' | 'external';
type Difficulty = 'secondary' | 'undergrad' | 'grad' | 'unlimited';

export type CommitCompletedTurnCommand = {
  gameId: string;
  state: GameState;
  turnId: string;
  difficulty: Difficulty;
  sourceEnvironment?: SourceEnvironment;
};

export class CommittedTurnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommittedTurnValidationError';
  }
}

function invalidCommittedTurn(message: string): never {
  throw new CommittedTurnValidationError(message);
}

function assertValidCommittedTurn(state: GameState, turnId: string) {
  const turn = state.turnsById[turnId];
  if (!turn) {
    invalidCommittedTurn(`Unknown committed turn: ${turnId}`);
  }

  if (!state.turnOrder.includes(turnId)) {
    invalidCommittedTurn(`Committed turn is not in turn order: ${turnId}`);
  }

  const destinationNode = state.nodesById[turn.destinationNodeId];
  if (!destinationNode) {
    invalidCommittedTurn(`Committed turn destination node is missing: ${turn.destinationNodeId}`);
  }

  const isOpeningTurn = turn.round === 0 && turn.sourceNodeIds.length === 0 && turn.edgeIds.length === 0;
  if (isOpeningTurn) return;

  if (turn.sourceNodeIds.length === 0) {
    invalidCommittedTurn('Committed scored turn must include at least one source node');
  }

  if (turn.edgeIds.length !== turn.sourceNodeIds.length) {
    invalidCommittedTurn('Committed scored turn must include one edge for each source node');
  }

  if (typeof turn.totalScore !== 'number' || !turn.legacyScores) {
    invalidCommittedTurn('Committed scored turn must include applied scores');
  }

  const turnSourceNodeIds = new Set(turn.sourceNodeIds);
  const edgeSourceNodeIds = new Set<string>();

  turn.sourceNodeIds.forEach(sourceNodeId => {
    if (!state.nodesById[sourceNodeId]) {
      invalidCommittedTurn(`Committed turn source node is missing: ${sourceNodeId}`);
    }
  });

  turn.edgeIds.forEach(edgeId => {
    const edge = state.edgesById[edgeId];
    if (!edge) {
      invalidCommittedTurn(`Committed turn edge is missing: ${edgeId}`);
    }
    if (edge.turnId !== turn.id) {
      invalidCommittedTurn(`Committed turn edge belongs to a different turn: ${edgeId}`);
    }
    if (edge.destinationNodeId !== turn.destinationNodeId) {
      invalidCommittedTurn(`Committed turn edge destination mismatch: ${edgeId}`);
    }
    if (!turnSourceNodeIds.has(edge.sourceNodeId)) {
      invalidCommittedTurn(`Committed turn edge source mismatch: ${edgeId}`);
    }
    edgeSourceNodeIds.add(edge.sourceNodeId);
  });

  turn.sourceNodeIds.forEach(sourceNodeId => {
    if (!edgeSourceNodeIds.has(sourceNodeId)) {
      invalidCommittedTurn(`Committed turn source has no matching edge: ${sourceNodeId}`);
    }
  });
}

export function commitCompletedTurn(command: CommitCompletedTurnCommand) {
  assertValidCommittedTurn(command.state, command.turnId);

  return saveGameSnapshot({
    gameId: command.gameId,
    state: command.state,
    difficulty: command.difficulty,
    sourceEnvironment: command.sourceEnvironment,
  });
}
