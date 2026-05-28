"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gameApi } from '@/app/services/gameApi';
import {
  DEFAULT_HUMAN_PLAYER_ID,
  CurrentEvaluationView,
  Player,
  createEmptyGameState,
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
  selectCurrentSourceTopicText,
  selectTurnContextHistory,
} from '@/domain/gameFlow';
import {
  PlayerTurnController,
  createTurnExecutionKey,
  resolvePlayerController,
  shouldAutoSubmitTurn,
} from '@/domain/playerController';
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

function createClientGameId() {
  return crypto.randomUUID();
}

export function useGameController({
  maxRounds,
  aiGoesFirst,
  difficulty,
  players,
  services = gameApi,
  playerControllers = EMPTY_PLAYER_CONTROLLERS,
}: UseGameControllerParams) {
  const gameIdRef = useRef<string>(createClientGameId());
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
      modelKey: context.player.modelKey,
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
    const gameId = createClientGameId();
    gameIdRef.current = gameId;
    startedAutomaticTurnKeyRef.current = null;
    setInlineEvaluation(null);
    setResponse('');

    if (services.createGame) {
      const result = await services.createGame({
        gameId,
        maxRounds,
        initialPlayerId,
        players,
        difficulty,
      });
      setGameState(result.state);
      return;
    }

    setGameState(setGameStatus(createEmptyGameState(maxRounds, initialPlayerId, players), 'awaitingResponse'));
  };

  const evaluateTurnResponse = useCallback(async (params: {
    playerId: string;
    responseText: string;
    destinationSubjectCategory?: GeneratedTopic['subjectCategory'];
    selectedSourceNodeIds?: string[];
    fallbackOnFailure?: boolean;
    clearResponseOnSuccess?: boolean;
  }) => {
    const responseText = params.responseText.trim();
    if (!responseText || !services.submitTurn) return;

    const nextStatus = isOpeningTurn && currentPlayerModel?.kind === 'ai' ? 'aiThinking' : 'evaluating';
    setGameState(prev => setGameStatus(prev, nextStatus));

    try {
      const result = await services.submitTurn({
        gameId: gameIdRef.current,
        playerId: params.playerId,
        responseText,
        selectedSourceNodeIds: params.selectedSourceNodeIds ?? gameState.activeSourceNodeIds,
        destinationSubjectCategory: params.destinationSubjectCategory,
        fallbackOnEvaluationFailure: params.fallbackOnFailure,
        advanceAfterScoring: !params.clearResponseOnSuccess,
      });

      setInlineEvaluation(result.inlineEvaluation);
      setGameState(result.state);

      if (params.clearResponseOnSuccess) {
        setResponse('');
      }
    } catch (error) {
      console.error('Failed to submit turn:', error);
      setGameState(prev => setGameStatus(prev, 'awaitingResponse'));
      alert('Failed to submit turn. Please try again.');
    }
  }, [
    currentPlayerModel?.kind,
    gameState.activeSourceNodeIds,
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

  const handleNextTurn = async () => {
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

    if (!services.advanceTurn) return;

    try {
      const result = await services.advanceTurn({
        gameId: gameIdRef.current,
      });
      setGameState(result.state);
      setResponse('');
    } catch (error) {
      console.error('Failed to advance turn:', error);
      alert('Failed to advance to the next turn. Please try again.');
    }
  };

  const resetCurrentGame = (currentPlayerId: string) => {
    setResponse('');
    gameIdRef.current = createClientGameId();
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
