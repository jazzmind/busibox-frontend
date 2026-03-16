'use client';
/**
 * Agent Badge Component
 * 
 * Displays a small badge for a selected agent in the chat header.
 */


import { X } from 'lucide-react';

interface AgentBadgeProps {
  name: string;
  icon?: string;
  onRemove?: () => void;
  className?: string;
}

export function AgentBadge({ name, icon, onRemove, className = '' }: AgentBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium ${className}`}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
          title={`Remove ${name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

