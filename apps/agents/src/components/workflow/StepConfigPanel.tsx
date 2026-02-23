'use client';

/**
 * Side panel for configuring workflow step details
 */

import React, { useState, useEffect } from 'react';
import type { StepNodeData } from './StepNode';

interface StepConfigPanelProps {
  step: StepNodeData | null;
  onUpdate: (step: StepNodeData) => void;
  onClose: () => void;
  agents?: { id: string; name: string; display_name?: string }[];
  tools?: { id: string; name: string; description?: string }[];
}

const OPERATORS = [
  { value: 'eq', label: 'Equals (==)' },
  { value: 'ne', label: 'Not Equals (!=)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'gte', label: 'Greater or Equal (>=)' },
  { value: 'lte', label: 'Less or Equal (<=)' },
  { value: 'contains', label: 'Contains' },
  { value: 'exists', label: 'Exists (not null)' },
];

const DEFAULT_TOOLS = [
  { id: 'search', name: 'Web Search', description: 'Search the internet' },
  { id: 'rag', name: 'Document Search', description: 'Search documents in RAG' },
  { id: 'data', name: 'Document Ingestion', description: 'Process and ingest documents' },
];

export default function StepConfigPanel({
  step,
  onUpdate,
  onClose,
  agents = [],
  tools = DEFAULT_TOOLS,
}: StepConfigPanelProps) {
  const [localStep, setLocalStep] = useState<StepNodeData | null>(step);

  useEffect(() => {
    setLocalStep(step);
  }, [step]);

  if (!localStep) return null;

  const handleChange = (field: string, value: any) => {
    const updated = { ...localStep, [field]: value };
    setLocalStep(updated);
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    const parentObj = (localStep as any)[parent] || {};
    const updated = { ...localStep, [parent]: { ...parentObj, [field]: value } };
    setLocalStep(updated);
  };

  const handleSave = () => {
    if (localStep) {
      onUpdate(localStep);
      onClose();
    }
  };

  const renderAgentConfig = () => {
    // Get current agent value (can be name or id)
    const currentAgent = (localStep as any).agent || localStep.agent_id || '';
    
    // Find matching agent by id OR name (for built-in workflows that use names)
    const matchedAgent = agents.find(a => 
      a.id === currentAgent || a.name === currentAgent
    );
    
    return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Agent *
        </label>
        <select
          value={matchedAgent?.name || currentAgent}
          onChange={(e) => {
            // Set both 'agent' (for backend) and 'agent_id' (for backwards compat)
            // Use agent name for built-in workflows compatibility
            handleChange('agent', e.target.value);
            handleChange('agent_id', e.target.value);
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select an agent...</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.name}>
              {agent.display_name || agent.name}
            </option>
          ))}
        </select>
        {currentAgent && !matchedAgent && agents.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Current agent "{currentAgent}" not found in available agents
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          * Required field
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Prompt Template
        </label>
        <textarea
          value={localStep.agent_prompt || ''}
          onChange={(e) => handleChange('agent_prompt', e.target.value)}
          placeholder="Use $.step_id.field to reference previous step outputs"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Example: Analyze this data: $.previous_step.result
        </p>
      </div>
    </div>
  );
  };

  const renderToolConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tool
        </label>
        <select
          value={localStep.tool || ''}
          onChange={(e) => handleChange('tool', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select a tool...</option>
          {tools.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name} - {tool.description}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tool Arguments (JSON)
        </label>
        <textarea
          value={JSON.stringify(localStep.tool_args || {}, null, 2)}
          onChange={(e) => {
            try {
              handleChange('tool_args', JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, don't update
            }
          }}
          placeholder='{"query": "$.input.search_term"}'
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
        />
      </div>
    </div>
  );

  const renderConditionConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Field (JSONPath)
        </label>
        <input
          type="text"
          value={localStep.condition?.field || ''}
          onChange={(e) => handleNestedChange('condition', 'field', e.target.value)}
          placeholder="$.previous_step.success"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Operator
        </label>
        <select
          value={localStep.condition?.operator || 'eq'}
          onChange={(e) => handleNestedChange('condition', 'operator', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Value
        </label>
        <input
          type="text"
          value={localStep.condition?.value || ''}
          onChange={(e) => handleNestedChange('condition', 'value', e.target.value)}
          placeholder="true"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ✓ Then Step
          </label>
          <input
            type="text"
            value={localStep.condition?.then_step || ''}
            onChange={(e) => handleNestedChange('condition', 'then_step', e.target.value)}
            placeholder="next_step_id"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ✗ Else Step
          </label>
          <input
            type="text"
            value={localStep.condition?.else_step || ''}
            onChange={(e) => handleNestedChange('condition', 'else_step', e.target.value)}
            placeholder="alternate_step_id"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
    </div>
  );

  const renderHumanConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notification Message
        </label>
        <textarea
          value={localStep.human_config?.notification || ''}
          onChange={(e) => handleNestedChange('human_config', 'notification', e.target.value)}
          placeholder="Please review and approve this action"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Approval Options (one per line: id|label)
        </label>
        <textarea
          value={
            localStep.human_config?.options
              ?.map((o) => `${o.id}|${o.label}`)
              .join('\n') || ''
          }
          onChange={(e) => {
            const options = e.target.value
              .split('\n')
              .filter((line) => line.includes('|'))
              .map((line) => {
                const [id, label] = line.split('|');
                return { id: id.trim(), label: label.trim() };
              });
            handleNestedChange('human_config', 'options', options);
          }}
          placeholder="approve|Approve&#10;reject|Reject&#10;escalate|Escalate"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
        />
      </div>
    </div>
  );

  const renderLoopConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Items Path (JSONPath to array)
        </label>
        <input
          type="text"
          value={localStep.loop_config?.items_path || ''}
          onChange={(e) => handleNestedChange('loop_config', 'items_path', e.target.value)}
          placeholder="$.previous_step.items"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Item Variable Name
        </label>
        <input
          type="text"
          value={localStep.loop_config?.item_variable || 'item'}
          onChange={(e) => handleNestedChange('loop_config', 'item_variable', e.target.value)}
          placeholder="item"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Reference current item in loop as $.{localStep.loop_config?.item_variable || 'item'}
        </p>
      </div>
    </div>
  );

  const renderGuardrails = () => (
    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
        🛡️ Guardrails (Optional)
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Request Limit
          </label>
          <input
            type="number"
            value={localStep.guardrails?.request_limit || ''}
            onChange={(e) =>
              handleNestedChange('guardrails', 'request_limit', e.target.value ? parseInt(e.target.value) : undefined)
            }
            placeholder="e.g., 5"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Token Limit
          </label>
          <input
            type="number"
            value={localStep.guardrails?.total_tokens_limit || ''}
            onChange={(e) =>
              handleNestedChange('guardrails', 'total_tokens_limit', e.target.value ? parseInt(e.target.value) : undefined)
            }
            placeholder="e.g., 5000"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Timeout (seconds)
        </label>
        <input
          type="number"
          value={localStep.guardrails?.timeout_seconds || ''}
          onChange={(e) =>
            handleNestedChange('guardrails', 'timeout_seconds', e.target.value ? parseInt(e.target.value) : undefined)
          }
          placeholder="e.g., 60"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );

  const typeConfigs: Record<string, () => React.ReactNode> = {
    agent: renderAgentConfig,
    tool: renderToolConfig,
    condition: renderConditionConfig,
    human: renderHumanConfig,
    loop: renderLoopConfig,
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Configure Step
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Step ID
            </label>
            <input
              type="text"
              value={localStep.id}
              onChange={(e) => handleChange('id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={localStep.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Optional display name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Type-specific config */}
        {typeConfigs[localStep.type]?.()}

        {/* Guardrails for agent/tool steps */}
        {(localStep.type === 'agent' || localStep.type === 'tool') && renderGuardrails()}

        {/* Next Step (for non-condition types) */}
        {localStep.type !== 'condition' && localStep.type !== 'end' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Next Step ID
            </label>
            <input
              type="text"
              value={localStep.next_step || ''}
              onChange={(e) => handleChange('next_step', e.target.value)}
              placeholder="Leave empty to auto-connect"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
