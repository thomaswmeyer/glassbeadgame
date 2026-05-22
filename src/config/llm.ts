// LLM Configuration
export const LLM_CONFIG = {
  // Models configuration with name, provider, and descriptions
  models: {
    // Google Gemini models - MOST COST-EFFECTIVE
    gemini_flash: {
      name: "gemini-3.1-flash-lite",
      provider: "gemini",
      displayName: "Gemini 3.1 Flash-Lite",
      description: "Fastest and most cost-effective Gemini 3.1 model",
      category: "gemini"
    },
    
    // Anthropic models - Updated to latest versions
    sonnet: {
      name: "claude-sonnet-4-5",
      provider: "anthropic",
      displayName: "Claude Sonnet 4.5",
      description: "Best for coding and agents - $3/$15 per 1M tokens",
      category: "anthropic"
    },
    opus: {
      name: "claude-opus-4-6",
      provider: "anthropic",
      displayName: "Claude Opus 4.6",
      description: "Most advanced Claude model - Highest quality",
      category: "anthropic"
    },
    haiku: {
      name: "claude-haiku-4-5",
      provider: "anthropic",
      displayName: "Claude Haiku 4.5",
      description: "Fastest Claude model - $1/$5 per 1M tokens",
      category: "anthropic"
    },
    
    // DeepSeek models
    deepseek_chat: {
      name: "deepseek-chat",
      provider: "deepseek",
      displayName: "DeepSeek Chat",
      description: "General-purpose chat - $0.14/$0.28 per 1M tokens",
      category: "deepseek"
    },
    deepseek_reasoner: {
      name: "deepseek-reasoner",
      provider: "deepseek",
      displayName: "DeepSeek Reasoner",
      description: "Complex reasoning - $0.55/$2.19 per 1M tokens",
      category: "deepseek"
    }
  },
  
  // Default temperature settings for different types of requests
  temperature: {
    creative: 0.9,  // For topic generation and AI responses
    factual: 0.7,   // For definitions
    evaluation: 0.2  // For evaluations
  },
  
  // API endpoints
  endpoints: {
    anthropic: "",  // Uses the Anthropic SDK directly
    deepseek: "https://api.deepseek.com/v1/chat/completions",  // DeepSeek API endpoint
    gemini: ""  // Uses the Gemini SDK directly
  },
  
  // Response format settings for different providers
  responseFormat: {
    anthropic: null, // Anthropic doesn't support direct JSON response format in the same way as OpenAI
    deepseek: {
      json: { type: "json_object" as const } // Use const assertion to ensure correct type
    }
  },
  
  // Max tokens settings for different request types
  maxTokens: {
    topic: 100,
    definition: 800,
    response: 100,
    evaluation: 1000
  },
  
  // Production mode settings
  production: {
    // Check if we're in production mode (NEXT_PUBLIC_ prefix makes it available on client-side)
    isProduction: process.env.NEXT_PUBLIC_PRODUCTION_MODE === 'true',
    // Default model to use in production mode - Gemini Flash is most cost-effective
    defaultModel: 'gemini_flash'
  }
};

// Current model configuration (to be used by the LLM service)
// In production mode, always use the production default model
const defaultModel = LLM_CONFIG.production.isProduction 
  ? LLM_CONFIG.production.defaultModel 
  : 'gemini_flash'; // Development default - most cost-effective

export let currentModelConfig = {
  model: '',
  provider: ''
};

// Initialize the current model configuration using the default model
updateModel(defaultModel);

// Update the current model based on the selected model key
export function updateModel(modelKey: string): void {
  // In production mode, only allow changing to the production default model
  if (LLM_CONFIG.production.isProduction && modelKey !== LLM_CONFIG.production.defaultModel) {
    console.warn(`In production mode, only ${LLM_CONFIG.production.defaultModel} is allowed. Ignoring request to change to ${modelKey}.`);
    modelKey = LLM_CONFIG.production.defaultModel;
  }
  
  if (!LLM_CONFIG.models[modelKey as keyof typeof LLM_CONFIG.models]) {
    console.error(`Invalid model key: ${modelKey}`);
    return;
  }
  
  const modelConfig = LLM_CONFIG.models[modelKey as keyof typeof LLM_CONFIG.models];
  
  // Update the current model configuration
  currentModelConfig = {
    model: modelConfig.name,
    provider: modelConfig.provider
  };
  
  console.log(`Model updated to: ${currentModelConfig.model} (${currentModelConfig.provider})`);
}
