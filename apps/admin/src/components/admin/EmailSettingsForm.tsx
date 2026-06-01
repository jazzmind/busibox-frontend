/**
 * Email Settings Form Component
 *
 * Renders SMTP, Resend, and IMAP inbound email configuration with autosave.
 * Outbound (SMTP/Resend) saves to /api/email-settings.
 * Inbound (IMAP) saves to /api/bridge-settings.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Send, RefreshCw, Check } from 'lucide-react';
import { useAutosave } from '@jazzmind/busibox-app';

export interface EmailSettingsData {
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
  resendEnabled: boolean;
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
  emailAgentId?: string | null;
}

interface EmailSettingsFormProps {
  settings: EmailSettingsData;
  activeProvider: string;
  imapSettings?: ImapSettingsData | null;
  onSuccess?: () => void;
}

export function EmailSettingsForm({ settings, activeProvider, imapSettings, onSuccess }: EmailSettingsFormProps) {
  const [formData, setFormData] = useState<EmailSettingsData>({
    smtpEnabled: settings.smtpEnabled ?? false,
    smtpHost: settings.smtpHost ?? null,
    smtpPort: settings.smtpPort ?? null,
    smtpUser: settings.smtpUser ?? null,
    smtpPassword: settings.smtpPassword ?? null,
    smtpSecure: settings.smtpSecure ?? false,
    resendEnabled: settings.resendEnabled ?? false,
    emailFrom: settings.emailFrom ?? null,
    resendApiKey: settings.resendApiKey ?? null,
  });
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

  // Re-sync when parent reloads settings (e.g. navigating back to this tab)
  useEffect(() => {
    setFormData({
      smtpEnabled: settings.smtpEnabled ?? false,
      smtpHost: settings.smtpHost ?? null,
      smtpPort: settings.smtpPort ?? null,
      smtpUser: settings.smtpUser ?? null,
      smtpPassword: settings.smtpPassword ?? null,
      smtpSecure: settings.smtpSecure ?? false,
      resendEnabled: settings.resendEnabled ?? false,
      emailFrom: settings.emailFrom ?? null,
      resendApiKey: settings.resendApiKey ?? null,
    });
  }, [settings]);

  useEffect(() => {
    if (!imapSettings) return;
    setImapData(imapSettings);
  }, [imapSettings]);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/agents?limit=200', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((result) => {
        if (!result) return;
        const raw = result.data;
        const list: unknown[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.agents) ? raw.agents : []);
        setAgentOptions(
          list
            .map((item: unknown) => {
              const a = item as Record<string, unknown>;
              const slug = String(a.name ?? '').trim();
              const display = String(a.display_name ?? a.name ?? slug).trim();
              return slug ? { id: slug, name: display } : null;
            })
            .filter((v): v is { id: string; name: string } => Boolean(v))
        );
      })
      .catch(() => {});
  }, []);

  // ── Inbox viewer ─────────────────────────────────────────────────────────
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<{ id: string; subject: string; from: string; date: string; seen: boolean }[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const loadInbox = async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const resp = await fetch('/api/bridge-settings/inbox?limit=20');
      const data = await resp.json();
      if (!resp.ok) {
        setInboxError(data?.error || 'Failed to load inbox');
        return;
      }
      setInboxMessages(data?.data?.messages ?? []);
    } catch {
      setInboxError('Failed to load inbox');
    } finally {
      setInboxLoading(false);
    }
  };

  const toggleInbox = () => {
    if (!inboxOpen && !inboxMessages) loadInbox();
    setInboxOpen((v) => !v);
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Email autosave ────────────────────────────────────────────────────────
  const saveEmailFn = useCallback(async (data: EmailSettingsData) => {
    const response = await fetch('/api/email-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to save email settings');
    return true;
  }, []);

  const email = useAutosave(saveEmailFn);

  const updateEmailText = <K extends keyof EmailSettingsData>(key: K, value: EmailSettingsData[K]) => {
    const next = { ...formData, [key]: value };
    setFormData(next);
    email.markDirty(next);
  };

  const updateEmailImmediate = <K extends keyof EmailSettingsData>(
    key: K, value: EmailSettingsData[K], el?: HTMLElement | null,
  ) => {
    const next = { ...formData, [key]: value };
    setFormData(next);
    email.triggerSave(next, el);
  };

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    email.triggerBlurSave(e.target);
  };

  // ── IMAP autosave ─────────────────────────────────────────────────────────
  const saveImapFn = useCallback(async (data: ImapSettingsData) => {
    const response = await fetch('/api/bridge-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to save IMAP settings');
    return true;
  }, []);

  const imap = useAutosave(saveImapFn);

  const updateImapText = <K extends keyof ImapSettingsData>(key: K, value: ImapSettingsData[K]) => {
    const next = { ...imapData, [key]: value };
    setImapData(next);
    imap.markDirty(next);
  };

  const updateImapImmediate = <K extends keyof ImapSettingsData>(
    key: K, value: ImapSettingsData[K], el?: HTMLElement | null,
  ) => {
    const next = { ...imapData, [key]: value };
    setImapData(next);
    imap.triggerSave(next, el);
  };

  const handleImapBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    imap.triggerBlurSave(e.target);
  };

  // ── Test IMAP connection ──────────────────────────────────────────────────
  const [imapTesting, setImapTesting] = useState(false);
  const [imapTestResult, setImapTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestImap = async () => {
    setImapTesting(true);
    setImapTestResult(null);
    try {
      const response = await fetch('/api/bridge-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'imap' }),
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error || data?.data?.message || 'IMAP connection failed';
        setImapTestResult({ ok: false, message: msg });
      } else {
        const msg = data?.data?.message || 'IMAP connection verified.';
        setImapTestResult({ ok: true, message: msg });
      }
      setTimeout(() => setImapTestResult(null), 10000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'IMAP test failed';
      setImapTestResult({ ok: false, message: msg });
    } finally {
      setImapTesting(false);
    }
  };

  // ── Send test to inbound (SMTP → IMAP address) ───────────────────────────
  const [sendToSelfTesting, setSendToSelfTesting] = useState(false);
  const [sendToSelfResult, setSendToSelfResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSendToSelf = async () => {
    setSendToSelfTesting(true);
    setSendToSelfResult(null);
    try {
      const bridgeResp = await fetch('/api/bridge-settings/inbox-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await bridgeResp.json();
      if (!bridgeResp.ok) {
        const msg = data?.error || data?.data?.message || 'Send failed';
        setSendToSelfResult({ ok: false, message: msg });
      } else {
        const msg = data?.data?.message || 'Test email sent to inbound address.';
        setSendToSelfResult({ ok: true, message: msg });
      }
      setTimeout(() => setSendToSelfResult(null), 10000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      setSendToSelfResult({ ok: false, message: msg });
    } finally {
      setSendToSelfTesting(false);
    }
  };

  // ── Test email (still manual) ─────────────────────────────────────────────
  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);
    email.setError(null);
    try {
      const response = await fetch('/api/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test email');
      setTestResult(data.data?.message || 'Test email sent! Check your inbox.');
      setTimeout(() => setTestResult(null), 8000);
    } catch (err: any) {
      email.setError(err.message);
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

  const saving = email.saving || imap.saving;
  const error = email.error || imap.error;
  const saved = email.lastSaved || imap.lastSaved;

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
              onChange={(e) => updateEmailText('emailFrom', e.target.value || null)}
              onBlur={handleEmailBlur}
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
          Configure SMTP credentials, then explicitly enable SMTP below.
        </p>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="smtpEnabled"
                type="checkbox"
                checked={formData.smtpEnabled}
                onChange={(e) => updateEmailImmediate('smtpEnabled', e.target.checked, e.target)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="smtpEnabled" className="font-medium text-gray-900">Enable SMTP Provider</label>
              <p className="text-sm text-gray-500 mt-1">When enabled and credentials are complete, Bridge will use SMTP.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input
                id="smtpHost"
                type="text"
                value={formData.smtpHost || ''}
                onChange={(e) => updateEmailText('smtpHost', e.target.value || null)}
                onBlur={handleEmailBlur}
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
                onChange={(e) => updateEmailText('smtpPort', e.target.value ? parseInt(e.target.value, 10) : null)}
                onBlur={handleEmailBlur}
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
                onChange={(e) => updateEmailText('smtpUser', e.target.value || null)}
                onBlur={handleEmailBlur}
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
                  onChange={(e) => updateEmailText('smtpPassword', e.target.value || null)}
                  onBlur={handleEmailBlur}
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
                onChange={(e) => updateEmailImmediate('smtpSecure', e.target.checked, e.target)}
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
          Configure Resend credentials, then explicitly enable Resend below.
        </p>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="resendEnabled"
                type="checkbox"
                checked={formData.resendEnabled}
                onChange={(e) => updateEmailImmediate('resendEnabled', e.target.checked, e.target)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="resendEnabled" className="font-medium text-gray-900">Enable Resend Provider</label>
              <p className="text-sm text-gray-500 mt-1">When enabled and API key is present, Bridge can use Resend.</p>
            </div>
          </div>
          <div>
            <label htmlFor="resendApiKey" className="block text-sm font-medium text-gray-700 mb-1">Resend API Key</label>
            <div className="relative">
              <input
                id="resendApiKey"
                type={showPasswords.has('resendApiKey') ? 'text' : 'password'}
                value={formData.resendApiKey || ''}
                onChange={(e) => updateEmailText('resendApiKey', e.target.value || null)}
                onBlur={handleEmailBlur}
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
            onChange={(e) => updateImapImmediate('emailInboundEnabled', e.target.checked, e.target)}
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
              onChange={(e) => updateImapText('imapHost', e.target.value || null)}
              onBlur={handleImapBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Port</label>
            <input
              type="number"
              value={imapData.imapPort ?? ''}
              onChange={(e) => updateImapText('imapPort', e.target.value ? parseInt(e.target.value, 10) : null)}
              onBlur={handleImapBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Folder</label>
            <input
              type="text"
              value={imapData.imapFolder || ''}
              onChange={(e) => updateImapText('imapFolder', e.target.value || null)}
              onBlur={handleImapBlur}
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
              onChange={(e) => updateImapText('imapUser', e.target.value || null)}
              onBlur={handleImapBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Password</label>
            <div className="relative">
              <input
                type={showPasswords.has('imapPassword') ? 'text' : 'password'}
                value={imapData.imapPassword || ''}
                onChange={(e) => updateImapText('imapPassword', e.target.value || null)}
                onBlur={handleImapBlur}
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
              onChange={(e) => updateImapImmediate('imapUseSsl', e.target.checked, e.target)}
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
              onChange={(e) => updateImapText('emailInboundPollInterval', e.target.value ? parseFloat(e.target.value) : null)}
              onBlur={handleImapBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Senders</label>
            <input
              type="text"
              value={imapData.emailAllowedSenders || ''}
              onChange={(e) => updateImapText('emailAllowedSenders', e.target.value || null)}
              onBlur={handleImapBlur}
              placeholder="user@example.com,ops@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Inbound Agent</label>
          <select
            value={imapData.emailAgentId || ''}
            onChange={(e) => {
              const next = { ...imapData, emailAgentId: e.target.value || null };
              setImapData(next);
              imap.triggerSave(next, e.target);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
          >
            <option value="">Use default agent</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Agent to handle inbound emails. Defaults to the global default agent.</p>
        </div>
        {/* IMAP test buttons */}
        <div className="pt-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestImap}
              disabled={imapTesting || saving || !imapData.emailInboundEnabled}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {imapTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {imapTesting ? 'Testing...' : 'Test IMAP Connection'}
            </button>
            <button
              type="button"
              onClick={handleSendToSelf}
              disabled={sendToSelfTesting || saving || !imapData.emailInboundEnabled}
              title="Send a test email via outbound SMTP to the IMAP inbound address to verify the full loop"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendToSelfTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sendToSelfTesting ? 'Sending...' : 'Send Test to Inbound'}
            </button>
          </div>
          {imapTestResult && (
            <div className={`rounded px-3 py-2 text-xs ${imapTestResult.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {imapTestResult.message}
            </div>
          )}
          {sendToSelfResult && (
            <div className={`rounded px-3 py-2 text-xs ${sendToSelfResult.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {sendToSelfResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Inbox Viewer */}
      {imapData.emailInboundEnabled && (
        <div className="bg-white rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={toggleInbox}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            <span>📬 Recent Inbound Messages</span>
            <span className="text-gray-400 text-xs">{inboxOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {inboxOpen && (
            <div className="border-t border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={loadInbox}
                  disabled={inboxLoading}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {inboxLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>
              {inboxError && (
                <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-2">{inboxError}</div>
              )}
              {inboxLoading && !inboxMessages && (
                <div className="text-xs text-gray-500 py-4 text-center">Loading inbox...</div>
              )}
              {inboxMessages && inboxMessages.length === 0 && (
                <div className="text-xs text-gray-500 py-4 text-center">No messages in inbox.</div>
              )}
              {inboxMessages && inboxMessages.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="pb-1 pr-3 font-medium">From</th>
                        <th className="pb-1 pr-3 font-medium">Subject</th>
                        <th className="pb-1 pr-3 font-medium whitespace-nowrap">Date</th>
                        <th className="pb-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inboxMessages.map((msg) => (
                        <tr key={msg.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 pr-3 max-w-[160px] truncate text-gray-700">{msg.from}</td>
                          <td className={`py-1.5 pr-3 max-w-[240px] truncate ${msg.seen ? 'text-gray-500' : 'font-medium text-gray-900'}`}>{msg.subject}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap text-gray-500">{msg.date ? new Date(msg.date).toLocaleString() : '—'}</td>
                          <td className="py-1.5">
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${msg.seen ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                              {msg.seen ? 'read' : 'unread'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
          {!saving && saved && <><Check className="w-3 h-3 text-green-500" /> Saved</>}
          {!saving && !saved && testResult && <><Check className="w-3 h-3 text-green-500" /> {testResult}</>}
        </div>
      </div>
    </div>
  );
}
