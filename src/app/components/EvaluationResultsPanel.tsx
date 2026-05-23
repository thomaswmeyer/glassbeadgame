import {
  CurrentEvaluationView,
  PlayerScoreRow,
  getGameOutcomeText,
} from '@/domain/game';
import {
  getCircleScoreDisplaySections,
  getRegularScoreDisplayItems,
} from '@/domain/scoreDisplay';

type EvaluationResultsPanelProps = {
  currentEvaluation: CurrentEvaluationView;
  circleEnabled: boolean;
  currentRound: number;
  maxRounds: number;
  gameCompleted: boolean;
  playerScoreRows: PlayerScoreRow[];
  onNextTurn: () => void;
  onRestart: () => void;
  onReturnToSettings: () => void;
};

export default function EvaluationResultsPanel({
  currentEvaluation,
  circleEnabled,
  currentRound,
  maxRounds,
  gameCompleted,
  playerScoreRows,
  onNextTurn,
  onRestart,
  onReturnToSettings,
}: EvaluationResultsPanelProps) {
  const isFinalCircleRound = currentRound === maxRounds && circleEnabled;
  const regularScoreItems = getRegularScoreDisplayItems(currentEvaluation.scores);
  const circleScoreSections = getCircleScoreDisplaySections(currentEvaluation.scores);
  const gameOutcomeText = getGameOutcomeText(playerScoreRows);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Evaluation Results</h3>

      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <p className="font-medium text-gray-700">
          {currentEvaluation.playerName} Response to &quot;{currentEvaluation.topic}&quot;:
        </p>
        <p className="mt-1 text-lg">{currentEvaluation.response}</p>
      </div>

      <div className="whitespace-pre-wrap">{currentEvaluation.evaluation}</div>

      {!isFinalCircleRound && (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="font-medium text-blue-800 text-sm">Score Breakdown:</h4>
          <div className="mt-1 text-sm">
            <ul className="list-disc pl-5">
              {regularScoreItems.map(item => (
                <li key={item.label}>
                  {item.label}: {item.value}/{item.max}
                </li>
              ))}
              <li className="font-medium mt-1">Total Score: {currentEvaluation.scores.total}/20</li>
            </ul>
          </div>
        </div>
      )}

      {isFinalCircleRound && currentEvaluation.finalEvaluation && (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="font-medium text-blue-800">Connection to Original Topic</h4>
          <p>{currentEvaluation.finalEvaluation}</p>

          <div className="mt-3 pt-3 border-t border-blue-200">
            <h5 className="font-medium text-blue-800 text-sm">Final Round Scoring:</h5>
            <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
              {circleScoreSections.map(section => (
                <div key={section.title}>
                  <p><strong>{section.title}:</strong></p>
                  <ul className="list-disc pl-5">
                    {section.items.map(item => (
                      <li key={item.label}>
                        {item.label}: {item.value}/{item.max}
                      </li>
                    ))}
                    <li>Subtotal: {section.subtotal}/20</li>
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2 font-medium">
              Final Score: {currentEvaluation.scores.total}/20 <span className="text-xs text-gray-500">(average of both subtotals)</span>
            </p>
          </div>
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
      ) : (
        <button
          onClick={onNextTurn}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Next Round
        </button>
      )}
    </div>
  );
}
