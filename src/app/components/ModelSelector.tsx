"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { LLM_CONFIG } from '@/config/llm';

export default function ModelSelector() {
  // If in production mode, use the production default model
  const initialModel = LLM_CONFIG.production.isProduction 
    ? LLM_CONFIG.production.defaultModel 
    : 'deepseek_chat';
    
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);
  const [isChanging, setIsChanging] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [apiTestError, setApiTestError] = useState<string | null>(null);
  const [anthropicModels, setAnthropicModels] = useState<string[]>([]);
  const [deepseekModels, setDeepseekModels] = useState<string[]>([]);

  useEffect(() => {
    // Group models by category
    const anthropic: string[] = [];
    const deepseek: string[] = [];
    
    Object.entries(LLM_CONFIG.models).forEach(([key, config]) => {
      if (config.category === 'anthropic') {
        anthropic.push(key);
      } else if (config.category === 'deepseek') {
        deepseek.push(key);
      }
    });
    
    setAnthropicModels(anthropic);
    setDeepseekModels(deepseek);
  }, []);

  const handleModelChange = async (model: string) => {
    // In production mode, don't allow changing the model
    if (LLM_CONFIG.production.isProduction) {
      console.warn('Model selection is disabled in production mode');
      return;
    }
    
    setIsChanging(true);
    setMessage('');
    setError('');
    setApiTestError(null);
    
    try {
      const response = await axios.post('/api/set-model', { model });
      setSelectedModel(model);
      setMessage(`Model changed to ${LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}`);
      
      // Check if there was an API test error
      if (response.data.testError) {
        const errorDetails = response.data.testError;
        setApiTestError(`API Test Error: ${errorDetails.message}`);
        console.error('API Test Error Details:', errorDetails);
      }
    } catch (error: any) {
      console.error('Error changing model:', error);
      setError(error.response?.data?.error || 'Failed to change model');
    } finally {
      setIsChanging(false);
    }
  };

  // If in production mode, don't render the model selector UI
  if (LLM_CONFIG.production.isProduction) {
    return null;
  }

  return (
    <div className="mb-4 max-w-md mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="font-bold mb-3 text-left">LLM Model:</h3>
      
      <div className="mb-3">
        <h4 className="text-sm font-medium mb-2 text-left">Anthropic Models:</h4>
        <div className="flex flex-wrap gap-2 justify-center mb-2">
          {anthropicModels.map(model => (
            <button
              key={model}
              onClick={() => handleModelChange(model)}
              disabled={isChanging}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedModel === model 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mb-2">
        <h4 className="text-sm font-medium mb-2 text-left">DeepSeek Models:</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {deepseekModels.map(model => (
            <button
              key={model}
              onClick={() => handleModelChange(model)}
              disabled={isChanging}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedModel === model 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}
            </button>
          ))}
        </div>
        
        {apiTestError && (
          <p className="text-xs text-orange-500 mt-1">
            Note: {apiTestError}. The model is selected but API requests may fail.
          </p>
        )}
      </div>
      
      {isChanging && (
        <p className="text-sm text-gray-500 text-center">Changing model...</p>
      )}
      
      {message && (
        <p className="text-sm text-green-600 text-center mt-1">{message}</p>
      )}
      
      {error && (
        <p className="text-sm text-red-600 text-center mt-1">{error}</p>
      )}
      
      <p className="text-xs text-gray-500 mt-2">
        <strong>Claude Models:</strong><br />
        {anthropicModels.map(model => {
          const config = LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models];
          return (
            <span key={model}>
              <strong>{config.displayName}:</strong> {config.description}<br />
            </span>
          );
        })}
        <strong>DeepSeek Models:</strong><br />
        {deepseekModels.map(model => {
          const config = LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models];
          return (
            <span key={model}>
              <strong>{config.displayName}:</strong> {config.description}<br />
            </span>
          );
        })}
      </p>
    </div>
  );
} 