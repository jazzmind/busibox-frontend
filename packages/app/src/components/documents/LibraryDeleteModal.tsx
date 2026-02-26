'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, FolderInput, Loader2, X } from 'lucide-react';

interface LibraryOption {
  id: string;
  name: string;
  isPersonal: boolean;
  libraryType?: string;
}

export interface LibraryDeleteModalProps {
  libraryId: string;
  libraryName: string;
  documentCount: number;
  onConfirm: (action: 'delete' | 'move', targetLibraryId?: string) => Promise<void>;
  onCancel: () => void;
  isDeleting?: boolean;
  /** API path for loading libraries. Defaults to /api/libraries */
  librariesApiPath?: string;
}

export function LibraryDeleteModal({
  libraryId,
  libraryName,
  documentCount,
  onConfirm,
  onCancel,
  isDeleting = false,
  librariesApiPath = '/api/libraries',
}: LibraryDeleteModalProps) {
  const [action, setAction] = useState<'delete' | 'move'>(documentCount > 0 ? 'move' : 'delete');
  const [targetLibraryId, setTargetLibraryId] = useState<string>('');
  const [libraries, setLibraries] = useState<LibraryOption[]>([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);

  useEffect(() => {
    if (documentCount > 0) {
      loadLibraries();
    }
  }, [documentCount]);

  async function loadLibraries() {
    setLoadingLibraries(true);
    try {
      const response = await fetch(librariesApiPath);
      if (!response.ok) return;
      const data = await response.json();
      const all: LibraryOption[] = (data.data || data.libraries || []).map((lib: Record<string, unknown>) => ({
        id: lib.id as string,
        name: lib.name as string,
        isPersonal: lib.isPersonal as boolean,
        libraryType: lib.libraryType as string | undefined,
      }));
      // Exclude the library being deleted
      const available = all.filter(lib => lib.id !== libraryId);
      setLibraries(available);
      // Pre-select the first available personal library, or the first library
      const personal = available.find(l => l.isPersonal);
      setTargetLibraryId(personal?.id || available[0]?.id || '');
    } catch (err) {
      console.error('Failed to load libraries:', err);
    } finally {
      setLoadingLibraries(false);
    }
  }

  const handleConfirm = async () => {
    await onConfirm(action, action === 'move' ? targetLibraryId : undefined);
  };

  const canConfirm = action === 'delete' || (action === 'move' && !!targetLibraryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Library</h3>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            You are about to delete <span className="font-medium text-gray-900">&ldquo;{libraryName}&rdquo;</span>.
            {documentCount > 0 ? (
              <> This library contains <span className="font-medium text-gray-900">{documentCount} document{documentCount !== 1 ? 's' : ''}</span>. What should happen to them?</>
            ) : (
              <> This library is empty and will be permanently removed.</>
            )}
          </p>

          {documentCount > 0 && (
            <div className="space-y-2">
              {/* Move option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  action === 'move'
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="deleteAction"
                  value="move"
                  checked={action === 'move'}
                  onChange={() => setAction('move')}
                  className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <FolderInput className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">Move documents to another library</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Documents will be transferred to the selected library before deletion.
                  </p>
                </div>
              </label>

              {/* Target library selector */}
              {action === 'move' && (
                <div className="ml-7 mt-1">
                  {loadingLibraries ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading libraries...
                    </div>
                  ) : libraries.length === 0 ? (
                    <p className="text-sm text-red-500 py-1">No other libraries available.</p>
                  ) : (
                    <select
                      value={targetLibraryId}
                      onChange={(e) => setTargetLibraryId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {libraries.map((lib) => (
                        <option key={lib.id} value={lib.id}>
                          {lib.name}{lib.isPersonal ? ' (Personal)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Delete option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  action === 'delete'
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="deleteAction"
                  value="delete"
                  checked={action === 'delete'}
                  onChange={() => setAction('delete')}
                  className="mt-0.5 h-4 w-4 text-red-600 border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-gray-900">Delete all documents</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    All {documentCount} document{documentCount !== 1 ? 's' : ''} will be permanently deleted.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting || !canConfirm}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
              action === 'delete'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isDeleting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
            ) : action === 'move' ? (
              <><FolderInput className="w-4 h-4" /> Move &amp; Delete</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete Library</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
