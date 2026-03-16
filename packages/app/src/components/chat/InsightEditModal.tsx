'use client';
/**
 * Insight Edit Modal
 * 
 * Modal for viewing, editing, and deleting insights.
 */


import { useState } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface InsightData {
  id: string;
  content: string;
  category: string;
  conversationId?: string;
  createdAt?: string;
}

interface InsightEditModalProps {
  insight: InsightData;
  onClose: () => void;
  onSave: (id: string, content: string, category: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CATEGORIES = [
  { value: 'preference', label: 'Preference', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'fact', label: 'Fact', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'goal', label: 'Goal', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'context', label: 'Context', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300' },
];

export function InsightEditModal({
  insight,
  onClose,
  onSave,
  onDelete,
}: InsightEditModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(insight.content);
  const [category, setCategory] = useState(insight.category || 'other');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(insight.id, content, category);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save insight:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this insight?')) return;
    
    setIsDeleting(true);
    try {
      await onDelete(insight.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete insight:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.color || CATEGORIES[4].color;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Insight' : 'View Insight'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      category === cat.value
                        ? cat.color + ' ring-2 ring-offset-2 ring-gray-400'
                        : cat.color + ' opacity-60 hover:opacity-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${getCategoryColor(category)}`}>
                {CATEGORIES.find(c => c.value === category)?.label || 'Other'}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content
            </label>
            {isEditing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Enter insight content..."
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-gray-50 dark:bg-gray-700 rounded-lg break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Metadata */}
          {insight.createdAt && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Created: {new Date(insight.createdAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setContent(insight.content);
                    setCategory(insight.category || 'other');
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !content.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
