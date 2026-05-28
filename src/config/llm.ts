export type LlmTask = 'topic' | 'definition' | 'response' | 'evaluation';
export type LlmProviderId = 'gemini' | 'openai' | 'anthropic';

export type LlmProvider = {
  id: LlmProviderId;
  displayName: string;
  endpoint: string;
  apiKeyEnvVar: string;
  formatModelDisplayName(modelId: string): string;
  resolveMaxOutputTokens(modelId: string, task: LlmTask, baseTokens: number): number;
  resolveGenerationOptions?(modelId: string, task: LlmTask): Record<string, unknown> | undefined;
};

export type LlmModelDefinition = {
  key: string;
  providerId: LlmProviderId;
  defaultModelId: string;
  displayName?: string;
  modelEnvVars?: string[];
};

export type ResolvedLlmModelConfig = {
  key: string;
  provider: LlmProvider;
  providerId: LlmProviderId;
  model: string;
  displayName: string;
};

const DEFAULT_MODEL_KEY = 'gemini_flash';

const THINKING_MODEL_MIN_OUTPUT_TOKENS: Record<LlmTask, number> = {
  topic: 4096,
  definition: 2048,
  response: 1536,
  evaluation: 4096,
};

const THINKING_MODEL_BUDGETS: Record<LlmTask, number> = {
  topic: 256,
  definition: 512,
  response: 512,
  evaluation: 1024,
};

function passthroughMaxOutputTokens(
  _modelId: string,
  _task: LlmTask,
  baseTokens: number
) {
  return baseTokens;
}

function titleCaseModelName(modelId: string) {
  return modelId
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.toUpperCase() === part
      ? part
      : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatOpenAiModelDisplayName(modelId: string) {
  if (modelId.startsWith('gpt-')) return modelId.toUpperCase();
  return titleCaseModelName(modelId);
}

function formatGeminiModelDisplayName(modelId: string) {
  if (modelId === 'gemini-2.5-flash-lite') return 'Gemini 2.5 Flash-Lite';
  if (modelId === 'gemini-2.5-pro') return 'Gemini 2.5 Pro';
  return titleCaseModelName(modelId);
}

function formatAnthropicModelDisplayName(modelId: string) {
  if (modelId.includes('opus')) return `Claude Opus (${modelId})`;
  if (modelId.includes('sonnet')) return `Claude Sonnet (${modelId})`;
  if (modelId.includes('haiku')) return `Claude Haiku (${modelId})`;
  return titleCaseModelName(modelId);
}

function isGeminiThinkingBudgetModel(modelId: string) {
  return modelId.startsWith('gemini-2.5-');
}

export const LLM_PROVIDERS: Record<LlmProviderId, LlmProvider> = {
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    formatModelDisplayName: formatGeminiModelDisplayName,
    resolveMaxOutputTokens(modelId, task, baseTokens) {
      if (!isGeminiThinkingBudgetModel(modelId)) return baseTokens;
      return Math.max(baseTokens, THINKING_MODEL_MIN_OUTPUT_TOKENS[task]);
    },
    resolveGenerationOptions(modelId, task) {
      if (!isGeminiThinkingBudgetModel(modelId)) return undefined;
      if (task === 'topic') return undefined;
      return {
        thinkingConfig: {
          thinkingBudget: THINKING_MODEL_BUDGETS[task],
        },
      };
    },
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    formatModelDisplayName: formatOpenAiModelDisplayName,
    resolveMaxOutputTokens: passthroughMaxOutputTokens,
  },
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    formatModelDisplayName: formatAnthropicModelDisplayName,
    resolveMaxOutputTokens: passthroughMaxOutputTokens,
  },
};

