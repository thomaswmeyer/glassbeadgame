import {
  CurrentEvaluationEdgeScore,
  CurrentEvaluationView,
  PlayerScoreRow,
  getGameOutcomeText,
} from '@/domain/game';
import { getRegularScoreDisplayItems } from '@/domain/scoreDisplay';
import { GameVisualTheme, cx, isBeadTableTheme } from './gameVisualTheme';

type EvaluationResultsPanelProps = {
  visualTheme?: GameVisualTheme;
  currentEvaluation: CurrentEvaluationView;
  gameCompleted: boolean;
  compact?: boolean;
  playerScoreRows: PlayerScoreRow[];
  onNextTurn: () => void;
  onRestart: () => void;
  onReturnToSettings: () => void;
};

export default function EvaluationResultsPanel({
  visualTheme,
  currentEvaluation,
  gameCompleted,
  compact = false,
  playerScoreRows,
  onNextTurn,
  onRestart,
  onReturnToSettings,
}: EvaluationResultsPanelProps) {
  const regularScoreItems = getRegularScoreDisplayItems(currentEvaluation.scores);
  const gameOutcomeText = getGameOutcomeText(playerScoreRows);
  const hasMultipleScoreEdges = currentEvaluation.edgeScores.length > 1;
  const useBeadTableTheme = isBeadTableTheme(visualTheme);

  return (
    <div className={cx(
      'mt-4 rounded-lg p-4',
      useBeadTableTheme
        ? 'border border-[#c4a565] bg-[#e2d0a7] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
        : 'bg-gray-100'
    )}>
      <h3 className={cx(
        'text-lg font-semibold mb-2',
        useBeadTableTheme && 'gbg-small-caps font-serif text-[#2d1d12]'
      )}>
        Evaluation Results
      </h3>

      <div className={cx(
        'mb-4 rounded-lg border p-3',
        useBeadTableTheme ? 'border-[#c9ad73] bg-[#fbf0d3]' : 'border-gray-200 bg-white'
      )}>
        <p className={cx('font-medium', useBeadTableTheme ? 'text-[#5a4428]' : 'text-gray-700')}>
          {currentEvaluation.isOpeningTurn
            ? `${currentEvaluation.playerName} chose the opening topic:`
            : `${currentEvaluation.playerName} Response to "${currentEvaluation.topic}":`}
        </p>
        <p className="mt-1 text-lg">{currentEvaluation.response}</p>
      </div>

      <div className={cx(
        'whitespace-pre-wrap',
        useBeadTableTheme && 'text-[#2b2118]'
      )}>
        {currentEvaluation.evaluation}
      </div>

      {currentEvaluation.isOpeningTurn ? (
        <div className={cx(
          'mt-4 rounded border p-3 text-sm',
          useBeadTableTheme
            ? 'border-[#b99a58] bg-[#f6e5b8] text-[#4a321d]'
            : 'border-blue-200 bg-blue-50 text-blue-900'
        )}>
          Opening topic turns create the root node and award 0 points.
        </div>
      ) : (
        <div className={cx(
          'mt-4 rounded border p-3',
          useBeadTableTheme
            ? 'border-[#b99a58] bg-[#f6e5b8] text-[#3a2a17]'
            : 'border-blue-200 bg-blue-50'
        )}>
          <h4 className={cx(
            'font-medium text-sm',
            useBeadTableTheme ? 'text-[#6e4a22]' : 'text-blue-800'
          )}>
            Score Breakdown:
          </h4>
          {hasMultipleScoreEdges ? (
            <MultiEdgeScoreBreakdown
              visualTheme={visualTheme}
              edgeScores={currentEvaluation.edgeScores}
              combinedTotal={currentEvaluation.scores.total}
            />
          ) : (
            <div className="mt-1 text-sm">
              <ul className="list-disc pl-5">
                {regularScoreItems.map(item => (
                  <li key={item.label}>
                    {item.label}: {item.value}/{item.max}
                  </li>
                ))}
                <li className="font-medium mt-1">Total Score: {currentEvaluation.scores.total}</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {gameCompleted ? (
        <div className="mt-4">
          <h3 className={cx('text-xl font-bold', useBeadTableTheme && 'gbg-small-caps font-serif')}>Game Completed!</h3>
          <div className={cx(
            'mt-2 rounded border p-3',
            useBeadTableTheme ? 'border-[#95a35a] bg-[#eef0c9]' : 'border-green-200 bg-green-50'
          )}>
            <p className="font-medium">Final Scores:</p>
            {playerScoreRows.map(scoreRow => (
              <p key={scoreRow.player.id}>
                {scoreRow.player.name} Score: {scoreRow.totalScore}
              </p>
            ))}
            <p className="mt-2 font-medium">
              {gameOutcomeText}
            </p>
          </div>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={onRestart}
              className={cx(
                'px-4 py-2 text-white rounded transition',
                useBeadTableTheme ? 'bg-[#6e4a22] hover:bg-[#80572a]' : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              Start New Game
            </button>
            <button
              onClick={onReturnToSettings}
              className={cx(
                'px-4 py-2 text-white rounded transition',
                useBeadTableTheme ? 'bg-[#4c4031] hover:bg-[#5f503d]' : 'bg-gray-600 hover:bg-gray-700'
              )}
            >
              Choose Game Settings
            </button>
          </div>
        </div>
      ) : !compact ? (
        <button
          onClick={onNextTurn}
          className={cx(
            'mt-4 px-4 py-2 text-white rounded transition',
            useBeadTableTheme ? 'bg-[#6e4a22] hover:bg-[#80572a]' : 'bg-blue-600 hover:bg-blue-700'
          )}
        >
          Next Round
        </button>
      ) : null}
    </div>
  );
}

function MultiEdgeScoreBreakdown({
  visualTheme,
  edgeScores,
  combinedTotal,
}: {
  visualTheme?: GameVisualTheme;
  edgeScores: CurrentEvaluationEdgeScore[];
  combinedTotal: number;
}) {
  const useBeadTableTheme = isBeadTableTheme(visualTheme);
  const rawCombinedTotal = edgeScores.length === 0
    ? 0
    : Math.round(edgeScores.reduce((sum, edgeScore) => sum + edgeScore.scores.total, 0) / Math.sqrt(edgeScores.length));
  const hasFirstConnectionBonus = edgeScores.length === 1 && combinedTotal !== rawCombinedTotal;

  return (
    <div className="mt-2 space-y-3 text-sm">
      {edgeScores.map(edgeScore => (
        <div
          key={edgeScore.sourceNodeId}
          className={cx(
            'border-t pt-2 first:border-t-0 first:pt-0',
            useBeadTableTheme ? 'border-[#cfb273]' : 'border-blue-200'
          )}
        >
          <p className={cx(
            'font-medium',
            useBeadTableTheme ? 'text-[#6e4a22]' : 'text-blue-900'
          )}>
            Edge from &quot;{edgeScore.sourceTopic}&quot;
          </p>
          <ul className="list-disc pl-5 mt-1">
            {getRegularScoreDisplayItems(edgeScore.scores).map(item => (
              <li key={item.label}>
                {item.label}: {item.value}/{item.max}
              </li>
            ))}
            <li className="font-medium">Edge Score: {edgeScore.scores.total}</li>
          </ul>
        </div>
      ))}
      <p className={cx(
        'font-semibold border-t pt-2',
        useBeadTableTheme ? 'border-[#cfb273]' : 'border-blue-200'
      )}>
        Combined Turn Score: {combinedTotal}
        <span className={cx(
          'text-xs font-normal',
          useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-500'
        )}>
          {hasFirstConnectionBonus
            ? ' (opening connection bonus: edge score multiplied by sqrt(2))'
            : ` (sum of edge scores divided by sqrt(${edgeScores.length}))`}
        </span>
      </p>
    </div>
  );
}
