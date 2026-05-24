import { Score } from '@/domain/game';
import {
  getCircleScoreDisplaySections,
  getRegularScoreDisplayItems,
} from '@/domain/scoreDisplay';

type ScoreTooltipData = {
  visible: boolean;
  x: number;
  y: number;
  score: Score | null;
  isCircleMode: boolean;
};

type ScoreTooltipProps = {
  tooltipData: ScoreTooltipData;
};

export default function ScoreTooltip({ tooltipData }: ScoreTooltipProps) {
  if (!tooltipData.visible || !tooltipData.score) return null;

  const regularItems = getRegularScoreDisplayItems(tooltipData.score);
  const circleSections = getCircleScoreDisplaySections(tooltipData.score);

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

      {!tooltipData.isCircleMode ? (
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
      ) : (
        <div>
          {circleSections.map(section => (
            <div key={section.title} className="mb-3">
              <p className="font-medium">{section.title}:</p>
              <ul className="list-disc pl-5">
                {section.items.map(item => (
                  <li key={item.label}>
                    <span>{item.label}: {item.value}/{item.max}</span>
                    <p className="text-xs text-gray-600 ml-1">{item.description}</p>
                  </li>
                ))}
                <li>Subtotal: {section.subtotal}</li>
              </ul>
            </div>
          ))}
          <p className="mt-2 font-medium">
            Final Score: {tooltipData.score.total} <span className="text-xs text-gray-500">(average of both subtotals)</span>
          </p>
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-700">
            <p><strong>Circle Mode:</strong> In the final round, your response must connect both to the current topic and back to the original starting topic.</p>
          </div>
        </div>
      )}
    </div>
  );
}
