import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import { LLM_CONFIG, currentModelConfig } from '@/config/llm';
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
  maxTokens: number;
  temperature: number;
  fallbackText: string;
  responseJson?: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
}

function getErrorResponseField(error: unknown, field: 'data' | 'headers') {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  const response = error.response;
  if (typeof response !== 'object' || response === null || !(field in response)) {
    return undefined;
  }

  return (response as Record<'data' | 'headers', unknown>)[field];
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: LLM_CONFIG.endpoints.deepseek,
});

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

export function getModelConfig() {
  return {
    model: currentModelConfig.model,
    provider: currentModelConfig.provider,
    temperature: LLM_CONFIG.temperature,
  };
}

function convertToOpenAIMessages(
  systemPrompt: string,
  userMessages: { role: string; content: string }[]
) {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  userMessages.forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  });

  return messages;
}

async function callDeepSeekAPI(params: ChatCompletionCreateParamsNonStreaming) {
  console.log('=== DEEPSEEK API REQUEST DETAILS ===');
  console.log('Base URL:', LLM_CONFIG.endpoints.deepseek);
  console.log(
    'API Key (first 5 chars):',
    process.env.DEEPSEEK_API_KEY
      ? `${process.env.DEEPSEEK_API_KEY.substring(0, 5)}...`
      : 'undefined'
  );
  console.log('Model:', params.model);
  console.log('Request params:', JSON.stringify({
    ...params,
    messages: params.messages ? `[${params.messages.length} messages]` : undefined,
  }, null, 2));

  try {
    const response = await deepseekClient.chat.completions.create(params);
    console.log('DeepSeek API request successful');
    return response;
  } catch (error: unknown) {
    console.error('=== DEEPSEEK API ERROR ===');
    console.error('Error status:', getErrorStatus(error));
    console.error('Error message:', getErrorMessage(error));
    console.error('Error details:', getErrorResponseField(error, 'data') || 'No detailed error data');
    console.error('Error headers:', getErrorResponseField(error, 'headers') || 'No headers');
    throw error;
  }
}

async function callTextPrompt(request: TextPromptRequest) {
  if (currentModelConfig.provider === 'anthropic') {
    console.log('Using Anthropic API with model:', currentModelConfig.model);
    const response = await callWithRetry(() =>
      anthropic.messages.create({
        model: currentModelConfig.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.userMessage,
          },
        ],
      })
    );

    return response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : request.fallbackText;
  }

  if (currentModelConfig.provider === 'deepseek') {
    console.log('Using DeepSeek API with model:', currentModelConfig.model);
    const messages = convertToOpenAIMessages(request.systemPrompt, [
      { role: 'user', content: request.userMessage },
    ]);

    const params: ChatCompletionCreateParamsNonStreaming = {
      model: currentModelConfig.model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      ...(request.responseJson ? { response_format: { type: 'json_object' as const } } : {}),
    };

    const response = await callWithRetry(() => callDeepSeekAPI(params));

    return response.choices?.[0]?.message?.content?.trim() || request.fallbackText;
  }

  if (currentModelConfig.provider === 'gemini') {
    console.log('Using Gemini API with model:', currentModelConfig.model);
    const model = gemini.getGenerativeModel({
      model: currentModelConfig.model,
      systemInstruction: request.systemPrompt,
      ...(request.responseJson ? {
        generationConfig: {
          responseMimeType: 'application/json',
        },
      } : {}),
    });

    const result = await callWithRetry(() =>
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: request.userMessage }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          ...(request.responseJson ? { responseMimeType: 'application/json' } : {}),
        },
      })
    );

    return result.response.text()?.trim() || request.fallbackText;
  }

  throw new Error(`Unsupported provider: ${currentModelConfig.provider}`);
}

export async function generateTopic(
  category: string,
  subcategory: string,
  difficulty: string,
  recentTopics: string[] = []
): Promise<string> {
  console.log('=== GENERATE TOPIC API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));

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
    maxTokens: LLM_CONFIG.maxTokens.topic,
    temperature: LLM_CONFIG.temperature.creative,
    fallbackText: 'Failed to generate a topic',
  });

  console.log('API request successful');
  return topic;
}

export async function getDefinition(topic: string): Promise<string> {
  console.log('=== GET DEFINITION API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));

  const { systemPrompt, userMessage } = buildDefinitionPrompt(topic);

  try {
    const definition = await callTextPrompt({
      systemPrompt,
      userMessage,
      maxTokens: LLM_CONFIG.maxTokens.definition,
      temperature: LLM_CONFIG.temperature.factual,
      fallbackText: 'Definition not available.',
    });

    return trimIncompleteTrailingSentence(definition);
  } catch (error) {
    console.error('Error fetching definition:', error);
    throw error;
  }
}

export async function getAiResponse(
  topic: string,
  originalTopic: string,
  gameHistory: LegacyAiGameHistoryItem[],
  difficulty: string,
  circleEnabled: boolean,
  isFinalRound: boolean,
  availableNodes: AiResponsePromptNode[] = [],
  selectedSourceNodeIds: string[] = [],
  sourceSelectionMode: AiSourceSelectionMode = 'suggested'
): Promise<string> {
  console.log('=== GET AI RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));

  const { systemPrompt, userMessage } = buildAiResponsePrompt({
    topic,
    availableNodes,
    selectedSourceNodeIds,
    sourceSelectionMode,
    originalTopic,
    gameHistory: gameHistory || [],
    difficulty,
    circleEnabled,
    isFinalRound,
    timestamp: new Date().toISOString(),
  });

  try {
    return await callTextPrompt({
      systemPrompt,
      userMessage,
      maxTokens: LLM_CONFIG.maxTokens.response,
      temperature: LLM_CONFIG.temperature.creative,
      fallbackText: 'Connection not found',
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
  difficulty: string,
  originalTopic?: string,
  isFinalRound?: boolean
): Promise<LlmEvaluationResponse> {
  console.log('=== EVALUATE RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(currentModelConfig));

  const isFinalEvaluation = Boolean(isFinalRound && originalTopic);
  const { systemPrompt, userMessage } = buildEvaluationPrompt({
    topic,
    response,
    difficulty,
    originalTopic,
    isFinalRound,
  });

  try {
    const evaluationText = await callTextPrompt({
      systemPrompt,
      userMessage,
      maxTokens: LLM_CONFIG.maxTokens.evaluation,
      temperature: LLM_CONFIG.temperature.evaluation,
      fallbackText: '{}',
      responseJson: true,
    });

    return parseEvaluationResponse(evaluationText, {
      isFinalRound: isFinalEvaluation,
    });
  } catch (error) {
    console.error('Error evaluating response:', error);
    throw error;
  }
}
