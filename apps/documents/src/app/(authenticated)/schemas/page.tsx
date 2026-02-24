'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileJson } from 'lucide-react';
import { Button, Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { SchemaEditor } from '@jazzmind/busibox-app/components/documents/SchemaEditor';
import { ProtectedRoute } from '@jazzmind/busibox-app/components/auth/ProtectedRoute';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';

type SchemaDocument = {
  id: string;
  name: string;
  schema?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  visibility?: 'personal' | 'shared';
  updatedAt?: string | null;
};

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
  { href: '/portal/docs', label: 'Help' },
];

export default function SchemaManagerPage() {
  const router = useRouter();
  const session = useSession();
  const searchParams = useSearchParams();
  const fromFileName = searchParams.get('fromFileName');

  const [schemas, setSchemas] = useState<SchemaDocument[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [clonedDoc, setClonedDoc] = useState<SchemaDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchemas = async () => {
    setError(null);
    try {
      const response = await fetch('/api/data?type=extraction_schema&limit=100');
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to list extraction schemas');
      }
      const payload = await response.json();
      const docs = (payload.documents || []) as SchemaDocument[];
      setSchemas(docs);
      if (docs.length > 0 && !selectedSchemaId) {
        setSelectedSchemaId(docs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemas();
  }, []);

  const selectedSchema = useMemo(() => {
    if (clonedDoc) return clonedDoc;
    return schemas.find((item) => item.id === selectedSchemaId) || null;
  }, [schemas, selectedSchemaId, clonedDoc]);

  const handleSaved = async () => {
    setClonedDoc(null);
    await fetchSchemas();
  };

  const handleDeleted = async () => {
    setSelectedSchemaId(null);
    setClonedDoc(null);
    await fetchSchemas();
  };

  const handleClone = (doc: SchemaDocument) => {
    setSelectedSchemaId(null);
    setClonedDoc(doc);
  };

  return (
    <ProtectedRoute>
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        session={session}
        onLogout={async () => session.redirectToPortal()}
        appsLink="/portal/home"
        accountLink="/portal/account" 
        adminNavigation={adminNavigation}
      />
      <div className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Button>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h1 className="text-2xl font-bold text-gray-900">Extraction Schemas</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage schema definitions used by agent-based extraction pipelines.
          </p>
          {fromFileName && (
            <p className="mt-2 text-xs text-blue-700">
              Creating schema from document: <span className="font-medium">{fromFileName}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Available Schemas</h2>
              <Button
                size="sm"
                onClick={() => { setSelectedSchemaId(null); setClonedDoc(null); }}
              >
                New
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading schemas...</p>
            ) : schemas.length === 0 ? (
              <p className="text-sm text-gray-500">No extraction schemas yet.</p>
            ) : (
              <div className="space-y-1">
                {schemas.map((schema) => (
                  <button
                    key={schema.id}
                    onClick={() => { setSelectedSchemaId(schema.id); setClonedDoc(null); }}
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      selectedSchemaId === schema.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-gray-500" />
                      <span className="truncate text-sm font-medium text-gray-900">{schema.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {schema.updatedAt ? `Updated ${new Date(schema.updatedAt).toLocaleString()}` : 'No timestamp'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <SchemaEditor
              document={selectedSchema}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onClone={handleClone}
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
    </ProtectedRoute>
  );
}
