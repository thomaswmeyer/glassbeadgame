import { PlayerScoreRow } from '@/domain/game';
import {
  getDefinitionButtonLabel,
  getRoundBadgeText,
} from '@/domain/topicDisplay';
import { getPlayerBadgeClass } from './TurnHistoryTable';

type CurrentTopicPanelProps = {
  currentRound: number;
  maxRounds: number;
  circleEnabled: boolean;
  originalTopic: string;
  currentSourceTopicText: string;
  hasBranchedSourceSelection: boolean;
  playerScoreRows: PlayerScoreRow[];
  isGeneratingTopic: boolean;
  currentTopicDefinition: string | null;
  currentTopicDefinitionVisible: boolean;
  currentTopicDefinitionAvailable: boolean;
  isLoadingCurrentTopicDefinition: boolean;
  originalTopicDefinition: string | null;
  originalTopicDefinitionVisible: boolean;
  originalTopicDefinitionAvailable: boolean;
  isLoadingOriginalTopicDefinition: boolean;
  onCurrentTopicDefinitionClick: () => void;
  onOriginalTopicDefinitionClick: () => void;
};

function LoadingSpinner({ className }: { className: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

function InfoIcon({ className }: { className: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function CurrentTopicPanel({
  currentRound,
  maxRounds,
  circleEnabled,
  originalTopic,
  currentSourceTopicText,
  hasBranchedSourceSelection,
  playerScoreRows,
  isGeneratingTopic,
  currentTopicDefinition,
  currentTopicDefinitionVisible,
  currentTopicDefinitionAvailable,
  isLoadingCurrentTopicDefinition,
  originalTopicDefinition,
  originalTopicDefinitionVisible,
  originalTopicDefinitionAvailable,
  isLoadingOriginalTopicDefinition,
  onCurrentTopicDefinitionClick,
  onOriginalTopicDefinitionClick,
}: CurrentTopicPanelProps) {
  const roundBadgeText = getRoundBadgeText({
    currentRound,
    maxRounds,
    circleEnabled,
    originalTopic,
  });
  const isFinalCircleRound = currentRound === maxRounds && circleEnabled;

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <h2 className="text-xl font-semibold mr-2">Topic:</h2>
          {roundBadgeText && (
            <span className={`text-xs px-2 py-1 rounded-full ${currentRound === 1 ? 'bg-yellow-100' : circleEnabled ? 'bg-red-100' : 'bg-orange-100'}`}>
              {roundBadgeText}
            </span>
          )}
          {hasBranchedSourceSelection && (
            <span className="text-xs bg-purple-100 px-2 py-1 rounded-full ml-2">Custom Selected Topic</span>
          )}
        </div>
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

      <div className="p-4 bg-gray-100 rounded-lg mb-2">
        <div className="flex items-center justify-between">
          <p className="text-xl font-medium">
            {isGeneratingTopic ? (
              <span className="flex items-center">
                <LoadingSpinner className="-ml-1 mr-2 h-4 w-4 text-blue-600" />
                Generating new topic...
              </span>
            ) : (
              currentSourceTopicText
            )}
          </p>
          <button
            onClick={onCurrentTopicDefinitionClick}
            disabled={!currentTopicDefinitionAvailable || isLoadingCurrentTopicDefinition || isGeneratingTopic}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 flex items-center"
            title={currentTopicDefinitionAvailable ? 'Show definition' : 'Definitions are available for a single selected source'}
          >
            {isLoadingCurrentTopicDefinition ? (
              <span className="flex items-center">
                <LoadingSpinner className="-ml-1 mr-2 h-3 w-3 text-gray-700" />
                {getDefinitionButtonLabel({
                  isLoading: isLoadingCurrentTopicDefinition,
                  isDefinitionVisible: currentTopicDefinitionVisible,
                })}
              </span>
            ) : (
              <span className="flex items-center">
                <InfoIcon className="h-3 w-3 mr-1" />
                {getDefinitionButtonLabel({
                  isLoading: isLoadingCurrentTopicDefinition,
                  isDefinitionVisible: currentTopicDefinitionVisible,
                })}
              </span>
            )}
          </button>
        </div>
      </div>

      {currentTopicDefinitionVisible && currentTopicDefinition && (
        <div className="p-3 bg-blue-50 rounded-lg mb-4 text-sm">
          <p className="font-medium mb-1">Definition:</p>
          <p>{currentTopicDefinition}</p>
        </div>
      )}

      {isFinalCircleRound && (
        <div className="p-3 bg-yellow-50 rounded-lg mb-4 text-sm">
          <p className="font-medium mb-1">Final Round Instructions:</p>
          <p>This is the final round! Your response should connect both to the current topic &quot;{currentSourceTopicText}&quot; AND back to the original topic &quot;{originalTopic}&quot;.</p>

          <div className="mt-2 flex justify-end">
            <button
              onClick={onOriginalTopicDefinitionClick}
              disabled={!originalTopicDefinitionAvailable || isLoadingOriginalTopicDefinition}
              className="text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded-full text-yellow-800 flex items-center"
              title="Show original topic definition"
            >
              {isLoadingOriginalTopicDefinition ? (
                <span className="flex items-center">
                  <LoadingSpinner className="-ml-1 mr-2 h-3 w-3 text-yellow-800" />
                  {getDefinitionButtonLabel({
                    isLoading: isLoadingOriginalTopicDefinition,
                    isDefinitionVisible: originalTopicDefinitionVisible,
                    hiddenLabel: 'Original Topic Definition',
                    visibleLabel: 'Hide Original Topic Definition',
                  })}
                </span>
              ) : (
                <span className="flex items-center">
                  <InfoIcon className="h-3 w-3 mr-1" />
                  {getDefinitionButtonLabel({
                    isLoading: isLoadingOriginalTopicDefinition,
                    isDefinitionVisible: originalTopicDefinitionVisible,
                    hiddenLabel: 'Original Topic Definition',
                    visibleLabel: 'Hide Original Topic Definition',
                  })}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {originalTopicDefinitionVisible && originalTopicDefinition && (
        <div className="p-3 bg-yellow-100 rounded-lg mb-4 text-sm">
          <p className="font-medium mb-1">Original Topic Definition (&quot;{originalTopic}&quot;):</p>
          <p>{originalTopicDefinition}</p>
        </div>
      )}
    </>
  );
}

