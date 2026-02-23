/**
 * ToolCard Component
 * 
 * Displays a single tool with its information and configuration status.
 * Includes enable/disable toggle and configuration options.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Tool } from '@/lib/types';
import { Settings, Play, ToggleLeft, ToggleRight } from 'lucide-react';

// Tool category definitions
export type ToolCategory = 'built-in' | 'custom' | 'mcp' | 'coming-soon';

export interface ToolCategoryInfo {
  label: string;
  color: string;
  bgColor: string;
  darkBgColor: string;
  icon?: React.ReactNode;
}

// Category metadata
const TOOL_CATEGORIES: Record<ToolCategory, ToolCategoryInfo> = {
  'built-in': {
    label: 'Built-in',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100',
    darkBgColor: 'dark:bg-purple-900/30',
  },
  'custom': {
    label: 'Custom',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-900/30',
  },
  'mcp': {
    label: 'MCP',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100',
    darkBgColor: 'dark:bg-orange-900/30',
  },
  'coming-soon': {
    label: 'Coming Soon',
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-100',
    darkBgColor: 'dark:bg-gray-700',
  },
};

// Known tool names for future tools (placeholder entries)
const FUTURE_TOOLS = ['code_execution', 'image_generation', 'video_generation'];

// Determine tool category
function getToolCategory(tool: Tool): ToolCategory {
  // Check for future/placeholder tools
  if (FUTURE_TOOLS.includes(tool.name) || !tool.is_active) {
    // If it's a future tool, mark as coming soon
    if (FUTURE_TOOLS.includes(tool.name)) {
      return 'coming-soon';
    }
  }
  
  if (tool.is_builtin) {
    return 'built-in';
  }
  
  // Check if it's an MCP tool (has mcp in entrypoint or name)
  if (tool.entrypoint?.includes('mcp') || tool.name?.toLowerCase().includes('mcp')) {
    return 'mcp';
  }
  
  return 'custom';
}

// Get tool icon based on name
function getToolIcon(toolName: string): React.ReactNode {
  const iconClass = "w-5 h-5";
  
  switch (toolName) {
    case 'web_search':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'document_search':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'get_weather':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      );
    case 'data_document':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      );
    case 'code_execution':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case 'image_generation':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'video_generation':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
}

interface ToolCardProps {
  tool: Tool;
  onConfigure?: (tool: Tool) => void; // Deprecated - use link to configure tab instead
  onToggleEnabled?: (tool: Tool, enabled: boolean) => Promise<void>;
  className?: string;
}

export function ToolCard({ tool, onConfigure, onToggleEnabled, className = '' }: ToolCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(tool.is_active);
  
  const category = getToolCategory(tool);
  const categoryInfo = TOOL_CATEGORIES[category];
  const isComingSoon = category === 'coming-soon';
  
  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleEnabled || isToggling) return;
    
    const newEnabled = !localEnabled;
    setLocalEnabled(newEnabled);
    setIsToggling(true);
    
    try {
      await onToggleEnabled(tool, newEnabled);
    } catch (error) {
      // Revert on error
      setLocalEnabled(!newEnabled);
      console.error('Failed to toggle tool:', error);
    } finally {
      setIsToggling(false);
    }
  };
  
  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow ${isComingSoon ? 'opacity-60' : ''} ${!localEnabled && !isComingSoon ? 'opacity-75' : ''} ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${categoryInfo.bgColor} ${categoryInfo.darkBgColor} ${categoryInfo.color}`}>
            {getToolIcon(tool.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {tool.name}
            </h3>
            {tool.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {tool.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${categoryInfo.bgColor} ${categoryInfo.darkBgColor} ${categoryInfo.color}`}>
            {categoryInfo.label}
          </span>
          {/* Enable/Disable Toggle */}
          {!isComingSoon && onToggleEnabled && (
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                localEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
              title={localEnabled ? 'Click to disable' : 'Click to enable'}
            >
              {localEnabled ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              {localEnabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
          {!isComingSoon && !onToggleEnabled && (
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                tool.is_active
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {tool.is_active ? 'Active' : 'Inactive'}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Entrypoint:</span> <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">{tool.entrypoint}</code>
        </div>
        {tool.scopes && tool.scopes.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Scopes:</span>{' '}
            {tool.scopes.join(', ')}
          </div>
        )}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Version:</span> {tool.version}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        {isComingSoon ? (
          <span className="text-sm text-gray-400 dark:text-gray-500 italic">
            This tool will be available in a future update
          </span>
        ) : (
          <>
            <Link
              href={`/tools/${tool.id}?tab=configure`}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              Configure
            </Link>
            <Link
              href={`/tools/${tool.id}`}
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              View details →
            </Link>
            <Link
              href={`/tools/${tool.id}?tab=test`}
              className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" />
              Test
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// Export helper functions for use in other components
export { getToolCategory, getToolIcon, TOOL_CATEGORIES, FUTURE_TOOLS };
