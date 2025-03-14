"use client";

import { useState } from 'react';
import axios from 'axios';

export default function ModelSelector() {
  const [selectedModel, setSelectedModel] = useState<string>('sonnet');
  const [isChanging, setIsChanging] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleModelChange = async (model: string) => {
    setIsChanging(true);
    setMessage('');
    setError('');
    
    try {
      const response = await axios.post('/api/set-model', { model });
      setSelectedModel(model);
      setMessage(`Model changed to ${model} (${response.data.model})`);
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
          <button
            onClick={() => handleModelChange('sonnet')}
            disabled={isChanging}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedModel === 'sonnet' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Claude 3 Sonnet
          </button>
          <button
            onClick={() => handleModelChange('haiku')}
            disabled={isChanging}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedModel === 'haiku' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Claude 3 Haiku
          </button>
          <button
            onClick={() => handleModelChange('opus')}
            disabled={isChanging}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedModel === 'opus' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Claude 3 Opus
          </button>
        </div>
      </div>
      
      <div className="mb-2">
        <h4 className="text-sm font-medium mb-2 text-left">DeepSeek Models:</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => handleModelChange('deepseek_coder')}
            disabled={isChanging}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedModel === 'deepseek_coder' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            DeepSeek Coder
          </button>
          <button
            onClick={() => handleModelChange('deepseek_lite')}
            disabled={isChanging}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedModel === 'deepseek_lite' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            DeepSeek Lite
          </button>
          <button
            onClick={() => handleModelChange('deepseek_v2')}
            disabled={isChanging}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedModel === 'deepseek_v2' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            DeepSeek V2
          </button>
        </div>
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
        <strong>Sonnet:</strong> Good balance of quality and speed<br />
        <strong>Haiku:</strong> Fastest, but less sophisticated<br />
        <strong>Opus:</strong> Highest quality, but slower and more expensive<br />
        <strong>DeepSeek Models:</strong><br />
        <strong>Coder:</strong> Specialized for code generation<br />
        <strong>Lite:</strong> Fast and efficient general-purpose model<br />
        <strong>V2:</strong> Latest DeepSeek model with improved capabilities
      </p>
    </div>
  );
} 