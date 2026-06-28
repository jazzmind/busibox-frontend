import { describe, it, expect, afterEach } from 'vitest';
import { detectPlatform, getPlatformConfig } from '../../../src/platform/config';
import { withEnv } from '../helpers/env';

describe('detectPlatform', () => {
  afterEach(() => {
    // Clean up any env vars set during tests
    delete process.env.BUSIBOX_PLATFORM;
    delete process.env.AGENT_API_URL;
    delete process.env.DATA_API_URL;
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL;
  });

  it('returns explicit BUSIBOX_PLATFORM override', () => {
    withEnv({ BUSIBOX_PLATFORM: 'busibox' }, () => {
      expect(detectPlatform()).toBe('busibox');
    });
  });

  it('returns busibox when AGENT_API_URL is set', () => {
    withEnv({ AGENT_API_URL: 'http://localhost:8000' }, () => {
      expect(detectPlatform()).toBe('busibox');
    });
  });

  it('returns busibox when DATA_API_URL is set', () => {
    withEnv({ DATA_API_URL: 'http://localhost:8002' }, () => {
      expect(detectPlatform()).toBe('busibox');
    });
  });

  it('returns vercel when DATABASE_URL is set', () => {
    withEnv({ DATABASE_URL: 'postgresql://user:pass@host/db' }, () => {
      expect(detectPlatform()).toBe('vercel');
    });
  });

  it('returns vercel when VERCEL env var is set', () => {
    withEnv({ VERCEL: '1' }, () => {
      expect(detectPlatform()).toBe('vercel');
    });
  });

  it('defaults to vercel when no env vars are set', () => {
    // Remove all detection vars
    delete process.env.BUSIBOX_PLATFORM;
    delete process.env.AGENT_API_URL;
    delete process.env.DATA_API_URL;
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL;
    expect(detectPlatform()).toBe('vercel');
  });

  it('BUSIBOX_PLATFORM takes precedence over AGENT_API_URL', () => {
    withEnv({ BUSIBOX_PLATFORM: 'vercel', AGENT_API_URL: 'http://localhost:8000' }, () => {
      expect(detectPlatform()).toBe('vercel');
    });
  });

  it('busibox detection takes precedence over DATABASE_URL', () => {
    withEnv({ AGENT_API_URL: 'http://localhost:8000', DATABASE_URL: 'postgresql://...' }, () => {
      expect(detectPlatform()).toBe('busibox');
    });
  });
});

describe('getPlatformConfig', () => {
  afterEach(() => {
    delete process.env.BUSIBOX_PLATFORM;
    delete process.env.BUSIBOX_PLATFORM_AI;
    delete process.env.BUSIBOX_PLATFORM_DATA;
    delete process.env.BUSIBOX_PLATFORM_SEARCH;
    delete process.env.BUSIBOX_PLATFORM_STORAGE;
    delete process.env.BUSIBOX_PLATFORM_AUTH;
  });

  it('returns config with type matching detectPlatform()', () => {
    withEnv({ BUSIBOX_PLATFORM: 'busibox' }, () => {
      const config = getPlatformConfig();
      expect(config.type).toBe('busibox');
    });
  });

  it('returns no overrides when none are set', () => {
    withEnv({ BUSIBOX_PLATFORM: 'busibox' }, () => {
      const config = getPlatformConfig();
      expect(config.overrides).toBeUndefined();
    });
  });

  it('parses per-service overrides from env vars', () => {
    withEnv(
      {
        BUSIBOX_PLATFORM: 'busibox',
        BUSIBOX_PLATFORM_AI: 'vercel',
        BUSIBOX_PLATFORM_DATA: 'vercel',
      },
      () => {
        const config = getPlatformConfig();
        expect(config.overrides?.ai).toBe('vercel');
        expect(config.overrides?.data).toBe('vercel');
        expect(config.overrides?.search).toBeUndefined();
      },
    );
  });
});
