/**
 * Login Page
 * 
 * Magic link authentication - users enter email to receive login link.
 * Redirects to dashboard if already authenticated.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user } = useSession();
  const [redirecting, setRedirecting] = useState(false);
  
  useEffect(() => {
    // If already authenticated, redirect
    if (user) {
      setRedirecting(true);
      
      // Check for returnTo parameter
      const urlParams = new URLSearchParams(window.location.search);
      const returnTo = urlParams.get('returnTo');
      
      if (returnTo) {
        console.log('[Login] Already authenticated, checking if library app redirect');
        
        // Check if returnTo is a library app (has /projects, /foundation, etc.)
        const libraryAppPaths = ['/projects', '/foundation', '/dataviz', '/innovation', '/agents', '/docs'];
        const isLibraryApp = libraryAppPaths.some(path => {
          try {
            const url = new URL(returnTo);
            return url.pathname.startsWith(path);
          } catch {
            return returnTo.includes(path);
          }
        });
        
        if (isLibraryApp) {
          // For library apps, we need to generate an SSO token
          console.log('[Login] Library app detected, generating SSO token for:', returnTo);
          generateSSOTokenAndRedirect(returnTo);
        } else {
          // For other URLs, just redirect
          console.log('[Login] Non-library app, redirecting to:', returnTo);
          window.location.href = returnTo;
        }
      } else {
        console.log('[Login] No returnTo, redirecting to dashboard');
        router.push('/home');
      }
    }
  }, [user, router]);
  
  const generateSSOTokenAndRedirect = async (returnTo: string) => {
    try {
      // Extract the app path to determine which app
      const url = new URL(returnTo);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const basePath = pathParts[0]; // e.g., 'projects', 'foundation'
      
      console.log('[Login] Extracted basePath:', basePath, 'from pathname:', url.pathname);
      
      // Map paths to app names (this should match app-library.ts)
      const pathToAppName: Record<string, string> = {
        'projects': 'Data Analysis',
        'foundation': 'Foundation Manager',
        'dataviz': 'Data Visualizer',
        'innovation': 'Innovation Manager',
        'agents': 'Agent Manager',
        'docs': 'Doc Intel',
      };
      
      const appName = pathToAppName[basePath];
      
      if (!appName) {
        console.warn('[Login] Unknown library app path:', basePath, '- redirecting without token');
        window.location.href = returnTo;
        return;
      }
      
      console.log('[Login] Generating SSO token for app:', appName);
      
      // Generate SSO token by app name
      const response = await fetch('/api/auth/sso/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success && data.data.token) {
        // Append token to returnTo URL
        const redirectUrl = new URL(returnTo);
        redirectUrl.searchParams.set('token', data.data.token);
        console.log('[Login] Redirecting with SSO token to:', redirectUrl.toString());
        window.location.href = redirectUrl.toString();
      } else {
        console.error('[Login] Failed to generate SSO token:', data.error);
        // Fallback: redirect without token
        window.location.href = returnTo;
      }
    } catch (err) {
      console.error('[Login] Error generating SSO token:', err);
      // Fallback: redirect without token
      window.location.href = returnTo;
    }
  };
  
  // If authenticated, show loading while redirecting
  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <MagicLinkForm />
    </div>
  );
}

