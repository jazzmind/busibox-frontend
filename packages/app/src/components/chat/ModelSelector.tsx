'use client';

import { useState, useEffect } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface ModelSelectorProps {
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled = false }: ModelSelectorProps) {
  const resolve = useCrossAppApiPath();
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await fetch(resolve('chat', '/api/chat/models'));
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      const availableModels = data.models || [];
      setModels(availableModels);
      
      // Set default model if none selected - default to 'chat'
      if (!selectedModel && availableModels.length > 0) {
        const chatModel = availableModels.find((m: any) => m.id === 'chat');
        onModelChange(chatModel?.id || availableModels[0].id);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      // Fallback models - prefer models with tool calling support first
      setModels([
        { id: 'chat', name: 'Chat', description: 'General chat and Q&A (supports image, audio and video analysis)' },
        { id: 'research', name: 'Research', description: 'Research and analysis (supports web and document search)' },
        { id: 'frontier', name: 'Frontier', description: 'Claude via AWS (supports tools)' },
      ]);
      // Set 'research' as default (supports tool calling)
      if (!selectedModel) {
        onModelChange('research');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedModelOption = models.find((m) => m.id === selectedModel) || models[0];

  if (loading) {
    return (
      <div className="px-3 py-1.5 text-sm border rounded-lg bg-gray-100 text-gray-400">
        Loading models...
      </div>
    );
  }

  if (models.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || !selectedModelOption}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
          disabled || !selectedModelOption
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
        title={selectedModelOption?.description}
      >
        <span className="font-medium">{selectedModelOption?.name || 'Select model'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  selectedModel === model.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

