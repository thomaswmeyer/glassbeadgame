"use client";

import ModelSelector from './ModelSelector';
import { DifficultyLevel } from '@/domain/gameFlow';
import { formatDifficultyLabel, getTurnsEachLabel } from '@/domain/setupDisplay';

type GameSetupPanelProps = {
  maxRounds: number;
  roundOptions: readonly number[];
  aiGoesFirst: boolean;
  circleEnabled: boolean;
  difficulty: DifficultyLevel;
  difficultyLevels: readonly DifficultyLevel[];
  difficultyDescriptions: Record<DifficultyLevel, string>;
  localPlayerName: string;
  aiPlayerName: string;
  isGeneratingTopic: boolean;
  productionMode: boolean;
  productionModelName: string;
  onMaxRoundsChange: (rounds: number) => void;
  onAiGoesFirstChange: (aiGoesFirst: boolean) => void;
  onDifficultyChange: (difficulty: DifficultyLevel) => void;
  onStartGame: () => void;
};

export default function GameSetupPanel({
  maxRounds,
  roundOptions,
  aiGoesFirst,
  circleEnabled,
  difficulty,
  difficultyLevels,
  difficultyDescriptions,
  localPlayerName,
  aiPlayerName,
  isGeneratingTopic,
  productionMode,
  productionModelName,
  onMaxRoundsChange,
  onAiGoesFirstChange,
  onDifficultyChange,
  onStartGame,
}: GameSetupPanelProps) {
  return (
    <div className="text-center">
      <p className="mb-6 text-lg">
        Welcome to the Glass Bead Game, a turn-based graph of connected concepts.
      </p>

      <div className="mb-4 max-w-md mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-bold mb-3 text-left">Game Settings:</h3>

        <div className="mb-4">
          <label className="block text-left mb-2 font-medium">Number of Rounds:</label>
          <div className="flex flex-wrap gap-2 justify-center">
            {roundOptions.map(option => (
              <button
                key={option}
                onClick={() => onMaxRoundsChange(option)}
                className={`px-3 py-1 rounded-full text-sm ${
                  maxRounds === option
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-left mb-2 font-medium">Who Goes First:</label>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onAiGoesFirstChange(false)}
              className={`px-4 py-2 rounded ${
                !aiGoesFirst
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {localPlayerName} First
            </button>
            <button
              onClick={() => onAiGoesFirstChange(true)}
              className={`px-4 py-2 rounded ${
                aiGoesFirst
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {aiPlayerName} First
            </button>
          </div>
        </div>

        <div>
          <label className="block text-left mb-2 font-medium">Game Difficulty:</label>
          <select
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value as DifficultyLevel)}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {difficultyLevels.map(level => (
              <option key={level} value={level}>
                {formatDifficultyLabel(level)}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">
            {difficultyDescriptions[difficulty]}
          </p>
        </div>
      </div>

      {!productionMode && <ModelSelector />}

      {productionMode && (
        <div className="mb-4 max-w-md mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-bold mb-2 text-left">AI Model:</h3>
          <p className="text-sm">
            This game uses {productionModelName} for all AI interactions.
          </p>
        </div>
      )}

      <div className="mb-6 text-center">
        <button
          onClick={onStartGame}
          disabled={isGeneratingTopic}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {isGeneratingTopic ? 'Generating Topic...' : 'Start Game'}
        </button>
      </div>

      <div className="mb-6 text-left max-w-md mx-auto">
        <h3 className="font-bold mb-2">Rules:</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>The game starts with a randomly generated topic node.</li>
          <li>Players take turns adding a new topic connected to the selected source topic.</li>
          <li><strong>Responses should be brief</strong> - ideally a single word or short phrase (1-5 words). The quality of the conceptual connection is what matters, not the length of your response.</li>
          <li>Select an older topic in the graph or history to branch from it.</li>
          <li>Use the + controls to connect a new topic to multiple source topics.</li>
          <li>The game lasts for {maxRounds} rounds ({getTurnsEachLabel(maxRounds)}).</li>
          {circleEnabled && (
            <li>In the final round, the response must connect back to the original starting topic.</li>
          )}
          <li>Responses are evaluated based on:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>Semantic Distance (1-10):</strong> How semantically remote yet meaningfully connected is the new topic from the selected source topic or topics? Higher scores for connections that are not obvious.</li>
              <li><strong>Relevance (1-10):</strong> How meaningful and appropriate is the connection? For example, stock market crash and flocking behavior.</li>
            </ul>
          </li>
          <li>Each source connection is scored by multiplying those two components; multi-source turns combine edge scores with diminishing returns.</li>
          {circleEnabled && (
            <li>The final round is scored based on both the connection to the previous topic and the connection back to the original topic.</li>
          )}
          <li>The player with the highest total score at the end wins!</li>
        </ol>
      </div>
    </div>
  );
}
