/**
 * Passkey Enrollment Prompt
 * 
 * Shown after login if user doesn't have a passkey registered.
 * Allows quick passkey enrollment for faster future logins.
 */

'use client';

import { useState, useEffect } from 'react';
import { usePasskey } from '@/hooks/usePasskey';
import { Button } from '@jazzmind/busibox-app';

interface PasskeyEnrollmentPromptProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function PasskeyEnrollmentPrompt({ onComplete, onSkip }: PasskeyEnrollmentPromptProps) {
  const {
    isSupported,
    isPlatformAvailable,
    isLoading,
    error,
    passkeys,
    registerPasskey,
    loadPasskeys,
    clearError,
  } = usePasskey();

  const [show, setShow] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [success, setSuccess] = useState(false);

  // Load passkeys and determine if we should show the prompt
  useEffect(() => {
    const checkPasskeys = async () => {
      await loadPasskeys();
    };
    checkPasskeys();
  }, [loadPasskeys]);

  // Show prompt if supported and user has no passkeys
  useEffect(() => {
    if (isSupported && isPlatformAvailable && passkeys.length === 0) {
      // Small delay for better UX
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, isPlatformAvailable, passkeys.length]);

  // Generate default device name
  useEffect(() => {
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
  }, []);

  const handleEnroll = async () => {
    clearError();
    const success = await registerPasskey(deviceName || 'My Device');
    if (success) {
      setSuccess(true);
      setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, 2000);
    }
  };

  const handleSkip = () => {
    setShow(false);
    // Store in localStorage to not show again this session
    localStorage.setItem('passkey-prompt-skipped', Date.now().toString());
    onSkip?.();
  };

  // Check if user recently skipped
  useEffect(() => {
    const skipped = localStorage.getItem('passkey-prompt-skipped');
    if (skipped) {
      const skippedTime = parseInt(skipped, 10);
      // Don't show again within 24 hours
      if (Date.now() - skippedTime < 24 * 60 * 60 * 1000) {
        setShow(false);
      }
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {success ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Passkey Saved!</h2>
            <p className="text-gray-600">
              You can now sign in instantly using Face ID, Touch ID, or your device PIN.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Enable Faster Sign-in
              </h2>
              <p className="text-gray-600">
                Save a passkey to sign in instantly using Face ID, Touch ID, or your device PIN. 
                No more waiting for email codes!
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">
                Device name
              </label>
              <input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., MacBook Pro, iPhone"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={handleEnroll}
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Setting up...' : 'Set up passkey'}
              </Button>
              
              <Button
                variant="ghost"
                fullWidth
                onClick={handleSkip}
                disabled={isLoading}
              >
                Maybe later
              </Button>
            </div>

            <p className="mt-4 text-xs text-gray-500 text-center">
              Your passkey is stored securely on this device and can't be shared.
            </p>
          </>
        )}
      </div>
    </div>
  );
}




