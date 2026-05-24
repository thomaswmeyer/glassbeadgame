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
