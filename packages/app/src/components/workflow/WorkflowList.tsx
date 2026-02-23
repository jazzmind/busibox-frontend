/**
 * WorkflowList Component
 * 
 * Displays a list of workflows with filtering, search, and actions.
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { Workflow, WorkflowExecution, TriggerType, ExecutionStatus } from '../../types/workflow';

export interface WorkflowListProps {
  workflows: Workflow[];
  executions?: Record<string, WorkflowExecution[]>;
  onView?: (workflow: Workflow) => void;
  onEdit?: (workflow: Workflow) => void;
  onExecute?: (workflow: Workflow) => void;
  onDelete?: (workflow: Workflow) => void;
  loading?: boolean;
  className?: string;
}

const getTriggerIcon = (triggerType: TriggerType): string => {
  switch (triggerType) {
    case 'manual': return '👆';
    case 'cron': return '⏰';
    case 'webhook': return '🔗';
    case 'event': return '📡';
    case 'agent_completion': return '🤖';
    default: return '❓';
  }
};

const getStatusColor = (active: boolean): string => {
  return active 
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

export const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  executions,
  onView,
  onEdit,
  onExecute,
  onDelete,
  loading = false,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | 'all'>('all');
  const [filterTrigger, setFilterTrigger] = useState<TriggerType | 'all'>('all');

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(workflow => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!workflow.name.toLowerCase().includes(search) && 
            !workflow.description?.toLowerCase().includes(search)) {
          return false;
        }
      }
      if (filterActive !== 'all' && workflow.active !== filterActive) return false;
      if (filterTrigger !== 'all' && workflow.trigger.type !== filterTrigger) return false;
      return true;
    });
  }, [workflows, searchTerm, filterActive, filterTrigger]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Search and Filters - simplified version above */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.map((workflow) => (
          <div key={workflow.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
            <h3 className="font-semibold text-lg mb-2">{workflow.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{workflow.description}</p>
            <div className="flex gap-2">
              {onView && <button onClick={() => onView(workflow)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">View</button>}
              {onExecute && workflow.active && <button onClick={() => onExecute(workflow)} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Execute</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowList;