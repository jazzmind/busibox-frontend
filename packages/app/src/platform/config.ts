export type PlatformType = 'busibox' | 'vercel' | 'aws' | 'azure';

export interface PlatformConfig {
  type: PlatformType;
  /** Override specific adapters (e.g., use Busibox auth but Vercel AI) */
  overrides?: {
    ai?: PlatformType;
    data?: PlatformType;
    search?: PlatformType;
    storage?: PlatformType;
    auth?: PlatformType;
  };
  /** Platform-specific configuration passed to adapters */
  options?: Record<string, unknown>;
}

export function detectPlatform(): PlatformType {
  if (process.env.BUSIBOX_PLATFORM) {
    return process.env.BUSIBOX_PLATFORM as PlatformType;
  }
  if (process.env.AGENT_API_URL || process.env.DATA_API_URL) return 'busibox';
  if (process.env.DATABASE_URL || process.env.VERCEL) return 'vercel';
  return 'vercel';
}

export function getPlatformConfig(): PlatformConfig {
  return {
    type: detectPlatform(),
    overrides: parseOverrides(),
    options: {},
  };
}

function parseOverrides(): PlatformConfig['overrides'] {
  const overrides: PlatformConfig['overrides'] = {};
  if (process.env.BUSIBOX_PLATFORM_AI) overrides.ai = process.env.BUSIBOX_PLATFORM_AI as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_DATA) overrides.data = process.env.BUSIBOX_PLATFORM_DATA as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_SEARCH) overrides.search = process.env.BUSIBOX_PLATFORM_SEARCH as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_STORAGE) overrides.storage = process.env.BUSIBOX_PLATFORM_STORAGE as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_AUTH) overrides.auth = process.env.BUSIBOX_PLATFORM_AUTH as PlatformType;
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
