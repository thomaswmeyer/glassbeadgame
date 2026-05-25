// LLM Configuration
export const GEMINI_MODEL = {
  name: 'gemini-3.1-flash-lite',
  provider: 'gemini',
  displayName: 'Gemini 3.1 Flash-Lite',
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
  return {
    model: LLM_CONFIG.model.name,
    provider: LLM_CONFIG.model.provider,
  };
}
