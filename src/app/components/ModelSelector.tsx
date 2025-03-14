"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { LLM_CONFIG } from '@/config/llm';

export default function ModelSelector() {
  const [selectedModel, setSelectedModel] = useState<string>('sonnet');
  const [isChanging, setIsChanging] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
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
    setIsChanging(true);
    setMessage('');
    setError('');
    
    try {
      const response = await axios.post('/api/set-model', { model });
      setSelectedModel(model);
      setMessage(`Model changed to ${LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}`);
    } catch (error: any) {
      console.error('Error changing model:', error);
      setError(error.response?.data?.error || 'Failed to change model');
    } finally {
      setIsChanging(false);
    }
  };

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
        <h4 className="text-sm font-medium mb-2 text-left">DeepSeek Models (Currently Unavailable):</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {deepseekModels.map(model => (
            <button
              key={model}
              onClick={() => handleModelChange(model)}
              disabled={true}
              className="px-3 py-1 rounded-full text-sm bg-gray-300 text-gray-500 cursor-not-allowed"
              title="DeepSeek models are currently unavailable"
            >
              {LLM_CONFIG.models[model as keyof typeof LLM_CONFIG.models].displayName}
            </button>
          ))}
        </div>
        <p className="text-xs text-red-500 mt-1">
          Note: DeepSeek models are currently returning 404 errors and are disabled.
        </p>
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
        <strong>DeepSeek Models (Unavailable):</strong><br />
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