import axios from 'axios';
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
    if (request.isFinalCircleRound) {
      return postJson('/api/evaluate-final-response', {
        currentTopic: request.topic,
        originalTopic: request.originalTopic,
        response: request.response,
        difficulty: request.difficulty,
      });
    }

    return postJson('/api/evaluate-response', {
      topic: request.topic,
      response: request.response,
      difficulty: request.difficulty,
    });
  },

  async generateAiResponse(request: GenerateAiResponseRequest) {
    const endpoint = request.isFinalCircleRound ? '/api/ai-final-response' : '/api/ai-response';
    const result = await axios.post(endpoint, {
      topic: request.topic,
      originalTopic: request.originalTopic,
      gameHistory: toLegacyAiGameHistory(request.gameHistory),
      difficulty: request.difficulty,
      circleEnabled: request.circleEnabled,
    });

    return result.data.response;
  },

  async getDefinition(topic: string) {
    const result = await axios.post('/api/get-definition', {
      topic,
    });
    return result.data.definition;
  },
};
