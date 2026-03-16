'use client';
/**
 * Passkey Required Wrapper Component
 * 
 * For admin users, checks if they have at least one passkey set up.
 * If not, displays a passkey setup prompt.
 * 
 * This enforces the "passkey-only admin" security model from the install flow.
 */


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './SessionProvider';
import { startRegistration } from '@simplewebauthn/browser';
import { useCrossAppBasePath } from '../../contexts/ApiContext';

export type PasskeyRequiredWrapperProps = {
  children: React.ReactNode;
  /** If true, require passkey for all authenticated users. If false, only for admins. */
  requireForAll?: boolean;
};

export function PasskeyRequiredWrapper({ 
  children, 
  requireForAll = false 
}: PasskeyRequiredWrapperProps) {
  const { user, isAuthenticated, isAdmin } = useSession();
  const router = useRouter();
  const portalBase = useCrossAppBasePath('portal');
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');

  // Check if passkey is required for this user
  const requiresPasskey = requireForAll || isAdmin;

  useEffect(() => {
    async function checkPasskeys() {
      if (!isAuthenticated || !requiresPasskey) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${portalBase}/api/auth/passkey`);
        if (response.ok) {
          const data = await response.json();
          setHasPasskey(data.data?.hasPasskeys ?? false);
        } else {
          // If we can't check, assume they have one to avoid blocking
          setHasPasskey(true);
        }
      } catch {
        // If we can't check, assume they have one to avoid blocking
        setHasPasskey(true);
      } finally {
        setIsLoading(false);
      }
    }

    checkPasskeys();
  }, [isAuthenticated, requiresPasskey]);

  const handleRegisterPasskey = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a name for this passkey');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Get registration options
      const optionsResponse = await fetch(`${portalBase}/api/auth/passkey/register/options`, {
        method: 'POST',
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const { data: { options } } = await optionsResponse.json();

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Verify registration
      const verifyResponse = await fetch(`${portalBase}/api/auth/passkey/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: credential,
          deviceName: deviceName.trim(),
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Failed to register passkey');
      }

      // Success - update state
      setHasPasskey(true);
      setDeviceName('');
    } catch (err) {
      console.error('Passkey registration error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Registration was cancelled or not allowed');
        } else if (err.name === 'InvalidStateError') {
          setError('This passkey is already registered');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to register passkey');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSkipForNow = () => {
    // Allow skip but show a warning - this should be rare
    setHasPasskey(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Checking security settings...</p>
        </div>
      </div>
    );
  }

  // If passkey not required or already has one, render children
  if (!requiresPasskey || hasPasskey) {
    return <>{children}</>;
  }

  // Passkey setup required
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Set Up Your Passkey
          </h1>
          <p className="text-gray-600">
            For your security, admin access requires a passkey. 
            This replaces passwords with biometrics like Touch ID or Face ID.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Why passkeys?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Phishing-resistant - can't be stolen remotely</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No passwords to remember or leak</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Fast login with Touch ID, Face ID, or security key</span>
              </li>
            </ul>
          </div>

          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-2">
              Name this device
            </label>
            <input
              type="text"
              id="deviceName"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g., MacBook Pro, iPhone, YubiKey"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isRegistering}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleRegisterPasskey}
            disabled={isRegistering || !deviceName.trim()}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRegistering ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up passkey...
              </span>
            ) : (
              'Register Passkey'
            )}
          </button>

          <div className="text-center">
            <button
              onClick={handleSkipForNow}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Skip for now (not recommended)
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Having trouble? Run <code className="bg-gray-100 px-1 py-0.5 rounded">make recover-admin</code> on the server to generate a recovery link.
          </p>
        </div>
      </div>
    </div>
  );
}
