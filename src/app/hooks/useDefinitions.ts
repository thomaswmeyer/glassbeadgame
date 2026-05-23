"use client";

import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react';
import {
  DefinitionTarget,
  GameState,
  setNodeDefinitionVisibility,
  updateNodeDefinition,
} from '@/domain/game';

type DefinitionServices = {
  getDefinition(topic: string): Promise<string>;
};

type UseDefinitionsParams = {
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  services: DefinitionServices;
};

function normalizeDefinitionTopic(topic: string) {
  return topic.trim().toLowerCase();
}

export function useDefinitions({
  gameState,
  setGameState,
  services,
}: UseDefinitionsParams) {
  const definitionCacheRef = useRef<Map<string, string>>(new Map());
  const loadingNodeIdsRef = useRef<Set<string>>(new Set());
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(() => new Set());

  const getCachedDefinition = useCallback(async (topic: string) => {
    const cacheKey = normalizeDefinitionTopic(topic);
    const cachedDefinition = definitionCacheRef.current.get(cacheKey);

    if (cachedDefinition) {
      return cachedDefinition;
    }

    const definition = await services.getDefinition(topic);
    definitionCacheRef.current.set(cacheKey, definition);
    return definition;
  }, [services]);

  const isDefinitionLoading = useCallback((nodeId: string) => {
    return loadingNodeIds.has(nodeId);
  }, [loadingNodeIds]);

  const setNodeLoading = useCallback((nodeId: string, isLoading: boolean) => {
    const next = new Set(loadingNodeIdsRef.current);
    if (isLoading) {
      next.add(nodeId);
    } else {
      next.delete(nodeId);
    }

    loadingNodeIdsRef.current = next;
    setLoadingNodeIds(next);
  }, []);

  const showDefinition = useCallback((nodeId: string) => {
    setGameState(prev => setNodeDefinitionVisibility(prev, nodeId, true));
  }, [setGameState]);

  const hideDefinition = useCallback((nodeId: string) => {
    setGameState(prev => setNodeDefinitionVisibility(prev, nodeId, false));
  }, [setGameState]);

  const fetchDefinition = useCallback(async ({ nodeId, topic }: DefinitionTarget) => {
    if (!topic || loadingNodeIdsRef.current.has(nodeId)) return null;

    const existingDefinition = gameState.nodesById[nodeId]?.definition;
    if (existingDefinition) {
      showDefinition(nodeId);
      return existingDefinition;
    }

    setNodeLoading(nodeId, true);

    try {
      const definition = await getCachedDefinition(topic);
      setGameState(prev => updateNodeDefinition(prev, nodeId, definition));
      return definition;
    } catch (error) {
      console.error('Error fetching definition:', error);
      setGameState(prev => updateNodeDefinition(prev, nodeId, 'Unable to fetch definition at this time.'));
      return null;
    } finally {
      setNodeLoading(nodeId, false);
    }
  }, [gameState.nodesById, getCachedDefinition, setGameState, setNodeLoading, showDefinition]);

  return {
    fetchDefinition,
    hideDefinition,
    isDefinitionLoading,
    showDefinition,
  };
}
