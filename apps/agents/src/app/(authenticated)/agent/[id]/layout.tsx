'use client';

import { useEffect } from 'react';

/**
 * Layout for agent detail page - hides footer to maximize chat space
 */
export default function AgentDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hide footer when this layout is active
  useEffect(() => {
    document.body.classList.add('hide-footer');
    return () => {
      document.body.classList.remove('hide-footer');
    };
  }, []);

  return <>{children}</>;
}
