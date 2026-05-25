import { CurrentEvaluationEdgeScore, Score } from '@/domain/game';
import { getRegularScoreDisplayItems } from '@/domain/scoreDisplay';

type ScoreTooltipData = {
  visible: boolean;
  x: number;
  y: number;
  score: Score | null;
  edgeScores?: CurrentEvaluationEdgeScore[];
};

type ScoreTooltipProps = {
  tooltipData: ScoreTooltipData;
};

export default function ScoreTooltip({ tooltipData }: ScoreTooltipProps) {
  if (!tooltipData.visible || !tooltipData.score) return null;

  const regularItems = getRegularScoreDisplayItems(tooltipData.score);
  const edgeScores = tooltipData.edgeScores || [];
  const hasMultipleScoreEdges = edgeScores.length > 1;

  return (
    <div
      className="fixed bg-white shadow-lg rounded-md p-3 z-50 border border-gray-200 text-sm"
      style={{
        left: `${tooltipData.x}px`,
        top: `${tooltipData.y}px`,
        maxWidth: '300px',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <h4 className="font-medium text-blue-800 mb-2">Score Breakdown:</h4>

      {hasMultipleScoreEdges ? (
        <div className="space-y-3">
          {edgeScores.map(edgeScore => (
            <div key={edgeScore.sourceNodeId} className="border-t border-gray-200 pt-2 first:border-t-0 first:pt-0">
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
          <p className="font-semibold border-t border-gray-200 pt-2">
            Combined Turn Score: {tooltipData.score.total}
          </p>
        </div>
      ) : (
        <div>
          <ul className="list-disc pl-5 mb-2">
            {regularItems.map(item => (
              <li key={item.label}>
                <span className="font-medium">{item.label}: {item.value}/{item.max}</span>
                <p className="text-xs text-gray-600 ml-1">{item.description}</p>
              </li>
            ))}
            <li className="font-medium mt-2">Total Score: {tooltipData.score.total}</li>
          </ul>
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-700">
            <p><strong>What makes a good connection?</strong></p>
            <p>The best connections balance novelty with relevance - they should be unexpected yet clearly related to the topic.</p>
          </div>
        </div>
      )}
    </div>
  );
}
