import { NextRequest, NextResponse } from 'next/server';

import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getMergedLibraryApps } from '@jazzmind/busibox-app/lib/deploy/app-library';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const apps = await getMergedLibraryApps();
    return NextResponse.json({ success: true, apps });
  } catch (error) {
    console.error('[Admin Library Apps] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load library apps' },
      { status: 500 }
    );
  }
}

