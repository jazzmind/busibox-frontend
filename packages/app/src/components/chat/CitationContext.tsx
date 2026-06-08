'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface CitationState {
  fileId: string;
  page?: number;
}

export interface CitationContextValue {
  activeCitation: CitationState | null;
  openCitation: (fileId: string, page?: number) => void;
  closeCitation: () => void;
}

export const CitationContext = createContext<CitationContextValue | null>(null);

export function CitationProvider({ children }: { children: ReactNode }) {
  const [activeCitation, setActiveCitation] = useState<CitationState | null>(null);

  const openCitation = (fileId: string, page?: number) => {
    setActiveCitation({ fileId, page });
  };

  const closeCitation = () => {
    setActiveCitation(null);
  };

  return (
    <CitationContext.Provider value={{ activeCitation, openCitation, closeCitation }}>
      {children}
    </CitationContext.Provider>
  );
}

/** Returns the citation context, or null if there is no CitationProvider ancestor. */
export function useCitation(): CitationContextValue | null {
  return useContext(CitationContext);
}
