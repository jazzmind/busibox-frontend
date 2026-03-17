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

    if ('emailInboundEnabled' in body) updates.emailInboundEnabled = asBool(body.emailInboundEnabled);
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

    const restartMessage = 'Settings saved. Bridge picks up new config automatically (no restart needed).';

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
      config: maskBridgeConfig(saved),
      bridgeHealth,
      message: `Bridge settings updated successfully. ${restartMessage}`,
    });
  } catch (error) {
    console.error('[API] Update bridge settings error:', error);
    return apiError('Failed to update bridge settings', 500);
  }
}
