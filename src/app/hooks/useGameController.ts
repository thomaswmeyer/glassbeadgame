"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  selectPlayerScoreRows,
  selectTurnHistoryRows,
  setGameStatus,
  setSelectedNodeIds,
  startGameState,
} from '@/domain/game';
import {
  DifficultyLevel,
  GameFlowServices,
  GeneratedTopic,
  TurnEvaluation,
  selectCurrentSourceTopicText,
  selectRootTopic,
  selectTurnContextHistory,
} from '@/domain/gameFlow';
import {
  PlayerTurnController,
  createTurnExecutionKey,
  resolvePlayerController,
  shouldAutoSubmitTurn,
} from '@/domain/playerController';
import { normalizeSubjectCategoryId } from '@/domain/subjectCategories';
import {
  SourceTurnEvaluation,
  combineSourceScores,
  formatCombinedEvaluation,
  formatCombinedFinalEvaluation,
  normalizeScore,
} from '@/domain/turnScoring';

export type { DifficultyLevel } from '@/domain/gameFlow';

type UseGameControllerParams = {
  maxRounds: number;
  aiGoesFirst: boolean;
  circleEnabled: boolean;
  difficulty: DifficultyLevel;
  services?: GameFlowServices;
  playerControllers?: PlayerTurnController[];
};

function getPlayerIdForTurn(player: 'human' | 'ai') {
  return player === 'ai' ? DEFAULT_AI_PLAYER_ID : DEFAULT_HUMAN_PLAYER_ID;
}

const EMPTY_PLAYER_CONTROLLERS: PlayerTurnController[] = [];

function resolveGeneratedTopic(result: string | GeneratedTopic): GeneratedTopic {
  return typeof result === 'string' ? { topic: result } : result;
}

