/**
 * Bridge Configuration Store
 *
 * Persists Bridge channel/integration settings in deploy-api's config store.
 * These settings are applied to bridge runtime env via deploy-api config apply.
 */

import {
  getDeployApiToken,
  bulkSetConfigs,
  listConfigs,
  getConfigRaw,
  type ConfigSetRequest,
} from '../deploy/client';
import { maskValue } from './masking';

export { isMaskedValue } from './masking';

const CONFIG_CATEGORY = 'bridge';

export type BridgeConfig = {
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
};

const DEFAULT_CONFIG: BridgeConfig = {
  signalEnabled: false,
  signalPhoneNumber: null,
  allowedPhoneNumbers: null,

  telegramEnabled: false,
  telegramBotToken: null,
  telegramPollInterval: 1.0,
  telegramPollTimeout: 25,
  telegramAllowedChatIds: null,

  discordEnabled: false,
  discordBotToken: null,
  discordPollInterval: 2.0,
  discordChannelIds: null,

  whatsappEnabled: false,
  whatsappVerifyToken: null,
  whatsappAccessToken: null,
  whatsappPhoneNumberId: null,
  whatsappApiVersion: 'v22.0',
  whatsappAllowedPhoneNumbers: null,

  channelUserBindings: null,
  defaultAgentId: 'chat-agent',

  emailInboundEnabled: false,
  imapHost: null,
  imapPort: 993,
  imapUser: null,
  imapPassword: null,
  imapUseSsl: true,
  imapFolder: 'INBOX',
  emailInboundPollInterval: 30.0,
  emailAllowedSenders: null,
};

const FIELD_TO_KEY: Record<keyof BridgeConfig, string> = {
  signalEnabled: 'SIGNAL_ENABLED',
  signalPhoneNumber: 'SIGNAL_PHONE_NUMBER',
  allowedPhoneNumbers: 'ALLOWED_PHONE_NUMBERS',

  telegramEnabled: 'TELEGRAM_ENABLED',
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  telegramPollInterval: 'TELEGRAM_POLL_INTERVAL',
  telegramPollTimeout: 'TELEGRAM_POLL_TIMEOUT',
  telegramAllowedChatIds: 'TELEGRAM_ALLOWED_CHAT_IDS',

  discordEnabled: 'DISCORD_ENABLED',
  discordBotToken: 'DISCORD_BOT_TOKEN',
  discordPollInterval: 'DISCORD_POLL_INTERVAL',
  discordChannelIds: 'DISCORD_CHANNEL_IDS',

  whatsappEnabled: 'WHATSAPP_ENABLED',
  whatsappVerifyToken: 'WHATSAPP_VERIFY_TOKEN',
  whatsappAccessToken: 'WHATSAPP_ACCESS_TOKEN',
  whatsappPhoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID',
  whatsappApiVersion: 'WHATSAPP_API_VERSION',
  whatsappAllowedPhoneNumbers: 'WHATSAPP_ALLOWED_PHONE_NUMBERS',

  channelUserBindings: 'CHANNEL_USER_BINDINGS',
  defaultAgentId: 'DEFAULT_AGENT_ID',

  emailInboundEnabled: 'EMAIL_INBOUND_ENABLED',
  imapHost: 'IMAP_HOST',
  imapPort: 'IMAP_PORT',
  imapUser: 'IMAP_USER',
  imapPassword: 'IMAP_PASSWORD',
  imapUseSsl: 'IMAP_USE_SSL',
  imapFolder: 'IMAP_FOLDER',
  emailInboundPollInterval: 'EMAIL_INBOUND_POLL_INTERVAL',
  emailAllowedSenders: 'EMAIL_ALLOWED_SENDERS',
};

const KEY_TO_FIELD: Record<string, keyof BridgeConfig> = Object.fromEntries(
  Object.entries(FIELD_TO_KEY).map(([field, key]) => [key, field as keyof BridgeConfig]),
);

const ENCRYPTED_KEYS = new Set<string>([
  'TELEGRAM_BOT_TOKEN',
  'DISCORD_BOT_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_ACCESS_TOKEN',
  'IMAP_PASSWORD',
]);

