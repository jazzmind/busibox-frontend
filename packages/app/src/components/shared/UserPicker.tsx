'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { UserProfile } from '../../types';
import { UserAvatar } from './UserAvatar';

export interface UserPickerProps {
  value?: string;
  onChange: (userId: string | null, user?: UserProfile) => void;
  users: UserProfile[];
  placeholder?: string;
  size?: 'sm' | 'md';
}

function userDisplayName(user: UserProfile): string {
  return (
    user.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email
  );
}

export function UserPicker({
  value,
  onChange,
  users,
  placeholder = 'Select user',
  size = 'md',
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => users.find((u) => u.id === value) || null,
    [users, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const label = userDisplayName(user).toLowerCase();
      return label.includes(q) || user.email.toLowerCase().includes(q);
    });
  }, [users, query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const controlSize = size === 'sm' ? 'h-9 text-sm' : 'h-10 text-sm';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3',
          'bg-white dark:bg-gray-700 text-left flex items-center justify-between',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          controlSize
        )}
      >
        <span className="truncate flex items-center gap-2">
          {selected ? (
            <>
              <UserAvatar
                size={size === 'sm' ? 'xs' : 'sm'}
                name={userDisplayName(selected)}
                email={selected.email}
                avatarUrl={selected.avatarUrl}
              />
              <span className="truncate text-gray-900 dark:text-gray-100">{userDisplayName(selected)}</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 ml-2">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(null);
                }
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter' && filtered[activeIndex]) {
                  e.preventDefault();
                  const user = filtered[activeIndex];
                  onChange(user.id, user);
                  setOpen(false);
                  setQuery('');
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              placeholder="Search users..."
              className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No users found</div>
            ) : (
              filtered.map((user, idx) => {
                const label = userDisplayName(user);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      onChange(user.id, user);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left flex items-center gap-2',
                      'hover:bg-gray-50 dark:hover:bg-gray-700',
                      idx === activeIndex && 'bg-gray-50 dark:bg-gray-700'
                    )}
                  >
                    <UserAvatar
                      size="sm"
                      name={label}
                      email={user.email}
                      avatarUrl={user.avatarUrl}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-900 dark:text-gray-100">{label}</span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
