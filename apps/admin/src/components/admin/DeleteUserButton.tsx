/**
 * DeleteUserButton Component
 * 
 * Allows admins to delete (deactivate) users with confirmation.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmModal } from '@jazzmind/busibox-app';

type DeleteUserButtonProps = {
  userId: string;
  userEmail: string;
};

export function DeleteUserButton({ userId, userEmail }: DeleteUserButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to users list after successful deletion
        router.push('/users');
        router.refresh();
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <Button
        variant="danger"
        onClick={() => setShowConfirm(true)}
        fullWidth
        disabled={loading}
      >
        Delete User
      </Button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Delete ${userEmail}?\n\nThis will deactivate their account and invalidate all sessions. This action cannot be undone.`}
        confirmText="Delete User"
        cancelText="Cancel"
        variant="danger"
        loading={loading}
      />
    </>
  );
}

