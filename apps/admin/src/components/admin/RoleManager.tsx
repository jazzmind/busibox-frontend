/**
 * RoleManager Component
 * 
 * Allows admins to add and remove roles from users.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@jazzmind/busibox-app';

type Role = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
};

type UserRole = {
  id: string;
  name: string;
  assignedAt: string | Date;
};

type RoleManagerProps = {
  userId: string;
  userRoles: UserRole[];
  onRoleChanged?: () => void;
};

export function RoleManager({ userId, userRoles, onRoleChanged }: RoleManagerProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (showAddModal) {
      fetchAvailableRoles();
    }
  }, [showAddModal]);

  const fetchAvailableRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      
      if (data.success) {
        // Filter out roles the user already has and app-scoped roles
        const userRoleIds = userRoles.map(r => r.id);
        const available = data.data.roles.filter(
          (role: Role) => !userRoleIds.includes(role.id) && !role.name.startsWith('app:')
        );
        setAvailableRoles(available);
      } else {
        setError(data.error || 'Failed to load roles');
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError('An unexpected error occurred');
    }
  };

  const handleAddRole = async (roleId: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });

      const data = await response.json();

      if (data.success) {
        setShowAddModal(false);
        if (onRoleChanged) {
          onRoleChanged();
        }
        router.refresh();
      } else {
        setError(data.error || 'Failed to add role');
      }
    } catch (err) {
      console.error('Failed to add role:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    setRemovingRoleId(roleId);
    setError('');

    try {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });

      const data = await response.json();

      if (data.success) {
        if (onRoleChanged) {
          onRoleChanged();
        }
        router.refresh();
      } else {
        setError(data.error || 'Failed to remove role');
      }
    } catch (err) {
      console.error('Failed to remove role:', err);
      setError('An unexpected error occurred');
    } finally {
      setRemovingRoleId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Roles</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          + Add Role
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Role List */}
      {userRoles.length > 0 ? (
        <ul className="space-y-2">
          {userRoles.map(role => (
            <li
              key={role.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <span className="font-medium text-gray-900">{role.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  Added {new Date(role.assignedAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRole(role.id)}
                loading={removingRoleId === role.id}
                disabled={removingRoleId === role.id}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg border border-gray-200">
          No roles assigned
        </p>
      )}

      {/* Add Role Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Role"
        size="md"
      >
        <div className="space-y-4">
          {availableRoles.length > 0 ? (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {availableRoles.map(role => (
                <li
                  key={role.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                      {role.description && (
                        <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                      )}
                      {role.isSystem && (
                        <span className="inline-block mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          System Role
                        </span>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddRole(role.id)}
                      loading={loading}
                      disabled={loading}
                    >
                      Add
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">
              No additional roles available
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

