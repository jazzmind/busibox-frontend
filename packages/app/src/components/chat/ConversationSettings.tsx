'use client';

import { useState, useEffect } from 'react';
import { X, Settings, UserPlus, Trash2, Shield, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

interface ConversationShare {
  id: string;
  userId: string;
  userEmail: string;
  role: 'viewer' | 'editor';
  sharedBy: string;
  sharedAt: Date;
}

interface ConversationSettingsProps {
  conversationId: string;
  isOwner: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onPrivacyChange?: (isPrivate: boolean) => void;
}

export function ConversationSettings({
  conversationId,
  isOwner,
  isPrivate,
  onClose,
  onPrivacyChange,
}: ConversationSettingsProps) {
  const resolve = useCrossAppApiPath();
  const [shares, setShares] = useState<ConversationShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [newShareEmail, setNewShareEmail] = useState('');
  const [newShareRole, setNewShareRole] = useState<'viewer' | 'editor'>('viewer');
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

  // Load shares
  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }

    loadShares();
  }, [conversationId, isOwner]);

  const loadShares = async () => {
    try {
      const response = await fetch(resolve('chat', `/api/chat/conversations/${conversationId}/share`));
      if (!response.ok) {
        throw new Error('Failed to load shares');
      }
      const data = await response.json();
      setShares(data.shares || []);
    } catch (error) {
      console.error('Failed to load shares:', error);
      toast.error('Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!newShareEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSharing(true);
    try {
      const response = await fetch(resolve('chat', `/api/chat/conversations/${conversationId}/share`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserEmail: newShareEmail.trim(),
          role: newShareRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to share conversation');
      }

      toast.success('Conversation shared successfully');
      setNewShareEmail('');
      setNewShareRole('viewer');
      await loadShares();
    } catch (error: any) {
      console.error('Failed to share conversation:', error);
      toast.error(error.message || 'Failed to share conversation');
    } finally {
      setSharing(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the conversation?')) {
      return;
    }

    try {
      const response = await fetch(
        resolve('chat', `/api/chat/conversations/${conversationId}/share/${userId}`),
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unshare conversation');
      }

      toast.success('User removed from conversation');
      await loadShares();
    } catch (error) {
      console.error('Failed to unshare conversation:', error);
      toast.error('Failed to unshare conversation');
    }
  };

  const handlePrivacyToggle = async () => {
    if (isPrivate && shares.length > 0) {
      if (
        !confirm(
          'Making this conversation public will allow sharing. Current shares will remain. Continue?'
        )
      ) {
        return;
      }
    }

    setUpdatingPrivacy(true);
    try {
      const response = await fetch(resolve('chat', `/api/chat/conversations/${conversationId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPrivate: !isPrivate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update privacy setting');
      }

      toast.success(`Conversation is now ${!isPrivate ? 'private' : 'public'}`);
      onPrivacyChange?.(!isPrivate);
    } catch (error) {
      console.error('Failed to update privacy:', error);
      toast.error('Failed to update privacy setting');
    } finally {
      setUpdatingPrivacy(false);
    }
  };

  if (!isOwner) {
    return null; // Only owners can access settings
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Conversation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Privacy Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPrivate ? (
                  <Shield className="w-5 h-5 text-gray-600" />
                ) : (
                  <ShieldOff className="w-5 h-5 text-gray-600" />
                )}
                <label className="font-medium">Privacy</label>
              </div>
              <button
                onClick={handlePrivacyToggle}
                disabled={updatingPrivacy}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPrivate ? 'bg-blue-600' : 'bg-gray-300'
                } ${updatingPrivacy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPrivate ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {isPrivate
                ? 'This conversation is private and cannot be shared.'
                : 'This conversation can be shared with other users.'}
            </p>
          </div>

          {/* Share Section */}
          {!isPrivate && (
            <>
              <div className="border-t pt-6">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Share with Users
                </h3>

                {/* Add Share Form */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={newShareEmail}
                    onChange={(e) => setNewShareEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleShare();
                      }
                    }}
                  />
                  <select
                    value={newShareRole}
                    onChange={(e) => setNewShareRole(e.target.value as 'viewer' | 'editor')}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    onClick={handleShare}
                    disabled={sharing || !newShareEmail.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sharing ? 'Sharing...' : 'Share'}
                  </button>
                </div>

                {/* Shares List */}
                {loading ? (
                  <div className="text-center py-4 text-gray-500">Loading shares...</div>
                ) : shares.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No users have access to this conversation yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{share.userEmail}</div>
                          <div className="text-sm text-gray-600">
                            {share.role === 'editor' ? 'Editor' : 'Viewer'} • Shared{' '}
                            {new Date(share.sharedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnshare(share.userId)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

