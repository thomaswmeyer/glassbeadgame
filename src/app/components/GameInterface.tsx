"use client";

import { useState, KeyboardEvent } from 'react';
import EvaluationResultsPanel from './EvaluationResultsPanel';
import ModelSelector from './ModelSelector';
import ScoreTooltip from './ScoreTooltip';
import SelectedNodePanel from './SelectedNodePanel';
import SimpleConceptGraph from './SimpleConceptGraph';
import TurnHistoryTable, { getPlayerBadgeClass } from './TurnHistoryTable';
import { LLM_CONFIG } from '@/config/llm';
import {
  DEFAULT_ROOT_NODE_ID,
  Score,
  TurnHistoryRow,
  addActiveSourceNode,
  removeActiveSourceNode,
  selectActiveSourceNodeStatus,
  selectRootDefinitionTarget,
  selectSelectedGraphNodeView,
  selectSingleActiveSourceDefinitionTarget,
  setSelectedNodeIds,
} from '@/domain/game';
import { DifficultyLevel, useGameController } from '@/app/hooks/useGameController';
import { useDefinitions } from '@/app/hooks/useDefinitions';
import { gameApi } from '@/app/services/gameApi';

export default function GameInterface() {
  // New state variables for user settings
  const [maxRounds, setMaxRounds] = useState<number>(10);
  const [aiGoesFirst, setAiGoesFirst] = useState<boolean>(false);
  const circleEnabled = false;
  const [roundOptions] = useState<number[]>([4, 6, 8, 10, 12, 14, 16, 20]);
  
  // Simplified difficulty level - single setting for both concept and AI
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('undergrad');
  const difficultyLevels: DifficultyLevel[] = ['secondary', 'undergrad', 'grad', 'unlimited'];
  
  // Difficulty level descriptions
  const difficultyDescriptions = {
    secondary: "High school level concepts and vocabulary",
    undergrad: "Recognizable undergraduate-level academic concepts",
    grad: "Specialized graduate-level concepts",
    unlimited: "Advanced, obscure, and highly technical concepts"
  };

  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    score: Score | null;
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
    activeSourceNodes,
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
    hideDefinition,
    isDefinitionLoading,
    showDefinition,
  } = useDefinitions({
    gameState,
    setGameState,
    services: gameApi,
  });

  const latestTurnId = gameState.turnOrder[gameState.turnOrder.length - 1];
  const defaultSourceNodeId = latestTurnId
    ? gameState.turnsById[latestTurnId]?.destinationNodeId
    : gameState.rootNodeId;
  const hasBranchedSourceSelection = Boolean(
    defaultSourceNodeId &&
    (
      gameState.activeSourceNodeIds.length !== 1 ||
      gameState.activeSourceNodeIds[0] !== defaultSourceNodeId
    )
  );
  const localPlayerName = playerScoreRows.find(row => row.player.kind === 'local')?.player.name || 'Local player';
  const aiPlayerName = playerScoreRows.find(row => row.player.kind === 'ai')?.player.name || 'AI player';

  const generateFirstTopic = async () => {
    await startGame();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && response.trim()) {
      e.preventDefault();
      evaluateResponse();
    }
  };

  const handleSelectHistoryItem = (historyItem: TurnHistoryRow) => {
    if (showingResults || isEvaluating || isAiThinking || gameCompleted) {
      // Don't allow selection during evaluation or when showing results
      return;
    }

    const sourceNodeId = historyItem.destinationNode.id;

    setSelectedGraphNodeId(sourceNodeId);
    if (sourceNodeId) {
      setGameState(prev => ({
        ...setSelectedNodeIds(prev, [sourceNodeId]),
        activeSourceNodeIds: [sourceNodeId],
      }));
    }
    
    console.log(`Selected previous topic: "${historyItem.destinationNode.topic}" from round ${historyItem.turn.round}`);
  };

  const getTopicGraphNodeId = (topicValue: string, beforeHistoryIndex = turnHistoryRows.length) => {
    const normalizedTopic = topicValue.trim();
    if (!normalizedTopic) return null;

    if (normalizedTopic === originalTopic) {
      return gameState.rootNodeId || DEFAULT_ROOT_NODE_ID;
    }

    for (let index = Math.min(beforeHistoryIndex - 1, turnHistoryRows.length - 1); index >= 0; index--) {
      if (turnHistoryRows[index].destinationNode.topic === normalizedTopic) {
        return turnHistoryRows[index]?.destinationNode.id || null;
      }
    }

    return null;
  };

  const handleTopicRowClick = (topicValue: string, beforeHistoryIndex?: number) => {
    const nodeId = getTopicGraphNodeId(topicValue, beforeHistoryIndex);
    if (nodeId) {
      handleGraphNodeClick(nodeId);
    }
  };

  const handleGraphNodeClick = (nodeId: string) => {
    setSelectedGraphNodeId(nodeId);

    if (nodeId === gameState.rootNodeId) {
      return;
    }

    return;
  };

  const currentTopicDefinitionTarget = selectSingleActiveSourceDefinitionTarget(gameState);
  const currentTopicNode = currentTopicDefinitionTarget
    ? gameState.nodesById[currentTopicDefinitionTarget.nodeId]
    : null;
  const currentTopicDefinition = currentTopicNode?.definition || null;
  const currentTopicDefinitionVisible = Boolean(
    currentTopicDefinition && currentTopicNode?.definitionVisible
  );
  const isLoadingCurrentTopicDefinition = currentTopicDefinitionTarget
    ? isDefinitionLoading(currentTopicDefinitionTarget.nodeId)
    : false;

  const originalTopicDefinitionTarget = selectRootDefinitionTarget(gameState);
  const originalTopicNode = originalTopicDefinitionTarget
    ? gameState.nodesById[originalTopicDefinitionTarget.nodeId]
    : null;
  const originalTopicDefinition = originalTopicNode?.definition || null;
  const originalTopicDefinitionVisible = Boolean(
    originalTopicDefinition && originalTopicNode?.definitionVisible
  );
  const isLoadingOriginalTopicDefinition = originalTopicDefinitionTarget
    ? isDefinitionLoading(originalTopicDefinitionTarget.nodeId)
    : false;

  const handleCurrentTopicDefinitionClick = async () => {
    if (!currentTopicDefinitionTarget || isGeneratingTopic) return;

    if (currentTopicDefinitionVisible) {
      hideDefinition(currentTopicDefinitionTarget.nodeId);
      return;
    }

    await fetchDefinition(currentTopicDefinitionTarget);
  };

  const handleOriginalTopicDefinitionClick = async () => {
    if (!originalTopicDefinitionTarget) return;

    if (originalTopicDefinitionVisible) {
      hideDefinition(originalTopicDefinitionTarget.nodeId);
      return;
    }

    await fetchDefinition(originalTopicDefinitionTarget);
  };

  const selectedGraphNode = selectSelectedGraphNodeView(gameState, selectedGraphNodeId);

  const selectedGraphTopicNode = selectedGraphNode ? gameState.nodesById[selectedGraphNode.id] : null;
  const selectedGraphNodeDefinition = selectedGraphTopicNode?.definition || null;
  const selectedGraphSourceStatus = selectedGraphNode
    ? selectActiveSourceNodeStatus(gameState, selectedGraphNode.id)
    : null;
  const selectedGraphNodeIsActiveSource = Boolean(selectedGraphSourceStatus?.isActiveSource);
  const shouldShowSelectedGraphNodePanel = Boolean(
    selectedGraphNode &&
    (!selectedGraphNodeIsActiveSource || activeSourceNodes.length > 1)
  );

  const fetchSelectedGraphNodeDefinition = async () => {
    if (!selectedGraphNode) return;
    await fetchDefinition({
      nodeId: selectedGraphNode.id,
      topic: selectedGraphNode.topicForDefinition,
    });
  };
  const isLoadingSelectedGraphNodeDefinition = selectedGraphNode
    ? isDefinitionLoading(selectedGraphNode.id)
    : false;

  const handleToggleSelectedGraphNodeSource = () => {
    if (!selectedGraphNode || showingResults || isEvaluating || isAiThinking || gameCompleted) return;

    setGameState(prev => {
      if (prev.activeSourceNodeIds.includes(selectedGraphNode.id)) {
        return removeActiveSourceNode(prev, selectedGraphNode.id);
      }

      return addActiveSourceNode(prev, selectedGraphNode.id);
    });
  };

  // Function to handle showing the tooltip
  const handleScoreMouseEnter = (e: React.MouseEvent, score: Score, isCircleRound: boolean) => {
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
        <div className="text-center">
          <p className="mb-6 text-lg">
            Welcome to the Glass Bead Game, a turn-based journey of connected concepts.
          </p>
          
          {/* Game settings */}
          <div className="mb-4 max-w-md mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-bold mb-3 text-left">Game Settings:</h3>
            
            <div className="mb-4">
              <label className="block text-left mb-2 font-medium">Number of Rounds:</label>
              <div className="flex flex-wrap gap-2 justify-center">
                {roundOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => setMaxRounds(option)}
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
                  onClick={() => setAiGoesFirst(false)}
                  className={`px-4 py-2 rounded ${
                    !aiGoesFirst 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {localPlayerName} First
                </button>
                <button
                  onClick={() => setAiGoesFirst(true)}
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
            
            {/* Single difficulty selector */}
            <div className="mb-0">
              <label className="block text-left mb-2 font-medium">Game Difficulty:</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {difficultyLevels.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {difficultyDescriptions[difficulty]}
              </p>
            </div>
          </div>
          
          {/* Add the ModelSelector component if not in production mode */}
          {!LLM_CONFIG.production.isProduction && <ModelSelector />}
          
          {/* Display model info in production mode */}
          {LLM_CONFIG.production.isProduction && (
            <div className="mb-4 max-w-md mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-bold mb-2 text-left">AI Model:</h3>
              <p className="text-sm">
                This game uses {LLM_CONFIG.models[LLM_CONFIG.production.defaultModel as keyof typeof LLM_CONFIG.models].displayName} for all AI interactions.
              </p>
            </div>
          )}
          
          <div className="mb-6 text-center">
            <button
              onClick={generateFirstTopic}
              disabled={isGeneratingTopic}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {isGeneratingTopic ? 'Generating Topic...' : 'Start Game'}
            </button>
          </div>
          
          <div className="mb-6 text-left max-w-md mx-auto">
            <h3 className="font-bold mb-2">Rules:</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>The game starts with a randomly generated topic.</li>
              <li>Players take turns responding to the current topic with a brief answer.</li>
              <li><strong>Responses should be brief</strong> - ideally a single word or short phrase (1-5 words). The quality of the conceptual connection is what matters, not the length of your response.</li>
              <li>Each response becomes the topic for the next round.</li>
              <li>The game lasts for {maxRounds} rounds ({Math.ceil(maxRounds/2)} turns each).</li>
              {circleEnabled && (
                <li>In the final round, the response must connect back to the original starting topic.</li>
              )}
              <li>Responses are evaluated based on:
                <ul className="list-disc pl-5 mt-1">
                  <li><strong>Semantic Distance (1-10):</strong> How semantically remote yet meaningfully connected is the overall topic from the prompt? Higher scores for connections that are not obvious.</li>
                  <li><strong>Similarity (1-10):</strong> How well do the ideas map onto each other? For example, stock market crash and flocking behavior.</li>
                </ul>
              </li>
              {circleEnabled && (
                <li>The final round is scored based on both the connection to the previous topic and the connection back to the original topic.</li>
              )}
              <li>The player with the highest total score at the end wins!</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main game area - left side */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <h2 className="text-xl font-semibold mr-2">Topic:</h2>
                {currentRound === 1 && (
                  <span className="text-xs bg-yellow-100 px-2 py-1 rounded-full">Starting Topic</span>
                )}
                {currentRound === maxRounds && circleEnabled && (
                  <span className="text-xs bg-red-100 px-2 py-1 rounded-full">Final Round - Connect back to "{originalTopic}"</span>
                )}
                {currentRound === maxRounds && !circleEnabled && (
                  <span className="text-xs bg-orange-100 px-2 py-1 rounded-full">Final Round</span>
                )}
                {hasBranchedSourceSelection && (
                  <span className="text-xs bg-purple-100 px-2 py-1 rounded-full ml-2">Custom Selected Topic</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Round {currentRound}/{maxRounds}</span>
                <div className="flex gap-2">
                  {playerScoreRows.map(scoreRow => (
                    <span
                      key={scoreRow.player.id}
                      className={`text-sm font-medium px-3 py-1 rounded-full ${getPlayerBadgeClass(scoreRow.player.kind)}`}
                    >
                      {scoreRow.player.name}: {scoreRow.totalScore}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg mb-2">
              <div className="flex items-center justify-between">
                <p className="text-xl font-medium">
                  {isGeneratingTopic ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating new topic...
                    </span>
                  ) : (
                    currentSourceTopicText
                  )}
                </p>
                <button 
                  onClick={handleCurrentTopicDefinitionClick}
                  disabled={!currentTopicDefinitionTarget || isLoadingCurrentTopicDefinition || isGeneratingTopic}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 flex items-center"
                  title={currentTopicDefinitionTarget ? 'Show definition' : 'Definitions are available for a single selected source'}
                >
                  {isLoadingCurrentTopicDefinition ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {currentTopicDefinitionVisible ? 'Hide Definition' : 'Definition'}
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {currentTopicDefinitionVisible && currentTopicDefinition && (
              <div className="p-3 bg-blue-50 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Definition:</p>
                <p>{currentTopicDefinition}</p>
              </div>
            )}

            {shouldShowSelectedGraphNodePanel && selectedGraphNode && (
              <SelectedNodePanel
                selectedGraphNode={selectedGraphNode}
                selectedGraphNodeDefinition={selectedGraphNodeDefinition}
                definitionVisible={Boolean(selectedGraphTopicNode?.definitionVisible)}
                isLoadingDefinition={isLoadingSelectedGraphNodeDefinition}
                canToggleSource={!showingResults && !isEvaluating && !isAiThinking && !gameCompleted}
                isActiveSource={selectedGraphNodeIsActiveSource}
                canRemoveActiveSource={Boolean(selectedGraphSourceStatus?.canRemoveSource)}
                onClear={() => setSelectedGraphNodeId(null)}
                onFetchDefinition={fetchSelectedGraphNodeDefinition}
                onHideDefinition={() => hideDefinition(selectedGraphNode.id)}
                onShowDefinition={() => showDefinition(selectedGraphNode.id)}
                onToggleSource={handleToggleSelectedGraphNodeSource}
              />
            )}

            {activeSourceNodes.length > 0 && (
              <div className="p-3 bg-green-50 rounded-lg mb-4 text-sm border border-green-100">
                <p className="font-medium text-green-900 mb-2">Current turn sources</p>
                <div className="flex flex-wrap gap-2">
                  {activeSourceNodes.map(sourceNode => (
                    <span key={sourceNode.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white border border-green-200 text-green-900">
                      {sourceNode.topic}
                      {activeSourceNodes.length > 1 && (
                        <button
                          onClick={() => setGameState(prev => removeActiveSourceNode(prev, sourceNode.id))}
                          className="h-5 w-5 rounded-full bg-green-100 hover:bg-green-200 text-green-900 leading-none"
                          title="Remove source"
                        >
                          -
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {currentRound === maxRounds && circleEnabled && (
              <div className="p-3 bg-yellow-50 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Final Round Instructions:</p>
                <p>This is the final round! Your response should connect both to the current topic "{currentSourceTopicText}" AND back to the original topic "{originalTopic}".</p>
                
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={handleOriginalTopicDefinitionClick}
                    disabled={!originalTopicDefinitionTarget || isLoadingOriginalTopicDefinition}
                    className="text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded-full text-yellow-800 flex items-center"
                    title="Show original topic definition"
                  >
                    {isLoadingOriginalTopicDefinition ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-yellow-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {originalTopicDefinitionVisible ? 'Hide Original Topic Definition' : 'Original Topic Definition'}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {originalTopicDefinitionVisible && originalTopicDefinition && (
              <div className="p-3 bg-yellow-100 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Original Topic Definition ("{originalTopic}"):</p>
                <p>{originalTopicDefinition}</p>
              </div>
            )}

            {!showingResults ? (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  {isCurrentPlayerManual ? 'Your Response:' : `${currentPlayerModel?.name || 'Player'} is thinking...`}
                </h2>
                
                {isCurrentPlayerManual ? (
                  <>
                    <input
                      type="text"
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full p-4 border border-gray-300 rounded-lg"
                      placeholder={currentRound === maxRounds && circleEnabled
                        ? `Type a brief response (1-5 words) that connects to both "${currentSourceTopicText}" and "${originalTopic}"...`
                        : "Type a brief response (1-5 words) and press Enter..."}
                      disabled={isEvaluating}
                      autoFocus
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Keep your response concise (1-5 words) for best results. The quality of the conceptual connection is what matters.
                      {hasBranchedSourceSelection && (
                        <span className="text-purple-600 ml-1">
                          You're responding to selected graph sources.
                        </span>
                      )}
                    </p>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={evaluateResponse}
                        disabled={isEvaluating || !response.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
                      >
                        {isEvaluating ? 'Evaluating...' : 'Submit'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center min-h-[60px]">
                    <div className="flex items-center">
                      <div className="animate-pulse flex space-x-4">
                        <div className="h-3 w-3 bg-red-300 rounded-full"></div>
                        <div className="h-3 w-3 bg-red-300 rounded-full"></div>
                        <div className="h-3 w-3 bg-red-300 rounded-full"></div>
                      </div>
                      <span className="ml-3 text-gray-600">{currentPlayerModel?.name || 'Player'} is formulating a response...</span>
                    </div>
                  </div>
                )}
              </div>
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
            
            {gameStarted && (
              <TurnHistoryTable
                activeSourceNodeIds={gameState.activeSourceNodeIds}
                canSelectHistoryRows={!showingResults && !isEvaluating && !isAiThinking && !gameCompleted}
                circleEnabled={circleEnabled}
                currentRound={currentRound}
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
              onNodeClick={handleGraphNodeClick}
              onAddSourceNode={(nodeId) => setGameState(prev => addActiveSourceNode(prev, nodeId))}
              onRemoveSourceNode={(nodeId) => setGameState(prev => removeActiveSourceNode(prev, nodeId))}
            />
          </div>
        </div>
      )}
      
      <ScoreTooltip tooltipData={tooltipData} />
    </div>
  );
}
