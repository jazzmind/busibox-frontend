/**
 * RoleForm Component
 * 
 * Form for creating and editing roles with OAuth scope management.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@jazzmind/busibox-app';

/**
 * Available OAuth scopes organized by service.
 * These scopes control access to backend services.
 */
const AVAILABLE_SCOPES = {
  data: {
    label: 'Document Ingestion',
    description: 'Access to document upload and management',
    scopes: [
      { value: 'data.read', label: 'Read', description: 'View documents and libraries' },
      { value: 'data.write', label: 'Write', description: 'Upload and modify documents' },
      { value: 'data.delete', label: 'Delete', description: 'Delete documents' },
    ],
  },
  search: {
    label: 'Search',
    description: 'Access to search functionality',
    scopes: [
      { value: 'search.read', label: 'Read', description: 'Search documents and get results' },
    ],
  },
  agent: {
    label: 'AI Agents',
    description: 'Access to AI agent functionality',
    scopes: [
      { value: 'agent.execute', label: 'Execute', description: 'Run AI agents and chat' },
    ],
  },
  libraries: {
    label: 'Libraries',
    description: 'Access to library management',
    scopes: [
      { value: 'libraries.read', label: 'Read', description: 'View libraries' },
      { value: 'libraries.write', label: 'Write', description: 'Create and manage libraries' },
    ],
  },
  apps: {
    label: 'Applications',
    description: 'Access to application management',
    scopes: [
      { value: 'apps.read', label: 'Read', description: 'View applications' },
      { value: 'apps.write', label: 'Write', description: 'Manage applications' },
    ],
  },
  workflow: {
    label: 'Workflows',
    description: 'Access to workflow automation',
    scopes: [
      { value: 'workflow.read', label: 'Read', description: 'View workflows' },
      { value: 'workflow.write', label: 'Write', description: 'Create and manage workflows' },
      { value: 'workflow.execute', label: 'Execute', description: 'Run workflows' },
    ],
  },
};

type RoleFormProps = {
  role?: {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    scopes?: string[];
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function RoleForm({ role, onSuccess, onCancel }: RoleFormProps) {
  const router = useRouter();
  const isEditMode = !!role;

  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(role?.scopes || []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScopeEditor, setShowScopeEditor] = useState(false);

  // Sync scopes when role prop changes
  useEffect(() => {
    if (role?.scopes) {
      setSelectedScopes(new Set(role.scopes));
    }
  }, [role?.scopes]);

  const toggleScope = (scope: string) => {
    const newScopes = new Set(selectedScopes);
    if (newScopes.has(scope)) {
      newScopes.delete(scope);
    } else {
      newScopes.add(scope);
    }
    setSelectedScopes(newScopes);
  };

  const selectAllInCategory = (category: keyof typeof AVAILABLE_SCOPES) => {
    const newScopes = new Set(selectedScopes);
    AVAILABLE_SCOPES[category].scopes.forEach(s => newScopes.add(s.value));
    setSelectedScopes(newScopes);
  };

  const deselectAllInCategory = (category: keyof typeof AVAILABLE_SCOPES) => {
    const newScopes = new Set(selectedScopes);
    AVAILABLE_SCOPES[category].scopes.forEach(s => newScopes.delete(s.value));
    setSelectedScopes(newScopes);
  };

  const getCategoryScopeCount = (category: keyof typeof AVAILABLE_SCOPES) => {
    return AVAILABLE_SCOPES[category].scopes.filter(s => selectedScopes.has(s.value)).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEditMode 
        ? `/api/roles/${role.id}`
        : '/api/roles';
      
      const method = isEditMode ? 'PATCH' : 'POST';
      
      const body = {
        name,
        description: description || null,
        scopes: Array.from(selectedScopes),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/roles');
          router.refresh();
        }
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isSystemRole = role?.isSystem || false;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {isSystemRole && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            System roles cannot be modified. They are managed by the system.
          </p>
        </div>
      )}

      {/* Name */}
      <Input
        label="Role Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Video Editors, Finance Team"
        required
        autoFocus={!isEditMode}
        disabled={isSystemRole}
        helperText="3-50 characters. Must be unique."
      />

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description (Optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this role is for..."
          disabled={isSystemRole}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-100"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Help users understand what permissions this role grants
        </p>
      </div>

      {/* OAuth Scopes */}
      {!isSystemRole && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              OAuth Scopes ({selectedScopes.size} selected)
            </label>
            <button
              type="button"
              onClick={() => setShowScopeEditor(!showScopeEditor)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showScopeEditor ? 'Hide Scope Editor' : 'Edit Scopes'}
            </button>
          </div>

          {/* Selected scopes summary */}
          {selectedScopes.size > 0 && !showScopeEditor && (
            <div className="flex flex-wrap gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
              {Array.from(selectedScopes).sort().map(scope => (
                <span
                  key={scope}
                  className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                >
                  {scope}
                </span>
              ))}
            </div>
          )}

          {selectedScopes.size === 0 && !showScopeEditor && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No scopes selected. Users with this role will have limited access.
            </p>
          )}

          {/* Scope Editor */}
          {showScopeEditor && (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              {Object.entries(AVAILABLE_SCOPES).map(([categoryKey, category]) => {
                const catKey = categoryKey as keyof typeof AVAILABLE_SCOPES;
                const selectedCount = getCategoryScopeCount(catKey);
                const totalCount = category.scopes.length;
                const allSelected = selectedCount === totalCount;

                return (
                  <div key={categoryKey} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                    {/* Category Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{category.label}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{category.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedCount}/{totalCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => allSelected ? deselectAllInCategory(catKey) : selectAllInCategory(catKey)}
                          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>

                    {/* Scope Checkboxes */}
                    <div className="px-4 py-2 space-y-2">
                      {category.scopes.map(scope => (
                        <label
                          key={scope.value}
                          className="flex items-start gap-3 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -mx-2"
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.has(scope.value)}
                            onChange={() => toggleScope(scope.value)}
                            className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {scope.label}
                              </span>
                              <code className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                {scope.value}
                              </code>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{scope.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            OAuth scopes control what backend services users with this role can access. 
            These are enforced when users make API requests.
          </p>
        </div>
      )}

      {/* System role scope display (read-only) */}
      {isSystemRole && role?.scopes && role.scopes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            OAuth Scopes (Read Only)
          </label>
          <div className="flex flex-wrap gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
            {role.scopes.map(scope => (
              <span
                key={scope}
                className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!isSystemRole && (
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
          
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading || !name || name.length < 3 || name.length > 50}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Role' : 'Create Role')}
          </Button>
        </div>
      )}
    </form>
  );
}

