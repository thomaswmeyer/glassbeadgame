"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gameApi } from '@/app/services/gameApi';
import {
  DEFAULT_HUMAN_PLAYER_ID,
  CurrentEvaluationView,
  Player,
  Score,
  addOpeningTopicTurnToGameState,
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
} from '@/domain/game';
import { resolveInitialPlayerId } from '@/domain/playerSetup';
import {
  DifficultyLevel,
  GameFlowServices,
  GeneratedTopic,
  TurnEvaluation,
  selectCurrentSourceTopicText,
  selectTurnContextHistory,
} from '@/domain/gameFlow';
import {
  PlayerTurnController,
  createTurnExecutionKey,
  resolvePlayerController,
  resolveSubmittedSourceNodeIds,
  shouldAutoSubmitTurn,
} from '@/domain/playerController';
import { normalizeSubjectCategoryId } from '@/domain/subjectCategories';
import {
  SourceTurnEvaluation,
  combineSourceScores,
  formatCombinedEvaluation,
  normalizeScore,
} from '@/domain/turnScoring';
import { parseAiMoveResponse } from '@/domain/llmParsing';

export type { DifficultyLevel } from '@/domain/gameFlow';

type UseGameControllerParams = {
  maxRounds: number;
  aiGoesFirst: boolean;
  difficulty: DifficultyLevel;
  players?: Player[];
  services?: GameFlowServices;
  playerControllers?: PlayerTurnController[];
};

const EMPTY_PLAYER_CONTROLLERS: PlayerTurnController[] = [];

function resolveGeneratedTopic(result: string | GeneratedTopic): GeneratedTopic {
  return typeof result === 'string' ? { topic: result } : result;
}

