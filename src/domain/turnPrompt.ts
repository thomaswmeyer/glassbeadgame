export function getTurnResponsePanelTitle(params: {
  isCurrentPlayerManual: boolean;
  playerName?: string | null;
}) {
  return params.isCurrentPlayerManual
    ? 'Your Response:'
    : `${params.playerName || 'Player'} is thinking...`;
}

export function getTurnResponsePlaceholder(params: {
  isFinalCircleRound: boolean;
  currentSourceTopicText: string;
  originalTopic: string;
}) {
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

