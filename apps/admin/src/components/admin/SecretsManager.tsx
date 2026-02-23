/**
 * Secrets Manager Component
 * Manages environment secrets for app deployments
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@jazzmind/busibox-app';

interface SecretsManagerProps {
  configId: string;
}

interface Secret {
  id: string;
  key: string;
  type: 'ENV' | 'API_KEY' | 'DATABASE_URL' | 'OAUTH_SECRET';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function SecretsManager({ configId }: SecretsManagerProps) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  
  // Form state
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState<Secret['type']>('ENV');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSecrets();
  }, [configId]);

  async function loadSecrets() {
    setLoading(true);
    try {
      const res = await fetch(`/api/deployments/secrets?configId=${configId}`);
      if (res.ok) {
        const { secrets: secretsData } = await res.json();
        setSecrets(secretsData);
      }
    } catch (error) {
      console.error('Failed to load secrets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!key || !value) {
      setError('Key and value are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/deployments/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId,
          key,
          value,
          type,
          description,
        }),
      });

      if (res.ok) {
        await loadSecrets();
        resetForm();
        setShowAddForm(false);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to save secret');
      }
    } catch (error) {
      console.error('Failed to save secret:', error);
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(secretId: string) {
    if (!confirm('Are you sure you want to delete this secret?')) {
      return;
    }

    try {
      const res = await fetch(`/api/deployments/secrets/${secretId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadSecrets();
      } else {
        alert('Failed to delete secret');
      }
    } catch (error) {
      console.error('Failed to delete secret:', error);
      alert('An unexpected error occurred');
    }
  }

  function startEdit(secret: Secret) {
    setEditingSecret(secret);
    setKey(secret.key);
    setValue(''); // Don't show existing value for security
    setType(secret.type);
    setDescription(secret.description || '');
    setShowAddForm(true);
  }

  function resetForm() {
    setKey('');
    setValue('');
    setType('ENV');
    setDescription('');
    setEditingSecret(null);
    setError('');
  }

  function cancelForm() {
    resetForm();
    setShowAddForm(false);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600">Loading secrets...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Environment Secrets</h3>
        {!showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            variant="primary"
            size="sm"
          >
            + Add Secret
          </Button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="DATABASE_URL"
                required
                disabled={!!editingSecret}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Environment variable name (e.g., DATABASE_URL, API_KEY)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Secret['type'])}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ENV">Environment Variable</option>
                <option value="API_KEY">API Key</option>
                <option value="DATABASE_URL">Database URL</option>
                <option value="OAUTH_SECRET">OAuth Secret</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value <span className="text-red-500">*</span>
            </label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter secret value..."
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            {editingSecret && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Enter a new value to update this secret
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this secret"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingSecret ? 'Update Secret' : 'Add Secret'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {secrets.length === 0 ? (
        <p className="text-sm text-gray-600">
          No secrets configured. Add environment variables, API keys, and other secrets needed for deployment.
        </p>
      ) : (
        <div className="space-y-2">
          {secrets.map((secret) => (
            <div
              key={secret.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-gray-900">
                      {secret.key}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {secret.type}
                    </span>
                  </div>
                  {secret.description && (
                    <p className="text-sm text-gray-600 mt-1">{secret.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Updated: {new Date(secret.updatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => startEdit(secret)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(secret.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Secrets are encrypted and stored securely. They will be injected as environment variables during deployment.
        </p>
      </div>
    </div>
  );
}

