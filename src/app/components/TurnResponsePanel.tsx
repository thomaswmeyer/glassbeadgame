import { KeyboardEvent } from 'react';
import {
  canSubmitTurnResponse,
  getTurnResponsePanelTitle,
  getTurnResponsePlaceholder,
} from '@/domain/turnPrompt';

type TurnResponsePanelProps = {
  isCurrentPlayerManual: boolean;
  isOpeningTurn: boolean;
  playerName?: string | null;
  response: string;
  isEvaluating: boolean;
  hasBranchedSourceSelection: boolean;
  onResponseChange: (response: string) => void;
  onSubmit: () => void;
};

export default function TurnResponsePanel({
  isCurrentPlayerManual,
  isOpeningTurn,
  playerName,
  response,
  isEvaluating,
  hasBranchedSourceSelection,
  onResponseChange,
  onSubmit,
}: TurnResponsePanelProps) {
  const canSubmit = canSubmitTurnResponse({ response, isEvaluating });

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">
        {getTurnResponsePanelTitle({ isCurrentPlayerManual, isOpeningTurn, playerName })}
      </h2>

      {isCurrentPlayerManual ? (
        <>
          <input
            type="text"
            value={response}
            onChange={(event) => onResponseChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-4 border border-gray-300 rounded-lg"
            placeholder={getTurnResponsePlaceholder({
              isOpeningTurn,
            })}
            disabled={isEvaluating}
            autoFocus
          />
          <p className="text-sm text-gray-500 mt-1">
            {isOpeningTurn
              ? 'Pick a concise concept to seed the board. No points are awarded for the opening topic.'
              : 'Keep your response concise (1-5 words) for best results. The quality of the conceptual connection is what matters.'}
            {!isOpeningTurn && hasBranchedSourceSelection && (
              <span className="text-purple-600 ml-1">
                You&apos;re responding to selected graph sources.
              </span>
            )}
          </p>
          <div className="flex justify-end mt-2">
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
            >
              {isEvaluating ? 'Evaluating...' : 'Submit'}
            </button>
          </div>
        </>
      ) : (
        <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center min-h-[60px]">
          <div className="flex items-center">
            <div className="animate-pulse flex space-x-4">
              <div className="h-3 w-3 bg-red-300 rounded-full"></div>
              <div className="h-3 w-3 bg-red-300 rounded-full"></div>
              <div className="h-3 w-3 bg-red-300 rounded-full"></div>
            </div>
            <span className="ml-3 text-gray-600">
              {isOpeningTurn
                ? `${playerName || 'Player'} is choosing the opening topic...`
                : `${playerName || 'Player'} is formulating a response...`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
