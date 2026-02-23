/**
 * Tool Selector Component
 * 
 * Allows selecting from available tools (web search, document search, etc.)
 * with a dropdown checkbox interface.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Wrench, Check } from 'lucide-react';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon?: string;
  enabled?: boolean;
}

interface ToolSelectorProps {
  selectedTools: string[];
  onToolsChange: (toolIds: string[]) => void;
  disabled?: boolean;
  availableTools?: Tool[];
}

const DEFAULT_TOOLS: Tool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the internet for current information',
    icon: '🌐',
    enabled: true,
  },
  {
    id: 'doc_search',
    name: 'Document Search',
    description: 'Search your document libraries',
    icon: '📄',
    enabled: true,
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Get current weather information',
    icon: '🌤️',
    enabled: true,
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform mathematical calculations',
    icon: '🔢',
    enabled: false,
  },
];

export function ToolSelector({
  selectedTools,
  onToolsChange,
  disabled = false,
  availableTools = DEFAULT_TOOLS,
}: ToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter((id) => id !== toolId));
    } else {
      onToolsChange([...selectedTools, toolId]);
    }
  };

  const enabledTools = availableTools.filter((t) => t.enabled !== false);
  const selectedCount = selectedTools.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : selectedCount > 0
            ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Select tools"
      >
        <Wrench className="w-4 h-4" />
        <span className="font-medium">
          Tools {selectedCount > 0 && `(${selectedCount})`}
        </span>
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
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
              Available Tools
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {enabledTools.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No tools available
              </div>
            ) : (
              <div className="p-1">
                {enabledTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleToggleTool(tool.id)}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {selectedTools.includes(tool.id) ? (
                        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {tool.icon && <span className="text-lg">{tool.icon}</span>}
                        <span className="font-medium text-gray-900">{tool.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCount > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={() => onToolsChange([])}
                className="w-full px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

