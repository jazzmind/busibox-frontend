/**
 * usePasskey Hook
 * 
 * Client-side WebAuthn passkey operations using @simplewebauthn/browser.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';

interface Passkey {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface UsePasskeyReturn {
  // State
  isSupported: boolean;
  isPlatformAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  passkeys: Passkey[];
  hasPasskeys: boolean;

  // Actions
  registerPasskey: (deviceName?: string) => Promise<boolean>;
  authenticateWithPasskey: (email?: string) => Promise<boolean>;
  deletePasskey: (passkeyId: string) => Promise<boolean>;
  renamePasskey: (passkeyId: string, newName: string) => Promise<boolean>;
  loadPasskeys: () => Promise<void>;
  clearError: () => void;
}

export function usePasskey(): UsePasskeyReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = browserSupportsWebAuthn();
      setIsSupported(supported);

      if (supported) {
        try {
          const platformAvailable = await platformAuthenticatorIsAvailable();
          setIsPlatformAvailable(platformAvailable);
        } catch {
          setIsPlatformAvailable(false);
        }
      }
    };

    checkSupport();
  }, []);

  // Load user's passkeys
  const loadPasskeys = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/passkey', {
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        // Map API response (passkey_id) to component format (id)
        const mappedPasskeys = data.data.passkeys.map((p: any) => ({
          id: p.passkey_id,
          name: p.name,
          deviceType: p.device_type,
          backedUp: p.backed_up,
          createdAt: p.created_at,
          lastUsedAt: p.last_used_at || null,
        }));
        setPasskeys(mappedPasskeys);
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err);
    }
  }, []);

  // Register a new passkey
  const registerPasskey = useCallback(async (deviceName = 'My Device'): Promise<boolean> => {
    if (!isSupported) {
      setError('WebAuthn is not supported in this browser');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get registration options from server
      const optionsResponse = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        credentials: 'include',
      });

      const optionsData = await optionsResponse.json();

      if (!optionsData.success) {
        throw new Error(optionsData.error || 'Failed to get registration options');
      }

      // Start WebAuthn registration ceremony
      const registrationResponse = await startRegistration({
        optionsJSON: optionsData.data.options,
      });

      // Verify with server
      const verifyResponse = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: registrationResponse,
          deviceName,
        }),
        credentials: 'include',
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || 'Failed to register passkey');
      }

      // Reload passkeys list
      await loadPasskeys();

      return true;
    } catch (err: any) {
      // Handle user cancellation
      if (err.name === 'NotAllowedError') {
        setError('Passkey registration was cancelled');
      } else {
        setError(err.message || 'Failed to register passkey');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, loadPasskeys]);

  // Authenticate with passkey
  const authenticateWithPasskey = useCallback(async (email?: string): Promise<boolean> => {
    if (!isSupported) {
      setError('WebAuthn is not supported in this browser');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get authentication options from server
      const optionsResponse = await fetch('/api/auth/passkey/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const optionsData = await optionsResponse.json();

      if (!optionsData.success) {
        throw new Error(optionsData.error || 'Failed to get authentication options');
      }

      // Start WebAuthn authentication ceremony
      const authResponse = await startAuthentication({
        optionsJSON: optionsData.data.options,
      });

      // Verify with server
      const verifyResponse = await fetch('/api/auth/passkey/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: authResponse,
        }),
        credentials: 'include',
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || 'Authentication failed');
      }

      return true;
    } catch (err: any) {
      // Handle user cancellation
      if (err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled');
      } else {
        setError(err.message || 'Authentication failed');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Delete a passkey
  const deletePasskey = useCallback(async (passkeyId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/passkey/${passkeyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete passkey');
      }

      // Reload passkeys list
      await loadPasskeys();

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete passkey');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadPasskeys]);

  // Rename a passkey
  const renamePasskey = useCallback(async (passkeyId: string, newName: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/passkey/${passkeyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to rename passkey');
      }

      // Reload passkeys list
      await loadPasskeys();

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to rename passkey');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadPasskeys]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isSupported,
    isPlatformAvailable,
    isLoading,
    error,
    passkeys,
    hasPasskeys: passkeys.length > 0,
    registerPasskey,
    authenticateWithPasskey,
    deletePasskey,
    renamePasskey,
    loadPasskeys,
    clearError,
  };
}










