import {
  CurrentEvaluationEdgeScore,
  CurrentEvaluationView,
  PlayerScoreRow,
  getGameOutcomeText,
} from '@/domain/game';
import { getRegularScoreDisplayItems } from '@/domain/scoreDisplay';

type EvaluationResultsPanelProps = {
  currentEvaluation: CurrentEvaluationView;
  gameCompleted: boolean;
  compact?: boolean;
  playerScoreRows: PlayerScoreRow[];
  onNextTurn: () => void;
  onRestart: () => void;
  onReturnToSettings: () => void;
};

export default function EvaluationResultsPanel({
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

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Evaluation Results</h3>

      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <p className="font-medium text-gray-700">
          {currentEvaluation.isOpeningTurn
            ? `${currentEvaluation.playerName} chose the opening topic:`
            : `${currentEvaluation.playerName} Response to "${currentEvaluation.topic}":`}
        </p>
        <p className="mt-1 text-lg">{currentEvaluation.response}</p>
      </div>

      <div className="whitespace-pre-wrap">{currentEvaluation.evaluation}</div>

      {currentEvaluation.isOpeningTurn ? (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200 text-sm text-blue-900">
          Opening topic turns create the root node and award 0 points.
        </div>
      ) : (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="font-medium text-blue-800 text-sm">Score Breakdown:</h4>
          {hasMultipleScoreEdges ? (
            <MultiEdgeScoreBreakdown
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
          <h3 className="text-xl font-bold">Game Completed!</h3>
          <div className="mt-2 p-3 bg-green-50 rounded border border-green-200">
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Start New Game
            </button>
            <button
              onClick={onReturnToSettings}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Choose Game Settings
            </button>
          </div>
        </div>
      ) : !compact ? (
        <button
          onClick={onNextTurn}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Next Round
        </button>
      ) : null}
    </div>
  );
}

function MultiEdgeScoreBreakdown({
  edgeScores,
  combinedTotal,
}: {
  edgeScores: CurrentEvaluationEdgeScore[];
  combinedTotal: number;
}) {
  const rawCombinedTotal = edgeScores.length === 0
    ? 0
    : Math.round(edgeScores.reduce((sum, edgeScore) => sum + edgeScore.scores.total, 0) / Math.sqrt(edgeScores.length));
  const hasFirstConnectionBonus = edgeScores.length === 1 && combinedTotal !== rawCombinedTotal;

  return (
    <div className="mt-2 space-y-3 text-sm">
      {edgeScores.map(edgeScore => (
        <div key={edgeScore.sourceNodeId} className="border-t border-blue-200 pt-2 first:border-t-0 first:pt-0">
          <p className="font-medium text-blue-900">Edge from &quot;{edgeScore.sourceTopic}&quot;</p>
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
      <p className="font-semibold border-t border-blue-200 pt-2">
        Combined Turn Score: {combinedTotal}
        <span className="text-xs font-normal text-gray-500">
          {hasFirstConnectionBonus
            ? ' (opening connection bonus: edge score multiplied by sqrt(2))'
            : ` (sum of edge scores divided by sqrt(${edgeScores.length}))`}
        </span>
      </p>
    </div>
  );
}
