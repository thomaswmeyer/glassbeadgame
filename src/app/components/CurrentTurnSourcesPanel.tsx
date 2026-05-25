import { ActiveSourceRow, PlayerScoreRow } from '@/domain/game';
import { getDefinitionButtonLabel } from '@/domain/topicDisplay';
import { getPlayerBadgeClass } from './TurnHistoryTable';

type CurrentTurnSourcesPanelProps = {
  activeSourceRows: ActiveSourceRow[];
  currentRound: number;
  maxRounds: number;
  playerScoreRows: PlayerScoreRow[];
  isGeneratingTopic: boolean;
  isSourceSelectionLocked: boolean;
  isDefinitionLoading: (nodeId: string) => boolean;
  onFetchDefinition: (nodeId: string, topic: string) => void | Promise<unknown>;
  onRemoveSource: (nodeId: string) => void;
};

function LoadingSpinner({ className }: { className: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

export default function CurrentTurnSourcesPanel({
  activeSourceRows,
  currentRound,
  maxRounds,
  playerScoreRows,
  isGeneratingTopic,
  isSourceSelectionLocked,
  isDefinitionLoading,
  onFetchDefinition,
  onRemoveSource,
}: CurrentTurnSourcesPanelProps) {
  if (activeSourceRows.length === 0) return null;
  const heading = activeSourceRows.length === 1 ? 'Selected topic' : 'Selected topics';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center gap-3 mb-3">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Round {currentRound}/{maxRounds}</span>
          <div className="flex gap-2">
            {playerScoreRows.map(scoreRow => (
              <span
                key={scoreRow.player.id}
                className={`text-sm font-medium px-3 py-1 rounded-full ${getPlayerBadgeClass(scoreRow.player.kind)}`}
              >
                {scoreRow.player.name}: {scoreRow.totalScore}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {activeSourceRows.map(({ node, canRemoveSource }) => {
          const loadingDefinition = isDefinitionLoading(node.id);

          return (
            <section key={node.id} className="border-b border-gray-200 pb-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-medium break-words">
                    {isGeneratingTopic ? (
                      <span className="flex items-center">
                        <LoadingSpinner className="-ml-1 mr-2 h-4 w-4 text-blue-600" />
                        Generating new topic...
                      </span>
                    ) : (
                      node.topic
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!node.definition && (
                    <button
                      onClick={() => onFetchDefinition(node.id, node.topic)}
                      disabled={loadingDefinition || isGeneratingTopic}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-full text-gray-700"
                    >
                      {getDefinitionButtonLabel({
                        isLoading: loadingDefinition,
                        isDefinitionVisible: false,
                      })}
                    </button>
                  )}

                  {canRemoveSource && (
                    <button
                      onClick={() => onRemoveSource(node.id)}
                      disabled={isSourceSelectionLocked}
                      className="h-6 w-6 rounded-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 leading-none"
                      title="Remove source"
                    >
                      -
                    </button>
                  )}
                </div>
              </div>

              {node.definition && (
                <div className="mt-3 text-sm text-gray-800">
                  <p className="font-medium mb-1">Definition:</p>
                  <p>{node.definition}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
