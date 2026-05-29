import axios from 'axios';
import {
  LLM_CONFIG,
  LlmTask,
  ResolvedLlmModelConfig,
  resolveModelConfig,
} from '@/config/llm';
import {
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
  parseAiMoveResponse,
  parseEvaluationResponse,
  trimIncompleteTrailingSentence,
} from '@/domain/llmParsing';
import { validateConceptLength } from '@/domain/conceptRules';

export { difficultyPrompts, evaluationDifficultyPrompts };

type TextPromptRequest = {
  systemPrompt: string;
  userMessage: string;
  task: LlmTask;
  maxTokens: number;
  temperature: number;
  responseJson?: boolean;
};

const MAX_CONCEPT_GENERATION_ATTEMPTS = 3;

type AnthropicTextBlock = {
  type?: string;
  text?: string;
};

type OpenAiResponseOutputItem = {
  content?: {
    type?: string;
    text?: string;
  }[];
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const providerMessage = typeof responseData === 'string'
      ? responseData
      : responseData
        ? JSON.stringify(responseData)
        : '';
    const statusText = error.response?.status ? `status ${error.response.status}` : error.message;
    return providerMessage ? `${statusText}: ${providerMessage}` : statusText;
  }

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

function getProviderApiKey(modelConfig: ResolvedLlmModelConfig) {
  const apiKey = process.env[modelConfig.provider.apiKeyEnvVar] || '';
  if (!apiKey) {
    throw new Error(`${modelConfig.provider.apiKeyEnvVar} is not configured`);
  }

  return apiKey;
}

function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseGeneratedTopicResponse(text: string) {
  const cleaned = stripCodeFence(text);

  try {
    const parsed = JSON.parse(cleaned) as { topic?: unknown };
    if (typeof parsed.topic === 'string' && parsed.topic.trim()) {
      return parsed.topic.trim();
    }
  } catch {
    // Fall through to tolerate older non-JSON model outputs.
  }

  return cleaned
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)
    ?.replace(/^["']|["']$/g, '')
    .replace(/^topic:\s*/i, '')
    .trim() || '';
}

async function callGeminiAPI(
  request: TextPromptRequest,
  modelConfig: ResolvedLlmModelConfig
) {
  const apiKey = getProviderApiKey(modelConfig);
  const maxOutputTokens = modelConfig.provider.resolveMaxOutputTokens(
    modelConfig.model,
    request.task,
    request.maxTokens
  );
  const generationOptions = modelConfig.provider.resolveGenerationOptions?.(
    modelConfig.model,
    request.task
  );
  const url = `${modelConfig.provider.endpoint}/models/${modelConfig.model}:generateContent`;
  const buildPayload = (options?: Record<string, unknown>) => ({
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
      ...(options || {}),
      ...(request.responseJson ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const requestConfig = {
    params: { key: apiKey },
    headers: { 'Content-Type': 'application/json' },
    timeout: 60_000,
  };
  let response;

  try {
    response = await axios.post(url, buildPayload(generationOptions), requestConfig);
  } catch (error) {
    if (generationOptions && axios.isAxiosError(error) && error.response?.status === 400) {
      console.warn('Gemini rejected optional generation options; retrying without them', {
        model: modelConfig.model,
        task: request.task,
        generationOptions,
        error: getErrorMessage(error),
      });
      response = await axios.post(url, buildPayload(), requestConfig);
    } else {
      throw error;
    }
  }

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
      generationOptions,
      finishReason: candidate?.finishReason,
      usageMetadata: response.data?.usageMetadata,
      promptFeedback: response.data?.promptFeedback,
    });
    throw new Error(`Gemini returned no visible text for ${request.task}`);
  }

  return text.trim();
}

function shouldSendOpenAiTemperature(modelId: string) {
  return !modelId.startsWith('gpt-5') && !modelId.startsWith('o');
}

async function callOpenAiAPI(
  request: TextPromptRequest,
  modelConfig: ResolvedLlmModelConfig
) {
  const apiKey = getProviderApiKey(modelConfig);
  const maxOutputTokens = modelConfig.provider.resolveMaxOutputTokens(
    modelConfig.model,
    request.task,
    request.maxTokens
  );
  const response = await axios.post(
    `${modelConfig.provider.endpoint}/responses`,
    {
      model: modelConfig.model,
      instructions: request.systemPrompt,
      input: request.userMessage,
      max_output_tokens: maxOutputTokens,
      ...(shouldSendOpenAiTemperature(modelConfig.model) ? { temperature: request.temperature } : {}),
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 60_000,
    }
  );

  const outputText = response.data?.output_text;
  const fallbackOutput = Array.isArray(response.data?.output)
    ? response.data.output
      .flatMap((item: OpenAiResponseOutputItem) => item.content || [])
      .map((content: { text?: string }) => content.text || '')
      .join('')
    : '';
  const text = typeof outputText === 'string' ? outputText : fallbackOutput;

  if (!text.trim()) {
    console.warn('OpenAI returned no visible text', {
      model: modelConfig.model,
      task: request.task,
      maxOutputTokens,
      responseId: response.data?.id,
      status: response.data?.status,
    });
    throw new Error(`OpenAI returned no visible text for ${request.task}`);
  }

  return text.trim();
}

async function callAnthropicAPI(
  request: TextPromptRequest,
  modelConfig: ResolvedLlmModelConfig
) {
  const apiKey = getProviderApiKey(modelConfig);
  const maxTokens = modelConfig.provider.resolveMaxOutputTokens(
    modelConfig.model,
    request.task,
    request.maxTokens
  );
  const response = await axios.post(
    `${modelConfig.provider.endpoint}/messages`,
    {
      model: modelConfig.model,
      system: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: request.userMessage,
        },
      ],
      max_tokens: maxTokens,
      temperature: request.temperature,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 60_000,
    }
  );

  const text = Array.isArray(response.data?.content)
    ? response.data.content
      .map((block: AnthropicTextBlock) => block.type === 'text' || block.text ? block.text || '' : '')
      .join('')
    : '';

  if (!text.trim()) {
    console.warn('Anthropic returned no visible text', {
      model: modelConfig.model,
      task: request.task,
      maxTokens,
      stopReason: response.data?.stop_reason,
      usage: response.data?.usage,
    });
    throw new Error(`Anthropic returned no visible text for ${request.task}`);
  }

  return text.trim();
}

