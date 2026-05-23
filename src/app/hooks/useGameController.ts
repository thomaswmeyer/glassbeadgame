"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { gameApi } from '@/app/services/gameApi';
import {
  DEFAULT_AI_PLAYER_ID,
  DEFAULT_HUMAN_PLAYER_ID,
  Score,
  addTurnToGameState,
  advanceGameTurn,
  createEmptyGameState,
  getNextPlayerId,
  selectCurrentEvaluation,
  selectCurrentPlayer,
  selectGraphRenderData,
  selectLegacyGameHistory,
  selectPlayerScoreRows,
  selectSelectedNodePanels,
  selectTurnHistoryRows,
  setGameStatus,
  setSelectedNodeIds,
  startGameState,
} from '@/domain/game';
import {
  DifficultyLevel,
  GameFlowServices,
  TurnEvaluation,
  selectCurrentSourceTopicText,
  selectRootTopic,
} from '@/domain/gameFlow';

export type { DifficultyLevel } from '@/domain/gameFlow';

type UseGameControllerParams = {
  maxRounds: number;
  aiGoesFirst: boolean;
  circleEnabled: boolean;
  difficulty: DifficultyLevel;
  services?: GameFlowServices;
};

function getPlayerIdForTurn(player: 'human' | 'ai') {
  return player === 'ai' ? DEFAULT_AI_PLAYER_ID : DEFAULT_HUMAN_PLAYER_ID;
}

export function useGameController({
  maxRounds,
  aiGoesFirst,
  circleEnabled,
  difficulty,
  services = gameApi,
}: UseGameControllerParams) {
  const startedAiTurnKeyRef = useRef<string | null>(null);
  const [gameState, setGameState] = useState(() => createEmptyGameState(10, DEFAULT_HUMAN_PLAYER_ID));
  const [response, setResponse] = useState<string>('');

  const graphRenderData = selectGraphRenderData(gameState);
  const currentEvaluation = selectCurrentEvaluation(gameState);
  const currentPlayerModel = selectCurrentPlayer(gameState);
  const selectedNodePanels = selectSelectedNodePanels(gameState);
  const turnHistoryRows = selectTurnHistoryRows(gameState);
  const playerScoreRows = selectPlayerScoreRows(gameState);
  const gameHistory = selectLegacyGameHistory(gameState);
  const currentRound = gameState.currentRound;
  const isCurrentPlayerLocal = currentPlayerModel?.kind === 'local';
  const activeSourceNodes = gameState.activeSourceNodeIds
    .map(nodeId => gameState.nodesById[nodeId])
    .filter(Boolean);
  const gameStarted = gameState.gameStatus !== 'setup';
  const isGeneratingTopic = gameState.gameStatus === 'generatingTopic';
  const originalTopic = selectRootTopic(gameState);
  const currentSourceTopicText = selectCurrentSourceTopicText(gameState);
  const topic = isGeneratingTopic ? 'Generating new topic...' : currentSourceTopicText;
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

    try {
      const newTopic = await services.generateTopic({
        difficulty,
      });
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
    playerId: string;
    responseText: string;
    evaluationTopic: string;
    result: TurnEvaluation;
  }) => {
    setGameState(prev => {
      const withTurn = addTurnToGameState(prev, {
        destinationTopic: params.responseText,
        playerId: params.playerId,
        sourceNodeIds: prev.activeSourceNodeIds,
        evaluation: params.result.evaluation,
        finalEvaluation: params.result.finalEvaluation,
        totalScore: params.result.scores.total,
        legacyScores: params.result.scores,
        scoringDescription: params.result.evaluation,
      });

      return setGameStatus(
        withTurn,
        currentRound === maxRounds ? 'completed' : 'showingResults'
      );
    });
  }, [currentRound, maxRounds]);

  const evaluateTurnResponse = useCallback(async (params: {
    playerId: string;
    responseText: string;
    fallbackOnFailure?: boolean;
    clearResponseOnSuccess?: boolean;
  }) => {
    const evaluationTopic = currentSourceTopicText;
    if (!evaluationTopic || !params.responseText) return;

    setGameState(prev => setGameStatus(prev, 'evaluating'));

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const result = await services.evaluateTurn({
          topic: evaluationTopic,
          originalTopic,
          response: params.responseText,
          difficulty,
          isFinalCircleRound: currentRound === maxRounds && circleEnabled,
        });

        completeEvaluatedTurn({
          playerId: params.playerId,
          responseText: params.responseText,
          evaluationTopic,
          result,
        });

        if (params.clearResponseOnSuccess) {
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
            playerId: params.playerId,
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
  }, [circleEnabled, completeEvaluatedTurn, currentRound, currentSourceTopicText, difficulty, maxRounds, originalTopic, services]);

  const evaluateResponse = async () => {
    if (!currentPlayerModel) return;

    await evaluateTurnResponse({
      playerId: currentPlayerModel.id,
      responseText: response,
      clearResponseOnSuccess: currentPlayerModel.kind === 'local',
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

    setGameState(prev => advanceGameTurn(prev, getNextPlayerId(prev)));
    setResponse('');
  };

  const resetCurrentGame = (currentPlayerId: string) => {
    setResponse('');
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
      if (gameState.gameStatus !== 'awaitingResponse' || !currentPlayerModel || currentPlayerModel.kind !== 'ai') {
        return;
      }

      const aiTurnKey = `${gameState.currentRound}:${gameState.currentPlayerId}:${gameState.turnOrder.length}`;
      if (startedAiTurnKeyRef.current === aiTurnKey) return;

      startedAiTurnKeyRef.current = aiTurnKey;
      setGameState(prev => setGameStatus(prev, 'aiThinking'));
      const aiPromptTopic = currentSourceTopicText;

      try {
        const formattedHistory = gameHistory.map(item => ({
          round: item.round,
          topic: item.topic,
          response: item.response,
          evaluation: item.evaluation,
          scores: item.scores,
          player: item.player,
        }));

        let aiResponse = await services.generateAiResponse({
          topic: aiPromptTopic,
          originalTopic,
          gameHistory: formattedHistory,
          difficulty,
          circleEnabled,
          isFinalCircleRound: currentRound === maxRounds && circleEnabled,
        });
        if (!aiResponse || !aiResponse.trim()) {
          aiResponse = `Response to ${aiPromptTopic}`;
        }

        setResponse(aiResponse);
        await evaluateTurnResponse({
          playerId: currentPlayerModel.id,
          responseText: aiResponse,
          fallbackOnFailure: true,
        });
      } catch (error) {
        console.error('Error getting AI response:', error);
        const aiResponse = `Response to ${aiPromptTopic}`;
        setResponse(aiResponse);
        await evaluateTurnResponse({
          playerId: currentPlayerModel.id,
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
    currentPlayerModel,
    currentPlayerModel?.kind,
    currentRound,
    currentSourceTopicText,
    originalTopic,
    gameHistory,
    maxRounds,
    difficulty,
    circleEnabled,
    evaluateTurnResponse,
    services,
  ]);

  return {
    gameState,
    setGameState,
    topic,
    originalTopic,
    response,
    setResponse,
    currentEvaluation,
    graphRenderData,
    currentPlayerModel,
    selectedNodePanels,
    turnHistoryRows,
    gameHistory,
    selectedGraphNodeId: gameState.selectedNodeIds[0] || null,
    currentRound,
    isCurrentPlayerLocal,
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
    findNodeIdByTopic,
    getSingleCurrentSourceNode,
    generateFirstTopic,
    evaluateResponse,
    handleNextTurn,
    handleRestart,
    handleReturnToSettings,
  };
}
