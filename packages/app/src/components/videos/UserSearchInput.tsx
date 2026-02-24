'use client';

/**
 * UserSearchInput Component
 *
 * Autocomplete input for searching and selecting users.
 */

import { useState, useEffect, useRef } from 'react';
import { useBusiboxApi, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface User {
  id: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
}

interface UserSearchInputProps {
  onSelectUser: (user: User) => void;
  selectedUserIds?: string[];
  placeholder?: string;
}

export function UserSearchInput({ onSelectUser, selectedUserIds = [], placeholder = 'Search users by email...' }: UserSearchInputProps) {
  const api = useBusiboxApi();
  const mediaBasePath = useCrossAppBasePath('media');

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setUsers([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const endpoint = `/api/users/search?q=${encodeURIComponent(query)}`;

        const response = await fetchServiceFirstFallbackNext({
          service: { baseUrl: api.services?.agentApiUrl, path: endpoint, init: { method: 'GET' } },
          next: { nextApiBasePath: mediaBasePath, path: endpoint, init: { method: 'GET' } },
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

        if (!response.ok) throw new Error('Failed to search users');

        const data = await response.json();

        if (data.success && data.data && Array.isArray(data.data.users)) {
          const filteredUsers = data.data.users.filter((user: User) => !selectedUserIds.includes(user.id));
          setUsers(filteredUsers);
          setShowDropdown(filteredUsers.length > 0);
        } else {
          setUsers([]);
          setShowDropdown(false);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
        setUsers([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [api.fallback, mediaBasePath, api.serviceRequestHeaders, api.services?.agentApiUrl, query, selectedUserIds]);

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    setQuery('');
    setUsers([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || users.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < users.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < users.length) handleSelectUser(users[selectedIndex]);
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (users.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
          </div>
        )}
      </div>

      {showDropdown && users.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {users.map((user, index) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
              type="button"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  <div className="text-xs text-gray-500">{user.roles?.join(', ')}</div>
                </div>
                {user.isAdmin && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Admin</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}










