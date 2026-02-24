'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';
import { Button } from '@jazzmind/busibox-app';

type ChannelType = 'telegram' | 'discord' | 'signal' | 'whatsapp';

type ChannelBinding = {
  id: string;
  channel_type: string;
  external_id: string | null;
  verified_at: string | null;
  created_at?: string;
  updated_at?: string;
};

const CHANNEL_OPTIONS: { value: ChannelType; label: string; instruction: string }[] = [
  { value: 'telegram', label: 'Telegram', instruction: 'Send `/link <code>` to your Telegram bot.' },
  { value: 'discord', label: 'Discord', instruction: 'Send `/link <code>` in your configured Discord channel.' },
  { value: 'signal', label: 'Signal', instruction: 'Send `/link <code>` to your Signal bot number.' },
  { value: 'whatsapp', label: 'WhatsApp', instruction: 'Send `/link <code>` to your WhatsApp bot number.' },
];

export function ChannelLinkingSettings() {
  const resolve = useCrossAppApiPath();
  const [bindings, setBindings] = useState<ChannelBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [channelType, setChannelType] = useState<ChannelType>('telegram');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);

  const selectedInstruction = useMemo(
    () => CHANNEL_OPTIONS.find((c) => c.value === channelType)?.instruction || '',
    [channelType],
  );

  const loadBindings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(resolve('account', '/api/account/channel-bindings'), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load channel bindings');
      setBindings(Array.isArray(data.bindings) ? data.bindings : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load channel bindings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBindings();
  }, []);

  useEffect(() => {
    if (!linkCode) return;
    const interval = setInterval(() => {
      void loadBindings();
    }, 10000);
    return () => clearInterval(interval);
  }, [linkCode]);

  const initiateLink = async () => {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(resolve('account', '/api/account/channel-bindings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initiate linking');
      setLinkCode(data.linkCode || null);
      setLinkExpiresAt(data.linkExpiresAt || null);
      setMessage(`Link code generated for ${channelType}. ${selectedInstruction}`);
      await loadBindings();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate linking');
    } finally {
      setWorking(false);
    }
  };

  const unlinkBinding = async (id: string) => {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(resolve('account', `/api/account/channel-bindings/${id}`), {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to unlink channel');
      setMessage('Channel unlinked.');
      await loadBindings();
    } catch (err: any) {
      setError(err.message || 'Failed to unlink channel');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Connected Channels</h3>
        <p className="text-xs text-gray-500 mt-1">
          Link messaging channels to your account so bridge can respond on your behalf.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value as ChannelType)}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md bg-white"
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={initiateLink} disabled={working}>
              {working ? 'Generating...' : 'Generate Link Code'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-600">{selectedInstruction}</p>
        {linkCode && (
          <div className="rounded border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700">Use this code in your channel:</p>
            <p className="text-lg font-mono font-semibold text-blue-900 mt-1">{linkCode}</p>
            {linkExpiresAt ? (
              <p className="text-xs text-blue-700 mt-1">
                Expires at {new Date(linkExpiresAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading channel links...</p>
      ) : bindings.length === 0 ? (
        <div className="space-y-1">
          <p className="text-sm text-gray-500">No linked channels yet.</p>
          {linkCode ? (
            <p className="text-xs text-blue-700">
              Your pending link code is shown above. Send it in your selected channel to complete linking.
            </p>
          ) : (
            <p className="text-xs text-gray-500">Generate a link code above to start linking a channel.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {bindings.map((binding) => {
            const verified = Boolean(binding.verified_at);
            return (
              <div
                key={binding.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{binding.channel_type}</p>
                  <p className="text-xs text-gray-600">
                    {binding.external_id ? `External ID: ${binding.external_id}` : 'Pending verification'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      verified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {verified ? 'Linked' : 'Pending'}
                  </span>
                  <Button variant="secondary" onClick={() => unlinkBinding(binding.id)} disabled={working}>
                    Unlink
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