export const LLM_MODEL_DEFINITIONS: Record<string, LlmModelDefinition> = {
  gemini_flash: {
    key: 'gemini_flash',
    providerId: 'gemini',
    defaultModelId: 'gemini-2.5-flash-lite',
    displayName: 'Gemini Flash-Lite',
    modelEnvVars: ['GEMINI_FLASH_MODEL', 'GEMINI_MODEL'],
  },
  gemini_pro: {
    key: 'gemini_pro',
    providerId: 'gemini',
    defaultModelId: 'gemini-2.5-pro',
    displayName: 'Gemini Pro',
    modelEnvVars: ['GEMINI_PRO_MODEL'],
  },
  openai_frontier: {
    key: 'openai_frontier',
    providerId: 'openai',
    defaultModelId: 'gpt-5.2',
    displayName: 'OpenAI Frontier',
    modelEnvVars: ['OPENAI_FRONTIER_MODEL', 'OPENAI_MODEL'],
  },
  openai_fast: {
    key: 'openai_fast',
    providerId: 'openai',
    defaultModelId: 'gpt-5-mini',
    displayName: 'OpenAI Fast',
    modelEnvVars: ['OPENAI_FAST_MODEL'],
  },
  claude_opus: {
    key: 'claude_opus',
    providerId: 'anthropic',
    defaultModelId: 'claude-opus-4-1-20250805',
    displayName: 'Claude Opus',
    modelEnvVars: ['ANTHROPIC_OPUS_MODEL'],
  },
  claude_sonnet: {
    key: 'claude_sonnet',
    providerId: 'anthropic',
    defaultModelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet',
    modelEnvVars: ['ANTHROPIC_SONNET_MODEL', 'ANTHROPIC_MODEL'],
  },
};

export const LLM_CONFIG = {
  temperature: {
    creative: 0.9,
    factual: 0.7,
    evaluation: 0.2,
  },

  maxTokens: {
    topic: 100,
    definition: 800,
    response: 100,
    evaluation: 1000,
  },
};

function firstConfiguredEnvValue(envVars: string[] = []) {
  return envVars
    .map(envVar => process.env[envVar]?.trim())
    .find((value): value is string => Boolean(value));
}

export function normalizeModelKey(modelKey: string | undefined | null) {
  const trimmedModelKey = modelKey?.trim();
  return trimmedModelKey && LLM_MODEL_DEFINITIONS[trimmedModelKey]
    ? trimmedModelKey
    : DEFAULT_MODEL_KEY;
}

export function getDefaultAiModelKey() {
  return normalizeModelKey(
    process.env.GBG_DEFAULT_AI_MODEL_KEY ||
      process.env.NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY
  );
}

export function getDefaultJudgeModelKey() {
  return normalizeModelKey(process.env.GBG_JUDGE_MODEL_KEY || getDefaultAiModelKey());
}

export function getTaskModelKey(task: LlmTask, explicitModelKey?: string) {
  if (explicitModelKey) return normalizeModelKey(explicitModelKey);

  if (task === 'evaluation') return getDefaultJudgeModelKey();
  if (task === 'topic') return normalizeModelKey(process.env.GBG_TOPIC_MODEL_KEY || getDefaultAiModelKey());
  if (task === 'definition') {
    return normalizeModelKey(process.env.GBG_DEFINITION_MODEL_KEY || getDefaultAiModelKey());
  }

  return getDefaultAiModelKey();
}

export function resolveModelConfig(
  task: LlmTask = 'response',
  explicitModelKey?: string
): ResolvedLlmModelConfig {
  const key = getTaskModelKey(task, explicitModelKey);
  const definition = LLM_MODEL_DEFINITIONS[key] || LLM_MODEL_DEFINITIONS[DEFAULT_MODEL_KEY];
  const provider = LLM_PROVIDERS[definition.providerId];
  const model = firstConfiguredEnvValue(definition.modelEnvVars) || definition.defaultModelId;

  return {
    key: definition.key,
    provider,
    providerId: provider.id,
    model,
    displayName: definition.displayName || provider.formatModelDisplayName(model),
  };
}

export function resolveModelProviderInfo(modelKey: string | undefined) {
  const trimmedModelKey = modelKey?.trim();
  if (trimmedModelKey && !LLM_MODEL_DEFINITIONS[trimmedModelKey]) {
    return {
      provider: 'unknown',
      modelId: trimmedModelKey,
      modelKey: trimmedModelKey,
      displayName: trimmedModelKey,
    };
  }

  const config = resolveModelConfig('response', modelKey);
  return {
    provider: config.providerId,
    modelId: config.model,
    modelKey: config.key,
    displayName: config.displayName,
  };
}
