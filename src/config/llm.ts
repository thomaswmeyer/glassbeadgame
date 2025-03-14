// LLM Configuration
export const LLM_CONFIG = {
  // Models configuration with name, provider, and descriptions
  models: {
    // Anthropic models
    sonnet: {
      name: "claude-3-7-sonnet-latest",
      provider: "anthropic",
      displayName: "Claude 3.7 Sonnet",
      description: "Latest and most capable model",
      category: "anthropic"
    },
    haiku: {
      name: "claude-3-5-haiku-latest",
      provider: "anthropic",
      displayName: "Claude 3.5 Haiku",
      description: "Fast and efficient model",
      category: "anthropic"
    },
    opus: {
      name: "claude-3-opus-latest",
      provider: "anthropic",
      displayName: "Claude 3 Opus",
      description: "Highest quality, but slower and more expensive",
      category: "anthropic"
    },
    
    // DeepSeek models
    deepseek_chat: {
      name: "deepseek-chat",
      provider: "deepseek",
      displayName: "DeepSeek Chat",
      description: "General-purpose chat model with strong reasoning capabilities",
      category: "deepseek"
    },
    deepseek_reasoner: {
      name: "deepseek-reasoner",
      provider: "deepseek",
      displayName: "DeepSeek Reasoner",
      description: "Specialized for complex reasoning and problem-solving",
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
    deepseek: "https://api.deepseek.com/v1/chat/completions"  // DeepSeek API endpoint
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
    definition: 250,
    response: 100,
    evaluation: 1000
  },
  
  // Production mode settings
  production: {
    // Check if we're in production mode (NEXT_PUBLIC_ prefix makes it available on client-side)
    isProduction: process.env.NEXT_PUBLIC_PRODUCTION_MODE === 'true',
    // Default model to use in production mode
    defaultModel: 'deepseek_chat'
  }
};

// Current model configuration (to be used by the LLM service)
// In production mode, always use the production default model
const defaultModel = LLM_CONFIG.production.isProduction 
  ? LLM_CONFIG.production.defaultModel 
  : 'sonnet'; // Development default

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