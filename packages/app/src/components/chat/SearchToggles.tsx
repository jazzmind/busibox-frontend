'use client';
/**
 * Search Toggles Component
 * 
 * Toggle buttons for enabling/disabling web search and document search
 */


import { useState, useEffect } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

export interface SearchToggleState {
  webSearch: boolean;
  documentSearch: boolean;
}

interface SearchTogglesProps {
  webSearch: boolean;
  documentSearch: boolean;
  onToggle: (state: SearchToggleState) => void;
  disabled?: boolean;
  modelCapabilities?: {
    toolCalling: boolean;
  };
}

export function SearchToggles({
  webSearch,
  documentSearch,
  onToggle,
  disabled = false,
  modelCapabilities,
}: SearchTogglesProps) {
  const resolve = useCrossAppApiPath();
  const [webSearchAvailable, setWebSearchAvailable] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check if web search is available
  useEffect(() => {
    async function checkWebSearch() {
      try {
        const response = await fetch(resolve('chat', '/api/chat/search/config'));
        if (response.ok) {
          const data = await response.json();
          setWebSearchAvailable(data.webSearchAvailable);
        }
      } catch (error) {
        console.error('Failed to check web search availability:', error);
        setWebSearchAvailable(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkWebSearch();
  }, []);

  const handleWebToggle = () => {
    if (!disabled) {
      onToggle({
        webSearch: !webSearch,
        documentSearch,
      });
    }
  };

  const handleDocumentToggle = () => {
    if (!disabled) {
      onToggle({
        webSearch,
        documentSearch: !documentSearch,
      });
    }
  };

  // Web and document search are always available now (dual-model routing handles tool calling)
  const searchDisabled = disabled;

  return (
    <div className="flex gap-2 items-center">
      {webSearchAvailable && !isLoading && (
      <button
        type="button"
        onClick={handleWebToggle}
        disabled={searchDisabled}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
          webSearch
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        } ${searchDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={webSearch ? 'Disable web search' : 'Enable web search'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        Web
      </button>
      )}

      <button
        type="button"
        onClick={handleDocumentToggle}
        disabled={searchDisabled}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
          documentSearch
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        } ${searchDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={documentSearch ? 'Disable document search' : 'Enable document search'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Documents
      </button>
    </div>
  );
}

/**
 * Hook for managing search toggle state with persistence
 */
export function useSearchToggles(
  conversationId?: string
): [SearchToggleState, (state: SearchToggleState) => void] {
  // Default document search to ON for chat model with dual-model routing
  const resolve = useCrossAppApiPath();
  const [state, setState] = useState<SearchToggleState>({
    webSearch: false,
    documentSearch: true, // Default ON - dual-model routing enables tool calling for all models
  });
  const [webSearchAvailable, setWebSearchAvailable] = useState<boolean>(true);

  // Check if web search is available
  useEffect(() => {
    async function checkWebSearch() {
      try {
        const response = await fetch(resolve('chat', '/api/chat/search/config'));
        if (response.ok) {
          const data = await response.json();
          setWebSearchAvailable(data.webSearchAvailable);
          
          // If web search is not available and it's currently enabled, disable it
          if (!data.webSearchAvailable) {
            setState(prev => {
              if (prev.webSearch) {
                const newState = { ...prev, webSearch: false };
                localStorage.setItem('chat-search-toggles', JSON.stringify(newState));
                return newState;
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Failed to check web search availability:', error);
        setWebSearchAvailable(false);
      }
    }
    checkWebSearch();
  }, []);

  // Load persisted state from localStorage (global per user)
  // If not stored, keep the default (documentSearch: true)
  useEffect(() => {
    const stored = localStorage.getItem('chat-search-toggles');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(parsed);
      } catch (error) {
        console.error('Failed to parse stored search toggles:', error);
        // On parse error, set default with documentSearch: true
        setState({ webSearch: false, documentSearch: true });
      }
    }
    // If no stored state, we keep the initial state which has documentSearch: true
  }, []);

  // Persist state to localStorage
  const updateState = (newState: SearchToggleState) => {
    // Don't allow enabling web search if it's not available
    if (newState.webSearch && !webSearchAvailable) {
      return;
    }
    
    setState(newState);
    localStorage.setItem('chat-search-toggles', JSON.stringify(newState));
  };

  return [state, updateState];
}

