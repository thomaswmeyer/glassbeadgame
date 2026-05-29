import {
  Score,
  TurnHistoryRow,
  getTurnHistoryRowScore,
  getTurnHistoryRowSourceTopicText,
} from '@/domain/game';
import { GameVisualTheme, cx, isBeadTableTheme } from './gameVisualTheme';

export function getPlayerBadgeClass(playerKind?: string, visualTheme?: GameVisualTheme) {
  if (isBeadTableTheme(visualTheme)) {
    if (playerKind === 'local') return 'border border-[#8ea9b9] bg-[#d7e7ea] text-[#234653]';
    if (playerKind === 'ai') return 'border border-[#c08a71] bg-[#f0d0bb] text-[#6f2e21]';
    return 'border border-[#b99a58] bg-[#f7e7bd] text-[#4a321d]';
  }

  if (playerKind === 'local') return 'bg-blue-100 text-blue-800';
  if (playerKind === 'ai') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

type TurnHistoryTableProps = {
  visualTheme?: GameVisualTheme;
  activeSourceNodeIds: string[];
  canSelectHistoryRows: boolean;
  showCurrentTurnRow: boolean;
  currentRound: number;
  currentPlayerKind?: string;
  currentPlayerName?: string;
  currentSourceTopicText: string;
  currentTopicNodeId: string | null;
  selectedGraphNodeId: string | null;
  turnHistoryRows: TurnHistoryRow[];
  getTopicGraphNodeId: (topicValue: string, beforeHistoryIndex?: number) => string | null;
  onCurrentTopicClick: () => void;
  onHistoryTopicClick: (topicValue: string, beforeHistoryIndex?: number) => void;
  onScoreMouseEnter: (
    event: React.MouseEvent,
    score: Score,
    edgeScores?: TurnHistoryRow['edgeScores']
  ) => void;
  onScoreMouseLeave: () => void;
  onSelectHistoryItem: (historyItem: TurnHistoryRow) => void;
  onAddHistoryItem: (historyItem: TurnHistoryRow) => void;
};

export default function TurnHistoryTable({
  visualTheme,
  activeSourceNodeIds,
  canSelectHistoryRows,
  showCurrentTurnRow,
  currentRound,
  currentPlayerKind,
  currentPlayerName,
  currentSourceTopicText,
  currentTopicNodeId,
  selectedGraphNodeId,
  turnHistoryRows,
  getTopicGraphNodeId,
  onCurrentTopicClick,
  onHistoryTopicClick,
  onScoreMouseEnter,
  onScoreMouseLeave,
  onSelectHistoryItem,
  onAddHistoryItem,
}: TurnHistoryTableProps) {
  const isCurrentTopicSelected = Boolean(currentTopicNodeId && selectedGraphNodeId === currentTopicNodeId);
  const useBeadTableTheme = isBeadTableTheme(visualTheme);

  return (
    <div className="mt-8">
      <h2 className={cx(
        'text-xl font-semibold mb-4',
        useBeadTableTheme && 'gbg-small-caps font-serif text-[#2d1d12]'
      )}>
        Game History
      </h2>
      <p className={cx(
        'text-sm mb-2',
        useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-600'
      )}>
        Click a row to select that row's topic in the graph.
      </p>
      <div className={cx(
        'overflow-auto max-h-[32rem] rounded border',
        useBeadTableTheme ? 'border-[#c7ad75] bg-[#f4e5bd]' : 'border-transparent'
      )}>
        <table className={cx(
          'min-w-full',
          useBeadTableTheme ? 'bg-[#f8edcf]' : 'bg-white'
        )}>
          <thead className={cx(
            useBeadTableTheme ? 'bg-[#d9c18b] text-[#352313]' : 'bg-gray-100'
          )}>
            <tr>
              <th className="py-2 px-4 text-left">Round</th>
              <th className="py-2 px-4 text-left">Topic</th>
              <th className="py-2 px-4 text-left">Player</th>
              <th className="py-2 px-4 text-left">Response</th>
              <th className="py-2 px-4 text-left">Score</th>
              <th className="py-2 px-4 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {showCurrentTurnRow && (
              <tr
                key="current-topic"
                onClick={() => {
                  if (canSelectHistoryRows) onCurrentTopicClick();
                }}
                className={cx(
                  'border-t',
                  useBeadTableTheme ? 'border-[#c7ad75]' : 'border-gray-200',
                  canSelectHistoryRows ? 'cursor-pointer' : 'cursor-default',
                  isCurrentTopicSelected
                    ? (useBeadTableTheme ? 'bg-[#ecd494]' : 'bg-purple-50')
                    : (useBeadTableTheme ? 'bg-[#e8efd1] hover:bg-[#dbe8bd]' : 'bg-green-50 hover:bg-green-100')
                )}
              >
                <td className="py-2 px-4">{currentRound}</td>
                <td className="py-2 px-4 font-medium">{currentSourceTopicText}</td>
                <td className="py-2 px-4">
                  <span className={cx(
                    'px-2 py-1 rounded-full text-xs',
                    getPlayerBadgeClass(currentPlayerKind, visualTheme)
                  )}>
                    {currentPlayerName || 'Player'}
                  </span>
                </td>
                <td className={cx('py-2 px-4', useBeadTableTheme ? 'text-[#9b8250]' : 'text-gray-400')}>-</td>
                <td className={cx('py-2 px-4', useBeadTableTheme ? 'text-[#9b8250]' : 'text-gray-400')}>-</td>
                <td className={cx('py-2 px-4 text-xs', useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-500')}>Topic</td>
              </tr>
            )}
            {turnHistoryRows
              .slice()
              .reverse()
              .map((round, index) => {
                const historyIndex = turnHistoryRows.length - index - 1;
                const topicText = getTurnHistoryRowSourceTopicText(round);
                const score = getTurnHistoryRowScore(round);
                const topicNodeId = getTopicGraphNodeId(topicText, historyIndex);
                const isTopicSelected = selectedGraphNodeId === topicNodeId;
                const destinationNodeId = round.destinationNode.id;
                const isResponseSelectedForTopic = activeSourceNodeIds.includes(destinationNodeId);
                const player = round.player;

                return (
                  <tr
                    key={round.turn.id}
                    onClick={() => {
                      if (canSelectHistoryRows) onHistoryTopicClick(topicText, historyIndex);
                    }}
                    className={cx(
                      'border-t',
                      useBeadTableTheme ? 'border-[#c7ad75]' : 'border-gray-200',
                      canSelectHistoryRows ? 'cursor-pointer' : 'cursor-default',
                      isTopicSelected
                        ? (useBeadTableTheme ? 'bg-[#ecd494]' : 'bg-purple-50')
                        : (useBeadTableTheme ? 'hover:bg-[#f1dfad]' : 'hover:bg-gray-50')
                    )}
                  >
                    <td className="py-2 px-4">{round.turn.round}</td>
                    <td className="py-2 px-4">{topicText}</td>
                    <td className="py-2 px-4">
                      <span className={cx(
                        'px-2 py-1 rounded-full text-xs',
                        getPlayerBadgeClass(player?.kind, visualTheme)
                      )}>
                        {player?.name || 'Player'}
                      </span>
                    </td>
                    <td className="py-2 px-4">{round.destinationNode.topic}</td>
                    <td className="py-2 px-4">
                      <span
                        className={cx(
                          'cursor-help underline decoration-dotted',
                          useBeadTableTheme && 'decoration-[#8f5b23]'
                        )}
                        onMouseEnter={(event) => onScoreMouseEnter(event, score, round.edgeScores)}
                        onMouseLeave={onScoreMouseLeave}
                      >
                        {score.total}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      {canSelectHistoryRows && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectHistoryItem(round);
                            }}
                            className={cx(
                              'text-xs px-2 py-1 rounded-full',
                              isResponseSelectedForTopic
                                ? (useBeadTableTheme ? 'bg-[#6e4a22] text-white' : 'bg-purple-600 text-white')
                                : (useBeadTableTheme
                                  ? 'border border-[#b99a58] bg-[#f7e7bd] text-[#4a321d] hover:bg-[#fff0c2]'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                            )}
                          >
                            {isResponseSelectedForTopic ? 'Selected' : 'Use as Topic'}
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onAddHistoryItem(round);
                            }}
                            disabled={isResponseSelectedForTopic}
                            title="Add topic to current turn"
                            className={cx(
                              'h-7 w-7 rounded-full disabled:cursor-not-allowed disabled:text-gray-400',
                              useBeadTableTheme
                                ? 'border border-[#b99a58] bg-[#f7e7bd] text-[#4a321d] hover:bg-[#fff0c2] disabled:bg-[#ead8ad]'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100'
                            )}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
