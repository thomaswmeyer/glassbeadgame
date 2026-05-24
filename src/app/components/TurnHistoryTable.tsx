import {
  Score,
  TurnHistoryRow,
  getTurnHistoryRowScore,
  getTurnHistoryRowSourceTopicText,
} from '@/domain/game';

export function getPlayerBadgeClass(playerKind?: string) {
  if (playerKind === 'local') return 'bg-blue-100 text-blue-800';
  if (playerKind === 'ai') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

type TurnHistoryTableProps = {
  activeSourceNodeIds: string[];
  canSelectHistoryRows: boolean;
  circleEnabled: boolean;
  currentRound: number;
  currentSourceTopicText: string;
  currentTopicNodeId: string | null;
  maxRounds: number;
  selectedGraphNodeId: string | null;
  turnHistoryRows: TurnHistoryRow[];
  getTopicGraphNodeId: (topicValue: string, beforeHistoryIndex?: number) => string | null;
  onCurrentTopicClick: () => void;
  onHistoryTopicClick: (topicValue: string, beforeHistoryIndex?: number) => void;
  onScoreMouseEnter: (event: React.MouseEvent, score: Score, isCircleRound: boolean) => void;
  onScoreMouseLeave: () => void;
  onSelectHistoryItem: (historyItem: TurnHistoryRow) => void;
};

export default function TurnHistoryTable({
  activeSourceNodeIds,
  canSelectHistoryRows,
  circleEnabled,
  currentRound,
  currentSourceTopicText,
  currentTopicNodeId,
  maxRounds,
  selectedGraphNodeId,
  turnHistoryRows,
  getTopicGraphNodeId,
  onCurrentTopicClick,
  onHistoryTopicClick,
  onScoreMouseEnter,
  onScoreMouseLeave,
  onSelectHistoryItem,
}: TurnHistoryTableProps) {
  const isCurrentTopicSelected = Boolean(currentTopicNodeId && selectedGraphNodeId === currentTopicNodeId);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Game History</h2>
      <p className="text-sm text-gray-600 mb-2">
        Click a row to select that row's topic in the graph.
      </p>
      <div className="overflow-auto max-h-60">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
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
            <tr
              key="current-topic"
              onClick={onCurrentTopicClick}
              className={`border-t cursor-pointer ${isCurrentTopicSelected ? 'bg-purple-50' : 'bg-green-50 hover:bg-green-100'}`}
            >
              <td className="py-2 px-4">{currentRound}</td>
              <td className="py-2 px-4 font-medium">{currentSourceTopicText}</td>
              <td className="py-2 px-4">
                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Current
                </span>
              </td>
              <td className="py-2 px-4 text-gray-400">-</td>
              <td className="py-2 px-4 text-gray-400">-</td>
              <td className="py-2 px-4 text-xs text-gray-500">Topic</td>
            </tr>
            {turnHistoryRows
              .slice()
              .reverse()
              .map((round, index) => {
                const historyIndex = turnHistoryRows.length - index - 1;
                const topicText = getTurnHistoryRowSourceTopicText(round);
                const score = getTurnHistoryRowScore(round);
                const isCircleRound = circleEnabled && round.turn.round === maxRounds;
                const topicNodeId = getTopicGraphNodeId(topicText, historyIndex);
                const isTopicSelected = selectedGraphNodeId === topicNodeId;
                const destinationNodeId = round.destinationNode.id;
                const isResponseSelectedForTopic = activeSourceNodeIds.includes(destinationNodeId);
                const player = round.player;

                return (
                  <tr
                    key={round.turn.id}
                    onClick={() => onHistoryTopicClick(topicText, historyIndex)}
                    className={`border-t cursor-pointer ${isTopicSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2 px-4">{round.turn.round}</td>
                    <td className="py-2 px-4">{topicText}</td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${getPlayerBadgeClass(player?.kind)}`}>
                        {player?.name || 'Player'}
                      </span>
                    </td>
                    <td className="py-2 px-4">{round.destinationNode.topic}</td>
                    <td className="py-2 px-4">
                      <span
                        className="cursor-help underline decoration-dotted"
                        onMouseEnter={(event) => onScoreMouseEnter(event, score, isCircleRound)}
                        onMouseLeave={onScoreMouseLeave}
                      >
                        {score.total}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      {canSelectHistoryRows && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectHistoryItem(round);
                          }}
                          className={`text-xs px-2 py-1 rounded-full ${
                            isResponseSelectedForTopic
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          {isResponseSelectedForTopic ? 'Selected' : 'Use as Topic'}
                        </button>
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
