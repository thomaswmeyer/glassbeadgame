export function getDefinitionButtonLabel(params: {
  isLoading: boolean;
  isDefinitionVisible: boolean;
  visibleLabel?: string;
  hiddenLabel?: string;
}) {
  if (params.isLoading) return 'Loading...';

  return params.isDefinitionVisible
    ? params.visibleLabel || 'Hide Definition'
    : params.hiddenLabel || 'Definition';
}

export function getRoundBadgeText(params: {
  currentRound: number;
  maxRounds: number;
  circleEnabled: boolean;
  originalTopic: string;
}) {
  if (params.currentRound === 1) return 'Starting Topic';
  if (params.currentRound !== params.maxRounds) return null;

  return params.circleEnabled
    ? `Final Round - Connect back to "${params.originalTopic}"`
    : 'Final Round';
}

