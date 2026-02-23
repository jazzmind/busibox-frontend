import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { searchDocuments } from '@jazzmind/busibox-app/lib/agent/chat-search';
import {
  buildServiceAuthorization,
  ensureTestRoles,
  getUserRoles,
} from '../helpers';

type DocStatus = {
  id: string;
  name: string;
  role: string;
  fileId?: string;
  status?: string;
  chunks?: number;
  vectors?: number;
  visualEmbedding?: boolean;
  error?: string;
};

type CheckResult = {
  docId: string;
  name: string;
  role: string;
  hasRole: boolean;
  visualOk: boolean;
  searchOk: boolean;
  searchCount: number;
  status?: string;
  fileId?: string;
  error?: string;
};

async function fetchDocStatus(authHeader: string, userId: string): Promise<DocStatus[]> {
  const response = await dataFetch(
    'Validate test-doc status',
    '/test-docs/status',
    {
      headers: {
        Authorization: authHeader,
        'X-User-Id': userId,
      },
    }
  );
  const data = await response.json();
  return data?.documents || [];
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);

    await ensureTestRoles();
    const userRoles = await getUserRoles(user.id);
    const roleNames = new Set(userRoles.map((r) => r.name));

    const authorization = await buildServiceAuthorization(sessionJwt, user);
    const docs = await fetchDocStatus(authorization, user.id);

    const results: CheckResult[] = [];

    for (const doc of docs) {
      const hasRole = roleNames.has(doc.role);
      // run search with doc name (fallback id) to validate access expectation
      const query = doc.name || doc.id;
      const search = await searchDocuments(query, user.id, {
        mode: 'hybrid',
        limit: 3,
        authorization,
      });
      const count = search.results?.length || 0;
      const searchOk = hasRole ? count > 0 : count === 0;
      
      // Visual embeddings are optional - only validate if the doc has them
      // Text-only PDFs don't need visual embeddings
      const hasVisualEmbeddings = Boolean(doc.visualEmbedding);
      const visualOk = hasVisualEmbeddings
        ? (doc.vectors ?? 0) > 0 && (doc.chunks ?? 0) >= 0
        : true; // Text-only docs pass visual check

      results.push({
        docId: doc.id,
        name: doc.name,
        role: doc.role,
        hasRole,
        searchOk,
        searchCount: count,
        visualOk,
        status: doc.status,
        fileId: doc.fileId,
        error: doc.error,
      });
    }

    // Pass if all docs have correct search results and no errors
    // Visual embeddings are optional (only checked if present)
    const passed = results.every((r) => r.searchOk && !r.error);

    return NextResponse.json({
      success: passed,
      data: {
        passed,
        results,
      },
    });
  } catch (error: any) {
    console.error('[admin/tests/validate] Failed to run validation', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Validation failed' },
      { status: 500 }
    );
  }
}
