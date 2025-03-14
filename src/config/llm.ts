// LLM Configuration
export const LLM_CONFIG = {
  // The model to use for all requests
  model: "claude-3-sonnet-20240229",
  
  // Alternative models that can be used
  models: {
    sonnet: "claude-3-sonnet-20240229",
    haiku: "claude-3-haiku-20240307",
    opus: "claude-3-opus-20240229"
  },
  
  // Default temperature settings for different types of requests
  temperature: {
    creative: 0.9,  // For topic generation and AI responses
    factual: 0.7,   // For definitions
    evaluation: 0.2  // For evaluations
  }
};

// Function to update the model
export function updateModel(modelKey: 'sonnet' | 'haiku' | 'opus') {
  LLM_CONFIG.model = LLM_CONFIG.models[modelKey];
  return LLM_CONFIG.model;
} 