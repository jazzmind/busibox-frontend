'use client';

import React, { useState } from 'react';
import { Share2, Lock, Globe, Users, MoreVertical, X, Check, Loader2 } from 'lucide-react';
import type { AppDataLibraryItem } from '@jazzmind/busibox-app';

interface AppDataItemActionsProps {
  documentId: string;
  recordId: string;
  currentVisibility: 'personal' | 'shared';
  allowSharing?: boolean;
  appDataItem: AppDataLibraryItem;
  onVisibilityChange?: (newVisibility: 'personal' | 'shared') => void;
}

export function AppDataItemActions({
  documentId,
  recordId,
  currentVisibility,
  allowSharing = true,
  appDataItem,
  onVisibilityChange,
}: AppDataItemActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVisibilityChange(newVisibility: 'personal' | 'shared') {
    if (!allowSharing && newVisibility === 'shared') {
      setError('Sharing is not allowed for this data type');
      return;
    }

    try {
      setIsChanging(true);
      setError(null);

      // Update the record's _visibility field via data-api
      const response = await fetch(`/api/data/${documentId}/records`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { _visibility: newVisibility },
          where: { field: 'id', op: 'eq', value: recordId },
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update visibility');
      }

      onVisibilityChange?.(newVisibility);
      setIsOpen(false);
    } catch (err: any) {
      console.error('Failed to change visibility:', err);
      setError(err.message || 'Failed to change visibility');
    } finally {
      setIsChanging(false);
    }
  }

  const visibilityIcon = currentVisibility === 'shared' ? (
    <Globe className="w-4 h-4 text-green-600" />
  ) : (
    <Lock className="w-4 h-4 text-gray-500" />
  );

  const visibilityLabel = currentVisibility === 'shared' ? 'Shared' : 'Personal';

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        title="Sharing settings"
      >
        {visibilityIcon}
        <span className="ml-1.5 hidden sm:inline">{visibilityLabel}</span>
        <MoreVertical className="w-4 h-4 ml-1 text-gray-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Sharing Settings</h4>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Control who can see this {appDataItem.itemLabel?.toLowerCase() || 'item'}
              </p>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="p-2">
              {/* Personal Option */}
              <button
                onClick={() => handleVisibilityChange('personal')}
                disabled={isChanging || currentVisibility === 'personal'}
                className={`w-full flex items-center px-3 py-2 rounded-md text-left transition-colors ${
                  currentVisibility === 'personal'
                    ? 'bg-blue-50 text-blue-900'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Lock className="w-5 h-5 mr-3 text-gray-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Personal</div>
                  <div className="text-xs text-gray-500">Only you can see this</div>
                </div>
                {currentVisibility === 'personal' && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
                {isChanging && currentVisibility !== 'personal' && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </button>

              {/* Shared Option */}
              <button
                onClick={() => handleVisibilityChange('shared')}
                disabled={isChanging || currentVisibility === 'shared' || !allowSharing}
                className={`w-full flex items-center px-3 py-2 rounded-md text-left transition-colors mt-1 ${
                  currentVisibility === 'shared'
                    ? 'bg-green-50 text-green-900'
                    : allowSharing
                    ? 'hover:bg-gray-50 text-gray-700'
                    : 'opacity-50 cursor-not-allowed text-gray-400'
                }`}
              >
                <Users className="w-5 h-5 mr-3 text-gray-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Shared</div>
                  <div className="text-xs text-gray-500">
                    {allowSharing ? 'Visible to users with access to this app' : 'Sharing not available'}
                  </div>
                </div>
                {currentVisibility === 'shared' && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
                {isChanging && currentVisibility !== 'shared' && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </button>
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              <div className="flex items-start">
                <Share2 className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
                <span>
                  Default visibility is inherited from{' '}
                  <span className="font-medium">{appDataItem.sourceApp.replace(/-/g, ' ')}</span>
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Inline visibility badge for displaying current visibility status
 */
export function VisibilityBadge({ visibility }: { visibility: 'personal' | 'shared' }) {
  if (visibility === 'shared') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        <Globe className="w-3 h-3 mr-1" />
        Shared
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
      <Lock className="w-3 h-3 mr-1" />
      Personal
    </span>
  );
}
