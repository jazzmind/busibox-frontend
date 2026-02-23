'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface RelatedCount {
  name: string;
  count: number;
}

interface DeleteConfirmModalProps {
  /** Display name of the item being deleted */
  itemName: string;
  /** Type of item (e.g., "record", "document", "library") */
  itemType?: string;
  /** Whether this is a document-level delete (affects messaging) */
  isDocument?: boolean;
  /** Related record counts for cascade delete */
  relatedCounts?: RelatedCount[];
  /** Callback when delete is confirmed */
  onConfirm: (cascade: boolean) => Promise<void>;
  /** Callback when modal is cancelled */
  onCancel: () => void;
  /** Whether deletion is in progress */
  isDeleting?: boolean;
}

/**
 * A reusable delete confirmation modal with cascade delete option.
 * 
 * @example
 * ```tsx
 * <DeleteConfirmModal
 *   itemName="My Project"
 *   itemType="project"
 *   relatedCounts={[{ name: 'Tasks', count: 5 }, { name: 'Updates', count: 3 }]}
 *   onConfirm={async (cascade) => { await deleteItem(cascade); }}
 *   onCancel={() => setShowModal(false)}
 * />
 * ```
 */
export function DeleteConfirmModal({
  itemName,
  itemType = 'record',
  isDocument = false,
  relatedCounts = [],
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmModalProps) {
  const [cascadeDelete, setCascadeDelete] = useState(false);
  
  const totalRelated = relatedCounts.reduce((sum, r) => sum + r.count, 0);
  const hasRelatedItems = totalRelated > 0;

  const handleConfirm = async () => {
    await onConfirm(cascadeDelete);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-full">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Delete {itemType}?
            </h3>
          </div>
          
          <p className="text-sm text-gray-600 mb-2">
            Are you sure you want to delete <strong>&ldquo;{itemName}&rdquo;</strong>?
          </p>
          
          <p className="text-sm text-gray-500 mb-4">
            This action cannot be undone. 
            {isDocument 
              ? ' All records in this document will be permanently deleted.'
              : ' The record will be permanently deleted.'}
          </p>
          
          {/* Cascade option */}
          {hasRelatedItems && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                <p className="text-sm text-orange-800">
                  This {itemType} has related records that may become orphaned.
                </p>
              </div>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cascadeDelete}
                  onChange={(e) => setCascadeDelete(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Also delete related records
                  </p>
                  <ul className="mt-1 text-xs text-gray-600">
                    {relatedCounts.map(({ name, count }) => (
                      count > 0 && (
                        <li key={name}>• {count} {name}</li>
                      )
                    ))}
                  </ul>
                </div>
              </label>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete{cascadeDelete && hasRelatedItems ? ' All' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
