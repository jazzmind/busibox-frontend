/**
 * Email Configuration Store
 *
 * Persists email provider settings (SMTP / Resend) in config-api's
 * config_entries table so admins can manage them from the UI.
 *
 * Bridge reads these settings on demand from config-api using a
 * scope-restricted token (config.email.read), so no restart is needed.
 *
 * Admin flow:
 *   Admin saves settings via UI  ->  PATCH /api/admin/email-settings
 *   -> bulk-set in config-api config store
 */

import {
  getConfigApiToken,
  bulkSetConfigs,
  listConfigs,
  getConfigRaw,
  type ConfigSetRequest,
  type ConfigValue,
} from '../config/client';
import { maskValue } from './masking';

export { isMaskedValue } from './masking';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Config-api config category for all email/SMTP settings. */
const CONFIG_CATEGORY = 'smtp';

/**
 * Mapping between our friendly EmailConfig field names and the
 * config-api config keys (which match the env var names bridge reads).
 */
const FIELD_TO_KEY: Record<keyof EmailConfig, string> = {
  smtpHost:     'SMTP_HOST',
  smtpPort:     'SMTP_PORT',
  smtpUser:     'SMTP_USER',
  smtpPassword: 'SMTP_PASSWORD',
  smtpSecure:   'SMTP_SECURE',
  emailFrom:    'EMAIL_FROM',
  resendApiKey: 'RESEND_API_KEY',
};

const KEY_TO_FIELD: Record<string, keyof EmailConfig> = Object.fromEntries(
  Object.entries(FIELD_TO_KEY).map(([f, k]) => [k, f as keyof EmailConfig]),
);

/** Fields whose values should be flagged as `encrypted` in config-api. */
const ENCRYPTED_KEYS = new Set<string>(['SMTP_PASSWORD', 'RESEND_API_KEY']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailConfig = {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
  emailFrom: string | null;
  resendApiKey: string | null;
};

const DEFAULT_CONFIG: EmailConfig = {
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPassword: null,
  smtpSecure: false,
  emailFrom: null,
  resendApiKey: null,
};

// ---------------------------------------------------------------------------
// Sensitive-field masking
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS: (keyof EmailConfig)[] = ['smtpPassword', 'resendApiKey'];

export function maskEmailConfig(config: EmailConfig): EmailConfig {
  const masked = { ...config };
  for (const key of SENSITIVE_KEYS) {
    const val = masked[key];
    if (typeof val === 'string') {
      (masked as any)[key] = maskValue(val);
    }
  }
  return masked;
}

// ---------------------------------------------------------------------------
// Config-API token helpers
// ---------------------------------------------------------------------------

/**
 * Get a config-api scoped token for an authenticated admin user.
 */
export async function getEmailConfigToken(
  userId: string,
  sessionJwt: string,
): Promise<string> {
  return getConfigApiToken(userId, sessionJwt);
}

// ---------------------------------------------------------------------------
// Public API — Read
// ---------------------------------------------------------------------------

/**
 * Read email config from config-api config store.
 *
 * @param token - config-api scoped JWT (from admin user)
 * @param raw   - if true, fetches raw (unmasked) values
 */
export async function getEmailConfigFromDeployApi(
  token: string,
  raw = false,
): Promise<EmailConfig> {
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
          // skip if key disappeared
        }
      }
    } else {
      for (const cfg of listing.configs) {
        values[cfg.key] = cfg.value;
      }
    }

    return configValuesToEmailConfig(values);
  } catch (error) {
    console.warn('[EMAIL-CONFIG] Failed to read from config-api:', error);
    return { ...DEFAULT_CONFIG };
  }
}

function configValuesToEmailConfig(values: Record<string, string>): EmailConfig {
  const config = { ...DEFAULT_CONFIG };

  for (const [key, value] of Object.entries(values)) {
    const field = KEY_TO_FIELD[key];
    if (!field || !value) continue;

    // Encrypted fields come back as '********' from the list endpoint.
    // Preserve them so the UI can show "password is set" via masking.
    if (value === '********') {
      (config as any)[field] = '********';
      continue;
    }

    switch (field) {
      case 'smtpPort': {
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n > 0) config.smtpPort = n;
        break;
      }
      case 'smtpSecure':
        config.smtpSecure = value === 'true';
        break;
      default:
        (config as any)[field] = value;
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Public API — Write
// ---------------------------------------------------------------------------

/**
 * Save email config to config-api config store (bulk upsert).
 *
 * @param token   - config-api scoped JWT (from admin user)
 * @param updates - partial EmailConfig to save
 */
export async function saveEmailConfigToDeployApi(
  token: string,
  updates: Partial<EmailConfig>,
): Promise<EmailConfig> {
  const configs: Record<string, ConfigSetRequest> = {};

  for (const [field, configKey] of Object.entries(FIELD_TO_KEY)) {
    const value = updates[field as keyof EmailConfig];
    if (value === undefined) continue;

    // Booleans must be stored as "true"/"false" (not empty string)
    // because bridge's Pydantic settings can't parse "" as a boolean.
    const strValue = typeof value === 'boolean'
      ? String(value)
      : value === null
        ? ''
        : String(value);

    configs[configKey] = {
      value: strValue,
      encrypted: ENCRYPTED_KEYS.has(configKey),
      category: CONFIG_CATEGORY,
      description: `Bridge email setting: ${field}`,
    };
  }

  if (Object.keys(configs).length === 0) {
    return getEmailConfigFromDeployApi(token, true);
  }

  await bulkSetConfigs(token, { configs });

  return getEmailConfigFromDeployApi(token, true);
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function getDefaultEmailConfig(): EmailConfig {
  return { ...DEFAULT_CONFIG };
}
