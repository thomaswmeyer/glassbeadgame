"use client";

import { useMemo, useState } from 'react';
import CurrentTurnSourcesPanel from './CurrentTurnSourcesPanel';
import EvaluationResultsPanel from './EvaluationResultsPanel';
import GameSetupPanel from './GameSetupPanel';
import ScoreTooltip from './ScoreTooltip';
import ConceptGraph from './graph/ConceptGraph';
import TurnResponsePanel from './TurnResponsePanel';
import TurnHistoryTable from './TurnHistoryTable';
import { GameVisualTheme, cx } from './gameVisualTheme';
import {
  CurrentEvaluationEdgeScore,
  Score,
  TurnHistoryRow,
  addActiveSourceNode,
  removeActiveSourceNode,
  selectActiveSourceRows,
  selectHasBranchedSourceSelection,
  selectTopicNodeIdByTopic,
  setSingleActiveSourceNode,
} from '@/domain/game';
import { DifficultyLevel, useGameController } from '@/app/hooks/useGameController';
import { useDefinitions } from '@/app/hooks/useDefinitions';
import { gameApi } from '@/app/services/gameApi';
import {
  DEFAULT_DIFFICULTY_LEVELS,
  DEFAULT_ROUND_OPTIONS,
  difficultyDescriptions,
} from '@/domain/setupDisplay';
import {
  GamePlayerMode,
  createConfiguredPlayers,
  getPlayerNameAt,
} from '@/domain/playerSetup';

