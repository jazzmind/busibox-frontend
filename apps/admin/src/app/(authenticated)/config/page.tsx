/**
 * System Configuration Page
 * 
 * Manage system configuration including:
 * - Email settings (SMTP, Resend)
 * - Domain configuration
 * - Security settings
 */

'use client';

import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface ConfigSection {
  id: string;
  title: string;
  description: string;
  fields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'number' | 'select' | 'boolean';
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: 'email',
    title: 'Email Configuration',
    description: 'Configure email delivery for magic links and notifications',
    fields: [
      { key: 'EMAIL_FROM', label: 'From Address', type: 'email', placeholder: 'noreply@example.com', required: true },
      { key: 'RESEND_API_KEY', label: 'Resend API Key', type: 'password', description: 'Get your API key from resend.com' },
      { key: 'SMTP_HOST', label: 'SMTP Host', type: 'text', placeholder: 'smtp.example.com' },
      { key: 'SMTP_PORT', label: 'SMTP Port', type: 'number', placeholder: '587' },
      { key: 'SMTP_USERNAME', label: 'SMTP Username', type: 'text' },
      { key: 'SMTP_PASSWORD', label: 'SMTP Password', type: 'password' },
    ],
  },
  {
    id: 'domain',
    title: 'Domain & URLs',
    description: 'Configure public URLs and domain settings',
    fields: [
      { key: 'APP_URL', label: 'Public URL', type: 'text', placeholder: 'https://ai.example.com/portal', required: true, description: 'Runtime URL used for passkeys and emails (include /portal if using base path)' },
      { key: 'ALLOWED_EMAIL_DOMAINS', label: 'Allowed Email Domains', type: 'text', placeholder: '* or example.com,company.org', description: 'Comma-separated list or * for all' },
    ],
  },
  {
    id: 'security',
    title: 'Security Settings',
    description: 'Authentication and authorization settings',
    fields: [
      { key: 'REQUIRE_PASSKEY_ADMIN', label: 'Require Passkey for Admins', type: 'boolean', description: 'Force admins to use passkeys instead of passwords' },
      { key: 'SESSION_EXPIRY_HOURS', label: 'Session Expiry (hours)', type: 'number', placeholder: '24' },
    ],
  },
];

export default function ConfigurationPage() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data?.config || {});
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
        setSaveStatus('success');
        setIsDirty(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderField = (field: ConfigField) => {
    const value = config[field.key] || '';
    const isPassword = field.type === 'password';
    const showPassword = showPasswords.has(field.key);

    if (field.type === 'boolean') {
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => handleChange(field.key, e.target.checked ? 'true' : 'false')}
            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-gray-700">{field.label}</span>
        </label>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <select
          value={value}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select...</option>
          {field.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    return (
      <div className="relative">
        <input
          type={isPassword && !showPassword ? 'password' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => handleChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => togglePasswordVisibility(field.key)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-900">Configuration</h1>
          <p className="text-gray-600 mt-1">
            Manage system settings and integrations
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

      <div className="space-y-8">
        {CONFIG_SECTIONS.map(section => (
          <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{section.title}</h2>
            <p className="text-gray-600 mb-6">{section.description}</p>

            <div className="space-y-4">
              {section.fields.map(field => (
                <div key={field.key}>
                  {field.type !== 'boolean' && (
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(field)}
                  {field.description && (
                    <p className="mt-1 text-sm text-gray-500">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Changes to environment variables may require a service restart to take effect.
          Some settings are stored in Ansible Vault for production deployments.
        </p>
      </div>
    </div>
  );
}
