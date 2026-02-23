import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

interface RouteParams {
  params: Promise<{ bindingId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { bindingId } = await params;

    const response = await fetch(`${getAuthzBaseUrl()}/me/channel-bindings/${encodeURIComponent(bindingId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.sessionJwt}` },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || 'Failed to delete channel binding' },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    return handleApiError(error, 'Failed to delete channel binding');
  }
}
