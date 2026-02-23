/**
 * Passkey Settings Component
 * 
 * Manage registered passkeys - view, add, rename, and remove.
 */

'use client';

import { useState, useEffect } from 'react';
import { usePasskey } from '@/hooks/usePasskey';
import { Button } from '@jazzmind/busibox-app';

interface PasskeySettingsProps {
  className?: string;
}

export function PasskeySettings({ className = '' }: PasskeySettingsProps) {
  const {
    isSupported,
    isPlatformAvailable,
    isLoading,
    error,
    passkeys,
    registerPasskey,
    deletePasskey,
    renamePasskey,
    loadPasskeys,
    clearError,
  } = usePasskey();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load passkeys on mount
  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  // Generate default device name
  useEffect(() => {
    const getDeviceName = () => {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone')) return 'iPhone';
      if (ua.includes('iPad')) return 'iPad';
      if (ua.includes('Mac')) return 'Mac';
      if (ua.includes('Windows')) return 'Windows PC';
      if (ua.includes('Android')) return 'Android Device';
      if (ua.includes('Linux')) return 'Linux Device';
      return 'My Device';
    };
    setNewDeviceName(getDeviceName());
  }, []);

  const handleAddPasskey = async () => {
    clearError();
    const success = await registerPasskey(newDeviceName || 'My Device');
    if (success) {
      setShowAddForm(false);
      setNewDeviceName('');
    }
  };

  const handleRename = async (passkeyId: string) => {
    if (!editName.trim()) return;
    
    const success = await renamePasskey(passkeyId, editName.trim());
    if (success) {
      setEditingId(null);
      setEditName('');
    }
  };

  const handleDelete = async (passkeyId: string) => {
    const success = await deletePasskey(passkeyId);
    if (success) {
      setConfirmDelete(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isSupported) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-yellow-800">
            Passkeys are not supported in this browser. Try using Chrome, Safari, or Edge.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Passkeys</h3>
          <p className="text-sm text-gray-600">
            Sign in instantly using Face ID, Touch ID, or your device PIN
          </p>
        </div>
        
        {isPlatformAvailable && !showAddForm && (
          <Button
            variant="primary"
            onClick={() => setShowAddForm(true)}
            disabled={isLoading}
          >
            Add Passkey
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add New Passkey Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-medium text-gray-900 mb-3">Add a new passkey</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">
                Device name
              </label>
              <input
                id="deviceName"
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., MacBook Pro"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleAddPasskey}
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Setting up...' : 'Create passkey'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  clearError();
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Passkey List */}
      {passkeys.length > 0 ? (
        <div className="space-y-3">
          {passkeys.map((passkey) => (
            <div
              key={passkey.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                
                {editingId === passkey.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(passkey.id);
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditName('');
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => handleRename(passkey.id)}
                      disabled={isLoading}
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(null);
                        setEditName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-900">{passkey.name}</p>
                    <p className="text-sm text-gray-500">
                      Added {formatDate(passkey.createdAt)}
                      {passkey.lastUsedAt && ` · Last used ${formatDate(passkey.lastUsedAt)}`}
                    </p>
                  </div>
                )}
              </div>

              {editingId !== passkey.id && (
                <div className="flex items-center gap-2">
                  {confirmDelete === passkey.id ? (
                    <>
                      <span className="text-sm text-gray-600 mr-2">Delete?</span>
                      <Button
                        variant="ghost"
                        onClick={() => handleDelete(passkey.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700"
                      >
                        Yes
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmDelete(null)}
                        disabled={isLoading}
                      >
                        No
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(passkey.id);
                          setEditName(passkey.name);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(passkey.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-gray-600 mb-4">
            No passkeys registered yet. Add one for faster sign-in!
          </p>
          {isPlatformAvailable && !showAddForm && (
            <Button
              variant="primary"
              onClick={() => setShowAddForm(true)}
            >
              Add your first passkey
            </Button>
          )}
        </div>
      )}

      {!isPlatformAvailable && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            This device doesn't support passkeys. Try on a device with Face ID, Touch ID, or Windows Hello.
          </p>
        </div>
      )}
    </div>
  );
}




