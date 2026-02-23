'use client';

import { useState, useEffect } from 'react';
import { listWorkflows, deleteWorkflow } from '../../lib/admin-client';
import { formatDate } from '@jazzmind/busibox-app/lib/date-utils';

interface WorkflowStep {
  id: string;
  description: string;
  inputSchema?: string;
  outputSchema?: string;
  isWorkflow?: boolean;
}

interface StepGraphItem {
  type: string;
  step: {
    id: string;
    description: string;
  };
}

interface Workflow {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  steps: Record<string, WorkflowStep>;
  allSteps?: Record<string, WorkflowStep>;
  stepGraph?: StepGraphItem[];
  inputSchema?: string;
  outputSchema?: string;
  scopes: string[];
  created_at: string;
  updated_at?: string;
}

export default function WorkflowManagement() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  // Check for component parameter in URL to auto-select workflow
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const componentId = urlParams.get('component');
    if (componentId && workflows.length > 0) {
      const workflow = workflows.find(w => w.id === componentId || w.name === componentId);
      if (workflow) {
        setSelectedWorkflow(workflow);
        // Clear the URL parameter
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [workflows]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await listWorkflows();
      console.log('Workflows data received:', data);
      // The data is coming back as an object with workflow properties, not an array
      if (data && typeof data === 'object') {
        const workflowsList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          name: key,
          display_name: value.name || key,
          description: value.description || 'No description available',
          steps: value.steps || {},
          allSteps: value.allSteps || {},
          stepGraph: value.stepGraph || [],
          inputSchema: value.inputSchema,
          outputSchema: value.outputSchema,
          scopes: [], // This would need to come from somewhere else
          created_at: new Date().toISOString(), // Default to now
          updated_at: new Date().toISOString()
        }));
        setWorkflows(workflowsList);
      } else {
        setWorkflows([]);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      await deleteWorkflow(workflowId);
      await loadWorkflows(); // Reload the list
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  const handleSaveWorkflow = async () => {
    if (!selectedWorkflow) return;
    
    try {
      // Note: updateWorkflow function doesn't exist yet in admin-client
      // This would need to be implemented when workflow editing is fully supported
      console.log('Save workflow:', selectedWorkflow);
      setIsEditing(false);
      // await loadWorkflows(); // Reload the list when update function is available
    } catch (err) {
      console.error('Failed to update workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to update workflow');
    }
  };

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => (
    <div
      onClick={() => setSelectedWorkflow(workflow)}
      className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200/50 group hover:scale-[1.02]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {workflow.display_name || workflow.name}
            </h3>
            <p className="text-sm text-gray-500">{workflow.name}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteWorkflow(workflow.id);
          }}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      
      {workflow.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{workflow.description}</p>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>{Object.keys(workflow.steps || {}).length} steps</span>
        <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Workflow
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        <span>Created {formatDate(workflow.created_at)}</span>
      </div>
    </div>
  );

  const FlowEditor = ({ workflow }: { workflow: Workflow }) => {
    return (
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">Workflow Steps</h4>
        
        {/* Step Graph Visualization */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex flex-col space-y-4">
            {workflow.stepGraph && workflow.stepGraph.length > 0 ? (
              workflow.stepGraph.map((item, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <h5 className="font-medium text-gray-900">{item.step.id}</h5>
                    <p className="text-sm text-gray-600 mt-1">{item.step.description}</p>
                  </div>
                      {index < (workflow.stepGraph?.length || 0) - 1 && (
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p>No workflow steps defined</p>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Steps */}
        {Object.keys(workflow.steps || {}).length > 0 && (
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-700">Step Details</h5>
            {Object.entries(workflow.steps || {}).map(([stepId, step]) => (
              <div key={stepId} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-medium text-gray-900">{step.id}</h6>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {step.isWorkflow ? 'Workflow' : 'Step'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                
                {(step.inputSchema || step.outputSchema) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                    {step.inputSchema && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Input Schema</label>
                        <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-700 max-h-24 overflow-y-auto">
                          {typeof step.inputSchema === 'string' ? step.inputSchema : JSON.stringify(step.inputSchema, null, 2)}
                        </div>
                      </div>
                    )}
                    {step.outputSchema && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Output Schema</label>
                        <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-700 max-h-24 overflow-y-auto">
                          {typeof step.outputSchema === 'string' ? step.outputSchema : JSON.stringify(step.outputSchema, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const WorkflowEditor = () => {
    if (!selectedWorkflow) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedWorkflow(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedWorkflow.display_name || selectedWorkflow.name}
                </h2>
                <p className="text-sm text-gray-500">Workflow Configuration</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={isEditing ? handleSaveWorkflow : () => setIsEditing(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isEditing 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isEditing ? 'Save Changes' : 'Edit Workflow'}
              </button>
              <button 
                onClick={() => handleDeleteWorkflow(selectedWorkflow.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50">
            <h3 className="text-lg font-semibold text-gray-900">Workflow Configuration</h3>
          </div>
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Workflow Name</label>
                <input
                  type="text"
                  value={selectedWorkflow.name}
                  onChange={(e) => setSelectedWorkflow(prev => prev ? { ...prev, name: e.target.value } : null)}
                  disabled={!isEditing}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={selectedWorkflow.display_name || ''}
                  onChange={(e) => setSelectedWorkflow(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                  disabled={!isEditing}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={selectedWorkflow.description || ''}
                onChange={(e) => setSelectedWorkflow(prev => prev ? { ...prev, description: e.target.value } : null)}
                disabled={!isEditing}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Brief description of what this workflow does..."
              />
            </div>

            {/* Schema Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Input Schema</label>
                <textarea
                  value={typeof selectedWorkflow.inputSchema === 'string' ? selectedWorkflow.inputSchema || '' : JSON.stringify(selectedWorkflow.inputSchema || {}, null, 2)}
                  onChange={(e) => setSelectedWorkflow(prev => prev ? { ...prev, inputSchema: e.target.value } : null)}
                  disabled={!isEditing}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500 font-mono text-sm"
                  placeholder="JSON schema for workflow input..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Output Schema</label>
                <textarea
                  value={typeof selectedWorkflow.outputSchema === 'string' ? selectedWorkflow.outputSchema || '' : JSON.stringify(selectedWorkflow.outputSchema || {}, null, 2)}
                  onChange={(e) => setSelectedWorkflow(prev => prev ? { ...prev, outputSchema: e.target.value } : null)}
                  disabled={!isEditing}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500 font-mono text-sm"
                  placeholder="JSON schema for workflow output..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Flow Editor */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50">
            <h3 className="text-lg font-semibold text-gray-900">Workflow Design</h3>
          </div>
          <div className="p-6">
            <FlowEditor workflow={selectedWorkflow} />
          </div>
        </div>

        {/* Scopes */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50">
            <h3 className="text-lg font-semibold text-gray-900">Permissions</h3>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Permission Scopes</label>
            <div className="min-h-[2.5rem] p-3 border border-gray-200 rounded-lg bg-gray-50">
              {selectedWorkflow.scopes && selectedWorkflow.scopes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedWorkflow.scopes.map((scope, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.5-4.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      {scope}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500 text-sm">No scopes assigned</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (selectedWorkflow) {
    return <WorkflowEditor />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600">Manage your workflow automations and integrations</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button 
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors text-sm"
            onClick={loadWorkflows}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-600">Manage your workflow automations and integrations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create Workflow</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{workflows.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{workflows.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Steps</p>
              <p className="text-2xl font-bold text-gray-900">{workflows.reduce((sum, workflow) => sum + Object.keys(workflow.steps || {}).length, 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.5-4.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Complex</p>
              <p className="text-2xl font-bold text-gray-900">{workflows.filter(w => Object.keys(w.steps || {}).length > 2).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflows Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/80 rounded-xl p-6 shadow-lg animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first workflow</p>
          <button 
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
}