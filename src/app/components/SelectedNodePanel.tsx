import {
  SelectedGraphNodeView,
  getTurnHistoryRowScore,
  getTurnHistoryRowSourceTopicText,
} from '@/domain/game';

type SelectedNodePanelProps = {
  selectedGraphNode: SelectedGraphNodeView;
  selectedGraphNodeDefinition: string | null;
  definitionVisible: boolean;
  isLoadingDefinition: boolean;
  canToggleSource: boolean;
  isActiveSource: boolean;
  canRemoveActiveSource: boolean;
  onClear: () => void;
  onFetchDefinition: () => void | Promise<void>;
  onHideDefinition: () => void;
  onShowDefinition: () => void;
  onToggleSource: () => void;
};

export default function SelectedNodePanel({
  selectedGraphNode,
  selectedGraphNodeDefinition,
  definitionVisible,
  isLoadingDefinition,
  canToggleSource,
  isActiveSource,
  canRemoveActiveSource,
  onClear,
  onFetchDefinition,
  onHideDefinition,
  onShowDefinition,
  onToggleSource,
}: SelectedNodePanelProps) {
  return (
    <div className="p-3 bg-purple-50 rounded-lg mb-4 text-sm border border-purple-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-purple-900">{selectedGraphNode.title}</p>
          <p className="text-xs text-purple-700">{selectedGraphNode.subtitle}</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs px-2 py-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800"
        >
          Clear
        </button>
      </div>

      {selectedGraphNode.historyItem && (
        <div className="mt-2 text-gray-700">
          <p>Topic: {getTurnHistoryRowSourceTopicText(selectedGraphNode.historyItem)}</p>
          <p>Score: {getTurnHistoryRowScore(selectedGraphNode.historyItem).total}/20</p>
        </div>
      )}

      {selectedGraphNodeDefinition && definitionVisible ? (
        <div className="mt-3 pt-3 border-t border-purple-100">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="font-medium">Definition:</p>
            <button
              onClick={onHideDefinition}
              className="text-xs px-2 py-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800"
            >
              Hide
            </button>
          </div>
          <p>{selectedGraphNodeDefinition}</p>
        </div>
      ) : selectedGraphNodeDefinition ? (
        <button
          onClick={onShowDefinition}
          className="mt-3 text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full"
        >
          Show Definition
        </button>
      ) : (
        <button
          onClick={onFetchDefinition}
          disabled={isLoadingDefinition}
          className="mt-3 text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-full"
        >
          {isLoadingDefinition ? 'Loading definition...' : 'Get Definition'}
        </button>
      )}

      {canToggleSource && (
        <button
          onClick={onToggleSource}
          disabled={isActiveSource && !canRemoveActiveSource}
          className="mt-3 ml-2 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full"
        >
          {isActiveSource ? 'Remove Source' : 'Add Source'}
        </button>
      )}
    </div>
  );
}
