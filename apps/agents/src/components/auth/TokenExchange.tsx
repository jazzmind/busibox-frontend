'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * TokenExchange Component
 * 
 * Handles SSO token exchange when redirected from portal.
 * Looks for ?token=... in URL, exchanges it for a session cookie,
 * then removes the token from the URL.
 */
export function TokenExchange() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExchanging, setIsExchanging] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token || isExchanging) {
      return;
    }

    setIsExchanging(true);

    // Exchange token for session
    exchangeToken(token)
      .then(() => {
        // Remove token from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        router.replace(url.pathname + url.search);
      })
      .catch((error) => {
        console.error('[TokenExchange] Failed to exchange token:', error);
        // Still remove token from URL even on error
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        router.replace(url.pathname + url.search);
      })
      .finally(() => {
        setIsExchanging(false);
      });
  }, [searchParams, router, isExchanging]);

  return null; // This component doesn't render anything
}

async function exchangeToken(token: string): Promise<void> {
  const response = await fetch('/api/auth/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  // Also store in localStorage as backup for client-side requests
  try {
    localStorage.setItem('auth_token', token);
  } catch (e) {
    // Ignore localStorage errors
  }
}
