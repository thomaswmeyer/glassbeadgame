export function getTurnResponsePanelTitle(params: {
  isCurrentPlayerManual: boolean;
  isOpeningTurn?: boolean;
  playerName?: string | null;
}) {
  if (params.isOpeningTurn) {
    return params.isCurrentPlayerManual
      ? 'Choose Opening Topic:'
      : `${params.playerName || 'Player'} is choosing the opening topic...`;
  }

  return params.isCurrentPlayerManual
    ? 'Your Response:'
    : `${params.playerName || 'Player'} is thinking...`;
}

export function getTurnResponsePlaceholder(params: {
  isOpeningTurn?: boolean;
}) {
  if (params.isOpeningTurn) {
    return 'Choose the opening topic for this game and press Enter...';
  }

  return 'Type a brief response (1-5 words) and press Enter...';
}

export function canSubmitTurnResponse(params: {
  response: string;
  isEvaluating: boolean;
}) {
  return !params.isEvaluating && validateConceptLength(params.response).valid;
}

export function getTurnResponseValidationMessage(response: string) {
  if (!response.trim()) return '';

  return validateConceptLength(response).message || '';
}
import { validateConceptLength } from './conceptRules';
