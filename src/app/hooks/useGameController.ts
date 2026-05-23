"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  Score,
  addTurnToGameState,
  advanceGameTurn,
  createEmptyGameState,
  getNextPlayerId,
  selectCurrentPlayer,
  selectGraphRenderData,
  selectLegacyGameHistory,
  selectPlayerScoreTotals,
  selectSelectedNodePanels,
  selectTurnHistoryRows,
  setGameStatus,
  setSelectedNodeIds,
  startGameState,
} from '@/domain/game';

export type DifficultyLevel = 'secondary' | 'undergrad' | 'grad' | 'unlimited';

export type CurrentEvaluation = {
  topic: string;
  response: string;
  evaluation: string;
  scores: Score;
  player: 'human' | 'ai';
  finalEvaluation?: string;
};

type UseGameControllerParams = {
  maxRounds: number;
  aiGoesFirst: boolean;
  circleEnabled: boolean;
  difficulty: DifficultyLevel;
};

type EvaluationResponse = {
  evaluation: string;
  finalEvaluation?: string;
  scores: Score;
};

function getPlayerIdForTurn(player: 'human' | 'ai') {
  return player === 'ai' ? DEFAULT_AI_PLAYER_ID : DEFAULT_HUMAN_PLAYER_ID;
}

async function requestEvaluation(params: {
  topic: string;
  response: string;
  originalTopic: string;
  difficulty: DifficultyLevel;
  isFinalCircleRound: boolean;
}): Promise<EvaluationResponse> {
  const endpoint = params.isFinalCircleRound
    ? '/api/evaluate-final-response'
    : '/api/evaluate-response';
  const body = params.isFinalCircleRound
    ? {
        currentTopic: params.topic,
        originalTopic: params.originalTopic,
        response: params.response,
        difficulty: params.difficulty,
      }
    : {
        topic: params.topic,
        response: params.response,
        difficulty: params.difficulty,
      };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`HTTP error ${res.status}: ${errorData.error || 'Unknown error'}`);
  }

  return res.json();
}

