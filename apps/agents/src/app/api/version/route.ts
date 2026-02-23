import { NextResponse } from 'next/server';

/**
 * GET /api/version
 *
 * Shared shape expected by @jazzmind/busibox-app `VersionBar`.
 * This is intentionally lightweight for busibox-agents.
 */
export async function GET() {
  const version = process.env.NEXT_PUBLIC_VERSION || '';
  const branch = process.env.NEXT_PUBLIC_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
  const commit = process.env.NEXT_PUBLIC_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
  const shortCommit = commit !== 'unknown' ? commit.slice(0, 8) : 'unknown';

  return NextResponse.json({
    success: true,
    data: {
      type: version ? 'production' : 'development',
      branch,
      commit,
      shortCommit,
      deployed_at: null,
      deployed_by: 'busibox-agents',
    },
  });
}




