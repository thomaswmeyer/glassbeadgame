"use client";

import { useState, KeyboardEvent, useRef } from 'react';
import ModelSelector from './ModelSelector';
import SimpleConceptGraph from './SimpleConceptGraph';
import { LLM_CONFIG } from '@/config/llm';
import {
  DEFAULT_ROOT_NODE_ID,
  Score,
  addActiveSourceNode,
  removeActiveSourceNode,
  setNodeDefinitionVisibility,
  setSelectedNodeIds,
  updateNodeDefinition,
} from '@/domain/game';
import { DifficultyLevel, useGameController } from '@/app/hooks/useGameController';
import { gameApi } from '@/app/services/gameApi';

// Define the GameHistory type to match what SimpleConceptGraph expects
interface GameHistory {
  round: number;
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  player: 'human' | 'ai';
}

function normalizeDefinitionTopic(topic: string) {
  return topic.trim().toLowerCase();
}

export default function GameInterface() {
  const definitionCacheRef = useRef<Map<string, string>>(new Map());
  const [, setDefinitionCacheVersion] = useState<number>(0);
  const [topicDefinition, setTopicDefinition] = useState<string>('');
  const [showDefinition, setShowDefinition] = useState<boolean>(false);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState<boolean>(false);
  const [originalTopicDefinition, setOriginalTopicDefinition] = useState<string>('');
  const [showOriginalDefinition, setShowOriginalDefinition] = useState<boolean>(false);
  const [isLoadingOriginalDefinition, setIsLoadingOriginalDefinition] = useState<boolean>(false);
  const [isLoadingSelectedNodeDefinition, setIsLoadingSelectedNodeDefinition] = useState<boolean>(false);
  
  // New state variables for user settings
  const [maxRounds, setMaxRounds] = useState<number>(10);
  const [aiGoesFirst, setAiGoesFirst] = useState<boolean>(false);
  const [circleEnabled, setCircleEnabled] = useState<boolean>(false);
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
    topic,
    setTopic,
    originalTopic,
    response,
    setResponse,
    currentEvaluation,
    graphRenderData,
    selectedNodePanels,
    turnHistoryRows,
    gameHistory,
    selectedGraphNodeId,
    currentRound,
    currentPlayer,
    totalScores,
    activeSourceNodes,
    currentSourceTopicText,
    gameStarted,
    isGeneratingTopic,
    isEvaluating,
    isAiThinking,
    showingResults,
    gameCompleted,
    setSelectedGraphNodeId,
    findNodeIdByTopic,
    getSingleCurrentSourceNode,
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

  const hasBranchedSourceSelection = gameState.activeSourceNodeIds.length > 1 || (
    gameState.activeSourceNodeIds.length === 1 &&
    gameState.nodesById[gameState.activeSourceNodeIds[0]]?.topic !== topic
  );

  const generateFirstTopic = async () => {
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    await startGame();
  };

  const getCachedDefinition = async (definitionTopic: string) => {
    const cacheKey = normalizeDefinitionTopic(definitionTopic);
    const cachedDefinition = definitionCacheRef.current.get(cacheKey);

    if (cachedDefinition) {
      return cachedDefinition;
    }

    const definition = await gameApi.getDefinition(definitionTopic);
    definitionCacheRef.current.set(cacheKey, definition);
    setDefinitionCacheVersion(version => version + 1);
    return definition;
  };

  const fetchTopicDefinition = async () => {
    const singleSourceNode = getSingleCurrentSourceNode();
    const definitionTopic = singleSourceNode?.topic || topic;
    if (!definitionTopic || isLoadingDefinition) return;
    
    setIsLoadingDefinition(true);
    try {
      const definition = await getCachedDefinition(definitionTopic);
      setTopicDefinition(definition);
      const nodeId = singleSourceNode?.id || findNodeIdByTopic(definitionTopic);
      if (nodeId) {
        setGameState(prev => updateNodeDefinition(prev, nodeId, definition));
      }
      setShowDefinition(true);
    } catch (error) {
      console.error('Error fetching definition:', error);
      setTopicDefinition('Unable to fetch definition at this time.');
      setShowDefinition(true);
    } finally {
      setIsLoadingDefinition(false);
    }
  };

  const fetchOriginalTopicDefinition = async () => {
    if (!originalTopic || isLoadingOriginalDefinition) return;
    
    setIsLoadingOriginalDefinition(true);
    try {
      const definition = await getCachedDefinition(originalTopic);
      setOriginalTopicDefinition(definition);
      const nodeId = findNodeIdByTopic(originalTopic);
      if (nodeId) {
        setGameState(prev => updateNodeDefinition(prev, nodeId, definition));
      }
      setShowOriginalDefinition(true);
    } catch (error) {
      console.error('Error fetching original topic definition:', error);
      setOriginalTopicDefinition('Unable to fetch definition at this time.');
      setShowOriginalDefinition(true);
    } finally {
      setIsLoadingOriginalDefinition(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && response.trim()) {
      e.preventDefault();
      evaluateResponse();
    }
  };

  // New function to handle selecting a previous topic from history
  const handleSelectHistoryItem = (historyItem: GameHistory) => {
    if (showingResults || isEvaluating || isAiThinking || gameCompleted) {
      // Don't allow selection during evaluation or when showing results
      return;
    }

    const selectedIndex = gameHistory.findIndex(item =>
      item.round === historyItem.round &&
      item.topic === historyItem.topic &&
      item.response === historyItem.response
    );
    
    const sourceNodeId = selectedIndex === -1 ? null : turnHistoryRows[selectedIndex]?.destinationNode.id || null;

    setSelectedGraphNodeId(sourceNodeId);
    if (sourceNodeId) {
      setGameState(prev => ({
        ...setSelectedNodeIds(prev, [sourceNodeId]),
        activeSourceNodeIds: [sourceNodeId],
      }));
    }
    setTopic(historyItem.response); // Use the response as the new topic
    
    // Clear any existing definition since we're changing topics
    setShowDefinition(false);
    setTopicDefinition('');
    
    console.log(`Selected previous topic: "${historyItem.response}" from round ${historyItem.round}`);
  };

  const getTopicGraphNodeId = (topicValue: string, beforeHistoryIndex = gameHistory.length) => {
    const normalizedTopic = topicValue.trim();
    if (!normalizedTopic) return null;

    if (normalizedTopic === originalTopic) {
      return gameState.rootNodeId || DEFAULT_ROOT_NODE_ID;
    }

    for (let index = Math.min(beforeHistoryIndex - 1, gameHistory.length - 1); index >= 0; index--) {
      if (gameHistory[index].response === normalizedTopic) {
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

  const selectedGraphNode = (() => {
    if (!selectedGraphNodeId) return null;

    if (selectedGraphNodeId === gameState.rootNodeId) {
      return {
        id: gameState.rootNodeId,
        title: originalTopic,
        subtitle: 'Original topic',
        topicForDefinition: originalTopic,
        historyItem: null as GameHistory | null,
      };
    }

    const panel = selectedNodePanels.find(selectedPanel => selectedPanel.node.id === selectedGraphNodeId);
    const historyItem = gameHistory.find(item => item.response === panel?.node.topic) || null;
    if (!panel) return null;

    return {
      id: selectedGraphNodeId,
      title: panel.node.topic,
      subtitle: panel.player ? `${panel.player.name} topic` : 'Topic',
      topicForDefinition: panel.node.topic,
      historyItem,
    };
  })();

  const selectedGraphNodeDefinition = selectedGraphNode
    ? gameState.nodesById[selectedGraphNode.id]?.definition ||
      definitionCacheRef.current.get(normalizeDefinitionTopic(selectedGraphNode.topicForDefinition))
    : null;
  const selectedGraphTopicNode = selectedGraphNode ? gameState.nodesById[selectedGraphNode.id] : null;
  const selectedGraphNodeIsActiveSource = Boolean(
    selectedGraphNode && gameState.activeSourceNodeIds.includes(selectedGraphNode.id)
  );
  const shouldShowSelectedGraphNodePanel = Boolean(
    selectedGraphNode &&
    (!selectedGraphNodeIsActiveSource || activeSourceNodes.length > 1)
  );

  const fetchSelectedGraphNodeDefinition = async () => {
    if (!selectedGraphNode || isLoadingSelectedNodeDefinition) return;

    setIsLoadingSelectedNodeDefinition(true);
    try {
      const definition = await getCachedDefinition(selectedGraphNode.topicForDefinition);
      setGameState(prev => updateNodeDefinition(prev, selectedGraphNode.id, definition));
    } catch (error) {
      console.error('Error fetching selected node definition:', error);
    } finally {
      setIsLoadingSelectedNodeDefinition(false);
    }
  };

  const handleToggleSelectedGraphNodeSource = () => {
    if (!selectedGraphNode || showingResults || isEvaluating || isAiThinking || gameCompleted) return;

    setGameState(prev => {
      if (prev.activeSourceNodeIds.includes(selectedGraphNode.id)) {
        return removeActiveSourceNode(prev, selectedGraphNode.id);
      }

      return addActiveSourceNode(prev, selectedGraphNode.id);
    });
    setShowDefinition(false);
    setTopicDefinition('');
  };

  const handleRestart = () => {
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    setOriginalTopicDefinition('');
    setTopicDefinition('');
    restartGame();
  };

  const handleReturnToSettings = () => {
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    setOriginalTopicDefinition('');
    setTopicDefinition('');
    returnToSettings();
  };

  const handleNextTurn = () => {
    setShowDefinition(false);
    setShowOriginalDefinition(false);
    advanceTurn();
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
            Welcome to the Glass Bead Game! In this game, you'll compete against an AI opponent
            in a journey of connected concepts.
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
                  You First
                </button>
                <button
                  onClick={() => setAiGoesFirst(true)}
                  className={`px-4 py-2 rounded ${
                    aiGoesFirst 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  AI First
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
              <li>You and the AI will take turns responding to the current topic with a brief answer.</li>
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
                  <span className="text-sm font-medium bg-blue-100 px-3 py-1 rounded-full">You: {totalScores.human}</span>
                  <span className="text-sm font-medium bg-red-100 px-3 py-1 rounded-full">AI: {totalScores.ai}</span>
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
                  onClick={fetchTopicDefinition}
                  disabled={isLoadingDefinition || isGeneratingTopic}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 flex items-center"
                  title="Show definition"
                >
                  {isLoadingDefinition ? (
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
                      Definition
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {showDefinition && (
              <div className="p-3 bg-blue-50 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Definition:</p>
                <p>{topicDefinition}</p>
              </div>
            )}

            {shouldShowSelectedGraphNodePanel && selectedGraphNode && (
              <div className="p-3 bg-purple-50 rounded-lg mb-4 text-sm border border-purple-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-purple-900">{selectedGraphNode.title}</p>
                    <p className="text-xs text-purple-700">{selectedGraphNode.subtitle}</p>
                  </div>
                  <button
                    onClick={() => setSelectedGraphNodeId(null)}
                    className="text-xs px-2 py-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800"
                  >
                    Clear
                  </button>
                </div>

                {selectedGraphNode.historyItem && (
                  <div className="mt-2 text-gray-700">
                    <p>Topic: {selectedGraphNode.historyItem.topic}</p>
                    <p>Score: {selectedGraphNode.historyItem.scores.total}/20</p>
                  </div>
                )}

                {selectedGraphNodeDefinition && selectedGraphTopicNode?.definitionVisible ? (
                  <div className="mt-3 pt-3 border-t border-purple-100">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="font-medium">Definition:</p>
                      <button
                        onClick={() => setGameState(prev => setNodeDefinitionVisibility(prev, selectedGraphNode.id, false))}
                        className="text-xs px-2 py-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800"
                      >
                        Hide
                      </button>
                    </div>
                    <p>{selectedGraphNodeDefinition}</p>
                  </div>
                ) : selectedGraphNodeDefinition ? (
                  <button
                    onClick={() => setGameState(prev => setNodeDefinitionVisibility(prev, selectedGraphNode.id, true))}
                    className="mt-3 text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full"
                  >
                    Show Definition
                  </button>
                ) : (
                  <button
                    onClick={fetchSelectedGraphNodeDefinition}
                    disabled={isLoadingSelectedNodeDefinition}
                    className="mt-3 text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-full"
                  >
                    {isLoadingSelectedNodeDefinition ? 'Loading definition...' : 'Get Definition'}
                  </button>
                )}

                {!showingResults && !isEvaluating && !isAiThinking && !gameCompleted && (
                  <button
                    onClick={handleToggleSelectedGraphNodeSource}
                    disabled={selectedGraphNodeIsActiveSource && activeSourceNodes.length <= 1}
                    className="mt-3 ml-2 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full"
                  >
                    {selectedGraphNodeIsActiveSource ? 'Remove Source' : 'Add Source'}
                  </button>
                )}
              </div>
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
                    onClick={fetchOriginalTopicDefinition}
                    disabled={isLoadingOriginalDefinition}
                    className="text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded-full text-yellow-800 flex items-center"
                    title="Show original topic definition"
                  >
                    {isLoadingOriginalDefinition ? (
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
                        Original Topic Definition
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {showOriginalDefinition && (
              <div className="p-3 bg-yellow-100 rounded-lg mb-4 text-sm">
                <p className="font-medium mb-1">Original Topic Definition ("{originalTopic}"):</p>
                <p>{originalTopicDefinition}</p>
              </div>
            )}

            {!showingResults ? (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  {currentPlayer === 'human' ? 'Your Response:' : 'AI is thinking...'}
                </h2>
                
                {currentPlayer === 'human' ? (
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
                      <span className="ml-3 text-gray-600">AI is formulating a response...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : currentEvaluation && (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Evaluation Results</h3>
                
                {/* Display the response that was evaluated */}
                <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-700">
                    {currentEvaluation.player === 'human' ? 'Your' : 'AI'} Response to "{currentEvaluation.topic}":
                  </p>
                  <p className="mt-1 text-lg">{currentEvaluation.response}</p>
                </div>
                
                <div className="whitespace-pre-wrap">{currentEvaluation.evaluation}</div>
                
                {/* Score breakdown for regular rounds */}
                {(currentRound !== maxRounds || !circleEnabled) && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-800 text-sm">Score Breakdown:</h4>
                    <div className="mt-1 text-sm">
                      <ul className="list-disc pl-5">
                        <li>Semantic Distance: {currentEvaluation.scores.semanticDistance}/10</li>
                        <li>Similarity: {currentEvaluation.scores.relevanceQuality}/10</li>
                        <li className="font-medium mt-1">Total Score: {currentEvaluation.scores.total}/20</li>
                      </ul>
                    </div>
                  </div>
                )}
                
                {/* Final round score breakdown for circle mode */}
                {currentRound === maxRounds && circleEnabled && currentEvaluation.finalEvaluation && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-800">Connection to Original Topic</h4>
                    <p>{currentEvaluation.finalEvaluation}</p>
                    
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <h5 className="font-medium text-blue-800 text-sm">Final Round Scoring:</h5>
                      <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                        <div>
                          <p><strong>Current Topic Connection:</strong></p>
                          <ul className="list-disc pl-5">
                            <li>Semantic Distance: {currentEvaluation.scores.currentConnection?.semanticDistance || 0}/10</li>
                            <li>Similarity: {currentEvaluation.scores.currentConnection?.similarity || 0}/10</li>
                            <li>Subtotal: {currentEvaluation.scores.currentConnection?.subtotal || 0}/20</li>
                          </ul>
                        </div>
                        <div>
                          <p><strong>Original Topic Connection:</strong></p>
                          <ul className="list-disc pl-5">
                            <li>Semantic Distance: {currentEvaluation.scores.originalConnection?.semanticDistance || 0}/10</li>
                            <li>Similarity: {currentEvaluation.scores.originalConnection?.similarity || 0}/10</li>
                            <li>Subtotal: {currentEvaluation.scores.originalConnection?.subtotal || 0}/20</li>
                          </ul>
                        </div>
                      </div>
                      <p className="mt-2 font-medium">Final Score: {currentEvaluation.scores.total}/20 <span className="text-xs text-gray-500">(average of both subtotals)</span></p>
                    </div>
                  </div>
                )}
                
                {gameCompleted ? (
                  <div className="mt-4">
                    <h3 className="text-xl font-bold">Game Completed!</h3>
                    <div className="mt-2 p-3 bg-green-50 rounded border border-green-200">
                      <p className="font-medium">Final Scores:</p>
                      <p>Your Score: {totalScores.human}</p>
                      <p>AI Score: {totalScores.ai}</p>
                      <p className="mt-2 font-medium">
                        {totalScores.human > totalScores.ai 
                          ? "Congratulations! You won!" 
                          : totalScores.human < totalScores.ai 
                            ? "The AI won this time." 
                            : "It's a tie!"}
                      </p>
                    </div>
                    <div className="mt-4 flex gap-3 justify-center">
                      <button
                        onClick={handleRestart}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      >
                        Start New Game
                      </button>
                      <button
                        onClick={handleReturnToSettings}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                      >
                        Choose Game Settings
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleNextTurn}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Next Round
                  </button>
                )}
              </div>
            )}
            
            {gameStarted && (
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
                      {(() => {
                        const currentTopicNodeId = gameState.activeSourceNodeIds.length === 1
                          ? gameState.activeSourceNodeIds[0]
                          : null;
                        const isCurrentTopicSelected = Boolean(currentTopicNodeId && selectedGraphNodeId === currentTopicNodeId);

                        return (
                          <tr
                            key="current-topic"
                            onClick={() => currentTopicNodeId && handleGraphNodeClick(currentTopicNodeId)}
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
                        );
                      })()}
                      {gameHistory
                        .slice()
                        .reverse()
                        .map((round, index) => {
                          // Calculate the actual round number for display
                          const actualRoundNumber = gameHistory.length - index;
                          const historyIndex = actualRoundNumber - 1;
                          const isCircleRound = circleEnabled && actualRoundNumber === maxRounds;
                          const topicNodeId = getTopicGraphNodeId(round.topic, historyIndex);
                          const isTopicSelected = selectedGraphNodeId === topicNodeId;
                          const destinationNodeId = turnHistoryRows[historyIndex]?.destinationNode.id;
                          const isResponseSelectedForTopic = Boolean(destinationNodeId && gameState.activeSourceNodeIds.includes(destinationNodeId));
                          
                          return (
                            <tr
                              key={index}
                              onClick={() => handleTopicRowClick(round.topic, historyIndex)}
                              className={`border-t cursor-pointer ${isTopicSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                            >
                              <td className="py-2 px-4">{actualRoundNumber}</td>
                              <td className="py-2 px-4">{round.topic}</td>
                              <td className="py-2 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs ${round.player === 'human' ? 'bg-blue-100' : 'bg-red-100'}`}>
                                  {round.player === 'human' ? 'You' : 'AI'}
                                </span>
                              </td>
                              <td className="py-2 px-4">{round.response}</td>
                              <td className="py-2 px-4">
                                <span 
                                  className="cursor-help underline decoration-dotted"
                                  onMouseEnter={(e) => handleScoreMouseEnter(e, round.scores, isCircleRound)}
                                  onMouseLeave={handleScoreMouseLeave}
                                >
                                  {round.scores.total}/20
                                </span>
                              </td>
                              <td className="py-2 px-4">
                                {!showingResults && !isEvaluating && !isAiThinking && !gameCompleted && (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleSelectHistoryItem(round);
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
      
      {/* Score tooltip/popup */}
      {tooltipData.visible && tooltipData.score && (
        <div 
          className="fixed bg-white shadow-lg rounded-md p-3 z-50 border border-gray-200 text-sm"
          style={{
            left: `${tooltipData.x}px`,
            top: `${tooltipData.y}px`,
            maxWidth: '300px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <h4 className="font-medium text-blue-800 mb-2">Score Breakdown:</h4>
          
          {!tooltipData.isCircleMode ? (
            <div>
              <ul className="list-disc pl-5 mb-2">
                <li>
                  <span className="font-medium">Semantic Distance: {tooltipData.score.semanticDistance}/10</span>
                  <p className="text-xs text-gray-600 ml-1">Measures how well the concepts are connected intellectually.</p>
                </li>
                <li>
                  <span className="font-medium">Similarity: {tooltipData.score.relevanceQuality}/10</span>
                  <p className="text-xs text-gray-600 ml-1">Measures how relevant and appropriate the response is to the topic.</p>
                </li>
                <li className="font-medium mt-2">Total Score: {tooltipData.score.total}/20</li>
              </ul>
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-700">
                <p><strong>What makes a good connection?</strong></p>
                <p>The best connections balance novelty with relevance - they should be unexpected yet clearly related to the topic.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3">
                <p className="font-medium">Current Topic Connection:</p>
                <ul className="list-disc pl-5">
                  <li>
                    <span>Semantic Distance: {tooltipData.score.currentConnection?.semanticDistance || 0}/10</span>
                    <p className="text-xs text-gray-600 ml-1">Connection quality to the current topic.</p>
                  </li>
                  <li>
                    <span>Similarity: {tooltipData.score.currentConnection?.similarity || 0}/10</span>
                    <p className="text-xs text-gray-600 ml-1">Relevance to the current topic.</p>
                  </li>
                  <li>Subtotal: {tooltipData.score.currentConnection?.subtotal || 0}/20</li>
                </ul>
              </div>
              <div className="mb-3">
                <p className="font-medium">Original Topic Connection:</p>
                <ul className="list-disc pl-5">
                  <li>
                    <span>Semantic Distance: {tooltipData.score.originalConnection?.semanticDistance || 0}/10</span>
                    <p className="text-xs text-gray-600 ml-1">Connection quality to the original topic.</p>
                  </li>
                  <li>
                    <span>Similarity: {tooltipData.score.originalConnection?.similarity || 0}/10</span>
                    <p className="text-xs text-gray-600 ml-1">Relevance to the original topic.</p>
                  </li>
                  <li>Subtotal: {tooltipData.score.originalConnection?.subtotal || 0}/20</li>
                </ul>
              </div>
              <p className="mt-2 font-medium">Final Score: {tooltipData.score.total}/20 <span className="text-xs text-gray-500">(average of both subtotals)</span></p>
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-700">
                <p><strong>Circle Mode:</strong> In the final round, your response must connect both to the current topic and back to the original starting topic.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
