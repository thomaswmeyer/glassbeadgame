"use client";

import { useState } from 'react';
import CurrentTurnSourcesPanel from './CurrentTurnSourcesPanel';
import EvaluationResultsPanel from './EvaluationResultsPanel';
import GameSetupPanel from './GameSetupPanel';
import ScoreTooltip from './ScoreTooltip';
import SimpleConceptGraph from './SimpleConceptGraph';
import TurnResponsePanel from './TurnResponsePanel';
import TurnHistoryTable from './TurnHistoryTable';
import { LLM_CONFIG } from '@/config/llm';
import {
  CurrentEvaluationEdgeScore,
  Score,
  TurnHistoryRow,
  addActiveSourceNode,
  removeActiveSourceNode,
  selectActiveSourceRows,
  selectHasBranchedSourceSelection,
  selectSetupPlayerNames,
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

export default function GameInterface() {
  const [maxRounds, setMaxRounds] = useState<number>(10);
  const [aiGoesFirst, setAiGoesFirst] = useState<boolean>(false);
  const circleEnabled = false;
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('undergrad');

  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    score: Score | null;
    edgeScores?: CurrentEvaluationEdgeScore[];
    isCircleMode: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    score: null,
    isCircleMode: false
  });

  const {
    gameState,
    setGameState,
    originalTopic,
    response,
    setResponse,
    currentEvaluation,
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
    circleEnabled,
    difficulty,
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
  const { localPlayerName, aiPlayerName } = selectSetupPlayerNames(playerScoreRows);
  const activeSourceRows = selectActiveSourceRows(gameState);
  const sourceSelectionLocked = showingResults || isEvaluating || isAiThinking || gameCompleted;
  const isOpeningTurn = gameStarted && !gameState.rootNodeId;
  const productionModelName = LLM_CONFIG.models[
    LLM_CONFIG.production.defaultModel as keyof typeof LLM_CONFIG.models
  ].displayName;

  const handleSelectHistoryItem = (historyItem: TurnHistoryRow) => {
    if (sourceSelectionLocked) {
      // Don't allow selection during evaluation or when showing results
      return;
    }

    const sourceNodeId = historyItem.destinationNode.id;

    setSelectedGraphNodeId(sourceNodeId);
    if (sourceNodeId) {
      setGameState(prev => setSingleActiveSourceNode(prev, sourceNodeId));
    }
    
    console.log(`Selected previous topic: "${historyItem.destinationNode.topic}" from round ${historyItem.turn.round}`);
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
    setGameState(prev => setSingleActiveSourceNode(prev, nodeId));
  };

  const handleAddSourceNode = (nodeId: string) => {
    if (sourceSelectionLocked) return;
    setGameState(prev => addActiveSourceNode(prev, nodeId));
  };

  const handleRemoveSourceNode = (nodeId: string) => {
    if (sourceSelectionLocked) return;
    setGameState(prev => removeActiveSourceNode(prev, nodeId));
  };

  // Function to handle showing the tooltip
  const handleScoreMouseEnter = (
    e: React.MouseEvent,
    score: Score,
    isCircleRound: boolean,
    edgeScores?: CurrentEvaluationEdgeScore[]
  ) => {
    // Calculate tooltip position to ensure it stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Initial position (offset from cursor)
    let xPos = e.clientX + 10;
    let yPos = e.clientY + 10;
    
    // Estimate tooltip dimensions (we'll adjust these based on content)
    const estimatedWidth = isCircleRound ? 300 : 250;
    const estimatedHeight = isCircleRound ? 350 : 200;
    
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
      isCircleMode: isCircleRound
    });
  };
  
  // Function to handle hiding the tooltip
  const handleScoreMouseLeave = () => {
    setTooltipData(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8">The Glass Bead Game</h1>
      
      {!gameStarted ? (
        <GameSetupPanel
          maxRounds={maxRounds}
          roundOptions={DEFAULT_ROUND_OPTIONS}
          aiGoesFirst={aiGoesFirst}
          circleEnabled={circleEnabled}
          difficulty={difficulty}
          difficultyLevels={DEFAULT_DIFFICULTY_LEVELS}
          difficultyDescriptions={difficultyDescriptions}
          localPlayerName={localPlayerName}
          aiPlayerName={aiPlayerName}
          isGeneratingTopic={isGeneratingTopic}
          productionMode={LLM_CONFIG.production.isProduction}
          productionModelName={productionModelName}
          onMaxRoundsChange={setMaxRounds}
          onAiGoesFirstChange={setAiGoesFirst}
          onDifficultyChange={setDifficulty}
          onStartGame={startGame}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main game area - left side */}
          <div className="flex-1">
            <CurrentTurnSourcesPanel
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

            {!showingResults ? (
              <TurnResponsePanel
                isCurrentPlayerManual={isCurrentPlayerManual}
                isOpeningTurn={isOpeningTurn}
                playerName={currentPlayerModel?.name}
                response={response}
                isEvaluating={isEvaluating}
                isFinalCircleRound={currentRound === maxRounds && circleEnabled}
                currentSourceTopicText={currentSourceTopicText}
                originalTopic={originalTopic}
                hasBranchedSourceSelection={hasBranchedSourceSelection}
                onResponseChange={setResponse}
                onSubmit={evaluateResponse}
              />
            ) : currentEvaluation && (
              <EvaluationResultsPanel
                currentEvaluation={currentEvaluation}
                circleEnabled={circleEnabled}
                currentRound={currentRound}
                maxRounds={maxRounds}
                gameCompleted={gameCompleted}
                playerScoreRows={playerScoreRows}
                onNextTurn={advanceTurn}
                onRestart={restartGame}
                onReturnToSettings={returnToSettings}
              />
            )}
            
            {gameStarted && gameState.rootNodeId && (
              <TurnHistoryTable
                activeSourceNodeIds={gameState.activeSourceNodeIds}
                canSelectHistoryRows={!sourceSelectionLocked}
                circleEnabled={circleEnabled}
                currentRound={currentRound}
                currentPlayerKind={currentPlayerModel?.kind}
                currentPlayerName={currentPlayerModel?.name}
                currentSourceTopicText={currentSourceTopicText}
                currentTopicNodeId={gameState.activeSourceNodeIds.length === 1 ? gameState.activeSourceNodeIds[0] : null}
                maxRounds={maxRounds}
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
              />
            )}
          </div>
          
          {/* Concept graph visualization - right side */}
          <div className="w-full lg:w-[450px] sticky top-6 self-start">
            <SimpleConceptGraph 
              nodes={graphRenderData.nodes}
              edges={graphRenderData.edges}
              width={450}
              height={500}
              interactionsDisabled={sourceSelectionLocked}
              onNodeClick={handleGraphNodeClick}
              onAddSourceNode={handleAddSourceNode}
              onRemoveSourceNode={handleRemoveSourceNode}
            />
          </div>
        </div>
      )}
      
      <ScoreTooltip tooltipData={tooltipData} />
    </div>
  );
}
