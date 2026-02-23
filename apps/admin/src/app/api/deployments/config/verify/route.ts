/**
 * Verify GitHub Repository Access
 * POST /api/deployments/config/verify - Verify repository access without creating config
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  verifyGitHubRepo,
} from '@jazzmind/busibox-app/lib/deploy/client';
import { handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;

  try {
    const body = await request.json();
    const { githubRepoOwner, githubRepoName } = body;

    if (!githubRepoOwner || !githubRepoName) {
      return NextResponse.json(
        { error: 'Repository owner and name are required' },
        { status: 400 }
      );
    }

    const token = await getDeployApiToken(user.id, sessionJwt);
    const result = await verifyGitHubRepo(token, githubRepoOwner, githubRepoName);

    if (result.verified) {
      return NextResponse.json({
        verified: true,
        repository: result.repository,
      });
    }

    return NextResponse.json(
      {
        error: 'Cannot access repository. Please check:',
        details: [
          'Repository exists',
          'Repository name is correct',
          'You have access permissions',
          'GitHub token has repo scope',
        ],
      },
      { status: 403 }
    );
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 400) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }
    if (err.status === 403) {
      return NextResponse.json(
        {
          error: 'Cannot access repository. Please check:',
          details: [
            'Repository exists',
            'Repository name is correct',
            'You have access permissions',
            'GitHub token has repo scope',
          ],
        },
        { status: 403 }
      );
    }
    return handleApiError(error, 'Failed to verify repository');
  }
}
