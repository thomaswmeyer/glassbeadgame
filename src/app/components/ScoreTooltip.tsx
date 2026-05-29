import { CurrentEvaluationEdgeScore, Score } from '@/domain/game';
import { getRegularScoreDisplayItems } from '@/domain/scoreDisplay';
import { GameVisualTheme, cx, isBeadTableTheme } from './gameVisualTheme';

type ScoreTooltipData = {
  visible: boolean;
  x: number;
  y: number;
  score: Score | null;
  edgeScores?: CurrentEvaluationEdgeScore[];
};

type ScoreTooltipProps = {
  visualTheme?: GameVisualTheme;
  tooltipData: ScoreTooltipData;
};

export default function ScoreTooltip({ visualTheme, tooltipData }: ScoreTooltipProps) {
  if (!tooltipData.visible || !tooltipData.score) return null;

  const regularItems = getRegularScoreDisplayItems(tooltipData.score);
  const edgeScores = tooltipData.edgeScores || [];
  const hasMultipleScoreEdges = edgeScores.length > 1;
  const useBeadTableTheme = isBeadTableTheme(visualTheme);

  return (
    <div
      className={cx(
        'fixed shadow-lg rounded-md p-3 z-50 border text-sm',
        useBeadTableTheme
          ? 'border-[#b99a58] bg-[#fbf0d3] text-[#2b2118]'
          : 'border-gray-200 bg-white'
      )}
      style={{
        left: `${tooltipData.x}px`,
        top: `${tooltipData.y}px`,
        maxWidth: '300px',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <h4 className={cx(
        'font-medium mb-2',
        useBeadTableTheme ? 'gbg-small-caps font-serif text-[#6e4a22]' : 'text-blue-800'
      )}>
        Score Breakdown:
      </h4>

      {hasMultipleScoreEdges ? (
        <div className="space-y-3">
          {edgeScores.map(edgeScore => (
            <div
              key={edgeScore.sourceNodeId}
              className={cx(
                'border-t pt-2 first:border-t-0 first:pt-0',
                useBeadTableTheme ? 'border-[#cfb273]' : 'border-gray-200'
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
            useBeadTableTheme ? 'border-[#cfb273]' : 'border-gray-200'
          )}>
            Combined Turn Score: {tooltipData.score.total}
          </p>
        </div>
      ) : (
        <div>
          <ul className="list-disc pl-5 mb-2">
            {regularItems.map(item => (
              <li key={item.label}>
                <span className="font-medium">{item.label}: {item.value}/{item.max}</span>
                <p className={cx(
                  'text-xs ml-1',
                  useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-600'
                )}>
                  {item.description}
                </p>
              </li>
            ))}
            <li className="font-medium mt-2">Total Score: {tooltipData.score.total}</li>
          </ul>
          <div className={cx(
            'mt-2 pt-2 border-t text-xs',
            useBeadTableTheme ? 'border-[#cfb273] text-[#5a4428]' : 'border-gray-200 text-gray-700'
          )}>
            <p><strong>What makes a good connection?</strong></p>
            <p>The best connections balance novelty with relevance - they should be unexpected yet clearly related to the topic.</p>
          </div>
        </div>
      )}
    </div>
  );
}
