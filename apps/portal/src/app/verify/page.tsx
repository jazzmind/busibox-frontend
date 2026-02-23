/**
 * Magic Link / TOTP Code Verification Page
 * 
 * Verifies the magic link token from email OR allows entering a 6-digit code.
 * Supports multi-device login flow.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error' | 'resending'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const verifyingRef = useRef(false);
  const autoResendRef = useRef(false);
  
  // Code entry form state
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const emailParam = searchParams.get('email');

    // Pre-fill email if provided
    if (emailParam) {
      setEmail(emailParam);
    }

    if (token) {
      // If we have a token, start verification
      setStatus('verifying');

      // Prevent double verification
      if (verifyingRef.current) {
        return;
      }

      verifyingRef.current = true;
      verifyToken(token);
    } else {
      // No token - show code entry form
      setStatus('idle');
    }
  }, [searchParams]);

  const resendEmail = async (emailToResend: string) => {
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToResend }),
      });
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Resend error:', error);
      return false;
    }
  };

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/verify-magic-link?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        setStatus('success');
        // Small delay to ensure cookie is set before redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      } else {
        const isExpired = data.error?.toLowerCase().includes('expired') || 
                         data.error?.toLowerCase().includes('invalid');
        
        // Auto-resend if expired and we have an email
        if (isExpired && email && !autoResendRef.current) {
          autoResendRef.current = true;
          setStatus('resending');
          
          const resent = await resendEmail(email);
          if (resent) {
            setStatus('idle');
            setErrorMessage('');
            setCodeError('Link expired. We\'ve sent you a new code. Please check your email.');
          } else {
            setStatus('error');
            setErrorMessage('Link expired. Please request a new one.');
          }
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Verification failed');
        }
        verifyingRef.current = false;
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setErrorMessage('An unexpected error occurred');
      verifyingRef.current = false;
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeLoading(true);
    setCodeError('');

    try {
      const response = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        // Small delay to ensure cookie is set before redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      } else {
        const isExpired = data.error?.toLowerCase().includes('expired') || 
                         data.error?.toLowerCase().includes('invalid');
        
        // Auto-resend if expired
        if (isExpired && email && !autoResendRef.current) {
          autoResendRef.current = true;
          setCodeLoading(false);
          setStatus('resending');
          
          const resent = await resendEmail(email);
          if (resent) {
            setStatus('idle');
            setCode('');
            setCodeError('Code expired. We\'ve sent you a new one. Please check your email.');
          } else {
            setCodeError('Code expired. Please request a new one.');
          }
        } else {
          setCodeError(data.error || 'Invalid code. Please try again.');
        }
      }
    } catch (error) {
      console.error('Code verification error:', error);
      setCodeError('An unexpected error occurred');
    } finally {
      setCodeLoading(false);
    }
  };

  // Handle code input - only allow digits, auto-format
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setCodeError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Verifying Magic Link */}
          {status === 'verifying' && (
            <div className="text-center">
              <svg
                className="animate-spin h-16 w-16 text-blue-600 mx-auto mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying...</h2>
              <p className="text-gray-600">Please wait while we verify your sign-in link.</p>
            </div>
          )}

          {/* Resending Email */}
          {status === 'resending' && (
            <div className="text-center">
              <svg
                className="animate-spin h-16 w-16 text-blue-600 mx-auto mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sending new code...</h2>
              <p className="text-gray-600">Your previous code expired. We're sending you a fresh one.</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-600">You're now signed in. Redirecting to dashboard...</p>
            </div>
          )}

          {/* Error from magic link verification */}
          {status === 'error' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h2>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              
              <div className="border-t pt-6 mt-4">
                <p className="text-sm text-gray-500 mb-4">Enter your code instead:</p>
                <form onSubmit={verifyCode} className="space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="6-digit code"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                    required
                  />
                  {codeError && <p className="text-red-600 text-sm">{codeError}</p>}
                  <button
                    type="submit"
                    disabled={codeLoading || code.length !== 6}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {codeLoading ? 'Verifying...' : 'Verify Code'}
                  </button>
                </form>
              </div>
              
              <Link
                href="/login"
                className="inline-block mt-6 text-blue-600 hover:text-blue-700 text-sm"
              >
                Request New Link & Code
              </Link>
            </div>
          )}

          {/* Idle - Code Entry Form (no token in URL) */}
          {status === 'idle' && (
            <>
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <svg className="w-16 h-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Code</h2>
                <p className="text-gray-600">
                  Enter your email and the 6-digit code from your email.
                </p>
              </div>

              <form onSubmit={verifyCode} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    autoComplete="email"
                  />
                </div>
                
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                    6-digit code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                  />
                </div>

                {codeError && (
                  <p className="text-red-600 text-sm text-center">{codeError}</p>
                )}

                <button
                  type="submit"
                  disabled={codeLoading || code.length !== 6 || !email}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {codeLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  Need a new code? Request one here
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