export default function GameInterface() {
  const [maxRounds, setMaxRounds] = useState<number>(10);
  const [playerMode, setPlayerMode] = useState<GamePlayerMode>('human-vs-ai');
  const [aiGoesFirst, setAiGoesFirst] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('undergrad');
  const [isSkeuomorphic, setIsSkeuomorphic] = useState<boolean>(true);
  const configuredPlayers = useMemo(() => createConfiguredPlayers(playerMode), [playerMode]);

  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    score: Score | null;
    edgeScores?: CurrentEvaluationEdgeScore[];
  }>({
    visible: false,
    x: 0,
    y: 0,
    score: null,
  });

  const {
    gameState,
    setGameState,
    response,
    setResponse,
    currentEvaluation,
    inlineEvaluation,
    clearInlineEvaluation,
    graphRenderData,
    currentPlayerModel,
    turnHistoryRows,
    selectedGraphNodeId,
    currentRound,
    isCurrentPlayerManual,
    playerScoreRows,
    currentSourceTopicText,
    gameStarted,
    isGeneratingTopic,
    isEvaluating,
    isAiThinking,
    showingResults,
    gameCompleted,
    setSelectedGraphNodeId,
    generateFirstTopic: startGame,
    evaluateResponse,
    handleNextTurn: advanceTurn,
    handleRestart: restartGame,
    handleReturnToSettings: returnToSettings,
  } = useGameController({
    maxRounds,
    aiGoesFirst,
    difficulty,
    players: configuredPlayers,
  });

  const {
    fetchDefinition,
    isDefinitionLoading,
  } = useDefinitions({
    gameState,
    setGameState,
    services: gameApi,
  });

  const hasBranchedSourceSelection = selectHasBranchedSourceSelection(gameState);
  const firstPlayerName = getPlayerNameAt(configuredPlayers, 0, 'Player 1');
  const secondPlayerName = getPlayerNameAt(configuredPlayers, 1, 'Player 2');
  const activeSourceRows = selectActiveSourceRows(gameState);
  const sourceSelectionLocked = isEvaluating || isAiThinking || gameCompleted;
  const isOpeningTurn = gameStarted && !gameState.rootNodeId;
  const productionModelName = 'the configured LLM model';
  const visualTheme: GameVisualTheme = isSkeuomorphic ? 'bead-table' : 'classic';
  const isBeadTableTheme = visualTheme === 'bead-table';
  const activeGraphRenderer = isSkeuomorphic ? 'webgl' : 'svg';

  const handleSelectHistoryItem = (historyItem: TurnHistoryRow) => {
    if (sourceSelectionLocked) {
      // Don't allow selection while a turn is being generated or scored.
      return;
    }

    const sourceNodeId = historyItem.destinationNode.id;

    setSelectedGraphNodeId(sourceNodeId);
    if (sourceNodeId) {
      clearInlineEvaluation();
      setGameState(prev => setSingleActiveSourceNode(prev, sourceNodeId));
    }
    
    console.log(`Selected previous topic: "${historyItem.destinationNode.topic}" from round ${historyItem.turn.round}`);
  };

  const handleAddHistoryItem = (historyItem: TurnHistoryRow) => {
    if (sourceSelectionLocked) {
      return;
    }

    clearInlineEvaluation();
    setGameState(prev => addActiveSourceNode(prev, historyItem.destinationNode.id));
  };

  const getTopicGraphNodeId = (topicValue: string, beforeHistoryIndex = turnHistoryRows.length) => {
    return selectTopicNodeIdByTopic(gameState, topicValue, beforeHistoryIndex);
  };

  const handleTopicRowClick = (topicValue: string, beforeHistoryIndex?: number) => {
    const nodeId = getTopicGraphNodeId(topicValue, beforeHistoryIndex);
    if (nodeId) {
      handleGraphNodeClick(nodeId);
    }
  };

  const handleGraphNodeClick = (nodeId: string) => {
    if (sourceSelectionLocked) {
      return;
    }

    setSelectedGraphNodeId(nodeId);
    clearInlineEvaluation();
    setGameState(prev => setSingleActiveSourceNode(prev, nodeId));
  };

  const handleAddSourceNode = (nodeId: string) => {
    if (sourceSelectionLocked) return;
    clearInlineEvaluation();
    setGameState(prev => addActiveSourceNode(prev, nodeId));
  };

  const handleRemoveSourceNode = (nodeId: string) => {
    if (sourceSelectionLocked) return;
    clearInlineEvaluation();
    setGameState(prev => removeActiveSourceNode(prev, nodeId));
  };

  // Function to handle showing the tooltip
  const handleScoreMouseEnter = (
    e: React.MouseEvent,
    score: Score,
    edgeScores?: CurrentEvaluationEdgeScore[]
  ) => {
    // Calculate tooltip position to ensure it stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Initial position (offset from cursor)
    let xPos = e.clientX + 10;
    let yPos = e.clientY + 10;
    
    // Estimate tooltip dimensions (we'll adjust these based on content)
    const estimatedWidth = 250;
    const estimatedHeight = 200;
    
    // Adjust position if tooltip would go off-screen
    if (xPos + estimatedWidth > viewportWidth - 20) {
      xPos = Math.max(20, e.clientX - estimatedWidth - 10); // Show on left side of cursor
    }
    
    if (yPos + estimatedHeight > viewportHeight - 20) {
      yPos = Math.max(20, e.clientY - estimatedHeight - 10); // Show above cursor
    }
    
    setTooltipData({
      visible: true,
      x: xPos,
      y: yPos,
      score,
      edgeScores,
    });
  };
  
  // Function to handle hiding the tooltip
  const handleScoreMouseLeave = () => {
    setTooltipData(prev => ({ ...prev, visible: false }));
  };

  if (!gameStarted) {
    return (
      <div className={cx(
        'min-h-screen w-full p-4 lg:p-6',
        isBeadTableTheme
          ? 'bg-[#17100a] text-[#24180f]'
          : 'bg-white text-gray-950'
      )}>
        <div className={cx(
          'mx-auto max-w-7xl rounded-lg border p-6',
          isBeadTableTheme
            ? 'border-[#6d5730] bg-[#efe2c3] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(0,0,0,0.35)]'
            : 'border-transparent bg-white shadow-lg'
        )}>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="w-32 shrink-0" aria-hidden="true" />
            <h1 className={cx(
              'text-center text-3xl font-bold',
              isBeadTableTheme && 'gbg-small-caps font-serif tracking-normal text-[#2d1d12]'
            )}>
              The Glass Bead Game
            </h1>
            <SkeuomorphicToggle
              enabled={isSkeuomorphic}
              visualTheme={visualTheme}
              onToggle={() => setIsSkeuomorphic(value => !value)}
            />
          </div>
          <GameSetupPanel
            visualTheme={visualTheme}
            maxRounds={maxRounds}
            roundOptions={DEFAULT_ROUND_OPTIONS}
            playerMode={playerMode}
            aiGoesFirst={aiGoesFirst}
            difficulty={difficulty}
            difficultyLevels={DEFAULT_DIFFICULTY_LEVELS}
            difficultyDescriptions={difficultyDescriptions}
            firstPlayerName={firstPlayerName}
            secondPlayerName={secondPlayerName}
            isGeneratingTopic={isGeneratingTopic}
            productionModelName={productionModelName}
            onMaxRoundsChange={setMaxRounds}
            onPlayerModeChange={setPlayerMode}
            onAiGoesFirstChange={setAiGoesFirst}
            onDifficultyChange={setDifficulty}
            onStartGame={startGame}
          />
          <ScoreTooltip visualTheme={visualTheme} tooltipData={tooltipData} />
        </div>
      </div>
    );
  }

  return (
    <div className={cx(
      'min-h-screen w-full p-4 lg:p-6',
      isBeadTableTheme
        ? 'bg-[#17100a] text-[#24180f]'
        : 'bg-white text-gray-950'
    )}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className={cx(
          'text-3xl font-bold',
          isBeadTableTheme && 'gbg-small-caps font-serif tracking-normal text-[#f4e8cc]'
        )}>
          The Glass Bead Game
        </h1>
        <SkeuomorphicToggle
          enabled={isSkeuomorphic}
          visualTheme={visualTheme}
          onToggle={() => setIsSkeuomorphic(value => !value)}
        />
      </div>

      <div className="flex min-h-0 w-full flex-col gap-4 lg:h-[calc(100vh-7rem)] lg:flex-row">
        <div className={cx(
          'w-full shrink-0 overflow-y-auto rounded-md border p-4 lg:w-[560px]',
          isBeadTableTheme
            ? 'border-[#6d5730] bg-[#efe2c3] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(0,0,0,0.35)]'
            : 'border-gray-200 bg-white shadow-sm'
        )}>
          <CurrentTurnSourcesPanel
            visualTheme={visualTheme}
            activeSourceRows={activeSourceRows}
            currentRound={currentRound}
            maxRounds={maxRounds}
            playerScoreRows={playerScoreRows}
            isGeneratingTopic={isGeneratingTopic}
            isSourceSelectionLocked={sourceSelectionLocked}
            isDefinitionLoading={isDefinitionLoading}
            onFetchDefinition={(nodeId, topic) => fetchDefinition({ nodeId, topic })}
            onRemoveSource={handleRemoveSourceNode}
          />

          {!showingResults && inlineEvaluation && (
            <EvaluationResultsPanel
              visualTheme={visualTheme}
              currentEvaluation={inlineEvaluation}
              compact
              gameCompleted={false}
              playerScoreRows={playerScoreRows}
              onNextTurn={advanceTurn}
              onRestart={restartGame}
              onReturnToSettings={returnToSettings}
            />
          )}

          {!showingResults ? (
            <TurnResponsePanel
              visualTheme={visualTheme}
              isCurrentPlayerManual={isCurrentPlayerManual}
              isOpeningTurn={isOpeningTurn}
              playerName={currentPlayerModel?.name}
              response={response}
              isEvaluating={isEvaluating}
              hasBranchedSourceSelection={hasBranchedSourceSelection}
              onResponseChange={setResponse}
              onSubmit={evaluateResponse}
            />
          ) : currentEvaluation && (
            <EvaluationResultsPanel
              visualTheme={visualTheme}
              currentEvaluation={currentEvaluation}
              gameCompleted={gameCompleted}
              playerScoreRows={playerScoreRows}
              onNextTurn={advanceTurn}
              onRestart={restartGame}
              onReturnToSettings={returnToSettings}
            />
          )}

          {gameState.rootNodeId && (
            <TurnHistoryTable
              visualTheme={visualTheme}
              activeSourceNodeIds={gameState.activeSourceNodeIds}
              canSelectHistoryRows={!sourceSelectionLocked}
              showCurrentTurnRow={!showingResults}
              currentRound={currentRound}
              currentPlayerKind={currentPlayerModel?.kind}
              currentPlayerName={currentPlayerModel?.name}
              currentSourceTopicText={currentSourceTopicText}
              currentTopicNodeId={gameState.activeSourceNodeIds.length === 1 ? gameState.activeSourceNodeIds[0] : null}
              selectedGraphNodeId={selectedGraphNodeId}
              turnHistoryRows={turnHistoryRows}
              getTopicGraphNodeId={getTopicGraphNodeId}
              onCurrentTopicClick={() => {
                const currentTopicNodeId = gameState.activeSourceNodeIds.length === 1
                  ? gameState.activeSourceNodeIds[0]
                  : null;
                if (currentTopicNodeId) handleGraphNodeClick(currentTopicNodeId);
              }}
              onHistoryTopicClick={handleTopicRowClick}
              onScoreMouseEnter={handleScoreMouseEnter}
              onScoreMouseLeave={handleScoreMouseLeave}
              onSelectHistoryItem={handleSelectHistoryItem}
              onAddHistoryItem={handleAddHistoryItem}
            />
          )}
        </div>

        <div className="min-h-[560px] min-w-0 flex-1 lg:h-full">
          <ConceptGraph
            renderer={activeGraphRenderer}
            nodes={graphRenderData.nodes}
            edges={graphRenderData.edges}
            width={900}
            height={650}
            interactionsDisabled={sourceSelectionLocked}
            onNodeClick={handleGraphNodeClick}
            onAddSourceNode={handleAddSourceNode}
            onRemoveSourceNode={handleRemoveSourceNode}
          />
        </div>
      </div>

      <ScoreTooltip visualTheme={visualTheme} tooltipData={tooltipData} />
    </div>
  );
}

function SkeuomorphicToggle({
  enabled,
  visualTheme,
  onToggle,
}: {
  enabled: boolean;
  visualTheme: GameVisualTheme;
  onToggle: () => void;
}) {
  const isBeadTableTheme = visualTheme === 'bead-table';

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className={cx(
        'w-32 shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        isBeadTableTheme
          ? 'border-[#b99a58] bg-[#f7e7bd] text-[#4a321d] hover:bg-[#fff0c2]'
          : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
      )}
    >
      Skeuomorphic: {enabled ? 'On' : 'Off'}
    </button>
  );
}
