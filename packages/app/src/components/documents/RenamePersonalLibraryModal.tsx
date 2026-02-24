'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

interface RenamePersonalLibraryModalProps {
  isOpen: boolean;
  libraryId: string | null;
  currentName: string;
  onClose: () => void;
  onRenamed: () => void;
}

export function RenamePersonalLibraryModal({
  isOpen,
  libraryId,
  currentName,
  onClose,
  onRenamed,
}: RenamePersonalLibraryModalProps) {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCrossAppApiPath();

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!libraryId || !name.trim()) return;

    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(resolve('libraries', `/api/libraries/${libraryId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to rename library');
      }

      onRenamed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename library');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen || !libraryId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rename Library</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="rename-library-name" className="block text-sm font-medium text-gray-700 mb-1">
                Library Name
              </label>
              <input
                id="rename-library-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim() || name.trim() === currentName}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
