/**
 * GET  /api/bridge-settings  — Read persisted bridge integration config (masked)
 * PATCH /api/bridge-settings — Update bridge config (applied at runtime via config-api)
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getBridgeConfigToken,
  getBridgeConfigFromDeployApi,
  saveBridgeConfigToDeployApi,
  maskBridgeConfig,
  isMaskedValue,
  type BridgeConfig,
} from '@jazzmind/busibox-app/lib/bridge/config';
import { getBridgeApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

function buildBridgeReloadPayload(config: BridgeConfig): Record<string, string> {
  const payload: Record<string, string> = {};
  const add = (key: string, val: string | number | boolean | null | undefined) => {
    if (val !== null && val !== undefined) payload[key] = String(val);
  };
  add('SIGNAL_ENABLED', config.signalEnabled);
  add('SIGNAL_PHONE_NUMBER', config.signalPhoneNumber);
  add('ALLOWED_PHONE_NUMBERS', config.allowedPhoneNumbers);
  add('TELEGRAM_ENABLED', config.telegramEnabled);
  add('TELEGRAM_BOT_TOKEN', config.telegramBotToken);
  add('TELEGRAM_POLL_INTERVAL', config.telegramPollInterval);
  add('TELEGRAM_POLL_TIMEOUT', config.telegramPollTimeout);
  add('TELEGRAM_ALLOWED_CHAT_IDS', config.telegramAllowedChatIds);
  add('DISCORD_ENABLED', config.discordEnabled);
  add('DISCORD_BOT_TOKEN', config.discordBotToken);
  add('DISCORD_POLL_INTERVAL', config.discordPollInterval);
  add('DISCORD_CHANNEL_IDS', config.discordChannelIds);
  add('WHATSAPP_ENABLED', config.whatsappEnabled);
  add('WHATSAPP_VERIFY_TOKEN', config.whatsappVerifyToken);
  add('WHATSAPP_ACCESS_TOKEN', config.whatsappAccessToken);
  add('WHATSAPP_PHONE_NUMBER_ID', config.whatsappPhoneNumberId);
  add('WHATSAPP_API_VERSION', config.whatsappApiVersion);
  add('WHATSAPP_ALLOWED_PHONE_NUMBERS', config.whatsappAllowedPhoneNumbers);
  add('EMAIL_INBOUND_ENABLED', config.emailInboundEnabled);
  add('EMAIL_INBOUND_PROTOCOL', config.emailInboundProtocol);
  add('IMAP_HOST', config.imapHost);
  add('IMAP_PORT', config.imapPort);
  add('IMAP_USER', config.imapUser);
  add('IMAP_PASSWORD', config.imapPassword);
  add('IMAP_USE_SSL', config.imapUseSsl);
  add('IMAP_FOLDER', config.imapFolder);
  add('EMAIL_INBOUND_POLL_INTERVAL', config.emailInboundPollInterval);
  add('EMAIL_ALLOWED_SENDERS', config.emailAllowedSenders);
  add('DEFAULT_AGENT_ID', config.defaultAgentId);
  add('TELEGRAM_AGENT_ID', config.telegramAgentId);
  add('SIGNAL_AGENT_ID', config.signalAgentId);
  add('DISCORD_AGENT_ID', config.discordAgentId);
  add('WHATSAPP_AGENT_ID', config.whatsappAgentId);
  add('EMAIL_AGENT_ID', config.emailAgentId);
  return payload;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function asNullableFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const token = await getBridgeConfigToken(user.id, sessionJwt);
    // Read raw values first so empty encrypted secrets remain empty (not masked placeholders).
    // We then mask non-empty secrets for UI display.
    const config = await getBridgeConfigFromDeployApi(token, true);

    let bridgeHealth: Record<string, unknown> | null = null;
    try {
      const bridgeUrl = getBridgeApiUrl();
      const healthRes = await fetch(`${bridgeUrl}/health`, { cache: 'no-store' });
      if (healthRes.ok) {
        bridgeHealth = await healthRes.json();
      }
    } catch {
      bridgeHealth = null;
    }

    return apiSuccess({
      config: maskBridgeConfig(config),
      bridgeHealth,
    });
  } catch (error) {
    console.error('[API] Get bridge settings error:', error);
    return apiError('Failed to load bridge settings', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const body = await parseJsonBody(request);
    if (!body || typeof body !== 'object') {
      return apiError('Invalid request body', 400);
    }

    const updates: Partial<BridgeConfig> = {};

    if ('signalEnabled' in body) updates.signalEnabled = asBool(body.signalEnabled);
    if ('signalPhoneNumber' in body) updates.signalPhoneNumber = asNullableString(body.signalPhoneNumber);
    if ('allowedPhoneNumbers' in body) updates.allowedPhoneNumbers = asNullableString(body.allowedPhoneNumbers);

    if ('telegramEnabled' in body) updates.telegramEnabled = asBool(body.telegramEnabled);
    if ('telegramBotToken' in body && !isMaskedValue(body.telegramBotToken)) {
      updates.telegramBotToken = asNullableString(body.telegramBotToken);
    }
    if ('telegramPollInterval' in body) updates.telegramPollInterval = asNullableFloat(body.telegramPollInterval);
    if ('telegramPollTimeout' in body) updates.telegramPollTimeout = asNullableInt(body.telegramPollTimeout);
    if ('telegramAllowedChatIds' in body) updates.telegramAllowedChatIds = asNullableString(body.telegramAllowedChatIds);

    if ('discordEnabled' in body) updates.discordEnabled = asBool(body.discordEnabled);
    if ('discordBotToken' in body && !isMaskedValue(body.discordBotToken)) {
      updates.discordBotToken = asNullableString(body.discordBotToken);
    }
    if ('discordPollInterval' in body) updates.discordPollInterval = asNullableFloat(body.discordPollInterval);
    if ('discordChannelIds' in body) updates.discordChannelIds = asNullableString(body.discordChannelIds);

    if ('whatsappEnabled' in body) updates.whatsappEnabled = asBool(body.whatsappEnabled);
    if ('whatsappVerifyToken' in body && !isMaskedValue(body.whatsappVerifyToken)) {
      updates.whatsappVerifyToken = asNullableString(body.whatsappVerifyToken);
    }
    if ('whatsappAccessToken' in body && !isMaskedValue(body.whatsappAccessToken)) {
      updates.whatsappAccessToken = asNullableString(body.whatsappAccessToken);
    }
    if ('whatsappPhoneNumberId' in body) updates.whatsappPhoneNumberId = asNullableString(body.whatsappPhoneNumberId);
    if ('whatsappApiVersion' in body) updates.whatsappApiVersion = asNullableString(body.whatsappApiVersion);
    if ('whatsappAllowedPhoneNumbers' in body) updates.whatsappAllowedPhoneNumbers = asNullableString(body.whatsappAllowedPhoneNumbers);

    if ('channelUserBindings' in body) updates.channelUserBindings = asNullableString(body.channelUserBindings);
    if ('defaultAgentId' in body) updates.defaultAgentId = asNullableString(body.defaultAgentId);
    if ('telegramAgentId' in body) updates.telegramAgentId = asNullableString(body.telegramAgentId);
    if ('signalAgentId' in body) updates.signalAgentId = asNullableString(body.signalAgentId);
    if ('discordAgentId' in body) updates.discordAgentId = asNullableString(body.discordAgentId);
    if ('whatsappAgentId' in body) updates.whatsappAgentId = asNullableString(body.whatsappAgentId);
    if ('emailAgentId' in body) updates.emailAgentId = asNullableString(body.emailAgentId);

    if ('emailInboundEnabled' in body) updates.emailInboundEnabled = asBool(body.emailInboundEnabled);
    if ('emailInboundProtocol' in body) updates.emailInboundProtocol = asNullableString(body.emailInboundProtocol) as 'imap' | 'pop3' | null;
    if ('imapHost' in body) updates.imapHost = asNullableString(body.imapHost);
    if ('imapPort' in body) updates.imapPort = asNullableInt(body.imapPort);
    if ('imapUser' in body) updates.imapUser = asNullableString(body.imapUser);
    if ('imapPassword' in body && !isMaskedValue(body.imapPassword)) {
      updates.imapPassword = asNullableString(body.imapPassword);
    }
    if ('imapUseSsl' in body) updates.imapUseSsl = asBool(body.imapUseSsl);
    if ('imapFolder' in body) updates.imapFolder = asNullableString(body.imapFolder);
    if ('emailInboundPollInterval' in body) updates.emailInboundPollInterval = asNullableFloat(body.emailInboundPollInterval);
    if ('emailAllowedSenders' in body) updates.emailAllowedSenders = asNullableString(body.emailAllowedSenders);

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update', 400);
    }

    const token = await getBridgeConfigToken(user.id, sessionJwt);
    const saved = await saveBridgeConfigToDeployApi(token, updates);

    // Push the updated config to bridge so channel polling picks it up
    // within the next supervision cycle (no restart required).
    let reloadedLive = false;
    const bridgeUrl = getBridgeApiUrl();
    try {
      const reloadPayload = buildBridgeReloadPayload(saved);
      const reloadRes = await fetch(`${bridgeUrl}/api/v1/config/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reloadPayload),
      });
      reloadedLive = reloadRes.ok;
    } catch {
      // Bridge unreachable — settings are saved in config-api, will apply on next start
      reloadedLive = false;
    }

    let bridgeHealth: Record<string, unknown> | null = null;
    try {
      const healthRes = await fetch(`${bridgeUrl}/health`, { cache: 'no-store' });
      if (healthRes.ok) {
        bridgeHealth = await healthRes.json();
      }
    } catch {
      bridgeHealth = null;
    }

    const liveMessage = reloadedLive
      ? 'Settings saved and applied to bridge (changes take effect within 5 seconds).'
      : 'Settings saved. Bridge will pick them up on next restart.';

    return apiSuccess({
      config: maskBridgeConfig(saved),
      bridgeHealth,
      message: `Bridge settings updated successfully. ${liveMessage}`,
    });
  } catch (error) {
    console.error('[API] Update bridge settings error:', error);
    return apiError('Failed to update bridge settings', 500);
  }
}
