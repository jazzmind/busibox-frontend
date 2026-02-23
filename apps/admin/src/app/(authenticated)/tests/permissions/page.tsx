import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch } from '@jazzmind/busibox-app/lib/data/app-client';
import {
  buildServiceAuthorization,
  ensureTestRoles,
  getTestRoleNames,
  getUserRoles,
} from '@/app/api/tests/helpers';
import { TestPermissionsHarness } from '@/components/admin/TestPermissionsHarness';

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

async function fetchInitialDocs(authHeader: string, userId: string): Promise<DocStatus[]> {
  try {
    const response = await dataFetch(
      'Fetch initial test-doc status',
      '/test-docs/status',
      {
        headers: {
          Authorization: authHeader,
          'X-User-Id': userId,
        },
      }
    );
    const data = await response.json();
    if (data?.documents) {
      return data.documents;
    }
  } catch (error) {
    console.warn('[admin/tests/permissions] Unable to load initial doc status', error);
  }
  return [];
}

export default async function PermissionsTestPage() {
  const currentUser = await getCurrentUserWithSessionFromCookies();

  if (!currentUser) {
    redirect('/portal/login');
  }

  if (!currentUser.roles?.includes('Admin')) {
    redirect('/portal/home');
  }

  await ensureTestRoles();
  const roles = await getUserRoles(currentUser.id);
  // Use Zero Trust auth (session JWT required)
  const authHeader = await buildServiceAuthorization(currentUser.sessionJwt, {
    id: currentUser.id,
    email: currentUser.email,
  });

  const docs = await fetchInitialDocs(authHeader, currentUser.id);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin auth & RAG harness</h1>
        <p className="text-gray-600 mt-2">
          Toggle test roles, seed docs (text + visual embeddings), and validate access in one
          place. Uses the current environment (prod vs test) automatically.
        </p>
      </div>

      <TestPermissionsHarness
        initialRoles={roles}
        testRoles={getTestRoleNames()}
        initialDocs={docs}
      />
    </div>
  );
}










