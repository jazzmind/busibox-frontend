/**
 * Identity Providers Admin Page
 * 
 * Configure external identity providers (Microsoft Entra ID, etc.)
 * for "Sign in with ..." on the login page.
 * 
 * Settings are stored in the authz service database and take effect immediately.
 */

'use client';

import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Shield, ExternalLink } from 'lucide-react';

interface IdpConfig {
  provider: string;
  enabled: boolean;
  client_id: string;
  tenant_id: string;
  has_client_secret: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export default function IdentityProvidersPage() {
  const [configs, setConfigs] = useState<IdpConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Microsoft form state
  const [msEnabled, setMsEnabled] = useState(false);
  const [msTenantId, setMsTenantId] = useState('');
  const [msClientId, setMsClientId] = useState('');
  const [msClientSecret, setMsClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/idp/config');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);

        const ms = (data.configs || []).find((c: IdpConfig) => c.provider === 'microsoft');
        if (ms) {
          setMsEnabled(ms.enabled);
          setMsTenantId(ms.tenant_id || '');
          setMsClientId(ms.client_id || '');
          setHasExistingSecret(ms.has_client_secret);
        }
      }
    } catch (error) {
      console.error('Failed to fetch IdP configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch('/api/idp/config/microsoft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: msEnabled,
          client_id: msClientId,
          client_secret: msClientSecret,
          tenant_id: msTenantId,
        }),
      });

      if (res.ok) {
        setSaveStatus('success');
        setIsDirty(false);
        setMsClientSecret('');
        // Refresh to get updated has_client_secret
        await fetchConfigs();
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Failed to save configuration');
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save IdP config:', error);
      setErrorMessage('Failed to save configuration');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const markDirty = () => {
    setIsDirty(true);
    setSaveStatus('idle');
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Identity Providers</h1>
          <p className="text-gray-600 mt-1">
            Configure external sign-in providers for your organization
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Microsoft Entra ID */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <svg viewBox="0 0 23 23" className="w-8 h-8">
                <path d="M0 0h11v11H0z" fill="#f25022"/>
                <path d="M12 0h11v11H12z" fill="#00a4ef"/>
                <path d="M0 12h11v11H0z" fill="#ffb900"/>
                <path d="M12 12h11v11H12z" fill="#7fba00"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Microsoft Entra ID</h2>
              <p className="text-sm text-gray-500">Azure Active Directory single sign-on</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={msEnabled}
              onChange={(e) => { setMsEnabled(e.target.checked); markDirty(); }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-700">
              {msEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        <p className="text-gray-600 mb-6 text-sm">
          Allow users to sign in with their Microsoft work account. Requires an App Registration in your Azure AD tenant.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tenant ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={msTenantId}
              onChange={(e) => { setMsTenantId(e.target.value); markDirty(); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Your Azure AD / Entra ID tenant GUID. Found in Azure Portal &gt; Entra ID &gt; Overview.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client ID (Application ID) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={msClientId}
              onChange={(e) => { setMsClientId(e.target.value); markDirty(); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Application (client) ID from your Azure App Registration.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret {!hasExistingSecret && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={msClientSecret}
                onChange={(e) => { setMsClientSecret(e.target.value); markDirty(); }}
                placeholder={hasExistingSecret ? '(secret is set — leave blank to keep current)' : 'Enter client secret'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Generated in Azure Portal &gt; App Registration &gt; Certificates & secrets.
              {hasExistingSecret && ' A secret is already configured.'}
            </p>
          </div>
        </div>

        {/* Setup instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">Setup Instructions</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Go to Azure Portal &gt; Entra ID &gt; App registrations &gt; New registration</li>
                <li>Set redirect URI to: <code className="bg-blue-100 px-1 rounded text-xs">https://ai.jaycashman.com/portal/api/auth/callback/microsoft</code></li>
                <li>Under API permissions, add: <code className="bg-blue-100 px-1 rounded text-xs">openid</code>, <code className="bg-blue-100 px-1 rounded text-xs">profile</code>, <code className="bg-blue-100 px-1 rounded text-xs">email</code>, <code className="bg-blue-100 px-1 rounded text-xs">User.Read</code></li>
                <li>Under Certificates & secrets, create a new client secret</li>
                <li>Copy the Tenant ID, Client ID, and Client Secret into the fields above</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> Changes take effect immediately. When enabled, a "Sign in with Microsoft" 
          button will appear on the login page. Users must have an email domain that matches your 
          allowed email domains configuration.
        </p>
      </div>
    </div>
  );
}