const SENSITIVE_FIELDS: (keyof BridgeConfig)[] = [
  'telegramBotToken',
  'discordBotToken',
  'whatsappVerifyToken',
  'whatsappAccessToken',
  'imapPassword',
];

export function maskBridgeConfig(config: BridgeConfig): BridgeConfig {
  const out = { ...config };
  for (const field of SENSITIVE_FIELDS) {
    const val = out[field];
    if (typeof val === 'string') {
      (out as Record<string, unknown>)[field] = maskValue(val);
    }
  }
  return out;
}

export async function getBridgeConfigToken(userId: string, sessionJwt: string): Promise<string> {
  return getDeployApiToken(userId, sessionJwt);
}

export async function getBridgeConfigFromDeployApi(
  token: string,
  raw = false,
): Promise<BridgeConfig> {
  try {
    const listing = await listConfigs(token, CONFIG_CATEGORY);
    if (!listing.configs || listing.configs.length === 0) {
      return { ...DEFAULT_CONFIG };
    }

    const values: Record<string, string> = {};
    if (raw) {
      for (const cfg of listing.configs) {
        try {
          const rawResp = await getConfigRaw(token, cfg.key);
          values[rawResp.key] = rawResp.value;
        } catch {
          // Ignore deleted/failed keys
        }
      }
    } else {
      for (const cfg of listing.configs) {
        values[cfg.key] = cfg.value;
      }
    }

    return configValuesToBridgeConfig(values);
  } catch (error) {
    console.warn('[BRIDGE-CONFIG] Failed to read bridge config from deploy-api:', error);
    return { ...DEFAULT_CONFIG };
  }
}

function configValuesToBridgeConfig(values: Record<string, string>): BridgeConfig {
  const config = { ...DEFAULT_CONFIG };

  for (const [key, rawValue] of Object.entries(values)) {
    const field = KEY_TO_FIELD[key];
    if (!field) continue;

    if (rawValue === '********') {
      (config as Record<string, unknown>)[field] = '********';
      continue;
    }

    if (rawValue === '' && typeof DEFAULT_CONFIG[field] !== 'string') {
      continue;
    }

    switch (field) {
      case 'signalEnabled':
      case 'telegramEnabled':
      case 'discordEnabled':
      case 'whatsappEnabled':
      case 'emailInboundEnabled':
      case 'imapUseSsl':
        (config as Record<string, unknown>)[field] = rawValue === 'true';
        break;
      case 'telegramPollInterval':
      case 'discordPollInterval':
      case 'emailInboundPollInterval': {
        const n = Number.parseFloat(rawValue);
        if (Number.isFinite(n)) (config as Record<string, unknown>)[field] = n;
        break;
      }
      case 'telegramPollTimeout':
      case 'imapPort': {
        const n = Number.parseInt(rawValue, 10);
        if (Number.isFinite(n)) (config as Record<string, unknown>)[field] = n;
        break;
      }
      default:
        (config as Record<string, unknown>)[field] = rawValue || null;
    }
  }

  return config;
}

export async function saveBridgeConfigToDeployApi(
  token: string,
  updates: Partial<BridgeConfig>,
): Promise<BridgeConfig> {
  const configs: Record<string, ConfigSetRequest> = {};

  for (const [field, configKey] of Object.entries(FIELD_TO_KEY)) {
    const value = updates[field as keyof BridgeConfig];
    if (value === undefined) continue;

    const strValue = typeof value === 'boolean'
      ? String(value)
      : value === null
        ? ''
        : String(value);

    configs[configKey] = {
      value: strValue,
      encrypted: ENCRYPTED_KEYS.has(configKey),
      category: CONFIG_CATEGORY,
      description: `Bridge integration setting: ${field}`,
    };
  }

  if (Object.keys(configs).length === 0) {
    return getBridgeConfigFromDeployApi(token, true);
  }

  await bulkSetConfigs(token, { configs });
  return getBridgeConfigFromDeployApi(token, true);
}

export function getDefaultBridgeConfig(): BridgeConfig {
  return { ...DEFAULT_CONFIG };
}
