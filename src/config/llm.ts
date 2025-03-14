// LLM Configuration
export const LLM_CONFIG = {
  // The model to use for all requests
  model: "claude-3-sonnet-20240229",
  
  // The provider of the current model
  provider: "anthropic",
  
  // Alternative models that can be used
  models: {
    // Anthropic models
    sonnet: "claude-3-sonnet-20240229",
    haiku: "claude-3-haiku-20240307",
    opus: "claude-3-opus-20240229",
    
    // DeepSeek models
    deepseek_coder: "deepseek-coder-33b-instruct",
    deepseek_lite: "deepseek-llm-67b-chat",
    deepseek_v2: "deepseek-v2"
  },
  
  // Map of models to their providers
  providers: {
    "claude-3-sonnet-20240229": "anthropic",
    "claude-3-haiku-20240307": "anthropic",
    "claude-3-opus-20240229": "anthropic",
    "deepseek-coder-33b-instruct": "deepseek",
    "deepseek-llm-67b-chat": "deepseek",
    "deepseek-v2": "deepseek"
  } as Record<string, string>,
  
  // Default temperature settings for different types of requests
  temperature: {
    creative: 0.9,  // For topic generation and AI responses
    factual: 0.7,   // For definitions
    evaluation: 0.2  // For evaluations
  },
  
  // API endpoints
  endpoints: {
    anthropic: "",  // Uses the Anthropic SDK directly
    deepseek: "https://api.deepseek.com/v1/chat/completions"  // DeepSeek API endpoint
  }
};

// Function to update the model
export function updateModel(modelKey: 'sonnet' | 'haiku' | 'opus' | 'deepseek_coder' | 'deepseek_lite' | 'deepseek_v2') {
  LLM_CONFIG.model = LLM_CONFIG.models[modelKey];
  LLM_CONFIG.provider = LLM_CONFIG.providers[LLM_CONFIG.model];
  return LLM_CONFIG.model;
} 