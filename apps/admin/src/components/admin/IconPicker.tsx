/**
 * IconPicker Component
 *
 * Browse and select icons from lucide-react. Shows a curated, categorized
 * subset by default. Searching queries ALL 1600+ lucide icons so users
 * can find anything they need.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  CURATED_ICONS,
  getCategories,
  getIconsByCategory,
  getAllLucideIconNames,
  getLucideIcon,
  resolveLucideIconName,
  type IconName,
  type IconCategory,
  type Icon,
} from '@jazzmind/busibox-app';

type IconPickerProps = {
  value?: IconName;
  onChange: (iconName: IconName) => void;
  label?: string;
  required?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  ai: 'AI & ML',
  general: 'General',
  media: 'Media',
  productivity: 'Productivity',
  tech: 'Tech',
  business: 'Business',
  finance: 'Finance',
  communication: 'Communication',
  nature: 'Nature',
  science: 'Science',
  health: 'Health',
  creative: 'Creative',
  social: 'People',
  files: 'Files',
  status: 'Status',
  transport: 'Transport',
};

function toLabel(pascalCase: string): string {
  return pascalCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1 ');
}

export function IconPicker({ value, onChange, label = 'Icon', required = false }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IconCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = getCategories();
  const resolvedValue = value ? resolveLucideIconName(value) : undefined;

  const selectedIcon = useMemo(() => {
    if (!resolvedValue) return undefined;
    const curated = CURATED_ICONS.find((i) => i.name === resolvedValue);
    if (curated) return curated;
    if (getLucideIcon(resolvedValue)) {
      return { name: resolvedValue, label: toLabel(resolvedValue), category: 'general' as IconCategory };
    }
    return undefined;
  }, [resolvedValue]);

  const filteredIcons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      // Search across ALL lucide icons when user types a query
      const allNames = getAllLucideIconNames();
      const curatedMap = new Map(CURATED_ICONS.map((i) => [i.name, i]));

      const matches: Icon[] = [];
      for (const name of allNames) {
        const readable = toLabel(name).toLowerCase();
        if (readable.includes(query) || name.toLowerCase().includes(query)) {
          const curated = curatedMap.get(name);
          matches.push(curated || { name, label: toLabel(name), category: 'general' });
        }
        if (matches.length >= 200) break;
      }
      return matches;
    }

    if (selectedCategory === 'all') return CURATED_ICONS;
    return getIconsByCategory(selectedCategory);
  }, [selectedCategory, searchQuery]);

  const handleSelect = (iconName: IconName) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchQuery('');
  };

  const SelectedLucideIcon = resolvedValue ? getLucideIcon(resolvedValue) : undefined;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Selected Icon Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        {selectedIcon && SelectedLucideIcon ? (
          <>
            <SelectedLucideIcon size={32} className="text-gray-700 dark:text-gray-300 flex-shrink-0" strokeWidth={1.5} />
            <span className="flex-1 text-left text-gray-900 dark:text-gray-100">{selectedIcon.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
              {CATEGORY_LABELS[selectedIcon.category] || selectedIcon.category}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-gray-400 dark:text-gray-500">Select an icon...</span>
        )}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Icon Browser Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choose an Icon</h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all 1,600+ icons..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                autoFocus
              />
            </div>

            {/* Category Filter (hidden during search) */}
            {!searchQuery && (
              <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    All ({CURATED_ICONS.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Icon Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredIcons.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No icons match your search.</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-10 gap-2">
                  {filteredIcons.map((icon) => {
                    const LIcon = getLucideIcon(icon.name);
                    if (!LIcon) return null;
                    return (
                      <button
                        key={icon.name}
                        onClick={() => handleSelect(icon.name)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 ${
                          resolvedValue === icon.name
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                        }`}
                        title={`${icon.label} (${CATEGORY_LABELS[icon.category] || icon.category})`}
                      >
                        <LIcon size={32} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight truncate w-full">
                          {icon.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                <span>
                  {filteredIcons.length} icons{searchQuery ? ' matching' : ' available'}
                  {searchQuery && <span className="text-xs ml-1">(search finds all 1,600+ Lucide icons)</span>}
                </span>
                {selectedIcon && (
                  <span className="font-medium text-gray-900 dark:text-gray-100">Selected: {selectedIcon.label}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
