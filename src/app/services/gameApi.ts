import axios from 'axios';
import {
  GameState,
} from '@/domain/game';
import {
  EvaluateTurnRequest,
  GameFlowServices,
  GenerateAiResponseRequest,
  GenerateTopicRequest,
  TurnContextHistoryItem,
  TurnEvaluation,
} from '@/domain/gameFlow';

async function postJson<TResponse>(endpoint: string, body: unknown): Promise<TResponse> {
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

function toLegacyAiGameHistory(gameHistory: TurnContextHistoryItem[]) {
  return gameHistory.map(item => ({
    round: item.round,
    topic: item.sourceTopics[0] || '',
    response: item.destinationTopic,
    evaluation: item.evaluation,
    scores: item.scores,
    player: item.playerKind === 'ai' ? 'ai' : 'human',
  }));
}

export const gameApi: GameFlowServices & {
  getDefinition(topic: string): Promise<string>;
  saveGameSnapshot(gameId: string, state: GameState): Promise<void>;
} = {
  async generateTopic(request: GenerateTopicRequest) {
    const result = await axios.post('/api/generate-topic', {
      difficulty: request.difficulty,
    });
    return {
      topic: result.data.topic,
      subjectCategory: result.data.subjectCategory,
    };
  },

  async evaluateTurn(request: EvaluateTurnRequest): Promise<TurnEvaluation> {
    return postJson('/api/evaluate-response', {
      topic: request.topic,
      response: request.response,
      difficulty: request.difficulty,
    });
  },

  async generateAiResponse(request: GenerateAiResponseRequest) {
    const result = await axios.post('/api/ai-response', {
      topic: request.topic,
      availableNodes: request.availableNodes,
      selectedSourceNodeIds: request.selectedSourceNodeIds,
      sourceSelectionMode: request.sourceSelectionMode,
      gameHistory: toLegacyAiGameHistory(request.gameHistory),
      difficulty: request.difficulty,
    });

    return result.data.response;
  },

  async getDefinition(topic: string) {
    const result = await axios.post('/api/get-definition', {
      topic,
    });
    return result.data.definition;
  },

  async saveGameSnapshot(gameId: string, state: GameState) {
    await postJson('/api/games/save', {
      gameId,
      state,
    });
  },
};
