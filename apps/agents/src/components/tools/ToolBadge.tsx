/**
 * ToolBadge Component
 * 
 * A compact, clickable badge that displays a tool name with icon and links to the tool page.
 * Used in agent detail pages to show which tools an agent uses.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { getToolIcon, getToolCategory, TOOL_CATEGORIES, ToolCategory } from './ToolCard';

interface ToolBadgeProps {
  /** Tool name to display */
  toolName: string;
  /** Optional tool ID for linking - if not provided, searches by name */
  toolId?: string;
  /** Optional description for tooltip */
  description?: string;
  /** Whether this is a built-in tool */
  isBuiltin?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether the badge is interactive (clickable) */
  interactive?: boolean;
  /** Optional click handler - if provided, won't navigate */
  onClick?: () => void;
  /** Optional className override */
  className?: string;
}

export function ToolBadge({
  toolName,
  toolId,
  description,
  isBuiltin = false,
  size = 'md',
  interactive = true,
  onClick,
  className = '',
}: ToolBadgeProps) {
  // Determine category for styling
  const category: ToolCategory = isBuiltin ? 'built-in' : 'custom';
  const categoryInfo = TOOL_CATEGORIES[category];
  
  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
  };
  
  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  const content = (
    <>
      <span className={iconSizeClasses[size]}>
        {getToolIcon(toolName)}
      </span>
      <span className="font-medium truncate max-w-[150px]">{toolName}</span>
    </>
  );

  const baseClasses = `
    inline-flex items-center rounded-full
    ${sizeClasses[size]}
    ${categoryInfo.bgColor} ${categoryInfo.darkBgColor} ${categoryInfo.color}
    ${interactive ? 'hover:opacity-80 cursor-pointer transition-opacity' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // If there's a click handler, use a button
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={baseClasses}
        title={description || `${toolName} tool`}
        type="button"
      >
        {content}
      </button>
    );
  }

  // If not interactive, just render a span
  if (!interactive) {
    return (
      <span className={baseClasses} title={description || `${toolName} tool`}>
        {content}
      </span>
    );
  }

  // Default: Link to tool page
  const href = toolId 
    ? `/tools/${toolId}` 
    : `/tools?search=${encodeURIComponent(toolName)}`;

  return (
    <Link
      href={href}
      className={baseClasses}
      title={description || `View ${toolName} tool`}
    >
      {content}
    </Link>
  );
}

/**
 * ToolBadgeList Component
 * 
 * Renders a list of tool badges with consistent spacing
 */
interface ToolBadgeListProps {
  tools: Array<{
    name: string;
    id?: string;
    description?: string;
    is_builtin?: boolean;
  }>;
  size?: 'sm' | 'md';
  interactive?: boolean;
  maxVisible?: number;
  onToolClick?: (toolName: string) => void;
  className?: string;
}

export function ToolBadgeList({
  tools,
  size = 'md',
  interactive = true,
  maxVisible,
  onToolClick,
  className = '',
}: ToolBadgeListProps) {
  if (!tools || tools.length === 0) {
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400 italic">
        No tools configured
      </span>
    );
  }

  const visibleTools = maxVisible ? tools.slice(0, maxVisible) : tools;
  const hiddenCount = maxVisible ? Math.max(0, tools.length - maxVisible) : 0;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {visibleTools.map((tool) => (
        <ToolBadge
          key={tool.id || tool.name}
          toolName={tool.name}
          toolId={tool.id}
          description={tool.description}
          isBuiltin={tool.is_builtin}
          size={size}
          interactive={interactive}
          onClick={onToolClick ? () => onToolClick(tool.name) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <span className={`
          inline-flex items-center rounded-full
          ${size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'}
          bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400
        `}>
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
