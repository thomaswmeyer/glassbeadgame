import { ActiveSourceRow, PlayerScoreRow } from '@/domain/game';
import { getDefinitionButtonLabel } from '@/domain/topicDisplay';
import { getPlayerBadgeClass } from './TurnHistoryTable';
import { GameVisualTheme, cx, isBeadTableTheme } from './gameVisualTheme';

type CurrentTurnSourcesPanelProps = {
  visualTheme?: GameVisualTheme;
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
  visualTheme,
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
  const useBeadTableTheme = isBeadTableTheme(visualTheme);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center gap-3 mb-3">
        <h2 className={cx(
          'text-xl font-semibold',
          useBeadTableTheme && 'gbg-small-caps font-serif text-[#2d1d12]'
        )}>
          {heading}
        </h2>
        <div className="flex items-center gap-4">
          <span className={cx(
            'text-sm',
            useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-500'
          )}>
            Round {currentRound}/{maxRounds}
          </span>
          <div className="flex gap-2">
            {playerScoreRows.map(scoreRow => (
              <span
                key={scoreRow.player.id}
                className={cx(
                  'text-sm font-medium px-3 py-1 rounded-full',
                  getPlayerBadgeClass(scoreRow.player.kind, visualTheme)
                )}
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
            <section
              key={node.id}
              className={cx(
                'border-b pb-3 last:border-b-0',
                useBeadTableTheme ? 'border-[#c7ad75]' : 'border-gray-200'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cx(
                    'text-xl font-medium break-words',
                    useBeadTableTheme && 'gbg-small-caps font-serif text-[#20150d]'
                  )}>
                    {isGeneratingTopic ? (
                      <span className="flex items-center">
                        <LoadingSpinner className={cx(
                          '-ml-1 mr-2 h-4 w-4',
                          useBeadTableTheme ? 'text-[#8f5b23]' : 'text-blue-600'
                        )} />
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
                      className={cx(
                        'text-xs px-2 py-1 rounded-full disabled:text-gray-400',
                        useBeadTableTheme
                          ? 'border border-[#b99a58] bg-[#f9efd4] text-[#4a321d] hover:bg-[#fff6dd] disabled:bg-[#ead8ad]'
                          : 'bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700'
                      )}
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
                      className={cx(
                        'h-6 w-6 rounded-full disabled:text-gray-400 leading-none',
                        useBeadTableTheme
                          ? 'border border-[#b99a58] bg-[#f9efd4] text-[#4a321d] hover:bg-[#fff6dd] disabled:bg-[#ead8ad]'
                          : 'bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700'
                      )}
                      title="Remove source"
                    >
                      -
                    </button>
                  )}
                </div>
              </div>

              {node.definition && (
                <div className={cx(
                  'mt-3 rounded border p-3 text-sm',
                  useBeadTableTheme
                    ? 'border-[#d2ba82] bg-[#f8edcf] text-[#2b2118] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]'
                    : 'border-transparent text-gray-800'
                )}>
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
