/**
 * Admin Setup Page
 * 
 * First-time admin setup flow. Accessible via:
 * - Magic link from `make install` → portal /setup consumes the token,
 *   sets the busibox-session cookie, then redirects here with no token.
 * - Direct navigation when an admin session cookie already exists.
 * 
 * Flow:
 * 1. Check for existing session (shared busibox-session cookie)
 * 2. Check passkeys → enroll if none
 * 3. Service installation
 * 4. Portal customization
 * 5. Mark setup complete
 * 
 * A sessionStorage flag allows the user to navigate through the
 * multi-step wizard (and refresh) without re-checking the session.
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { PasskeyEnrollmentPage } from '@/components/admin/PasskeyEnrollmentPage';
import { ServiceInstallationFlow } from '@/components/admin/ServiceInstallationFlow';
import { PortalCustomization } from '@/components/admin/PortalCustomization';

const SETUP_SESSION_KEY = 'setup_session_active';
const SETUP_PASSKEY_KEY = 'setup_passkey_verified';

type SetupState = 
  | 'loading'
  | 'validating'
  | 'invalid_token'
  | 'unauthorized'
  | 'passkey'
  | 'services'
  | 'customization'
  | 'complete';

type InstallState = {
  phase: string;
  status: string;
  setupComplete?: boolean;
  environment?: string;
  platform?: string;
  llmBackend?: string;
  adminEmail?: string;
};

function AdminSetupContent() {
  const router = useRouter();
  const [setupState, setSetupState] = useState<SetupState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [user, setUser] = useState<{ email: string; userId: string } | null>(null);
  const [installState, setInstallState] = useState<InstallState | null>(null);
  const [passkeyVerified, setPasskeyVerified] = useState(false);

  useEffect(() => {
    // Check if we're mid-setup (user refreshed or navigated back)
    const hasSetupSession = sessionStorage.getItem(SETUP_SESSION_KEY) === 'true';
    if (hasSetupSession) {
      const verified = sessionStorage.getItem(SETUP_PASSKEY_KEY) === 'true';
      if (verified) {
        setPasskeyVerified(true);
      }
      resumeSetupSession();
      return;
    }

    // No active setup session — try to start one from the shared session cookie.
    // The portal /setup page already consumed the magic link and set the cookie
    // before redirecting here.
    initSetupFromSession();
  }, []);

  const resumeSetupSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (!data.success || !data.data?.user) {
        // Session expired — need a new magic link
        sessionStorage.removeItem(SETUP_SESSION_KEY);
        sessionStorage.removeItem(SETUP_PASSKEY_KEY);
        setSetupState('invalid_token');
        setErrorMessage('Your setup session has expired. Please use a new setup link.');
        return;
      }

      const userRoles = data.data.user.roles || [];
      const isAdmin = userRoles.some((r: { name?: string } | string) => 
        typeof r === 'string' ? r === 'Admin' : r.name === 'Admin'
      );
      
      if (!isAdmin) {
        setSetupState('unauthorized');
        setErrorMessage('Your account does not have admin privileges.');
        return;
      }

      setUser({
        email: data.data.user.email,
        userId: data.data.user.id || data.data.user.user_id,
      });

      await fetchInstallState();
      
      const hasExistingPasskey = await checkUserHasPasskeys();
      if (hasExistingPasskey || sessionStorage.getItem(SETUP_PASSKEY_KEY) === 'true') {
        sessionStorage.setItem(SETUP_PASSKEY_KEY, 'true');
        setPasskeyVerified(true);
        setSetupState('services');
      } else {
        setSetupState('passkey');
      }
    } catch (error) {
      console.error('[AdminSetup] Session resume error:', error);
      sessionStorage.removeItem(SETUP_SESSION_KEY);
      sessionStorage.removeItem(SETUP_PASSKEY_KEY);
      setSetupState('invalid_token');
      setErrorMessage('Failed to resume setup session. Please use a new setup link.');
    }
  };

  const initSetupFromSession = async () => {
    setSetupState('validating');

    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!data.success || !data.data?.user) {
        setSetupState('invalid_token');
        setErrorMessage('This page requires a setup link. Use the link provided by the install script, or run `make login` to get a new one.');
        return;
      }

      const userRoles = data.data.user.roles || [];
      const isAdmin = userRoles.some((r: { name?: string } | string) =>
        typeof r === 'string' ? r === 'Admin' : r.name === 'Admin'
      );

      if (!isAdmin) {
        setSetupState('unauthorized');
        setErrorMessage('Your account does not have admin privileges.');
        return;
      }

      // Mark setup session as active so refreshes work
      sessionStorage.setItem(SETUP_SESSION_KEY, 'true');

      setUser({
        email: data.data.user.email,
        userId: data.data.user.id || data.data.user.user_id,
      });

      await fetchInstallState();

      const hasExistingPasskey = await checkUserHasPasskeys();
      if (hasExistingPasskey) {
        sessionStorage.setItem(SETUP_PASSKEY_KEY, 'true');
        setPasskeyVerified(true);
        setSetupState('services');
      } else {
        setSetupState('passkey');
      }
    } catch (error) {
      console.error('[AdminSetup] Session check error:', error);
      setSetupState('invalid_token');
      setErrorMessage('An unexpected error occurred during setup.');
    }
  };

  const fetchInstallState = async () => {
    try {
      const response = await fetch('/api/deploy/status', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInstallState(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch install state:', error);
    }
  };

  const portalBase = process.env.NEXT_PUBLIC_PORTAL_BASE_PATH || '/portal';

  const checkUserHasPasskeys = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${portalBase}/api/auth/passkey`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success && data.data?.passkeys) {
        return data.data.passkeys.length > 0;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check passkeys:', error);
      return false;
    }
  };

  const handlePasskeyComplete = () => {
    sessionStorage.setItem(SETUP_PASSKEY_KEY, 'true');
    setPasskeyVerified(true);
    setSetupState('services');
  };

  const handleServicesComplete = () => {
    setSetupState('customization');
  };

  const handleServicesSkip = () => {
    setSetupState('customization');
  };

  const handleCustomizationComplete = async () => {
    setCompletionError('');

    try {
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const message = data.error || response.statusText || 'Failed to mark setup complete.';
        console.error('Failed to mark setup complete:', message);
        setCompletionError(message);
        return;
      }

      console.log('[AdminSetup] Setup marked complete successfully');
    } catch (error) {
      console.error('Failed to mark setup complete:', error);
      setCompletionError('Failed to save setup completion. Please try again.');
      return;
    }

    // Clear setup session data
    sessionStorage.removeItem(SETUP_SESSION_KEY);
    sessionStorage.removeItem(SETUP_PASSKEY_KEY);
    
    setSetupState('complete');
    setTimeout(() => {
      router.push('/system');
    }, 2000);
  };

  const handleCustomizationSkip = async () => {
    await handleCustomizationComplete();
  };

  if (setupState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading setup...</p>
        </div>
      </div>
    );
  }

  if (setupState === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Preparing Setup</h2>
          <p className="text-gray-600">Please wait while we verify your admin access...</p>
        </div>
      </div>
    );
  }

  if (setupState === 'invalid_token') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Link Required</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <div className="space-y-3">
            <a
              href="/portal/login"
              className="block w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </a>
            <p className="text-sm text-gray-500">
              Run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">make login</code> to generate a new setup link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (setupState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <a
            href="/portal/home"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (setupState === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
          <p className="text-gray-600">Redirecting to admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (setupState === 'passkey') {
    const allowSkipInDev = process.env.NODE_ENV === 'development';
    return (
      <PasskeyEnrollmentPage
        userEmail={user?.email || ''}
        onComplete={handlePasskeyComplete}
        onSkip={allowSkipInDev ? handlePasskeyComplete : undefined}
        allowSkip={allowSkipInDev}
      />
    );
  }

  if (setupState === 'services') {
    return (
      <ServiceInstallationFlow
        onComplete={handleServicesComplete}
        onSkip={handleServicesSkip}
      />
    );
  }

  if (setupState === 'customization') {
    return (
      <>
        {completionError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[calc(100%-2rem)]">
            <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 shadow-lg">
              <p className="font-medium">Could not complete setup</p>
              <p className="text-sm mt-1">{completionError}</p>
            </div>
          </div>
        )}
        <PortalCustomization
          onComplete={handleCustomizationComplete}
          onSkip={handleCustomizationSkip}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">Unexpected state: {setupState}</p>
      </div>
    </div>
  );
}

export default function AdminSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AdminSetupContent />
    </Suspense>
  );
}
