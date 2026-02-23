import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzBaseUrl, createDelegationToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getBridgeApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const DEFAULT_BRIDGE_SCOPES = ['agent.execute', 'chat.write', 'chat.read'];

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const response = await fetch(`${getAuthzBaseUrl()}/me/channel-bindings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.sessionJwt}` },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || 'Failed to fetch channel bindings' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      bindings: data.bindings || [],
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch channel bindings');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const channelType = String(body.channelType || '').trim().toLowerCase();
    if (!channelType) {
      return NextResponse.json({ success: false, error: 'channelType is required' }, { status: 400 });
    }

    const delegation = await createDelegationToken({
      sessionJwt: auth.sessionJwt,
      name: `bridge-link-${channelType}`,
      scopes: DEFAULT_BRIDGE_SCOPES,
      expiresInSeconds: 60 * 60 * 24 * 30,
    });

    const bridgeResponse = await fetch(`${getBridgeApiUrl()}/api/v1/link/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: auth.user.id,
        channel_type: channelType,
        delegation_token: delegation.delegationToken,
        delegation_token_jti: delegation.jti,
      }),
    });
    const bridgeData = await bridgeResponse.json().catch(() => ({}));
    if (!bridgeResponse.ok) {
      return NextResponse.json(
        { success: false, error: bridgeData.detail || bridgeData.error || 'Failed to initiate channel link' },
        { status: bridgeResponse.status },
      );
    }

    const bridgeObj = asObject(bridgeData);
    const nestedData = asObject(bridgeObj.data);
    const nestedBinding = asObject(bridgeObj.binding);
    const nestedDataBinding = asObject(nestedData.binding);

    const linkCode = pickFirstString(
      bridgeObj.link_code,
      bridgeObj.linkCode,
      nestedData.link_code,
      nestedData.linkCode,
      nestedBinding.link_code,
      nestedBinding.linkCode,
      nestedDataBinding.link_code,
      nestedDataBinding.linkCode,
    );
    const linkExpiresAt = pickFirstString(
      bridgeObj.link_expires_at,
      bridgeObj.linkExpiresAt,
      nestedData.link_expires_at,
      nestedData.linkExpiresAt,
      nestedBinding.link_expires_at,
      nestedBinding.linkExpiresAt,
      nestedDataBinding.link_expires_at,
      nestedDataBinding.linkExpiresAt,
    );

    if (!linkCode) {
      return NextResponse.json(
        { success: false, error: 'Failed to initiate channel link: bridge did not return a link code' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      channelType,
      linkCode,
      linkExpiresAt,
      delegationTokenJti: delegation.jti,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to initiate channel binding');
  }
}
