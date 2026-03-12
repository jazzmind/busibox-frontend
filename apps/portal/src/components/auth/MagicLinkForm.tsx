/**
 * Magic Link Request Form
 * 
 * Allows users to request a magic link authentication email.
 * Uses portal customization for branding.
 * Supports passkey authentication if available.
 */

'use client';

import { useState, useEffect } from 'react';
import { Button, Input } from '@jazzmind/busibox-app';
import { useCustomization } from '@jazzmind/busibox-app';
import { usePasskey } from '@/hooks/usePasskey';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/portal';

export function MagicLinkForm() {
  const { customization } = useCustomization();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState(''); // Store email after submission
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // TOTP code entry state
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState('');
  
  // Microsoft IdP availability
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  
  // Passkey support
  const {
    isSupported: passkeySupported,
    isPlatformAvailable: passkeyAvailable,
    isLoading: passkeyLoading,
    error: passkeyError,
    authenticateWithPasskey,
    clearError: clearPasskeyError,
  } = usePasskey();
  
  const [showPasskeyOption, setShowPasskeyOption] = useState(false);
  const [autoPasskeyAttempted, setAutoPasskeyAttempted] = useState(false);
  
  // Check for Microsoft IdP availability and URL error params on mount
  useEffect(() => {
    // Check for error from Microsoft callback redirect
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) {
      const errorMessages: Record<string, string> = {
        microsoft_not_configured: 'Microsoft sign-in is not configured. Contact your administrator.',
        microsoft_error: 'Microsoft sign-in encountered an error.',
        microsoft_access_denied: 'Access was denied by Microsoft.',
        state_mismatch: 'Security check failed. Please try again.',
        domain_not_allowed: 'Your email domain is not allowed to sign in.',
        auth_failed: 'Authentication failed. Please try again.',
        token_exchange_failed: 'Failed to complete sign-in with Microsoft.',
        no_email: 'Could not retrieve your email from Microsoft. Check your Azure AD configuration.',
      };
      setError(errorMessages[urlError] || 'An error occurred during sign-in.');
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Check if Microsoft IdP is available
    fetch('/api/auth/idp/providers')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.providers?.some((p: { provider: string; enabled: boolean }) => p.provider === 'microsoft' && p.enabled)) {
          setMicrosoftEnabled(true);
        }
      })
      .catch(() => { /* Microsoft not available -- button stays hidden */ });
  }, []);

  // Check if passkey login is available on mount
  useEffect(() => {
    if (passkeySupported && passkeyAvailable) {
      setShowPasskeyOption(true);
      
      // Auto-trigger passkey auth if user hasn't dismissed it recently
      const dismissedUntil = localStorage.getItem('passkey-auto-dismissed');
      const now = Date.now();
      
      if (!autoPasskeyAttempted && (!dismissedUntil || now > parseInt(dismissedUntil))) {
        setAutoPasskeyAttempted(true);
        // Small delay to let the UI render
        setTimeout(() => {
          handlePasskeyLogin();
        }, 500);
      }
    }
  }, [passkeySupported, passkeyAvailable, autoPasskeyAttempted]);
  
  // Handle passkey login
  const handlePasskeyLogin = async () => {
    clearPasskeyError();
    const success = await authenticateWithPasskey();
    if (success) {
      // Redirect to home on success
      window.location.href = `${basePath}/home`;
    } else {
      // If auto-attempt failed, allow manual retry
      setAutoPasskeyAttempted(true);
    }
  };
  
  // Dismiss auto-passkey for 24 hours
  const dismissAutoPasskey = () => {
    const dismissUntil = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    localStorage.setItem('passkey-auto-dismissed', dismissUntil.toString());
    setAutoPasskeyAttempted(true);
  };

  // Handle TOTP code verification
  const verifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCodeLoading(true);
    setCodeError('');

    try {
      const response = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail, code: code.trim() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = `${basePath}/home`;
      } else {
        setCodeError(data.error || 'Invalid code. Please try again.');
      }
    } catch (error) {
      console.error('Code verification error:', error);
      setCodeError('An unexpected error occurred');
    } finally {
      setCodeLoading(false);
    }
  };

  // Handle code input - only allow digits
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setCodeError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        // Store submitted email before clearing form
        setSubmittedEmail(email);
        
        // Development mode: Auto-navigate to verify URL
        if (data.data?.devUrl) {
          console.log('[DEV] Auto-navigating to:', data.data.devUrl);
          window.location.href = data.data.devUrl;
          return;
        }
        
        setSuccess(true);
        setEmail(''); // Clear form
      } else {
        setError(data.error || 'Failed to send magic link');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Magic link error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            
            <p className="text-gray-700 mb-2">
              We've sent a sign-in link and code to:
            </p>
            <p className="text-sm font-medium text-gray-900 mb-4">
              {submittedEmail}
            </p>
          </div>

          {/* Option 1: Click magic link */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Click the link in your email
                </p>
                <p className="text-xs text-gray-600">
                  Opens automatically on this device
                </p>
              </div>
            </div>
          </div>

          {/* Option 2: Enter code */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Or enter your 6-digit code
                </p>
                <p className="text-xs text-gray-600">
                  Works on any device
                </p>
              </div>
            </div>

            <form onSubmit={verifyCode} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-2xl tracking-widest font-mono"
                maxLength={6}
                autoComplete="one-time-code"
              />
              
              {codeError && (
                <p className="text-sm text-red-600 text-center">{codeError}</p>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={codeLoading}
                disabled={codeLoading || code.length !== 6}
              >
                {codeLoading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </form>
          </div>

          <p className="text-xs text-center text-gray-500 mb-4">
            Both options expire in 15 minutes. Check your spam folder if you don't see the email.
          </p>
          
          <Button 
            variant="ghost" 
            fullWidth
            onClick={() => {
              setSuccess(false);
              setEmail(submittedEmail);
              setCode('');
              setCodeError('');
            }}
          >
            Request a new code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to {customization.companyName}
          </h1>
          <p className="text-gray-600">
            Sign in to access your account
          </p>
        </div>

        {/* Passkey Login Option */}
        {showPasskeyOption && (
          <>
            <div className="mb-6">
              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={handlePasskeyLogin}
                loading={passkeyLoading}
                disabled={passkeyLoading}
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {passkeyLoading ? 'Signing in...' : 'Sign in with Passkey'}
              </Button>
              
              {passkeyError && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-red-600 text-center">{passkeyError}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={dismissAutoPasskey}
                  >
                    Don't auto-prompt for 24 hours
                  </Button>
                </div>
              )}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign in with email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            label="Email address"
            required
            autoComplete="email"
            autoFocus={!showPasskeyOption}
            error={error}
          />

          <Button
            type="submit"
            variant={showPasskeyOption ? 'secondary' : 'primary'}
            fullWidth
            loading={loading}
            disabled={!email || loading}
          >
            {loading ? 'Sending...' : 'Send sign-in link & code'}
          </Button>

          {microsoftEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  window.location.href = '/api/auth/signin/microsoft';
                }}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23" fill="none">
                  <path d="M0 0h11v11H0z" fill="#f25022"/>
                  <path d="M12 0h11v11H12z" fill="#00a4ef"/>
                  <path d="M0 12h11v11H0z" fill="#ffb900"/>
                  <path d="M12 12h11v11H12z" fill="#7fba00"/>
                </svg>
                Sign in with Microsoft
              </Button>
            </>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-600">
              {showPasskeyOption 
                ? 'Use your passkey for instant sign-in, or request an email code.'
                : "You'll receive an email with a link and code to sign in."
              }
            </p>
          </div>
        </form>
      </div>

      <div className="mt-6 text-center text-sm text-gray-600">
        <p>
          Having trouble? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}

