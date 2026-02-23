/**
 * DeleteAppButton Component
 * 
 * Handles app deletion with confirmation dialog.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmModal } from '@jazzmind/busibox-app';

type DeleteAppButtonProps = {
  appId: string;
  appName: string;
};

export function DeleteAppButton({ appId, appName }: DeleteAppButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/apps/${appId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to apps list
        router.push('/apps');
        router.refresh();
      } else {
        setError(data.error || 'Failed to delete app');
      }
    } catch (err) {
      console.error('Delete error:', err);
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

      <Button variant="danger" onClick={() => setShowConfirm(true)} disabled={loading}>
        🗑️ Delete App
      </Button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setError('');
        }}
        onConfirm={handleDelete}
        title="Delete App"
        message={`Delete ${appName}?\n\nThis will:\n- Remove the app from the system\n- Delete all role permissions for this app\n- Invalidate all OAuth tokens for this app\n\nThis action cannot be undone.`}
        confirmText="Delete App"
        cancelText="Cancel"
        variant="danger"
        loading={loading}
      />
    </>
  );
}

