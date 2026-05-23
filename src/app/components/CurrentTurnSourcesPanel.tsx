import { ActiveSourceRow } from '@/domain/game';

type CurrentTurnSourcesPanelProps = {
  activeSourceRows: ActiveSourceRow[];
  onRemoveSource: (nodeId: string) => void;
};

export default function CurrentTurnSourcesPanel({
  activeSourceRows,
  onRemoveSource,
}: CurrentTurnSourcesPanelProps) {
  if (activeSourceRows.length === 0) return null;

  return (
    <div className="p-3 bg-green-50 rounded-lg mb-4 text-sm border border-green-100">
      <p className="font-medium text-green-900 mb-2">Current turn sources</p>
      <div className="flex flex-wrap gap-2">
        {activeSourceRows.map(({ node, canRemoveSource }) => (
          <span key={node.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white border border-green-200 text-green-900">
            {node.topic}
            {canRemoveSource && (
              <button
                onClick={() => onRemoveSource(node.id)}
                className="h-5 w-5 rounded-full bg-green-100 hover:bg-green-200 text-green-900 leading-none"
                title="Remove source"
              >
                -
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

