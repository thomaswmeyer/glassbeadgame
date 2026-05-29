import { KeyboardEvent } from 'react';
import {
  canSubmitTurnResponse,
  getTurnResponseValidationMessage,
  getTurnResponsePanelTitle,
  getTurnResponsePlaceholder,
} from '@/domain/turnPrompt';
import { GameVisualTheme, cx, isBeadTableTheme } from './gameVisualTheme';

type TurnResponsePanelProps = {
  visualTheme?: GameVisualTheme;
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
  visualTheme,
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
  const validationMessage = getTurnResponseValidationMessage(response);
  const useBeadTableTheme = isBeadTableTheme(visualTheme);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mb-6">
      <h2 className={cx(
        'text-xl font-semibold mb-2',
        useBeadTableTheme && 'gbg-small-caps font-serif text-[#2d1d12]'
      )}>
        {getTurnResponsePanelTitle({ isCurrentPlayerManual, isOpeningTurn, playerName })}
      </h2>

      {isCurrentPlayerManual ? (
        <>
          <input
            type="text"
            value={response}
            onChange={(event) => onResponseChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className={cx(
              'w-full rounded-lg border p-4 outline-none transition',
              useBeadTableTheme
                ? 'border-[#b99a58] bg-[#fbf0d3] text-[#20150d] shadow-[inset_0_1px_4px_rgba(60,38,18,0.18)] focus:border-[#8f5b23] focus:ring-2 focus:ring-[#c9943c]/30'
                : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
            )}
            placeholder={getTurnResponsePlaceholder({
              isOpeningTurn,
            })}
            disabled={isEvaluating}
            autoFocus
          />
          <p className={cx(
            'text-sm mt-1',
            validationMessage
              ? (useBeadTableTheme ? 'text-[#8f2f1f]' : 'text-red-600')
              : (useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-500')
          )}>
            {validationMessage || (isOpeningTurn
              ? 'Pick a concise concept to seed the board. No points are awarded for the opening topic.'
              : 'Keep your response concise (1-5 words) for best results. The quality of the conceptual connection is what matters.')}
            {!validationMessage && !isOpeningTurn && hasBranchedSourceSelection && (
              <span className={cx(
                'ml-1',
                useBeadTableTheme ? 'text-[#7a3f24]' : 'text-purple-600'
              )}>
                You&apos;re responding to selected graph sources.
              </span>
            )}
          </p>
          <div className="flex justify-end mt-2">
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cx(
                'px-4 py-2 text-white rounded-lg transition-colors disabled:cursor-not-allowed',
                useBeadTableTheme
                  ? 'bg-[#6e4a22] hover:bg-[#80572a] disabled:bg-[#b89c6a]'
                  : 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
              )}
            >
              {isEvaluating ? 'Evaluating...' : 'Submit'}
            </button>
          </div>
        </>
      ) : (
        <div className={cx(
          'flex min-h-[60px] items-center justify-center rounded-lg border p-4',
          useBeadTableTheme
            ? 'border-[#b99a58] bg-[#f8edcf] text-[#4a321d]'
            : 'border-gray-300 bg-gray-50'
        )}>
          <div className="flex items-center">
            <div className="animate-pulse flex space-x-4">
              <div className={cx('h-3 w-3 rounded-full', useBeadTableTheme ? 'bg-[#b66b35]' : 'bg-red-300')}></div>
              <div className={cx('h-3 w-3 rounded-full', useBeadTableTheme ? 'bg-[#b66b35]' : 'bg-red-300')}></div>
              <div className={cx('h-3 w-3 rounded-full', useBeadTableTheme ? 'bg-[#b66b35]' : 'bg-red-300')}></div>
            </div>
            <span className={cx(
              'ml-3',
              useBeadTableTheme ? 'text-[#5a4428]' : 'text-gray-600'
            )}>
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
