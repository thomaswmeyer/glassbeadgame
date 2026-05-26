// LLM Configuration
const DEFAULT_GEMINI_MODEL_NAME = 'gemini-3.1-flash-lite';
const DEFAULT_GEMINI_MODEL_DISPLAY_NAME = 'Gemini 3.1 Flash-Lite';

export type LlmTask = 'topic' | 'definition' | 'response' | 'evaluation';

const THINKING_MODEL_MIN_OUTPUT_TOKENS: Record<LlmTask, number> = {
  topic: 1024,
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

export function normalizeGeminiModelName(modelName: string | undefined) {
  return modelName?.trim() || DEFAULT_GEMINI_MODEL_NAME;
}

export function formatGeminiModelDisplayName(modelName: string) {
  if (modelName === DEFAULT_GEMINI_MODEL_NAME) return DEFAULT_GEMINI_MODEL_DISPLAY_NAME;
  if (modelName === 'gemini-2.5-pro') return 'Gemini 2.5 Pro';

  return modelName;
}

export function getConfiguredGeminiModelName() {
  return normalizeGeminiModelName(process.env.GEMINI_MODEL);
}

export function isGeminiThinkingBudgetModel(modelName: string) {
  return modelName.startsWith('gemini-2.5-');
}

export function resolveGeminiMaxOutputTokens(modelName: string, task: LlmTask, baseTokens: number) {
  if (!isGeminiThinkingBudgetModel(modelName)) return baseTokens;

  return Math.max(baseTokens, THINKING_MODEL_MIN_OUTPUT_TOKENS[task]);
}

export function resolveGeminiThinkingConfig(modelName: string, task: LlmTask) {
  if (!isGeminiThinkingBudgetModel(modelName)) return undefined;

  return {
    thinkingBudget: THINKING_MODEL_BUDGETS[task],
  };
}

export const GEMINI_MODEL = {
  name: DEFAULT_GEMINI_MODEL_NAME,
  provider: 'gemini',
  displayName: DEFAULT_GEMINI_MODEL_DISPLAY_NAME,
};

export const LLM_CONFIG = {
  model: GEMINI_MODEL,

  temperature: {
    creative: 0.9,
    factual: 0.7,
    evaluation: 0.2,
  },

  endpoints: {
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
  },

  maxTokens: {
    topic: 100,
    definition: 800,
    response: 100,
    evaluation: 1000,
  },
};

export function getCurrentModelConfig() {
  const model = getConfiguredGeminiModelName();

  return {
    model,
    provider: LLM_CONFIG.model.provider,
    displayName: formatGeminiModelDisplayName(model),
  };
}
