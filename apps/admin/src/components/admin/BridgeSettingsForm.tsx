'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@jazzmind/busibox-app';
import { Eye, EyeOff, RefreshCw, PlugZap, HelpCircle, Radio, Check } from 'lucide-react';
import { useAutosave } from '@jazzmind/busibox-app';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';

export interface BridgeSettingsData {
  signalEnabled: boolean;
  signalPhoneNumber: string | null;
  allowedPhoneNumbers: string | null;

  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramPollInterval: number | null;
  telegramPollTimeout: number | null;
  telegramAllowedChatIds: string | null;

  discordEnabled: boolean;
  discordBotToken: string | null;
  discordPollInterval: number | null;
  discordChannelIds: string | null;

  whatsappEnabled: boolean;
  whatsappVerifyToken: string | null;
  whatsappAccessToken: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappApiVersion: string | null;
  whatsappAllowedPhoneNumbers: string | null;

  channelUserBindings: string | null;
  defaultAgentId: string | null;

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

type BridgeSection = 'status' | 'signal' | 'telegram' | 'discord' | 'whatsapp';

interface BridgeSettingsFormProps {
  settings: BridgeSettingsData;
  bridgeHealth: Record<string, unknown> | null;
  onSuccess?: () => void;
  section?: BridgeSection;
}

const BRIDGE_DOC_URL = '/portal/docs/administrator/administrators-10-bridge-api-integrations';
const CREDENTIAL_TO_ENABLE: Partial<Record<keyof BridgeSettingsData, keyof BridgeSettingsData>> = {
  signalPhoneNumber: 'signalEnabled',
  telegramBotToken: 'telegramEnabled',
  discordBotToken: 'discordEnabled',
  whatsappVerifyToken: 'whatsappEnabled',
  whatsappAccessToken: 'whatsappEnabled',
  imapPassword: 'emailInboundEnabled',
};

type ChannelTestTarget = 'bridge' | 'agent-roundtrip' | 'telegram' | 'discord' | 'whatsapp';
type ChannelTestResult = { success: boolean; message: string };
type ChannelTestResults = Partial<Record<ChannelTestTarget, ChannelTestResult>>;
type AgentOption = { id: string; name: string };

function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function isChatAgentName(name: string): boolean {
  const normalized = normalizeAgentName(name);
  return normalized === 'chat agent' || normalized.includes('chat agent');
}

export function BridgeSettingsForm({ settings, bridgeHealth, onSuccess, section }: BridgeSettingsFormProps) {
  const resolve = useCrossAppApiPath();
  type ConnectivitySummaryItem = {
    target: ChannelTestTarget;
    success: boolean;
    message: string;
  };

  const [formData, setFormData] = useState<BridgeSettingsData>(settings);
  const [liveBridgeHealth, setLiveBridgeHealth] = useState<Record<string, unknown> | null>(bridgeHealth);
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState<string | null>(null);
  const [channelTestResults, setChannelTestResults] = useState<ChannelTestResults>({});
  const [testSummary, setTestSummary] = useState<ConnectivitySummaryItem[] | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    setLiveBridgeHealth(bridgeHealth);
  }, [bridgeHealth]);

  useEffect(() => {
    const loadAgents = async () => {
      setLoadingAgents(true);
      try {
        const response = await fetch(resolve('agents', '/api/agents?limit=200'), { credentials: 'include' });
        if (!response.ok) return;
        const result = await response.json();
        const list = result.data?.agents ?? result.agents ?? [];
        if (!Array.isArray(list)) return;
        const mapped = list
          .map((agent: Record<string, unknown>) => {
            const id = String(agent.id ?? '').trim();
            const name = String(agent.name ?? agent.title ?? id).trim();
            if (!id) return null;
            return { id, name };
          })
          .filter((v: AgentOption | null): v is AgentOption => Boolean(v));
        setAgentOptions(mapped);
      } catch {
        // non-fatal
      } finally {
        setLoadingAgents(false);
      }
    };
    void loadAgents();
  }, []);

  useEffect(() => {
    if (agentOptions.length === 0) return;

    const currentId = (formData.defaultAgentId || '').trim();
    const currentExists = currentId.length > 0 && agentOptions.some((agent) => agent.id === currentId);
    const chatLike = agentOptions.find((agent) => isChatAgentName(agent.name))
      ?? agentOptions.find((agent) => agent.id.toLowerCase() === 'chat-agent');

    if (!currentExists || currentId === 'chat-agent') {
      const fallback = chatLike ?? agentOptions[0];
      if (fallback?.id && fallback.id !== currentId) {
        setFormData((prev) => ({ ...prev, defaultAgentId: fallback.id }));
      }
    }
  }, [agentOptions, formData.defaultAgentId]);

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Autosave via hook ─────────────────────────────────────────────────────
  const persistViaHook = useCallback(async (data: BridgeSettingsData) => {
    const response = await fetch('/api/bridge-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to save bridge settings');

    if (result.data?.config) {
      setFormData(result.data.config as BridgeSettingsData);
    }
    if (result.data?.bridgeHealth) {
      setLiveBridgeHealth(result.data.bridgeHealth as Record<string, unknown>);
    }
    return true;
  }, []);

  const { saving, error: autosaveError, lastSaved, markDirty, triggerSave, triggerBlurSave } =
    useAutosave(persistViaHook);

  const updateText = <K extends keyof BridgeSettingsData>(key: K, value: BridgeSettingsData[K]) => {
    setFormData((prev) => {
      const next: BridgeSettingsData = { ...prev, [key]: value };
      markDirty(next);
      return next;
    });
  };

  const updateImmediate = <K extends keyof BridgeSettingsData>(
    key: K, value: BridgeSettingsData[K], el?: HTMLElement | null,
  ) => {
    setFormData((prev) => {
      const next: BridgeSettingsData = { ...prev, [key]: value };
      const enableKey = CREDENTIAL_TO_ENABLE[key];
      if (enableKey && typeof value === 'string' && value.trim().length > 0) {
        if (enableKey === 'signalEnabled') next.signalEnabled = true;
        if (enableKey === 'telegramEnabled') next.telegramEnabled = true;
        if (enableKey === 'discordEnabled') next.discordEnabled = true;
        if (enableKey === 'whatsappEnabled') next.whatsappEnabled = true;
      }
      triggerSave(next, el);
      return next;
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    triggerBlurSave(e.target);
  };

  const handleBlurWithCredential = (key: keyof BridgeSettingsData, e: React.FocusEvent<HTMLInputElement>) => {
    const enableKey = CREDENTIAL_TO_ENABLE[key];
    if (enableKey) {
      setFormData((prev) => {
        const val = prev[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          const next = { ...prev };
          if (enableKey === 'signalEnabled') next.signalEnabled = true;
          if (enableKey === 'telegramEnabled') next.telegramEnabled = true;
          if (enableKey === 'discordEnabled') next.discordEnabled = true;
          if (enableKey === 'whatsappEnabled') next.whatsappEnabled = true;
          markDirty(next);
          triggerBlurSave(e.target);
          return next;
        }
        triggerBlurSave(e.target);
        return prev;
      });
    } else {
      triggerBlurSave(e.target);
    }
  };

  // ── Direct persist for agent change (immediate, not via hook) ─────────────
  const handleDefaultAgentChange = async (value: string | null, el?: HTMLElement | null) => {
    const next = { ...formData, defaultAgentId: value || null };
    setFormData(next);
    triggerSave(next, el);
  };

  const resetForm = () => {
    setFormData(settings);
    setLiveBridgeHealth(bridgeHealth);
    setErrorMsg(null);
    setSuccessMsg(null);
    setChannelTestResults({});
    setTestSummary(null);
  };

  // ── Connectivity tests ────────────────────────────────────────────────────
  const runConnectivityTest = async (target: ChannelTestTarget) => {
    setTesting(target);
    setErrorMsg(null);
    setSuccessMsg(null);
    setTestSummary(null);
    try {
      const response = await fetch('/api/bridge-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, config: formData }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data.error || `Connectivity test failed for ${target}`;
        setChannelTestResults((prev) => ({
          ...prev,
          [target]: { success: false, message },
        }));
        throw new Error(message);
      }
      setChannelTestResults((prev) => ({
        ...prev,
        [target]: {
          success: true,
          message: data.data?.message || `Connectivity verified for ${target}`,
        },
      }));
    } catch (err: any) {
      setErrorMsg(err.message || `Connectivity test failed for ${target}`);
    } finally {
      setTesting(null);
    }
  };

  const runAllEnabledConnectivityTests = async () => {
    setTesting('all');
    setErrorMsg(null);
    setSuccessMsg(null);
    setChannelTestResults({});
    setTestSummary(null);
    try {
      const response = await fetch('/api/bridge-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'all', config: formData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connectivity checks failed');

      const results = Array.isArray(data.data?.results) ? data.data.results : [];
      setTestSummary(results);
      const mapped: ChannelTestResults = {};
      for (const item of results) {
        if (item?.target) {
          mapped[item.target as ChannelTestTarget] = {
            success: Boolean(item.success),
            message: String(item.message || ''),
          };
        }
      }
      setChannelTestResults(mapped);
      setSuccessMsg(data.data?.message || 'Connectivity checks completed.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Connectivity checks failed');
    } finally {
      setTesting(null);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderHelp = (label: string) => (
    <a
      href={BRIDGE_DOC_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
      aria-label={`Open setup guide for ${label}`}
      title={`Open setup guide for ${label}`}
    >
      <HelpCircle className="w-3.5 h-3.5" />
      Help
    </a>
  );

  const isChannelActive = (key: 'signal' | 'telegram' | 'discord' | 'whatsapp' | 'email'): boolean => {
    const flagMap: Record<string, string> = {
      signal: 'signal_enabled',
      telegram: 'telegram_enabled',
      discord: 'discord_enabled',
      whatsapp: 'whatsapp_enabled',
    };
    if (key === 'email') return formData.emailInboundEnabled;
    const healthKey = flagMap[key];
    const fromHealth = liveBridgeHealth?.[healthKey];
    if (fromHealth !== undefined) return Boolean(fromHealth);
    if (key === 'signal') return formData.signalEnabled;
    if (key === 'telegram') return formData.telegramEnabled;
    if (key === 'discord') return formData.discordEnabled;
    if (key === 'whatsapp') return formData.whatsappEnabled;
    return false;
  };

  const channelFlags = [
    { key: 'signal_enabled', label: 'Signal', enabled: isChannelActive('signal') },
    { key: 'telegram_enabled', label: 'Telegram', enabled: isChannelActive('telegram') },
    { key: 'discord_enabled', label: 'Discord', enabled: isChannelActive('discord') },
    { key: 'whatsapp_enabled', label: 'WhatsApp', enabled: isChannelActive('whatsapp') },
  ];

  const isStoredValue = (value: string | null): boolean =>
    Boolean(value && (value.includes('****') || value.trim().length > 0));

  const renderStoredBadge = (field: keyof BridgeSettingsData) => {
    const value = formData[field];
    if (typeof value !== 'string' || !isStoredValue(value)) return null;
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
        configured
      </span>
    );
  };

  const renderInlineTest = (target: ChannelTestTarget) => {
    const result = channelTestResults[target];
    if (!result) return null;
    return (
      <div
        className={`rounded px-3 py-2 text-xs ${
          result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}
      >
        {result.message}
      </div>
    );
  };

  const agentOptionsById = new Map<string, AgentOption>();
  for (const option of agentOptions) {
    if (!option.id) continue;
    if (!agentOptionsById.has(option.id)) {
      agentOptionsById.set(option.id, option);
    }
  }
  const visibleAgentOptions = Array.from(agentOptionsById.values());
  const selectedDefaultAgentId = visibleAgentOptions.some((agent) => agent.id === (formData.defaultAgentId || '').trim())
    ? (formData.defaultAgentId || '').trim()
    : (visibleAgentOptions[0]?.id || '');

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  const show = (s: BridgeSection) => !section || section === s;

  const error = autosaveError || errorMsg;
  const success = successMsg;

  return (
    <div className="space-y-8">
      {show('status') && <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Bridge Runtime Status</p>
            <p className="text-xs text-gray-600 mt-1">
              Current health flags reported by bridge-api.
            </p>
          </div>
          <a
            href={BRIDGE_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <HelpCircle className="w-4 h-4" />
            Open setup guide
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {channelFlags.map((flag) => (
            <span
              key={flag.key}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                flag.enabled
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {flag.label}: {flag.enabled ? 'enabled' : 'disabled'}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Agent</label>
            <select
              value={selectedDefaultAgentId}
              onChange={(e) => void handleDefaultAgentChange(e.target.value || null, e.target)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              disabled={loadingAgents || saving}
            >
              {visibleAgentOptions.length === 0 ? (
                <option value="">No agents available</option>
              ) : null}
              {visibleAgentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {isChatAgentName(agent.name) ? 'Chat Agent' : agent.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Inbound channel messages route to this agent by default. Changes autosave.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => runConnectivityTest('bridge')}
              disabled={testing !== null || saving}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {testing === 'bridge' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              Test Bridge API
            </button>
            <button
              type="button"
              onClick={() => runConnectivityTest('agent-roundtrip')}
              disabled={testing !== null || saving}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {testing === 'agent-roundtrip' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              Test Agent Roundtrip
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {renderInlineTest('bridge')}
          {renderInlineTest('agent-roundtrip')}
        </div>
      </div>}

      {show('signal') && <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Signal</h3>
            <StatusBadge active={isChannelActive('signal')} />
          </div>
          <div className="flex items-center gap-2">{renderHelp('Signal')}</div>
        </div>
        <div className="flex items-start">
          <input
            id="signalEnabled"
            type="checkbox"
            checked={formData.signalEnabled}
            onChange={(e) => updateImmediate('signalEnabled', e.target.checked, e.target)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="signalEnabled" className="ml-3 text-sm text-gray-700">
            Enable Signal channel
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signal Phone Number</label>
            <input
              type="text"
              value={formData.signalPhoneNumber || ''}
              onChange={(e) => updateText('signalPhoneNumber', e.target.value || null)}
              onBlur={(e) => handleBlurWithCredential('signalPhoneNumber', e)}
              placeholder="+15551234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Phone Numbers</label>
            <input
              type="text"
              value={formData.allowedPhoneNumbers || ''}
              onChange={(e) => updateText('allowedPhoneNumbers', e.target.value || null)}
              onBlur={handleBlur}
              placeholder="+15550000001,+15550000002"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>}

      {show('telegram') && <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Telegram</h3>
            <StatusBadge active={isChannelActive('telegram')} />
          </div>
          <div className="flex items-center gap-2">
            {renderHelp('Telegram')}
            <button
              type="button"
              onClick={() => runConnectivityTest('telegram')}
              disabled={testing !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
            >
              {testing === 'telegram' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
              Test
            </button>
          </div>
        </div>
        <div className="flex items-start">
          <input
            id="telegramEnabled"
            type="checkbox"
            checked={formData.telegramEnabled}
            onChange={(e) => updateImmediate('telegramEnabled', e.target.checked, e.target)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="telegramEnabled" className="ml-3 text-sm text-gray-700">
            Enable Telegram channel
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telegram Bot Token{renderStoredBadge('telegramBotToken')}
          </label>
          <div className="relative">
            <input
              type={showSecrets.has('telegramBotToken') ? 'text' : 'password'}
              value={formData.telegramBotToken || ''}
              onChange={(e) => updateText('telegramBotToken', e.target.value || null)}
              onBlur={(e) => handleBlurWithCredential('telegramBotToken', e)}
              placeholder="123456:ABC..."
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
            />
            <button
              type="button"
              onClick={() => toggleSecret('telegramBotToken')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showSecrets.has('telegramBotToken') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Interval (seconds)</label>
            <input
              type="number"
              step="0.1"
              value={formData.telegramPollInterval ?? ''}
              onChange={(e) => updateText('telegramPollInterval', e.target.value ? Number.parseFloat(e.target.value) : null)}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Timeout (seconds)</label>
            <input
              type="number"
              value={formData.telegramPollTimeout ?? ''}
              onChange={(e) => updateText('telegramPollTimeout', e.target.value ? Number.parseInt(e.target.value, 10) : null)}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Chat IDs</label>
            <input
              type="text"
              value={formData.telegramAllowedChatIds || ''}
              onChange={(e) => updateText('telegramAllowedChatIds', e.target.value || null)}
              onBlur={handleBlur}
              placeholder="1234,5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        {renderInlineTest('telegram')}
      </div>}

      {show('discord') && <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Discord</h3>
            <StatusBadge active={isChannelActive('discord')} />
          </div>
          <div className="flex items-center gap-2">
            {renderHelp('Discord')}
            <button
              type="button"
              onClick={() => runConnectivityTest('discord')}
              disabled={testing !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
            >
              {testing === 'discord' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
              Test
            </button>
          </div>
        </div>
        <div className="flex items-start">
          <input
            id="discordEnabled"
            type="checkbox"
            checked={formData.discordEnabled}
            onChange={(e) => updateImmediate('discordEnabled', e.target.checked, e.target)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="discordEnabled" className="ml-3 text-sm text-gray-700">
            Enable Discord channel
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discord Bot Token{renderStoredBadge('discordBotToken')}
          </label>
          <div className="relative">
            <input
              type={showSecrets.has('discordBotToken') ? 'text' : 'password'}
              value={formData.discordBotToken || ''}
              onChange={(e) => updateText('discordBotToken', e.target.value || null)}
              onBlur={(e) => handleBlurWithCredential('discordBotToken', e)}
              placeholder="Bot token"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
            />
            <button
              type="button"
              onClick={() => toggleSecret('discordBotToken')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showSecrets.has('discordBotToken') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Interval (seconds)</label>
            <input
              type="number"
              step="0.1"
              value={formData.discordPollInterval ?? ''}
              onChange={(e) => updateText('discordPollInterval', e.target.value ? Number.parseFloat(e.target.value) : null)}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel IDs</label>
            <input
              type="text"
              value={formData.discordChannelIds || ''}
              onChange={(e) => updateText('discordChannelIds', e.target.value || null)}
              onBlur={handleBlur}
              placeholder="1234567890,0987654321"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        {renderInlineTest('discord')}
      </div>}

      {show('whatsapp') && <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">WhatsApp Cloud API</h3>
            <StatusBadge active={isChannelActive('whatsapp')} />
          </div>
          <div className="flex items-center gap-2">
            {renderHelp('WhatsApp')}
            <button
              type="button"
              onClick={() => runConnectivityTest('whatsapp')}
              disabled={testing !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-60"
            >
              {testing === 'whatsapp' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
              Test
            </button>
          </div>
        </div>
        <div className="flex items-start">
          <input
            id="whatsappEnabled"
            type="checkbox"
            checked={formData.whatsappEnabled}
            onChange={(e) => updateImmediate('whatsappEnabled', e.target.checked, e.target)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="whatsappEnabled" className="ml-3 text-sm text-gray-700">
            Enable WhatsApp channel
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verify Token{renderStoredBadge('whatsappVerifyToken')}
              </label>
            <div className="relative">
              <input
                type={showSecrets.has('whatsappVerifyToken') ? 'text' : 'password'}
                value={formData.whatsappVerifyToken || ''}
                onChange={(e) => updateText('whatsappVerifyToken', e.target.value || null)}
                onBlur={(e) => handleBlurWithCredential('whatsappVerifyToken', e)}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => toggleSecret('whatsappVerifyToken')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showSecrets.has('whatsappVerifyToken') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token{renderStoredBadge('whatsappAccessToken')}
              </label>
            <div className="relative">
              <input
                type={showSecrets.has('whatsappAccessToken') ? 'text' : 'password'}
                value={formData.whatsappAccessToken || ''}
                onChange={(e) => updateText('whatsappAccessToken', e.target.value || null)}
                onBlur={(e) => handleBlurWithCredential('whatsappAccessToken', e)}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => toggleSecret('whatsappAccessToken')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showSecrets.has('whatsappAccessToken') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
            <input
              type="text"
              value={formData.whatsappPhoneNumberId || ''}
              onChange={(e) => updateText('whatsappPhoneNumberId', e.target.value || null)}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Version</label>
            <input
              type="text"
              value={formData.whatsappApiVersion || ''}
              onChange={(e) => updateText('whatsappApiVersion', e.target.value || null)}
              onBlur={handleBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Phone Numbers</label>
            <input
              type="text"
              value={formData.whatsappAllowedPhoneNumbers || ''}
              onChange={(e) => updateText('whatsappAllowedPhoneNumbers', e.target.value || null)}
              onBlur={handleBlur}
              placeholder="15550000001,15550000002"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        {renderInlineTest('whatsapp')}
      </div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}
      {testSummary && (
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <p className="text-sm font-medium text-gray-800 mb-3">Connectivity Summary</p>
          <div className="space-y-2">
            {testSummary.map((item) => (
              <div
                key={item.target}
                className={`rounded px-3 py-2 text-sm ${
                  item.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                <span className="font-medium capitalize">{item.target}</span>
                <span className="ml-2">{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAllEnabledConnectivityTests}
            disabled={testing !== null || saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {testing === 'all' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            {testing === 'all' ? 'Testing all enabled...' : 'Test All Enabled Channels'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          {saving && <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>}
          {!saving && lastSaved && <><Check className="w-3 h-3 text-green-500" /> Saved</>}
        </div>
      </div>
    </div>
  );
}
