/**
 * Email Settings Form Component
 *
 * Renders SMTP, Resend, and IMAP inbound email configuration with autosave.
 * Outbound (SMTP/Resend) saves to /api/email-settings.
 * Inbound (IMAP) saves to /api/bridge-settings.
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Send, RefreshCw, Check } from 'lucide-react';

export interface EmailSettingsData {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
  emailFrom: string | null;
  resendApiKey: string | null;
}

export interface ImapSettingsData {
  emailInboundEnabled: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapPassword: string | null;
  imapUseSsl: boolean;
  imapFolder: string | null;
  emailInboundPollInterval: number | null;
  emailAllowedSenders: string | null;
}

interface EmailSettingsFormProps {
  settings: EmailSettingsData;
  activeProvider: string;
  imapSettings?: ImapSettingsData | null;
  onSuccess?: () => void;
}

const AUTOSAVE_DELAY = 800;

export function EmailSettingsForm({ settings, activeProvider, imapSettings, onSuccess }: EmailSettingsFormProps) {
  const [formData, setFormData] = useState<EmailSettingsData>({ ...settings });
  const [imapData, setImapData] = useState<ImapSettingsData>(imapSettings ?? {
    emailInboundEnabled: false,
    imapHost: null,
    imapPort: null,
    imapUser: null,
    imapPassword: null,
    imapUseSsl: true,
    imapFolder: null,
    emailInboundPollInterval: null,
    emailAllowedSenders: null,
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
      if (imapTimer.current) clearTimeout(imapTimer.current);
    };
  }, []);

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Autosave: outbound email settings ────────────────────────────────────
  const saveEmail = useCallback(async (data: EmailSettingsData) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/email-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save email settings');
      setSuccess('Saved');
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [onSuccess]);

  const updateEmail = <K extends keyof EmailSettingsData>(key: K, value: EmailSettingsData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (emailTimer.current) clearTimeout(emailTimer.current);
      emailTimer.current = setTimeout(() => saveEmail(next), AUTOSAVE_DELAY);
      return next;
    });
  };

  // ── Autosave: IMAP inbound settings (via bridge-settings API) ────────────
  const saveImap = useCallback(async (data: ImapSettingsData) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/bridge-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save IMAP settings');
      setSuccess('Saved');
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [onSuccess]);

  const updateImap = <K extends keyof ImapSettingsData>(key: K, value: ImapSettingsData[K]) => {
    setImapData((prev) => {
      const next = { ...prev, [key]: value };
      if (imapTimer.current) clearTimeout(imapTimer.current);
      imapTimer.current = setTimeout(() => saveImap(next), AUTOSAVE_DELAY);
      return next;
    });
  };

  // ── Test email (still manual) ────────────────────────────────────────────
  const handleTestEmail = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test email');
      setSuccess(data.data?.message || 'Test email sent! Check your inbox.');
      setTimeout(() => setSuccess(null), 8000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const providerLabel: Record<string, string> = {
    smtp: 'SMTP',
    resend: 'Resend',
    none: 'Not configured',
    unknown: 'Unknown',
    unreachable: 'Bridge API unreachable',
  };

  return (
    <div className="space-y-8">
      {/* Active Provider Status */}
      <div className={`rounded-lg border p-4 ${
        activeProvider === 'none' || activeProvider === 'unreachable' || activeProvider === 'unknown'
          ? 'bg-amber-50 border-amber-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <p className={`text-sm font-medium ${
          activeProvider === 'none' || activeProvider === 'unreachable' || activeProvider === 'unknown'
            ? 'text-amber-800'
            : 'text-green-800'
        }`}>
          Active email provider: <strong>{providerLabel[activeProvider] || activeProvider}</strong>
        </p>
        {activeProvider === 'none' && (
          <p className="text-sm text-amber-700 mt-1">
            No email provider is configured. Magic link authentication will not work until SMTP or Resend is set up.
          </p>
        )}
        {activeProvider === 'unreachable' && (
          <p className="text-sm text-amber-700 mt-1">
            Bridge API is not reachable. The bridge service may not be running. Email sending will not work.
          </p>
        )}
      </div>

      {/* General Email Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">General</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="emailFrom" className="block text-sm font-medium text-gray-700 mb-1">
              From Address
            </label>
            <input
              id="emailFrom"
              type="text"
              value={formData.emailFrom || ''}
              onChange={(e) => updateEmail('emailFrom', e.target.value || null)}
              placeholder="Portal <noreply@example.com>"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The &quot;From&quot; address for all outbound emails. Format: <code>Name &lt;email@domain.com&gt;</code>
            </p>
          </div>
        </div>
      </div>

      {/* SMTP Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">SMTP Configuration</h3>
        <p className="text-sm text-gray-500 mb-4">
          Primary email delivery method. Configure your SMTP server for sending magic links and notifications.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input
                id="smtpHost"
                type="text"
                value={formData.smtpHost || ''}
                onChange={(e) => updateEmail('smtpHost', e.target.value || null)}
                placeholder="smtp.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input
                id="smtpPort"
                type="number"
                value={formData.smtpPort ?? ''}
                onChange={(e) => updateEmail('smtpPort', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="587"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Common ports: 587 (STARTTLS), 465 (SSL), 25 (unencrypted)</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
              <input
                id="smtpUser"
                type="text"
                value={formData.smtpUser || ''}
                onChange={(e) => updateEmail('smtpUser', e.target.value || null)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
              <div className="relative">
                <input
                  id="smtpPassword"
                  type={showPasswords.has('smtpPassword') ? 'text' : 'password'}
                  value={formData.smtpPassword || ''}
                  onChange={(e) => updateEmail('smtpPassword', e.target.value || null)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('smtpPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.has('smtpPassword') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="smtpSecure"
                type="checkbox"
                checked={formData.smtpSecure}
                onChange={(e) => updateEmail('smtpSecure', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="smtpSecure" className="font-medium text-gray-900">Use SSL/TLS</label>
              <p className="text-sm text-gray-500 mt-1">Enable for port 465. Leave unchecked for STARTTLS on port 587.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resend Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Resend Configuration</h3>
        <p className="text-sm text-gray-500 mb-4">
          Fallback email delivery via Resend API. Used when SMTP is not configured or unavailable.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="resendApiKey" className="block text-sm font-medium text-gray-700 mb-1">Resend API Key</label>
            <div className="relative">
              <input
                id="resendApiKey"
                type={showPasswords.has('resendApiKey') ? 'text' : 'password'}
                value={formData.resendApiKey || ''}
                onChange={(e) => updateEmail('resendApiKey', e.target.value || null)}
                placeholder="re_xxxxxxxxxxxx"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('resendApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.has('resendApiKey') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a>
            </p>
          </div>
        </div>
      </div>

      {/* Inbound Email (IMAP) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Inbound Email (IMAP)</h3>
          <p className="text-sm text-gray-500">
            Configure IMAP polling for inbound email processing via the bridge service.
          </p>
        </div>
        <div className="flex items-start">
          <input
            id="emailInboundEnabled"
            type="checkbox"
            checked={imapData.emailInboundEnabled}
            onChange={(e) => updateImap('emailInboundEnabled', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="emailInboundEnabled" className="ml-3 text-sm text-gray-700">
            Enable inbound email polling
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Host</label>
            <input
              type="text"
              value={imapData.imapHost || ''}
              onChange={(e) => updateImap('imapHost', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Port</label>
            <input
              type="number"
              value={imapData.imapPort ?? ''}
              onChange={(e) => updateImap('imapPort', e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Folder</label>
            <input
              type="text"
              value={imapData.imapFolder || ''}
              onChange={(e) => updateImap('imapFolder', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP User</label>
            <input
              type="text"
              value={imapData.imapUser || ''}
              onChange={(e) => updateImap('imapUser', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Password</label>
            <div className="relative">
              <input
                type={showPasswords.has('imapPassword') ? 'text' : 'password'}
                value={imapData.imapPassword || ''}
                onChange={(e) => updateImap('imapPassword', e.target.value || null)}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('imapPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswords.has('imapPassword') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={imapData.imapUseSsl}
              onChange={(e) => updateImap('imapUseSsl', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Use SSL
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Interval (seconds)</label>
            <input
              type="number"
              step="0.1"
              value={imapData.emailInboundPollInterval ?? ''}
              onChange={(e) => updateImap('emailInboundPollInterval', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Senders</label>
            <input
              type="text"
              value={imapData.emailAllowedSenders || ''}
              onChange={(e) => updateImap('emailAllowedSenders', e.target.value || null)}
              placeholder="user@example.com,ops@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Status and Test */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleTestEmail}
          disabled={testing || saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {testing ? 'Sending...' : 'Send Test Email'}
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          {saving && <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>}
          {!saving && success && <><Check className="w-3 h-3 text-green-500" /> {success}</>}
        </div>
      </div>
    </div>
  );
}
