/**
 * UserForm Component
 * 
 * Form for creating and editing users.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@jazzmind/busibox-app';
import type { UserStatus } from '@/types';

type UserFormProps = {
  user?: {
    id: string;
    email: string;
    status: UserStatus;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    roles: { id: string; name: string }[];
  };
  availableRoles?: { id: string; name: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function UserForm({ user, availableRoles = [], onSuccess, onCancel }: UserFormProps) {
  const router = useRouter();
  const isEditMode = !!user;

  const [email, setEmail] = useState(user?.email || '');
  const [status, setStatus] = useState<UserStatus>(user?.status || 'PENDING');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    user?.roles.map(r => r.id) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEditMode 
        ? `/api/users/${user.id}`
        : '/api/users';
      
      const method = isEditMode ? 'PATCH' : 'POST';
      
      const body = isEditMode
        ? {
            status,
            display_name: displayName || undefined,
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            avatar_url: avatarUrl || undefined,
          }
        : { email, roleIds: selectedRoles };

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
          router.push('/users');
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

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Email (only for create) */}
      {!isEditMode && (
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@email.com"
          required
          autoFocus
          helperText="User will receive a magic link to activate their account"
        />
      )}

      {/* Email (read-only for edit) */}
      {isEditMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
            {user.email}
          </div>
        </div>
      )}

      {/* Profile Fields (only for edit) */}
      {isEditMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
          />
          <Input
            label="Last Name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
          <Input
            label="Display Name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (shown in UI)"
            helperText="Overrides first/last name in the UI"
          />
          <Input
            label="Avatar URL"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
      )}

      {/* Status (only for edit) */}
      {isEditMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status <span className="text-red-500">*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Deactivating a user will immediately log them out and prevent login
          </p>
        </div>
      )}

      {/* Roles (only for create) */}
      {!isEditMode && availableRoles.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Roles (Optional)
          </label>
          <div className="space-y-2 border border-gray-300 rounded-md p-4 max-h-48 overflow-y-auto">
            {availableRoles.map(role => (
              <label key={role.id} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{role.name}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Roles can also be assigned later
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
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
          disabled={loading || (!isEditMode && !email)}
        >
          {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update User' : 'Create User')}
        </Button>
      </div>
    </form>
  );
}

