/**
 * Data Settings Admin Page
 * 
 * Allows administrators to configure document data processing options.
 * Backed by data-api document storage (replaces Prisma DataSettings model).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { Button } from '@jazzmind/busibox-app';
import { DataSettingsForm } from '@/components/admin/DataSettingsForm';
import { getDataApiTokenForSettings, getDataSettings, getDefaultDataSettings } from '@jazzmind/busibox-app/lib/data/settings';

// With Cache Components enabled, routes are dynamic by default.

export default async function DataSettingsPage() {
  const currentUser = await getCurrentUserWithSessionFromCookies();
  
  if (!currentUser) {
    redirect('/portal/login');
  }

  if (!currentUser.roles?.includes('Admin')) {
    redirect('/portal/home');
  }

  // Get current settings from data-api store
  let settings;
  try {
    const { accessToken } = await getDataApiTokenForSettings(currentUser.id, currentUser.sessionJwt);
    settings = await getDataSettings(accessToken);
  } catch (error) {
    console.error('[DataSettingsPage] Error fetching data settings:', error);
    settings = getDefaultDataSettings();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Data Settings</h1>
              <p className="text-gray-600 mt-1">Configure document processing and data options</p>
            </div>
            
            <Link href="/">
              <Button variant="secondary">
                ← Back to Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">About Data Settings</h3>
          <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
            <li>
              <strong>Simple Flow:</strong> Always enabled - basic text extraction using standard libraries
            </li>
            <li>
              <strong>Marker:</strong> Enhanced PDF processing with better table and formula extraction
            </li>
            <li>
              <strong>ColPali:</strong> Visual embeddings for semantic image search (requires GPU)
            </li>
            <li>
              <strong>Multi-Flow:</strong> Run multiple strategies in parallel to compare results
            </li>
            <li>
              <strong>LLM Cleanup:</strong> Use AI to clean and normalize extracted text
            </li>
          </ul>
        </div>

        {/* Settings Form */}
        <DataSettingsForm settings={settings} />

        {/* Documentation Links */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Documentation</h3>
          <ul className="space-y-2">
            <li>
              <a
                href="/docs/guides/multi-flow-processing.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Multi-Flow Processing Guide →
              </a>
            </li>
            <li>
              <a
                href="/docs/guides/colpali-testing.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                ColPali Testing Guide →
              </a>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
