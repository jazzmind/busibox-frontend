/**
 * Passkey Enrollment Page Component
 * 
 * Full-page passkey setup for initial admin setup flow.
 * Checks for existing passkeys and allows authentication or registration.
 */

'use client';

import { useState, useEffect } from 'react';
import { usePasskey } from '@/hooks/usePasskey';

export type PasskeyEnrollmentPageProps = {
  userEmail: string;
  onComplete: () => void;
  onSkip?: () => void;
  allowSkip?: boolean;
};

export function PasskeyEnrollmentPage({ 
  userEmail, 
  onComplete, 
  onSkip,
  allowSkip = true,
}: PasskeyEnrollmentPageProps) {
  const {
    isSupported,
    isLoading: passkeyLoading,
    error: passkeyError,
    hasPasskeys,
    passkeys,
    registerPasskey,
    authenticateWithPasskey,
    loadPasskeys,
    clearError,
  } = usePasskey();

  const [deviceName, setDeviceName] = useState('');
  const [mode, setMode] = useState<'check' | 'auth' | 'register'>('check');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [passkeysChecked, setPasskeysChecked] = useState(false);

  // Check for existing passkeys on mount (only when we have a user email)
  useEffect(() => {
    if (mode !== 'check' || !userEmail || passkeysChecked) {
      return;
    }

    const checkPasskeys = async () => {
      await loadPasskeys();
      setPasskeysChecked(true);
    };

    checkPasskeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]); // Only run when userEmail changes

  // Set mode based on passkey availability (only after passkeys are loaded)
  useEffect(() => {
    if (mode === 'check' && passkeysChecked) {
      const newMode = hasPasskeys ? 'auth' : 'register';
      setMode(newMode);
    }
  }, [hasPasskeys, mode, passkeysChecked]);

  // Auto-detect device name for registration
  useEffect(() => {
    if (mode === 'register' && !deviceName) {
      const getDeviceName = () => {
        const ua = navigator.userAgent;
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('iPad')) return 'iPad';
        if (ua.includes('Mac')) return 'Mac';
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Android')) return 'Android Device';
        if (ua.includes('Linux')) return 'Linux Device';
        return 'My Device';
      };
      setDeviceName(getDeviceName());
    }
  }, [mode, deviceName]);

  const handleAuthenticate = async () => {
    setIsProcessing(true);
    setLocalError(null);
    clearError();

    const success = await authenticateWithPasskey(userEmail);
    
    setIsProcessing(false);

    if (success) {
      onComplete();
    } else {
      setLocalError(passkeyError || 'Failed to authenticate with passkey');
    }
  };

  const handleRegister = async () => {
    if (!deviceName.trim()) {
      setLocalError('Please enter a name for this passkey');
      return;
    }

    setIsProcessing(true);
    setLocalError(null);
    clearError();

    const success = await registerPasskey(deviceName.trim());
    
    setIsProcessing(false);

    if (success) {
      onComplete();
    } else {
      setLocalError(passkeyError || 'Failed to register passkey');
    }
  };

  const switchToRegister = () => {
    setMode('register');
    setLocalError(null);
    clearError();
  };

  const switchToAuth = () => {
    setMode('auth');
    setLocalError(null);
    clearError();
  };

  // Loading state
  if (mode === 'check') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-purple-50 p-4">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-orange-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Checking for existing passkeys...</p>
        </div>
      </div>
    );
  }

  // Device doesn't support passkeys
  if (!isSupported && onSkip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-purple-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Passkeys Not Supported
            </h1>
            <p className="text-gray-600">
              This browser or device does not support passkeys (WebAuthn). 
              You can set up a passkey later from a supported device.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Supported devices</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>- Chrome, Safari, Edge, or Firefox on macOS, Windows, or Android</li>
                <li>- iOS 16+ Safari</li>
                <li>- Hardware security keys (YubiKey, etc.)</li>
              </ul>
            </div>

            <button
              onClick={onSkip}
              className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 focus:ring-4 focus:ring-orange-200 transition-colors"
            >
              Continue Without Passkey
            </button>

            <p className="text-xs text-gray-500 text-center">
              You can add a passkey anytime from Account Settings on a supported device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const error = localError || passkeyError;

  // Authentication mode (has existing passkeys)
  if (mode === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-purple-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Passkey Found
            </h1>
            <p className="text-gray-600">
              Verify to continue
            </p>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleAuthenticate}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 focus:ring-4 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify'
              )}
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                If your passkey isn't working
              </p>
              <button
                onClick={switchToRegister}
                disabled={isProcessing}
                className="text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
              >
                Create New
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Your passkey is stored securely on this device and never leaves it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Registration mode
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-purple-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {hasPasskeys ? 'Add Another Passkey' : 'Set Up Your Passkey'}
          </h1>
          <p className="text-gray-600 mb-4">
            Welcome, <span className="font-medium">{userEmail}</span>
          </p>
          <p className="text-gray-600">
            For your security, admin access requires a passkey. 
            This replaces passwords with biometrics like Touch ID or Face ID.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="font-semibold text-orange-900 mb-2">Why passkeys?</h3>
            <ul className="text-sm text-orange-800 space-y-1">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Phishing-resistant - can't be stolen remotely</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No passwords to remember or leak</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deviceName.trim()) {
                  handleRegister();
                }
              }}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={isProcessing || !deviceName.trim()}
            className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 focus:ring-4 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
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

          {hasPasskeys && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
          )}

          {hasPasskeys && (
            <button
              onClick={switchToAuth}
              disabled={isProcessing}
              className="w-full text-sm text-gray-600 hover:text-gray-800 underline disabled:opacity-50"
            >
              Use existing passkey instead
            </button>
          )}

          {allowSkip && onSkip && (
            <div className="text-center">
              <button
                onClick={onSkip}
                disabled={isProcessing}
                className="text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
              >
                Skip for now
              </button>
              <p className="text-xs text-gray-400 mt-1">
                You can add a passkey later from Account Settings
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Your passkey is stored securely on this device and never leaves it.
          </p>
        </div>
      </div>
    </div>
  );
}