export function useGameController({
  maxRounds,
  aiGoesFirst,
  difficulty,
  players,
  services = gameApi,
  playerControllers = EMPTY_PLAYER_CONTROLLERS,
}: UseGameControllerParams) {
  const startedAutomaticTurnKeyRef = useRef<string | null>(null);
  const [gameState, setGameState] = useState(() => createEmptyGameState(
    10,
    players?.[0]?.id || DEFAULT_HUMAN_PLAYER_ID,
    players
  ));
  const [response, setResponse] = useState<string>('');
  const [inlineEvaluation, setInlineEvaluation] = useState<CurrentEvaluationView | null>(null);

  const submitAiTurn = useCallback<NonNullable<PlayerTurnController['submitTurn']>>(async (context) => {
    if (context.availableNodes.length === 0) {
      const generatedTopic = resolveGeneratedTopic(await services.generateTopic({
        difficulty: context.difficulty,
      }));

      return {
        responseText: generatedTopic.topic,
        destinationSubjectCategory: generatedTopic.subjectCategory,
        fallbackOnEvaluationFailure: true,
      };
    }

    const aiResponse = await services.generateAiResponse({
      topic: context.topic,
      availableNodes: context.availableNodes.map(node => ({
        id: node.id,
        topic: node.topic,
        definition: node.definition,
        subjectCategory: node.subjectCategory,
        isCurrentSource: false,
      })),
      selectedSourceNodeIds: [],
      sourceSelectionMode: 'free',
      gameHistory: context.gameHistory,
      difficulty: context.difficulty,
    });
    const parsedMove = parseAiMoveResponse(aiResponse);
    console.log('Parsed AI move:', parsedMove || {
      parseFailed: true,
      rawResponsePreview: aiResponse.slice(0, 240),
    });

    return {
      selectedSourceNodeIds: parsedMove?.selectedSourceNodeIds,
      responseText: parsedMove?.responseText.trim() || aiResponse.trim() || `Response to ${context.topic}`,
      fallbackOnEvaluationFailure: true,
    };
  }, [services]);

  const defaultAiControllers = useMemo<PlayerTurnController[]>(
    () => Object.values(gameState.playersById)
      .filter(player => player.kind === 'ai')
      .map(player => ({
        playerId: player.id,
        mode: 'automatic',
        submitTurn: submitAiTurn,
      })),
    [gameState.playersById, submitAiTurn]
  );

  const effectivePlayerControllers = useMemo(
    () => [...playerControllers, ...defaultAiControllers],
    [defaultAiControllers, playerControllers]
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
  const currentSourceTopicText = selectCurrentSourceTopicText(gameState);
  const isEvaluating = gameState.gameStatus === 'evaluating';
  const isAiThinking = gameState.gameStatus === 'aiThinking';
  const showingResults = gameState.gameStatus === 'showingResults' || gameState.gameStatus === 'completed';
  const gameCompleted = gameState.gameStatus === 'completed';
  const isOpeningTurn = !gameState.rootNodeId;

  const setSelectedGraphNodeId = (nodeId: string | null) => {
    setInlineEvaluation(null);
    setGameState(prev => setSelectedNodeIds(prev, nodeId ? [nodeId] : []));
  };

  const generateFirstTopic = async () => {
    console.log('=== STARTING GAME ===');
    console.log('aiGoesFirst setting:', aiGoesFirst);

    const initialPlayerId = resolveInitialPlayerId(players, aiGoesFirst);
    startedAutomaticTurnKeyRef.current = null;
    setInlineEvaluation(null);
    setResponse('');
    setGameState(setGameStatus(
      createEmptyGameState(maxRounds, initialPlayerId, players),
      'awaitingResponse'
    ));
  };

  const completeEvaluatedTurn = useCallback((params: {
    playerId: string;
    responseText: string;
    evaluationTopic: string;
    result: TurnEvaluation;
    continueToNextTurn?: boolean;
  }) => {
    setGameState(prev => {
      const withTurn = addTurnToGameState(prev, {
        destinationTopic: params.responseText,
        playerId: params.playerId,
        sourceNodeIds: prev.activeSourceNodeIds,
        evaluation: params.result.evaluation,
        totalScore: params.result.scores.total,
        legacyScores: params.result.scores,
        edgeEvaluations: params.result.edgeEvaluations,
        destinationSubjectCategory: params.result.destinationSubjectCategory,
        scoringDescription: params.result.evaluation,
      });

      if (currentRound === maxRounds) {
        setInlineEvaluation(null);
        return setGameStatus(withTurn, 'completed');
      }

      if (!params.continueToNextTurn) {
        setInlineEvaluation(null);
        return setGameStatus(withTurn, 'showingResults');
      }

      setInlineEvaluation(selectCurrentEvaluation(setGameStatus(withTurn, 'showingResults')));
      return advanceGameTurn(withTurn, getNextPlayerId(withTurn));
    });
  }, [currentRound, maxRounds]);

  const evaluateTurnResponse = useCallback(async (params: {
    playerId: string;
    responseText: string;
    destinationSubjectCategory?: GeneratedTopic['subjectCategory'];
    selectedSourceNodeIds?: string[];
    fallbackOnFailure?: boolean;
    clearResponseOnSuccess?: boolean;
  }) => {
    if (isOpeningTurn) {
      if (!params.responseText.trim()) return;

      setGameState(prev => {
        const withOpeningTopic = addOpeningTopicTurnToGameState(prev, {
          topic: params.responseText.trim(),
          playerId: params.playerId,
          subjectCategory: params.destinationSubjectCategory,
        });

        return advanceGameTurn(withOpeningTopic, getNextPlayerId(withOpeningTopic), {
          incrementRound: false,
        });
      });

      if (params.clearResponseOnSuccess) {
        setResponse('');
      }
      return;
    }

    const selectedSourceNodeIds = resolveSubmittedSourceNodeIds(
      {
        nodesById: gameState.nodesById,
        activeSourceNodeIds: gameState.activeSourceNodeIds,
      },
      { selectedSourceNodeIds: params.selectedSourceNodeIds }
    );
    console.log('Resolved turn source ids:', {
      requestedSourceNodeIds: params.selectedSourceNodeIds || [],
      resolvedSourceNodeIds: selectedSourceNodeIds,
      fallbackActiveSourceNodeIds: gameState.activeSourceNodeIds,
    });
    const evaluationTargets = selectedSourceNodeIds
      .map(nodeId => gameState.nodesById[nodeId])
      .filter(Boolean);
    const evaluationTopic = evaluationTargets.map(node => node.topic).join(' + ');
    if (!evaluationTopic || !params.responseText) return;

    setGameState(prev => setGameStatus({
      ...prev,
      activeSourceNodeIds: selectedSourceNodeIds,
      selectedNodeIds: selectedSourceNodeIds,
    }, 'evaluating'));

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const edgeEvaluations = await Promise.all(
          evaluationTargets.map(async sourceNode => {
            const result = await services.evaluateTurn({
              topic: sourceNode.topic,
              response: params.responseText,
              difficulty,
            });

            return {
              sourceNodeId: sourceNode.id,
              sourceTopic: sourceNode.topic,
              evaluation: result.evaluation,
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
          destinationSubjectCategory,
          scores: combinedScores,
          edgeEvaluations,
        };

        completeEvaluatedTurn({
          playerId: params.playerId,
          responseText: params.responseText,
          evaluationTopic,
          result,
          continueToNextTurn: !params.clearResponseOnSuccess,
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
            continueToNextTurn: !params.clearResponseOnSuccess,
          });
        } else {
          setGameState(prev => setGameStatus(prev, 'awaitingResponse'));
          alert('Failed to evaluate response after multiple attempts. Please try again.');
        }
      }
    }
  }, [
    completeEvaluatedTurn,
    difficulty,
    gameState.activeSourceNodeIds,
    gameState.nodesById,
    isOpeningTurn,
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

    setGameState(prev => advanceGameTurn(prev, getNextPlayerId(prev), {
      incrementRound: !currentEvaluation?.isOpeningTurn,
    }));
    setResponse('');
  };

  const resetCurrentGame = (currentPlayerId: string) => {
    setResponse('');
    startedAutomaticTurnKeyRef.current = null;
    setInlineEvaluation(null);
    setSelectedGraphNodeId(null);
    setGameState(createEmptyGameState(maxRounds, currentPlayerId, players));
  };

  const handleRestart = () => {
    resetCurrentGame(resolveInitialPlayerId(players, aiGoesFirst));
    generateFirstTopic();
  };

  const handleReturnToSettings = () => {
    resetCurrentGame(players?.[0]?.id || DEFAULT_HUMAN_PLAYER_ID);
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
          availableNodes: Object.values(gameState.nodesById),
          selectedSourceNodeIds: [],
          gameHistory,
          difficulty,
        });
        const responseText = submission.responseText.trim() || `Response to ${promptTopic}`;

        await evaluateTurnResponse({
          playerId: currentPlayerModel.id,
          responseText,
          destinationSubjectCategory: submission.destinationSubjectCategory,
          selectedSourceNodeIds: submission.selectedSourceNodeIds,
          fallbackOnFailure: submission.fallbackOnEvaluationFailure,
          clearResponseOnSuccess: submission.clearResponseOnSuccess,
        });
      } catch (error) {
        console.error('Error getting automatic player response:', error);
        const fallbackResponse = `Response to ${promptTopic}`;
        await evaluateTurnResponse({
          playerId: currentPlayerModel.id,
          responseText: fallbackResponse,
          selectedSourceNodeIds: gameState.activeSourceNodeIds,
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
    gameHistory,
    maxRounds,
    difficulty,
    evaluateTurnResponse,
  ]);

  return {
    gameState,
    setGameState,
    response,
    setResponse,
    currentEvaluation,
    inlineEvaluation,
    clearInlineEvaluation: () => setInlineEvaluation(null),
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
