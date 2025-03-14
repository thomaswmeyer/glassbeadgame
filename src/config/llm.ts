// LLM Configuration
export const LLM_CONFIG = {
  // The model to use for all requests
  model: "claude-3-7-sonnet-latest",
  
  // The provider of the current model
  provider: "anthropic",
  
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
  }
};

// Current model configuration (to be used by the LLM service)
export let currentModelConfig = {
  model: LLM_CONFIG.model,
  provider: LLM_CONFIG.provider
};

// Update the current model based on the selected model key
export function updateModel(modelKey: string): void {
  if (!LLM_CONFIG.models[modelKey as keyof typeof LLM_CONFIG.models]) {
    console.error(`Invalid model key: ${modelKey}`);
    return;
  }
  
  const modelConfig = LLM_CONFIG.models[modelKey as keyof typeof LLM_CONFIG.models];
  
  // Update the global LLM_CONFIG
  LLM_CONFIG.model = modelConfig.name;
  LLM_CONFIG.provider = modelConfig.provider;
  
  // Update the current model configuration
  currentModelConfig = {
    model: modelConfig.name,
    provider: modelConfig.provider
  };
  
  console.log(`Model updated to: ${currentModelConfig.model} (${currentModelConfig.provider})`);
} 