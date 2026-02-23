'use client';

import { useEffect, useState } from 'react';

interface Library {
  id: string;
  name: string;
  isPersonal: boolean;
  documentCount: number;
}

interface LibrarySelectorProps {
  selectedLibraryId?: string;
  onSelectLibrary: (libraryId: string) => void;
  disabled?: boolean;
}

export function LibrarySelector({
  selectedLibraryId,
  onSelectLibrary,
  disabled = false,
}: LibrarySelectorProps) {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLibraries();
  }, []);

  async function loadLibraries() {
    try {
      setLoading(true);
      const response = await fetch('/api/libraries');
      if (!response.ok) {
        throw new Error('Failed to load libraries');
      }
      const data = await response.json();
      
      // API returns { success: true, data: { libraries: [...] } }
      const librariesArray = data.data?.libraries || data.libraries || [];
      
      const libs: Library[] = librariesArray.map((lib: any) => ({
        id: lib.id,
        name: lib.name,
        isPersonal: lib.isPersonal,
        documentCount: lib._count?.documents || 0,
      }));
      
      setLibraries(libs);
      
      // Auto-select personal library if none selected
      if (!selectedLibraryId && libs.length > 0) {
        const personal = libs.find(l => l.isPersonal);
        if (personal) {
          onSelectLibrary(personal.id);
        } else {
          onSelectLibrary(libs[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load libraries:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">Loading libraries...</div>
    );
  }

  return (
    <div>
      <label htmlFor="library-select" className="block text-sm font-medium text-gray-700 mb-2">
        Upload to Library
      </label>
      <select
        id="library-select"
        value={selectedLibraryId || ''}
        onChange={(e) => onSelectLibrary(e.target.value)}
        disabled={disabled}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {libraries.map((library) => (
          <option key={library.id} value={library.id}>
            {library.name} {library.isPersonal ? '(Personal)' : ''} - {library.documentCount} docs
          </option>
        ))}
      </select>
    </div>
  );
}

