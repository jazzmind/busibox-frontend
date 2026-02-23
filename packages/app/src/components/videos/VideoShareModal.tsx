'use client';

import { useState, useEffect } from 'react';
import { VideoVisibility, type VideoWithOwner, type VideoWithShares } from '../../types/video';
import { UserSearchInput } from './UserSearchInput';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface User {
  id: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
}

interface VideoShareModalProps {
  video: VideoWithOwner | VideoWithShares;
  isOpen: boolean;
  onClose: () => void;
  onSharesUpdated: () => void;
}

export function VideoShareModal({ video, isOpen, onClose, onSharesUpdated }: VideoShareModalProps) {
  const api = useBusiboxApi();

  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasShares = (v: VideoWithOwner | VideoWithShares): v is VideoWithShares => {
    return 'shares' in v && Array.isArray((v as any).shares);
  };

  const shares = hasShares(video) ? video.shares : [];

  useEffect(() => {
    if (isOpen) {
      setSelectedUsers([]);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const baseUrl = api.services?.videoApiUrl ?? api.services?.agentApiUrl;

  const handleSelectUser = (user: User) => {
    if (!selectedUsers.find((u) => u.id === user.id)) setSelectedUsers([...selectedUsers, user]);
  };

  const handleRemoveSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const handleShareWithUsers = async () => {
    setError(null);
    setSuccess(null);

    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    setIsSharing(true);
    try {
      const endpoint = `/api/videos/${video.id}/share`;
      const body = JSON.stringify({ shareWithUserIds: selectedUsers.map((u) => u.id) });

      const response = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl,
          path: endpoint,
          init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        },
        next: {
          nextApiBasePath: api.nextApiBasePath,
          path: endpoint,
          init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            401,
            403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to share video');
      }

      const data = await response.json();
      setSuccess(data.message || 'Shared');
      setSelectedUsers([]);
      onSharesUpdated();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to share video');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    setError(null);
    setSuccess(null);

    try {
      const endpoint = `/api/videos/${video.id}/share`;
      const body = JSON.stringify({ userId });

      const response = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl,
          path: endpoint,
          init: { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body },
        },
        next: {
          nextApiBasePath: api.nextApiBasePath,
          path: endpoint,
          init: { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            401,
            403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove share');
      }

      setSuccess('Share removed successfully');
      onSharesUpdated();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to remove share');
    }
  };

  const handleChangeVisibility = async (visibility: VideoVisibility) => {
    setError(null);
    setSuccess(null);
    setIsChangingVisibility(true);

    try {
      const endpoint = `/api/videos/${video.id}/visibility`;
      const body = JSON.stringify({ visibility });

      const response = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl,
          path: endpoint,
          init: { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body },
        },
        next: {
          nextApiBasePath: api.nextApiBasePath,
          path: endpoint,
          init: { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            401,
            403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to change visibility');
      }

      const data = await response.json();
      setSuccess(`Visibility changed to ${visibility}`);
      onSharesUpdated();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to change visibility');
    } finally {
      setIsChangingVisibility(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Share Video</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">{success}</div>}

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">{video.prompt}</h3>
            <p className="text-sm text-gray-600">
              {video.durationSeconds}s • {video.resolution}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleChangeVisibility(VideoVisibility.PRIVATE)}
                disabled={isChangingVisibility || video.visibility === VideoVisibility.PRIVATE}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  video.visibility === VideoVisibility.PRIVATE ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                🔒 Private
              </button>
              <button
                onClick={() => handleChangeVisibility(VideoVisibility.PUBLIC)}
                disabled={isChangingVisibility || video.visibility === VideoVisibility.PUBLIC}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  video.visibility === VideoVisibility.PUBLIC ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                🌍 Public
              </button>
              <button
                onClick={() => handleChangeVisibility(VideoVisibility.SHARED)}
                disabled={isChangingVisibility || (video.visibility === VideoVisibility.SHARED && shares.length === 0)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  video.visibility === VideoVisibility.SHARED ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                👥 Shared
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {video.visibility === VideoVisibility.PRIVATE && 'Only you can see this video'}
              {video.visibility === VideoVisibility.PUBLIC && 'Anyone can see this video'}
              {video.visibility === VideoVisibility.SHARED && 'Only shared users can see this video'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Share with Users</label>

            <div className="mb-3">
              <UserSearchInput
                onSelectUser={handleSelectUser}
                selectedUserIds={[...selectedUsers.map((u) => u.id), ...shares.map((s: any) => s.userId)]}
                placeholder="Search users by email..."
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="mb-3 space-y-2">
                {selectedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                      {user.roles.length > 0 && <p className="text-xs text-gray-500">{user.isAdmin ? 'Admin' : user.roles.join(', ')}</p>}
                    </div>
                    <button type="button" onClick={() => handleRemoveSelectedUser(user.id)} className="ml-2 text-red-600 hover:text-red-700 text-sm font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleShareWithUsers}
              disabled={isSharing || selectedUsers.length === 0}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isSharing ? 'Sharing...' : `Share with ${selectedUsers.length} ${selectedUsers.length === 1 ? 'user' : 'users'}`}
            </button>
            <p className="text-xs text-gray-500 mt-1">Search for users by email. Only users with app access are shown.</p>
          </div>

          {shares.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Shared with ({shares.length})</label>
              <div className="space-y-2">
                {shares.map((share: any) => (
                  <div key={share.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{share.user.email}</p>
                      <p className="text-xs text-gray-500">Shared {new Date(share.sharedAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => handleRemoveShare(share.userId)} className="text-sm text-red-600 hover:text-red-700 font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}










