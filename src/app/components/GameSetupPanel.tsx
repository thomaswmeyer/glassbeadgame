"use client";

import { DifficultyLevel } from '@/domain/gameFlow';
import { GamePlayerMode } from '@/domain/playerSetup';
import { formatDifficultyLabel, getTurnsEachLabel } from '@/domain/setupDisplay';
import { GameVisualTheme, cx, isBeadTableTheme } from './gameVisualTheme';

type GameSetupPanelProps = {
  visualTheme?: GameVisualTheme;
  maxRounds: number;
  roundOptions: readonly number[];
  playerMode: GamePlayerMode;
  aiGoesFirst: boolean;
  difficulty: DifficultyLevel;
  difficultyLevels: readonly DifficultyLevel[];
  difficultyDescriptions: Record<DifficultyLevel, string>;
  firstPlayerName: string;
  secondPlayerName: string;
  isGeneratingTopic: boolean;
  productionModelName: string;
  onMaxRoundsChange: (rounds: number) => void;
  onPlayerModeChange: (mode: GamePlayerMode) => void;
  onAiGoesFirstChange: (aiGoesFirst: boolean) => void;
  onDifficultyChange: (difficulty: DifficultyLevel) => void;
  onStartGame: () => void;
};

export default function GameSetupPanel({
  visualTheme,
  maxRounds,
  roundOptions,
  playerMode,
  aiGoesFirst,
  difficulty,
  difficultyLevels,
  difficultyDescriptions,
  firstPlayerName,
  secondPlayerName,
  isGeneratingTopic,
  productionModelName,
  onMaxRoundsChange,
  onPlayerModeChange,
  onAiGoesFirstChange,
  onDifficultyChange,
  onStartGame,
}: GameSetupPanelProps) {
  const useBeadTableTheme = isBeadTableTheme(visualTheme);
  const panelClassName = cx(
    'mb-4 max-w-md mx-auto rounded-lg border p-4',
    useBeadTableTheme
      ? 'border-[#c4a565] bg-[#e2d0a7] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
      : 'border-gray-200 bg-gray-50'
  );
  const labelClassName = cx(
    'block text-left mb-2 font-medium',
    useBeadTableTheme && 'text-[#3a2a17]'
  );
  const sectionHeadingClassName = cx(
    'font-bold text-left',
    useBeadTableTheme && 'gbg-small-caps font-serif text-[#2d1d12]'
  );
  const selectedButtonClassName = useBeadTableTheme
    ? 'bg-[#6e4a22] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
    : 'bg-blue-600 text-white';
  const unselectedButtonClassName = useBeadTableTheme
    ? 'border border-[#b99a58] bg-[#f7e7bd] text-[#4a321d] hover:bg-[#fff0c2]'
    : 'bg-gray-200 text-gray-700 hover:bg-gray-300';

  return (
    <div className="text-center">
      <p className={cx(
        'mb-6 text-lg',
        useBeadTableTheme ? 'text-[#4a321d]' : undefined
      )}>
        Welcome to the Glass Bead Game, a turn-based graph of connected concepts.
      </p>

      <div className={panelClassName}>
        <h3 className={cx(sectionHeadingClassName, 'mb-3')}>Game Settings:</h3>

        <div className="mb-4">
          <label className={labelClassName}>Number of Rounds:</label>
          <div className="flex flex-wrap gap-2 justify-center">
            {roundOptions.map(option => (
              <button
                key={option}
                onClick={() => onMaxRoundsChange(option)}
                className={`px-3 py-1 rounded-full text-sm ${
                  maxRounds === option
                    ? selectedButtonClassName
                    : unselectedButtonClassName
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClassName}>Players:</label>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                onPlayerModeChange('human-vs-ai');
                onAiGoesFirstChange(false);
              }}
              className={`px-4 py-2 rounded ${
                playerMode === 'human-vs-ai'
                  ? selectedButtonClassName
                  : unselectedButtonClassName
              }`}
            >
              You vs AI
            </button>
            <button
              onClick={() => {
                onPlayerModeChange('ai-vs-ai');
                onAiGoesFirstChange(false);
              }}
              className={`px-4 py-2 rounded ${
                playerMode === 'ai-vs-ai'
                  ? selectedButtonClassName
                  : unselectedButtonClassName
              }`}
            >
              AI vs AI
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClassName}>Who Goes First:</label>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onAiGoesFirstChange(false)}
              className={`px-4 py-2 rounded ${
                !aiGoesFirst
                  ? selectedButtonClassName
                  : unselectedButtonClassName
              }`}
            >
              {firstPlayerName} First
            </button>
            <button
              onClick={() => onAiGoesFirstChange(true)}
              className={`px-4 py-2 rounded ${
                aiGoesFirst
                  ? selectedButtonClassName
                  : unselectedButtonClassName
              }`}
            >
              {secondPlayerName} First
            </button>
          </div>
        </div>

        <div>
          <label className={labelClassName}>Game Difficulty:</label>
          <select
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value as DifficultyLevel)}
            className={cx(
              'w-full rounded-md border p-2 focus:outline-none focus:ring-2',
              useBeadTableTheme
                ? 'border-[#b99a58] bg-[#fbf0d3] text-[#20150d] focus:border-[#8f5b23] focus:ring-[#c9943c]/30'
                : 'border-gray-300 focus:ring-blue-500'
            )}
          >
            {difficultyLevels.map(level => (
              <option key={level} value={level}>
                {formatDifficultyLabel(level)}
              </option>
            ))}
          </select>
          <p className={cx(
            'text-sm mt-1',
            useBeadTableTheme ? 'text-[#725c37]' : 'text-gray-500'
          )}>
            {difficultyDescriptions[difficulty]}
          </p>
        </div>
      </div>

      <div className={panelClassName}>
        <h3 className={cx(sectionHeadingClassName, 'mb-2')}>AI Model:</h3>
        <p className={cx('text-sm', useBeadTableTheme && 'text-[#4a321d]')}>
          This game uses {productionModelName} for all AI interactions.
        </p>
      </div>

      <div className="mb-6 text-center">
        <button
          onClick={onStartGame}
          disabled={isGeneratingTopic}
          className={cx(
            'rounded-lg px-6 py-3 text-white transition-colors disabled:cursor-not-allowed',
            useBeadTableTheme
              ? 'bg-[#6e4a22] hover:bg-[#80572a] disabled:bg-[#b89c6a]'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
          )}
        >
          {isGeneratingTopic ? 'Generating Topic...' : 'Start Game'}
        </button>
      </div>

      <div className={cx(
        'mb-6 max-w-md mx-auto text-left',
        useBeadTableTheme && 'text-[#3a2a17]'
      )}>
        <h3 className={cx(
          'font-bold mb-2',
          useBeadTableTheme && 'gbg-small-caps font-serif text-[#2d1d12]'
        )}>
          Rules:
        </h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>The first player chooses the opening topic as turn 0.</li>
          <li>Players take turns adding a new topic connected to the selected source topic.</li>
          <li><strong>Responses should be brief</strong> - ideally a single word or short phrase (1-5 words). The quality of the conceptual connection is what matters, not the length of your response.</li>
          <li>Select an older topic in the graph or history to branch from it.</li>
          <li>Use the + controls to connect a new topic to multiple source topics.</li>
          <li>The game lasts for {maxRounds} rounds ({getTurnsEachLabel(maxRounds)}).</li>
          <li>Responses are evaluated based on:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>Semantic Distance (1-10):</strong> How semantically remote is the new topic from the selected source topic or topics? Higher scores for distant connections.</li>
              <li><strong>Relevance (1-10):</strong> How meaningful and appropriate is the connection? For example, stock market crash and flocking behavior.</li>
            </ul>
          </li>
          <li>Each source connection is scored by multiplying those two components; multi-source turns combine edge scores with diminishing returns.</li>
          <li>The player with the highest total score at the end wins!</li>
        </ol>
      </div>
    </div>
  );
}
