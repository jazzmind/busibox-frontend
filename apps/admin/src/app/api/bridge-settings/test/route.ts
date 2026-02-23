/**
 * POST /api/bridge-settings/test
 *
 * Connectivity tests for bridge integrations.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { getBridgeApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { createDelegationToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import {
  getBridgeConfigToken,
  getBridgeConfigFromDeployApi,
  isMaskedValue,
  type BridgeConfig,
} from '@jazzmind/busibox-app/lib/bridge/config';

type ConnectivityTarget = 'bridge' | 'agent-roundtrip' | 'telegram' | 'discord' | 'whatsapp' | 'all';

type ConnectivityResult = {
  target: Exclude<ConnectivityTarget, 'all'>;
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
};

function extractErrorMessage(payload: unknown, fallback = 'Unknown error'): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const p = payload as Record<string, unknown>;

  const detail = p.detail;
  if (typeof detail === 'string' && detail.trim().length > 0) return detail;

  const error = p.error;
  if (typeof error === 'string' && error.trim().length > 0) return error;

  const data = p.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.detail === 'string' && d.detail.trim().length > 0) return d.detail;
    if (typeof d.error === 'string' && d.error.trim().length > 0) return d.error;
    if (typeof d.message === 'string' && d.message.trim().length > 0) return d.message;
  }

  const message = p.message;
  if (typeof message === 'string' && message.trim().length > 0) return message;

  return fallback;
}

function pickConfigValue(
  incoming: Partial<BridgeConfig> | undefined,
  stored: BridgeConfig,
): BridgeConfig {
  if (!incoming) return stored;

  const merged: BridgeConfig = {
    ...stored,
    ...incoming,
  };

  const secretFields: (keyof BridgeConfig)[] = [
    'telegramBotToken',
    'discordBotToken',
    'whatsappVerifyToken',
    'whatsappAccessToken',
    'imapPassword',
  ];

  // Incoming config from UI can include masked placeholders (e.g. "****").
  // For connectivity tests, preserve stored raw secret when payload is masked.
  for (const field of secretFields) {
    if (isMaskedValue(incoming[field])) {
      (merged as Record<string, unknown>)[field] = stored[field];
    }
  }

  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const body = await parseJsonBody(request);
    if (!body || typeof body !== 'object') {
      return apiError('Invalid request body', 400);
    }

    const target = String(body.target || '').toLowerCase() as ConnectivityTarget;
    if (!['bridge', 'agent-roundtrip', 'telegram', 'discord', 'whatsapp', 'all'].includes(target)) {
      return apiError('Invalid test target', 400);
    }

    const token = await getBridgeConfigToken(user.id, sessionJwt);
    const stored = await getBridgeConfigFromDeployApi(token, true);
    const mergedConfig = pickConfigValue(body.config as Partial<BridgeConfig> | undefined, stored);

    const runSingleTest = async (
      singleTarget: Exclude<ConnectivityTarget, 'all'>,
    ): Promise<ConnectivityResult> => {
      if (singleTarget === 'bridge') {
        const bridgeUrl = getBridgeApiUrl();
        const resp = await fetch(`${bridgeUrl}/health`, { cache: 'no-store' });
        if (!resp.ok) {
          return {
            target: singleTarget,
            success: false,
            message: `Bridge health check failed (${resp.status})`,
          };
        }
        const health = await resp.json();
        return {
          target: singleTarget,
          success: true,
          message: 'Bridge API is reachable.',
          details: health,
        };
      }

      if (singleTarget === 'agent-roundtrip') {
        const bridgeUrl = getBridgeApiUrl();
        const delegation = await createDelegationToken({
          sessionJwt,
          name: `bridge-admin-roundtrip-${user.id}`,
          scopes: ['agent.execute', 'chat.write', 'chat.read'],
          expiresInSeconds: 60 * 60,
        });
        const response = await fetch(`${bridgeUrl}/api/v1/test/agent-roundtrip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            message: 'ping',
            sender: 'bridge-admin-test',
            agent_id: mergedConfig.defaultAgentId || null,
            delegation_token: delegation.delegationToken,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) {
          const err = extractErrorMessage(payload, 'Unknown error');
          const guidance = err.includes('DELEGATION_TOKEN is not configured')
            ? ' Bridge DELEGATION_TOKEN is missing; configure bridge delegation token and redeploy bridge.'
            : '';
          return {
            target: singleTarget,
            success: false,
            message: `Agent roundtrip failed (${response.status}): ${err}${guidance}`,
          };
        }
        return {
          target: singleTarget,
          success: true,
          message: 'Bridge to Agent API roundtrip verified.',
          details: {
            latency_ms: payload?.latency_ms ?? null,
            response_preview: payload?.response_preview ?? null,
            conversation_id: payload?.conversation_id ?? null,
            message_id: payload?.message_id ?? null,
          },
        };
      }

      if (singleTarget === 'telegram') {
        const botToken = mergedConfig.telegramBotToken || '';
        if (!botToken) {
          return {
            target: singleTarget,
            success: false,
            message: 'Telegram bot token is required for connectivity test',
          };
        }
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { cache: 'no-store' });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload?.ok !== true) {
          return {
            target: singleTarget,
            success: false,
            message: `Telegram connectivity failed${resp.status ? ` (${resp.status})` : ''}`,
          };
        }
        return {
          target: singleTarget,
          success: true,
          message: 'Telegram Bot API connectivity verified.',
          details: {
            username: payload?.result?.username || null,
            bot_id: payload?.result?.id || null,
          },
        };
      }

      if (singleTarget === 'discord') {
        const botToken = mergedConfig.discordBotToken || '';
        if (!botToken) {
          return {
            target: singleTarget,
            success: false,
            message: 'Discord bot token is required for connectivity test',
          };
        }
        const resp = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${botToken}` },
          cache: 'no-store',
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = payload?.message ? `: ${payload.message}` : '';
          return {
            target: singleTarget,
            success: false,
            message: `Discord connectivity failed (${resp.status})${msg}`,
          };
        }
        return {
          target: singleTarget,
          success: true,
          message: 'Discord API connectivity verified.',
          details: {
            bot_id: payload?.id || null,
            username: payload?.username || null,
          },
        };
      }

      // singleTarget === 'whatsapp'
      const accessToken = mergedConfig.whatsappAccessToken || '';
      const phoneNumberId = mergedConfig.whatsappPhoneNumberId || '';
      const apiVersion = mergedConfig.whatsappApiVersion || 'v22.0';
      if (!accessToken) {
        return {
          target: singleTarget,
          success: false,
          message: 'WhatsApp access token is required for connectivity test',
        };
      }
      if (!phoneNumberId) {
        return {
          target: singleTarget,
          success: false,
          message: 'WhatsApp phone number ID is required for connectivity test',
        };
      }

      const resp = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=id,display_phone_number`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        },
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err = payload?.error?.message ? `: ${payload.error.message}` : '';
        return {
          target: singleTarget,
          success: false,
          message: `WhatsApp connectivity failed (${resp.status})${err}`,
        };
      }

      return {
        target: singleTarget,
        success: true,
        message: 'WhatsApp Cloud API connectivity verified.',
        details: {
          phone_number_id: payload?.id || phoneNumberId,
          display_phone_number: payload?.display_phone_number || null,
        },
      };
    };

    if (target === 'all') {
      const targets: Exclude<ConnectivityTarget, 'all'>[] = ['bridge', 'agent-roundtrip'];
      if (mergedConfig.telegramEnabled) targets.push('telegram');
      if (mergedConfig.discordEnabled) targets.push('discord');
      if (mergedConfig.whatsappEnabled) targets.push('whatsapp');

      const results: ConnectivityResult[] = [];
      for (const t of targets) {
        results.push(await runSingleTest(t));
      }

      const successCount = results.filter((r) => r.success).length;
      const total = results.length;

      return apiSuccess({
        target,
        success: successCount === total,
        message: `Connectivity checks completed: ${successCount}/${total} passed.`,
        results,
      });
    }

    const single = await runSingleTest(target);
    if (!single.success) {
      return apiError(single.message, 502);
    }

    return apiSuccess(single);
  } catch (error) {
    console.error('[API] Bridge connectivity test failed:', error);
    return apiError('Bridge connectivity test failed', 500);
  }
}