const providerClients = {
  gemini: callGeminiAPI,
  openai: callOpenAiAPI,
  anthropic: callAnthropicAPI,
};

export function getModelConfig() {
  const modelConfig = resolveModelConfig();

  return {
    model: modelConfig.model,
    provider: modelConfig.providerId,
    displayName: modelConfig.displayName,
    modelKey: modelConfig.key,
    temperature: LLM_CONFIG.temperature,
  };
}

async function callTextPrompt(request: TextPromptRequest, modelKey?: string) {
  const modelConfig = resolveModelConfig(request.task, modelKey);
  const client = providerClients[modelConfig.providerId];
  console.log(`Using ${modelConfig.provider.displayName} API with model:`, modelConfig.model);

  return callWithRetry(() => client(request, modelConfig));
}

export async function generateTopic(
  category: string,
  subcategory: string,
  difficulty: string,
  recentTopics: string[] = [],
  modelKey?: string
): Promise<string> {
  console.log('=== GENERATE TOPIC API CALL ===');
  console.log('Current model config:', JSON.stringify(resolveModelConfig('topic', modelKey)));

  const { systemPrompt, userMessage } = buildGenerateTopicPrompt({
    category,
    subcategory,
    difficulty,
    recentTopics,
    timestamp: new Date().toISOString(),
  });

  let lastInvalidTopic = '';

  for (let attempt = 1; attempt <= MAX_CONCEPT_GENERATION_ATTEMPTS; attempt += 1) {
    const topic = await callTextPrompt({
      systemPrompt,
      userMessage: lastInvalidTopic
        ? `${userMessage}\n\nThe previous generated topic was invalid because it exceeded five words or was not concise: "${lastInvalidTopic}". Return a different topic with five words or fewer.`
        : userMessage,
      task: 'topic',
      maxTokens: LLM_CONFIG.maxTokens.topic,
      temperature: LLM_CONFIG.temperature.creative,
      responseJson: true,
    }, modelKey);

    const parsedTopic = parseGeneratedTopicResponse(topic);
    const validation = validateConceptLength(parsedTopic);
    if (validation.valid) {
      console.log('API request successful');
      return parsedTopic;
    }

    lastInvalidTopic = parsedTopic || topic;
    console.warn(`Generated topic failed concept validation on attempt ${attempt}:`, {
      topic: parsedTopic,
      wordCount: validation.wordCount,
      message: validation.message,
    });
  }

  throw new Error(`Generated topic exceeded five words after ${MAX_CONCEPT_GENERATION_ATTEMPTS} attempts`);
}

export async function getDefinition(topic: string, modelKey?: string): Promise<string> {
  console.log('=== GET DEFINITION API CALL ===');
  console.log('Current model config:', JSON.stringify(resolveModelConfig('definition', modelKey)));

  const { systemPrompt, userMessage } = buildDefinitionPrompt(topic);

  try {
    const definition = await callTextPrompt({
      systemPrompt,
      userMessage,
      task: 'definition',
      maxTokens: LLM_CONFIG.maxTokens.definition,
      temperature: LLM_CONFIG.temperature.factual,
    }, modelKey);

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
  modelKey?: string
): Promise<string> {
  console.log('=== GET AI RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(resolveModelConfig('response', modelKey)));

  const { systemPrompt, userMessage } = buildAiResponsePrompt({
    topic,
    availableNodes,
    gameHistory: gameHistory || [],
    difficulty,
    timestamp: new Date().toISOString(),
  });

  try {
    let lastInvalidResponse = '';

    for (let attempt = 1; attempt <= MAX_CONCEPT_GENERATION_ATTEMPTS; attempt += 1) {
      const response = await callTextPrompt({
        systemPrompt,
        userMessage: lastInvalidResponse
          ? `${userMessage}\n\nThe previous response topic was invalid because it exceeded five words or was not concise: "${lastInvalidResponse}". Return a different responseText with five words or fewer.`
          : userMessage,
        task: 'response',
        maxTokens: LLM_CONFIG.maxTokens.response,
        temperature: LLM_CONFIG.temperature.creative,
        responseJson: true,
      }, modelKey);

      const parsedMove = parseAiMoveResponse(response);
      const responseText = parsedMove?.responseText || response;
      const validation = validateConceptLength(responseText);
      if (validation.valid) {
        return response;
      }

      lastInvalidResponse = responseText;
      console.warn(`AI response failed concept validation on attempt ${attempt}:`, {
        responseText,
        wordCount: validation.wordCount,
        message: validation.message,
      });
    }

    throw new Error(`AI response exceeded five words after ${MAX_CONCEPT_GENERATION_ATTEMPTS} attempts`);
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
}

export async function evaluateResponse(
  topic: string,
  response: string,
  difficulty: string,
  modelKey?: string
): Promise<LlmEvaluationResponse> {
  console.log('=== EVALUATE RESPONSE API CALL ===');
  console.log('Current model config:', JSON.stringify(resolveModelConfig('evaluation', modelKey)));

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
    }, modelKey);

    return parseEvaluationResponse(evaluationText);
  } catch (error) {
    console.error('Error evaluating response:', error);
    throw error;
  }
}