export function useGameController({
  maxRounds,
  aiGoesFirst,
  circleEnabled,
  difficulty,
}: UseGameControllerParams) {
  const startedAiTurnKeyRef = useRef<string | null>(null);
  const [gameState, setGameState] = useState(() => createEmptyGameState(10, DEFAULT_HUMAN_PLAYER_ID));
  const [topic, setTopic] = useState<string>('');
  const [originalTopic, setOriginalTopic] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [currentEvaluation, setCurrentEvaluation] = useState<CurrentEvaluation | null>(null);

  const graphRenderData = selectGraphRenderData(gameState);
  const currentPlayerModel = selectCurrentPlayer(gameState);
  const selectedNodePanels = selectSelectedNodePanels(gameState);
  const turnHistoryRows = selectTurnHistoryRows(gameState);
  const scoreTotalsByPlayerId = selectPlayerScoreTotals(gameState);
  const gameHistory = selectLegacyGameHistory(gameState);
  const currentRound = gameState.currentRound;
  const currentPlayer = currentPlayerModel?.kind === 'ai' ? 'ai' : 'human';
  const totalScores = {
    human: scoreTotalsByPlayerId[DEFAULT_HUMAN_PLAYER_ID] || 0,
    ai: scoreTotalsByPlayerId[DEFAULT_AI_PLAYER_ID] || 0,
  };
  const activeSourceNodes = gameState.activeSourceNodeIds
    .map(nodeId => gameState.nodesById[nodeId])
    .filter(Boolean);
  const currentSourceTopicText = activeSourceNodes.length > 0
    ? activeSourceNodes.map(sourceNode => sourceNode.topic).join(' + ')
    : topic;
  const gameStarted = gameState.gameStatus !== 'setup';
  const isGeneratingTopic = gameState.gameStatus === 'generatingTopic';
  const isEvaluating = gameState.gameStatus === 'evaluating';
  const isAiThinking = gameState.gameStatus === 'aiThinking';
  const showingResults = gameState.gameStatus === 'showingResults' || gameState.gameStatus === 'completed';
  const gameCompleted = gameState.gameStatus === 'completed';

  const setSelectedGraphNodeId = (nodeId: string | null) => {
    setGameState(prev => setSelectedNodeIds(prev, nodeId ? [nodeId] : []));
  };

  const findNodeIdByTopic = (topicValue: string) => {
    return Object.values(gameState.nodesById).find(node => node.topic === topicValue)?.id || null;
  };

  const getSingleCurrentSourceNode = () => {
    if (gameState.activeSourceNodeIds.length !== 1) return null;
    return gameState.nodesById[gameState.activeSourceNodeIds[0]] || null;
  };

  const generateFirstTopic = async () => {
    console.log('=== GENERATING FIRST TOPIC ===');
    console.log('aiGoesFirst setting:', aiGoesFirst);

    const initialPlayer = aiGoesFirst ? 'ai' : 'human';
    setGameState(setGameStatus(
      createEmptyGameState(maxRounds, getPlayerIdForTurn(initialPlayer)),
      'generatingTopic'
    ));
    setTopic('Generating new topic...');
    setCurrentEvaluation(null);

    try {
      const result = await axios.post('/api/generate-topic', {
        difficulty,
      });
      const newTopic = result.data.topic;
      setTopic(newTopic);
      setOriginalTopic(newTopic);
      setResponse('');

      setGameState(startGameState({
        rootTopic: newTopic,
        maxRounds,
        currentPlayerId: getPlayerIdForTurn(initialPlayer),
        rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
      }));
    } catch (error) {
      console.error('Error generating topic:', error);
      setGameState(createEmptyGameState(maxRounds, getPlayerIdForTurn(initialPlayer)));
      alert('Failed to generate topic. Please try again.');
    }
  };

  const completeEvaluatedTurn = useCallback((params: {
    player: 'human' | 'ai';
    responseText: string;
    evaluationTopic: string;
    result: EvaluationResponse;
  }) => {
    setCurrentEvaluation({
      topic: params.evaluationTopic,
      response: params.responseText,
      player: params.player,
      evaluation: params.result.evaluation,
      finalEvaluation: params.result.finalEvaluation,
      scores: params.result.scores,
    });

    setGameState(prev => {
      const withTurn = addTurnToGameState(prev, {
        destinationTopic: params.responseText,
        playerId: getPlayerIdForTurn(params.player),
        sourceNodeIds: prev.activeSourceNodeIds,
        evaluation: params.result.evaluation,
        finalEvaluation: params.result.finalEvaluation,
        totalScore: params.result.scores.total,
        legacyScores: params.result.scores,
      });

      return setGameStatus(
        withTurn,
        currentRound === maxRounds ? 'completed' : 'showingResults'
      );
    });
  }, [currentRound, maxRounds]);

  const evaluateTurnResponse = useCallback(async (params: {
    player: 'human' | 'ai';
    responseText: string;
    fallbackOnFailure?: boolean;
  }) => {
    const evaluationTopic = currentSourceTopicText;
    if (!evaluationTopic || !params.responseText) return;

    setGameState(prev => setGameStatus(prev, 'evaluating'));

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const result = await requestEvaluation({
          topic: evaluationTopic,
          originalTopic,
          response: params.responseText,
          difficulty,
          isFinalCircleRound: currentRound === maxRounds && circleEnabled,
        });

        completeEvaluatedTurn({
          player: params.player,
          responseText: params.responseText,
          evaluationTopic,
          result,
        });

        if (params.player === 'human') {
          setResponse('');
        }
        break;
      } catch (error) {
        console.error(`Evaluation attempt ${retries + 1} failed:`, error);
        retries++;

        if (retries < maxRetries) {
          const backoffTime = 1000 * Math.pow(2, retries);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(r => setTimeout(r, backoffTime));
          continue;
        }

        if (params.fallbackOnFailure) {
          const fallbackScores: Score = {
            semanticDistance: 5,
            relevanceQuality: 5,
            total: 10,
          };
          completeEvaluatedTurn({
            player: params.player,
            responseText: params.responseText,
            evaluationTopic,
            result: {
              evaluation: "I couldn't evaluate this response properly. Here's a default score.",
              scores: fallbackScores,
            },
          });
        } else {
          setGameState(prev => setGameStatus(prev, 'awaitingResponse'));
          alert('Failed to evaluate response after multiple attempts. Please try again.');
        }
      }
    }
  }, [circleEnabled, completeEvaluatedTurn, currentRound, currentSourceTopicText, difficulty, maxRounds, originalTopic]);

  const evaluateResponse = async () => {
    await evaluateTurnResponse({
      player: 'human',
      responseText: response,
    });
  };

  const handleNextTurn = () => {
    if (gameCompleted) return;

    let nextTopic = currentEvaluation?.response || '';

    if (!nextTopic || !nextTopic.trim()) {
      if (gameHistory.length > 0) {
        nextTopic = gameHistory[gameHistory.length - 1]?.response || '';
      }

      if (!nextTopic || !nextTopic.trim()) {
        alert('Error: Could not determine the next topic. Please restart the game.');
        return;
      }
    }

    setTopic(nextTopic);
    setGameState(prev => advanceGameTurn(prev, getNextPlayerId(prev)));
    setCurrentEvaluation(null);
    setResponse('');
  };

  const resetCurrentGame = (currentPlayerId: string) => {
    setTopic('');
    setOriginalTopic('');
    setResponse('');
    setCurrentEvaluation(null);
    setSelectedGraphNodeId(null);
    setGameState(createEmptyGameState(maxRounds, currentPlayerId));
  };

  const handleRestart = () => {
    resetCurrentGame(getPlayerIdForTurn(aiGoesFirst ? 'ai' : 'human'));
    generateFirstTopic();
  };

  const handleReturnToSettings = () => {
    resetCurrentGame(DEFAULT_HUMAN_PLAYER_ID);
  };

  useEffect(() => {
    const aiTakeTurn = async () => {
      if (gameState.gameStatus !== 'awaitingResponse' || currentPlayerModel?.kind !== 'ai') {
        return;
      }

      if (topic === 'Generating new topic...') {
        return;
      }

      const aiTurnKey = `${gameState.currentRound}:${gameState.currentPlayerId}:${gameState.turnOrder.length}`;
      if (startedAiTurnKeyRef.current === aiTurnKey) return;

      startedAiTurnKeyRef.current = aiTurnKey;
      setGameState(prev => setGameStatus(prev, 'aiThinking'));
      const aiPromptTopic = currentSourceTopicText;

      try {
        const endpoint = (currentRound === maxRounds && circleEnabled) ? '/api/ai-final-response' : '/api/ai-response';
        const formattedHistory = gameHistory.map(item => ({
          round: item.round,
          topic: item.topic,
          response: item.response,
          evaluation: item.evaluation,
          scores: item.scores,
          player: item.player,
        }));

        const result = await axios.post(endpoint, {
          topic: aiPromptTopic,
          originalTopic,
          gameHistory: formattedHistory,
          difficulty,
          circleEnabled,
        });

        let aiResponse = result.data.response;
        if (!aiResponse || !aiResponse.trim()) {
          aiResponse = `Response to ${aiPromptTopic}`;
        }

        setResponse(aiResponse);
        await evaluateTurnResponse({
          player: 'ai',
          responseText: aiResponse,
          fallbackOnFailure: true,
        });
      } catch (error) {
        console.error('Error getting AI response:', error);
        const aiResponse = `Response to ${aiPromptTopic}`;
        setResponse(aiResponse);
        await evaluateTurnResponse({
          player: 'ai',
          responseText: aiResponse,
          fallbackOnFailure: true,
        });
      }
    };

    aiTakeTurn();
  }, [
    gameState.gameStatus,
    gameState.currentRound,
    gameState.currentPlayerId,
    gameState.turnOrder.length,
    currentPlayerModel?.kind,
    currentRound,
    topic,
    currentSourceTopicText,
    originalTopic,
    gameHistory,
    maxRounds,
    difficulty,
    circleEnabled,
    evaluateTurnResponse,
  ]);

  return {
    gameState,
    setGameState,
    topic,
    setTopic,
    originalTopic,
    setOriginalTopic,
    response,
    setResponse,
    currentEvaluation,
    setCurrentEvaluation,
    graphRenderData,
    currentPlayerModel,
    selectedNodePanels,
    turnHistoryRows,
    gameHistory,
    selectedGraphNodeId: gameState.selectedNodeIds[0] || null,
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
    generateFirstTopic,
    evaluateResponse,
    handleNextTurn,
    handleRestart,
    handleReturnToSettings,
  };
}
