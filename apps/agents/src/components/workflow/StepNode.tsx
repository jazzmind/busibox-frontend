'use client';

/**
 * Custom React Flow node for workflow steps
 * Supports: Agent, Tool, Condition, Human, Parallel, Loop nodes
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export interface StepNodeData {
  id: string;
  type: 'agent' | 'tool' | 'condition' | 'human' | 'parallel' | 'loop' | 'start' | 'end';
  name?: string;
  agent_id?: string;
  agent_prompt?: string;
  tool?: string;
  tool_args?: Record<string, any>;
  condition?: {
    field: string;
    operator: string;
    value: any;
    then_step?: string;
    else_step?: string;
  };
  human_config?: {
    notification: string;
    options?: { id: string; label: string }[];
  };
  parallel_steps?: any[];
  loop_config?: {
    items_path: string;
    item_variable: string;
  };
  guardrails?: {
    request_limit?: number;
    total_tokens_limit?: number;
    timeout_seconds?: number;
  };
  next_step?: string;
  onEdit?: (data: StepNodeData) => void;
  onDelete?: (id: string) => void;
  selected?: boolean;
}

const nodeStyles: Record<string, { bg: string; border: string; icon: string; accent: string }> = {
  start: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-500', icon: '▶️', accent: 'bg-emerald-500' },
  end: { bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-500', icon: '⏹️', accent: 'bg-rose-500' },
  agent: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-500', icon: '🤖', accent: 'bg-blue-500' },
  tool: { bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-500', icon: '🔧', accent: 'bg-orange-500' },
  condition: { bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-500', icon: '🔀', accent: 'bg-purple-500' },
  human: { bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-500', icon: '👤', accent: 'bg-green-500' },
  parallel: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', border: 'border-yellow-500', icon: '⚡', accent: 'bg-yellow-500' },
  loop: { bg: 'bg-pink-50 dark:bg-pink-900/30', border: 'border-pink-500', icon: '🔁', accent: 'bg-pink-500' },
};

const getNodeDescription = (data: StepNodeData): string => {
  switch (data.type) {
    case 'start':
      return 'Workflow starts here';
    case 'end':
      return 'Workflow ends here';
    case 'agent':
      return data.agent_id || data.name || 'Select an agent';
    case 'tool':
      return data.tool || 'Select a tool';
    case 'condition':
      if (data.condition) {
        return `${data.condition.field} ${data.condition.operator} ${data.condition.value}`;
      }
      return 'Configure condition';
    case 'human':
      return data.human_config?.notification || 'Awaits approval';
    case 'parallel':
      return `${data.parallel_steps?.length || 0} parallel tasks`;
    case 'loop':
      return data.loop_config?.items_path || 'Loop over items';
    default:
      return 'Unknown step';
  }
};

const StepNode: React.FC<NodeProps<StepNodeData>> = ({ data, selected }) => {
  const style = nodeStyles[data.type] || nodeStyles.agent;
  const isStartOrEnd = data.type === 'start' || data.type === 'end';

  return (
    <div
      className={`
        relative min-w-[200px] max-w-[280px] rounded-xl shadow-lg transition-all duration-200
        ${style.bg} ${style.border} border-2
        ${selected ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900 scale-105' : ''}
        hover:shadow-xl
      `}
    >
      {/* Top Handle (input) - not for start node */}
      {data.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !border-2 !border-white dark:!border-gray-800"
        />
      )}

      {/* Node Header */}
      <div className={`${style.accent} rounded-t-lg px-3 py-2 flex items-center gap-2`}>
        <span className="text-lg">{style.icon}</span>
        <span className="text-white font-semibold text-sm uppercase tracking-wide">
          {data.type}
        </span>
      </div>

      {/* Node Content */}
      <div className="p-3">
        {/* Node Name/ID */}
        <div className="font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
          {data.name || data.id || 'Unnamed Step'}
        </div>

        {/* Description */}
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {getNodeDescription(data)}
        </div>

        {/* Guardrails indicator */}
        {data.guardrails && (data.guardrails.request_limit || data.guardrails.total_tokens_limit) && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              🛡️ Guardrails
            </span>
          </div>
        )}

        {/* Condition branches indicator */}
        {data.type === 'condition' && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              ✓ {data.condition?.then_step || 'Then'}
            </span>
            <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
              ✗ {data.condition?.else_step || 'Else'}
            </span>
          </div>
        )}

        {/* Human options indicator */}
        {data.type === 'human' && data.human_config?.options && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.human_config.options.map((option, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
              >
                {option.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons - shown on hover */}
      {!isStartOrEnd && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {data.onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onEdit?.(data);
              }}
              className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center hover:bg-blue-600 shadow"
            >
              ✎
            </button>
          )}
          {data.onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.(data.id);
              }}
              className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 shadow"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Bottom Handle (output) - not for end node */}
      {data.type !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !border-2 !border-white dark:!border-gray-800"
        />
      )}

      {/* Condition has two output handles */}
      {data.type === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="then"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-gray-800"
            style={{ top: '60%' }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="else"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-800"
            style={{ top: '60%' }}
          />
        </>
      )}
    </div>
  );
};

export default memo(StepNode);
