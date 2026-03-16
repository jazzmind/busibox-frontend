'use client';
/**
 * Library Selector Component
 * 
 * Allows selecting from available document libraries for document search.
 * Only shown when document search tool is enabled.
 */


import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Check } from 'lucide-react';

export interface Library {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  icon?: string;
  enabled?: boolean;
}

interface LibrarySelectorProps {
  selectedLibraries: string[];
  onLibrariesChange: (libraryIds: string[]) => void;
  disabled?: boolean;
  availableLibraries?: Library[];
  /** Only show if document search is enabled */
  documentSearchEnabled?: boolean;
}

const DEFAULT_LIBRARIES: Library[] = [
  {
    id: 'all',
    name: 'All Libraries',
    description: 'Search across all document libraries',
    icon: '📚',
    enabled: true,
  },
  {
    id: 'personal',
    name: 'Personal Documents',
    description: 'Your personal document collection',
    documentCount: 42,
    icon: '👤',
    enabled: true,
  },
  {
    id: 'team',
    name: 'Team Documents',
    description: 'Shared team documents',
    documentCount: 128,
    icon: '👥',
    enabled: true,
  },
  {
    id: 'research',
    name: 'Research Papers',
    description: 'Academic and research documents',
    documentCount: 87,
    icon: '🔬',
    enabled: true,
  },
  {
    id: 'archive',
    name: 'Archive',
    description: 'Archived documents',
    documentCount: 256,
    icon: '📦',
    enabled: false,
  },
];

export function LibrarySelector({
  selectedLibraries,
  onLibrariesChange,
  disabled = false,
  availableLibraries = DEFAULT_LIBRARIES,
  documentSearchEnabled = false,
}: LibrarySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggleLibrary = (libraryId: string) => {
    // If selecting "all", clear other selections
    if (libraryId === 'all') {
      if (selectedLibraries.includes('all')) {
        onLibrariesChange([]);
      } else {
        onLibrariesChange(['all']);
      }
      return;
    }

    // If selecting a specific library, remove "all" if present
    let newSelection = selectedLibraries.filter((id) => id !== 'all');

    if (newSelection.includes(libraryId)) {
      newSelection = newSelection.filter((id) => id !== libraryId);
    } else {
      newSelection = [...newSelection, libraryId];
    }

    onLibrariesChange(newSelection);
  };

  const enabledLibraries = availableLibraries.filter((l) => l.enabled !== false);
  const selectedCount = selectedLibraries.length;

  // Don't show if document search is not enabled
  if (!documentSearchEnabled) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : selectedCount > 0
            ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Select document libraries"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="font-medium">
          Libraries {selectedCount > 0 && `(${selectedCount})`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
              Document Libraries
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {enabledLibraries.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No libraries available
              </div>
            ) : (
              <div className="p-1">
                {enabledLibraries.map((library) => (
                  <button
                    key={library.id}
                    onClick={() => handleToggleLibrary(library.id)}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {selectedLibraries.includes(library.id) ? (
                        <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {library.icon && <span className="text-lg">{library.icon}</span>}
                        <span className="font-medium text-gray-900">{library.name}</span>
                        {library.documentCount !== undefined && (
                          <span className="text-xs text-gray-500">
                            ({library.documentCount} docs)
                          </span>
                        )}
                      </div>
                      {library.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{library.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCount > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={() => onLibrariesChange([])}
                className="w-full px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

