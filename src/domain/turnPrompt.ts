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
  isFinalCircleRound: boolean;
  currentSourceTopicText: string;
  originalTopic: string;
}) {
  if (params.isOpeningTurn) {
    return 'Choose the opening topic for this game and press Enter...';
  }

  return params.isFinalCircleRound
    ? `Type a brief response (1-5 words) that connects to both "${params.currentSourceTopicText}" and "${params.originalTopic}"...`
    : 'Type a brief response (1-5 words) and press Enter...';
}

export function canSubmitTurnResponse(params: {
  response: string;
  isEvaluating: boolean;
}) {
  return !params.isEvaluating && Boolean(params.response.trim());
}
