/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  getPublicConfig: vi.fn(),
  getConfigApiToken: vi.fn(),
  setConfig: vi.fn(),
}));

vi.mock('@jazzmind/busibox-app/lib/next/middleware', () => ({
  requireAdminAuth: mocks.requireAdminAuth,
  apiSuccess: (data: unknown, status = 200) => Response.json({ data }, { status }),
  apiError: (error: string, status = 500) => Response.json({ error }, { status }),
}));

vi.mock('@jazzmind/busibox-app/lib/config/client', () => ({
  getPublicConfig: mocks.getPublicConfig,
  getConfigApiToken: mocks.getConfigApiToken,
  setConfig: mocks.setConfig,
}));

import { GET, POST } from '../route';

describe('chat routing config API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({
      user: { id: 'admin-1' },
      sessionJwt: 'session-token',
    });
    mocks.getConfigApiToken.mockResolvedValue('config-token');
  });

  it('returns the persisted administrator policy', async () => {
    mocks.getPublicConfig.mockResolvedValue({ chat_model_routing_mode: 'frontier' });

    const response = await GET(new NextRequest('http://localhost/api/chat-routing-config'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { config: { mode: 'frontier' } } });
  });

  it('falls back safely when persisted configuration is invalid', async () => {
    mocks.getPublicConfig.mockResolvedValue({ chat_model_routing_mode: 'browser-value' });

    const response = await GET(new NextRequest('http://localhost/api/chat-routing-config'));

    await expect(response.json()).resolves.toEqual({ data: { config: { mode: 'local' } } });
  });

  it('persists a valid routing policy', async () => {
    const request = new NextRequest('http://localhost/api/chat-routing-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.setConfig).toHaveBeenCalledWith(
      'config-token',
      'chat_model_routing_mode',
      expect.objectContaining({ value: 'auto', category: 'chat', tier: 'public' }),
    );
  });

  it('rejects an invalid routing policy', async () => {
    const request = new NextRequest('http://localhost/api/chat-routing-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'gpt-from-browser' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.setConfig).not.toHaveBeenCalled();
  });
});
