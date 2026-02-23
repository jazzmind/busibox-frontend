import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  ensureTestRoles,
  getUserRoles,
  getTestRoleNames,
  setUserTestRoles,
} from '../helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;
  await ensureTestRoles();
  const roles = await getUserRoles(user.id);

  return NextResponse.json({
    success: true,
    data: {
      roles,
      testRoles: getTestRoleNames(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const requestedRoles: string[] = Array.isArray(body?.roles) ? body.roles : [];

    const allowed = new Set(getTestRoleNames());
    const invalid = requestedRoles.filter((r) => !allowed.has(r));
    if (invalid.length) {
      return NextResponse.json(
        { success: false, error: `Invalid roles: ${invalid.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await setUserTestRoles(user.id, requestedRoles);

    return NextResponse.json({
      success: true,
      data: {
        roles: updated,
        testRoles: getTestRoleNames(),
      },
    });
  } catch (error: any) {
    console.error('[admin/tests/roles] Failed to set roles', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to set test roles' },
      { status: 500 }
    );
  }
}










