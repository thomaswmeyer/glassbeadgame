import axios from 'axios';
import {
  LLM_CONFIG,
  LlmTask,
  getCurrentModelConfig,
  resolveGeminiMaxOutputTokens,
  resolveGeminiThinkingConfig,
} from '@/config/llm';
import {
  AiSourceSelectionMode,
  AiResponsePromptNode,
  LegacyAiGameHistoryItem,
  buildAiResponsePrompt,
  buildDefinitionPrompt,
  buildEvaluationPrompt,
  buildGenerateTopicPrompt,
  difficultyPrompts,
  evaluationDifficultyPrompts,
} from '@/domain/llmPrompts';
import {
  LlmEvaluationResponse,
  parseEvaluationResponse,
  trimIncompleteTrailingSentence,
} from '@/domain/llmParsing';

export { difficultyPrompts, evaluationDifficultyPrompts };

type TextPromptRequest = {
  systemPrompt: string;
  userMessage: string;
  task: LlmTask;
  maxTokens: number;
  temperature: number;
  responseJson?: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function callWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`API request attempt ${attempt + 1} of ${maxRetries}`);
      return await apiCall();
    } catch (error: unknown) {
      console.error(`Attempt ${attempt + 1} failed:`, getErrorMessage(error));
      lastError = error;

      if (attempt < maxRetries - 1) {
        const backoffTime = 1000 * Math.pow(2, attempt);
        console.log(`Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  console.error('All retry attempts failed');
  throw lastError;
}

async function callGeminiAPI(request: TextPromptRequest) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const modelConfig = getCurrentModelConfig();
  const maxOutputTokens = resolveGeminiMaxOutputTokens(
    modelConfig.model,
    request.task,
    request.maxTokens
  );
  const thinkingConfig = resolveGeminiThinkingConfig(modelConfig.model, request.task);
  const url = `${LLM_CONFIG.endpoints.gemini}/models/${modelConfig.model}:generateContent`;
  const response = await axios.post(
    url,
    {
      systemInstruction: {
        parts: [{ text: request.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userMessage }],
        },
      ],
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens,
        ...(thinkingConfig ? { thinkingConfig } : {}),
        ...(request.responseJson ? { responseMimeType: 'application/json' } : {}),
      },
    },
    {
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    }
  );

  const candidate = response.data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part: { text?: string }) => part.text || '').join('')
    : '';

  if (!text.trim()) {
    console.warn('Gemini returned no visible text', {
      model: modelConfig.model,
      task: request.task,
      maxOutputTokens,
      thinkingConfig,
      finishReason: candidate?.finishReason,
      usageMetadata: response.data?.usageMetadata,
      promptFeedback: response.data?.promptFeedback,
    });
    throw new Error(`Gemini returned no visible text for ${request.task}`);
  }

  return text.trim();
}

export function getModelConfig() {
  return {
    ...getCurrentModelConfig(),
    temperature: LLM_CONFIG.temperature,
  };
}

async function callTextPrompt(request: TextPromptRequest) {
  const modelConfig = getCurrentModelConfig();
  console.log('Using Gemini API with model:', modelConfig.model);
  return callWithRetry(() => callGeminiAPI(request));
}

export async function generateTopic(
  category: string,
  subcategory: string,
  difficulty: string,
  recentTopics: string[] = []
): Promise<string> {
  console.log('=== GENERATE TOPIC API CALL ===');
  console.log('Current model config:', JSON.stringify(getCurrentModelConfig()));

  const { systemPrompt, userMessage } = buildGenerateTopicPrompt({
    category,
    subcategory,
    difficulty,
    recentTopics,
    timestamp: new Date().toISOString(),
  });

  const topic = await callTextPrompt({
    systemPrompt,
    userMessage,
    task: 'topic',
    maxTokens: LLM_CONFIG.maxTokens.topic,
    temperature: LLM_CONFIG.temperature.creative,
  });

  console.log('API request successful');
  return topic;
}

export async function getDefinition(topic: string): Promise<string> {
  console.log('=== GET DEFINITION API CALL ===');
  console.log('Current model config:', JSON.stringify(getCurrentModelConfig()));

  const { systemPrompt, userMessage } = buildDefinitionPrompt(topic);

  try {
    const definition = await callTextPrompt({
      systemPrompt,
      userMessage,
      task: 'definition',
      maxTokens: LLM_CONFIG.maxTokens.definition,
      temperature: LLM_CONFIG.temperature.factual,
    });

    return trimIncompleteTrailingSentence(definition);
  } catch (error) {
    console.error('Error fetching definition:', error);
    throw error;
  }
}

export async function getAiResponse(
  topic: string,
  gameHistory: LegacyAiGameHistoryItem[],
  difficulty: string,
  availableNodes: AiResponsePromptNode[] = [],
  selectedSourceNodeIds: string[] = [],
  sourceSelectionMode: AiSourceSelectionMode = 'suggested'
): Promise<string> {
  console.log('=== GET AI RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(getCurrentModelConfig()));

  const { systemPrompt, userMessage } = buildAiResponsePrompt({
    topic,
    availableNodes,
    selectedSourceNodeIds,
    sourceSelectionMode,
    gameHistory: gameHistory || [],
    difficulty,
    timestamp: new Date().toISOString(),
  });

  try {
    return await callTextPrompt({
      systemPrompt,
      userMessage,
      task: 'response',
      maxTokens: LLM_CONFIG.maxTokens.response,
      temperature: LLM_CONFIG.temperature.creative,
      responseJson: true,
    });
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
}

export async function evaluateResponse(
  topic: string,
  response: string,
  difficulty: string
): Promise<LlmEvaluationResponse> {
  console.log('=== EVALUATE RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(getCurrentModelConfig()));

  const { systemPrompt, userMessage } = buildEvaluationPrompt({
    topic,
    response,
    difficulty,
  });

  try {
    const evaluationText = await callTextPrompt({
      systemPrompt,
      userMessage,
      task: 'evaluation',
      maxTokens: LLM_CONFIG.maxTokens.evaluation,
      temperature: LLM_CONFIG.temperature.evaluation,
      responseJson: true,
    });

    return parseEvaluationResponse(evaluationText);
  } catch (error) {
    console.error('Error evaluating response:', error);
    throw error;
  }
}