export function useGameController({
  maxRounds,
  aiGoesFirst,
  circleEnabled,
  difficulty,
  services = gameApi,
  playerControllers = EMPTY_PLAYER_CONTROLLERS,
}: UseGameControllerParams) {
  const startedAutomaticTurnKeyRef = useRef<string | null>(null);
  const [gameState, setGameState] = useState(() => createEmptyGameState(10, DEFAULT_HUMAN_PLAYER_ID));
  const [response, setResponse] = useState<string>('');

  const defaultAiController = useMemo<PlayerTurnController>(() => ({
    playerId: DEFAULT_AI_PLAYER_ID,
    mode: 'automatic',
    async submitTurn(context) {
      const aiResponse = await services.generateAiResponse({
        topic: context.topic,
        originalTopic: context.originalTopic,
        gameHistory: context.gameHistory,
        difficulty: context.difficulty,
        circleEnabled: context.circleEnabled,
        isFinalCircleRound: context.isFinalCircleRound,
      });

      return {
        responseText: aiResponse.trim() || `Response to ${context.topic}`,
        fallbackOnEvaluationFailure: true,
      };
    },
  }), [services]);

  const effectivePlayerControllers = useMemo(
    () => [...playerControllers, defaultAiController],
    [defaultAiController, playerControllers]
  );

  const graphRenderData = selectGraphRenderData(gameState);
  const currentEvaluation = selectCurrentEvaluation(gameState);
  const currentPlayerModel = selectCurrentPlayer(gameState);
  const currentPlayerController = currentPlayerModel
    ? resolvePlayerController(currentPlayerModel, effectivePlayerControllers)
    : null;
  const turnHistoryRows = selectTurnHistoryRows(gameState);
  const playerScoreRows = selectPlayerScoreRows(gameState);
  const gameHistory = selectTurnContextHistory(gameState);
  const currentRound = gameState.currentRound;
  const isCurrentPlayerManual = currentPlayerController?.mode !== 'automatic' || !currentPlayerController.submitTurn;
  const activeSourceNodes = useMemo(
    () => gameState.activeSourceNodeIds
      .map(nodeId => gameState.nodesById[nodeId])
      .filter(Boolean),
    [gameState.activeSourceNodeIds, gameState.nodesById]
  );
  const gameStarted = gameState.gameStatus !== 'setup';
  const isGeneratingTopic = gameState.gameStatus === 'generatingTopic';
  const originalTopic = selectRootTopic(gameState);
  const currentSourceTopicText = selectCurrentSourceTopicText(gameState);
  const isEvaluating = gameState.gameStatus === 'evaluating';
  const isAiThinking = gameState.gameStatus === 'aiThinking';
  const showingResults = gameState.gameStatus === 'showingResults' || gameState.gameStatus === 'completed';
  const gameCompleted = gameState.gameStatus === 'completed';

  const setSelectedGraphNodeId = (nodeId: string | null) => {
    setGameState(prev => setSelectedNodeIds(prev, nodeId ? [nodeId] : []));
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
      const newTopic = resolveGeneratedTopic(await services.generateTopic({
        difficulty,
      }));
      setResponse('');

      setGameState(startGameState({
        rootTopic: newTopic.topic,
        maxRounds,
        currentPlayerId: getPlayerIdForTurn(initialPlayer),
        rootCreatedByPlayerId: DEFAULT_AI_PLAYER_ID,
        rootSubjectCategory: newTopic.subjectCategory,
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
        edgeEvaluations: params.result.edgeEvaluations,
        destinationSubjectCategory: params.result.destinationSubjectCategory,
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
    const evaluationTargets = activeSourceNodes;
    if (!evaluationTopic || !params.responseText) return;

    setGameState(prev => setGameStatus(prev, 'evaluating'));

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const isFinalCircleRound = currentRound === maxRounds && circleEnabled;
        const edgeEvaluations = await Promise.all(
          evaluationTargets.map(async sourceNode => {
            const result = await services.evaluateTurn({
              topic: sourceNode.topic,
              originalTopic,
              response: params.responseText,
              difficulty,
              isFinalCircleRound,
            });

            return {
              sourceNodeId: sourceNode.id,
              sourceTopic: sourceNode.topic,
              evaluation: result.evaluation,
              finalEvaluation: result.finalEvaluation,
              destinationSubjectCategory: normalizeSubjectCategoryId(result.destinationSubjectCategory),
              scores: normalizeScore(result.scores),
            } satisfies SourceTurnEvaluation;
          })
        );
        const combinedScores = combineSourceScores(edgeEvaluations.map(edgeEvaluation => edgeEvaluation.scores));
        const destinationSubjectCategory = normalizeSubjectCategoryId(
          edgeEvaluations
            .map(edgeEvaluation => edgeEvaluation.destinationSubjectCategory)
            .find(Boolean)
        );
        const result: TurnEvaluation = {
          evaluation: formatCombinedEvaluation(edgeEvaluations),
          finalEvaluation: formatCombinedFinalEvaluation(edgeEvaluations),
          destinationSubjectCategory,
          scores: combinedScores,
          edgeEvaluations,
        };

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
            total: 25,
          };
          const edgeEvaluations = evaluationTargets.map(sourceNode => ({
            sourceNodeId: sourceNode.id,
            sourceTopic: sourceNode.topic,
            evaluation: "I couldn't evaluate this response properly. Here's a default score.",
            scores: fallbackScores,
          } satisfies SourceTurnEvaluation));
          const combinedScores = combineSourceScores(edgeEvaluations.map(edgeEvaluation => edgeEvaluation.scores));
          completeEvaluatedTurn({
            playerId: params.playerId,
            responseText: params.responseText,
            evaluationTopic,
            result: {
              evaluation: formatCombinedEvaluation(edgeEvaluations),
              destinationSubjectCategory: 'science',
              scores: combinedScores,
              edgeEvaluations,
            },
          });
        } else {
          setGameState(prev => setGameStatus(prev, 'awaitingResponse'));
          alert('Failed to evaluate response after multiple attempts. Please try again.');
        }
      }
    }
  }, [
    activeSourceNodes,
    circleEnabled,
    completeEvaluatedTurn,
    currentRound,
    currentSourceTopicText,
    difficulty,
    maxRounds,
    originalTopic,
    services,
  ]);

  const evaluateResponse = async () => {
    if (!currentPlayerModel) return;

    await evaluateTurnResponse({
      playerId: currentPlayerModel.id,
      responseText: response,
      clearResponseOnSuccess: isCurrentPlayerManual,
    });
  };

  const handleNextTurn = () => {
    if (gameCompleted) return;

    let nextTopic = currentEvaluation?.response || '';

    if (!nextTopic || !nextTopic.trim()) {
      const latestTurnRow = turnHistoryRows[turnHistoryRows.length - 1];
      nextTopic = latestTurnRow?.destinationNode.topic || '';

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
    const submitAutomaticTurn = async () => {
      if (
        !currentPlayerModel ||
        !currentPlayerController ||
        !shouldAutoSubmitTurn(gameState, currentPlayerModel, currentPlayerController)
      ) {
        return;
      }

      const turnExecutionKey = createTurnExecutionKey(gameState);
      if (startedAutomaticTurnKeyRef.current === turnExecutionKey) return;

      startedAutomaticTurnKeyRef.current = turnExecutionKey;
      setGameState(prev => setGameStatus(prev, 'aiThinking'));
      const promptTopic = currentSourceTopicText;

      try {
        const submission = await currentPlayerController.submitTurn!({
          state: gameState,
          player: currentPlayerModel,
          topic: promptTopic,
          originalTopic,
          gameHistory,
          difficulty,
          circleEnabled,
          isFinalCircleRound: currentRound === maxRounds && circleEnabled,
        });
        const responseText = submission.responseText.trim() || `Response to ${promptTopic}`;

        setResponse(responseText);
        await evaluateTurnResponse({
          playerId: currentPlayerModel.id,
          responseText,
          fallbackOnFailure: submission.fallbackOnEvaluationFailure,
          clearResponseOnSuccess: submission.clearResponseOnSuccess,
        });
      } catch (error) {
        console.error('Error getting automatic player response:', error);
        const fallbackResponse = `Response to ${promptTopic}`;
        setResponse(fallbackResponse);
        await evaluateTurnResponse({
          playerId: currentPlayerModel.id,
          responseText: fallbackResponse,
          fallbackOnFailure: true,
        });
      }
    };

    submitAutomaticTurn();
  }, [
    gameState,
    gameState.gameStatus,
    gameState.currentRound,
    gameState.currentPlayerId,
    gameState.turnOrder.length,
    currentPlayerController,
    currentPlayerModel,
    isCurrentPlayerManual,
    currentRound,
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
    originalTopic,
    response,
    setResponse,
    currentEvaluation,
    graphRenderData,
    currentPlayerModel,
    turnHistoryRows,
    selectedGraphNodeId: gameState.selectedNodeIds[0] || null,
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
    generateFirstTopic,
    evaluateResponse,
    handleNextTurn,
    handleRestart,
    handleReturnToSettings,
  };
}
