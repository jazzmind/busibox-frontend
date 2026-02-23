/**
 * Documentation Category Page
 * 
 * Shows documentation landing for a category (platform/administrator/apps/developer).
 * For the 'apps' category, docs are grouped by application.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { DocLayout } from '@/components/docs/DocLayout';
import { getDocsNavigation, getAppsDocsGroups, type DocCategory } from '@jazzmind/busibox-app/lib/docs/client';

interface Props {
  params: Promise<{ category: string }>;
}

const validCategories = ['platform', 'administrator', 'apps', 'developer'] as const;

// Backward compatibility: redirect old 'user' URLs to 'platform'
const categoryRedirects: Record<string, string> = {
  user: '/docs/platform',
};

function isValidCategory(category: string): category is DocCategory {
  return validCategories.includes(category as DocCategory);
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params;
  
  if (!isValidCategory(category)) {
    return { title: 'Not Found' };
  }

  const titles: Record<DocCategory, string> = {
    platform: 'Platform Guide',
    administrator: 'Administrator Documentation',
    apps: 'App Documentation',
    developer: 'Developer Documentation',
  };

  return {
    title: `${titles[category]} | Busibox Docs`,
    description: categoryInfo[category].description,
  };
}

const categoryInfo: Record<DocCategory, { title: string; description: string }> = {
  platform: {
    title: 'Platform Guide',
    description: 'Learn how to use Busibox applications, manage documents, and interact with AI agents.',
  },
  administrator: {
    title: 'Administrator Documentation',
    description: 'Operational guides for configuring, deploying, and managing Busibox services.',
  },
  apps: {
    title: 'App Documentation',
    description: 'Documentation provided by installed applications.',
  },
  developer: {
    title: 'Developer Documentation',
    description: 'Technical documentation for deploying, configuring, and extending the Busibox platform.',
  },
};

export default async function DocsCategoryPage({ params }: Props) {
  const { category } = await params;
  
  // Handle backward-compatible redirects
  if (category in categoryRedirects) {
    redirect(categoryRedirects[category]);
  }

  if (!isValidCategory(category)) {
    notFound();
  }

  const navigation = await getDocsNavigation(category);
  const info = categoryInfo[category];

  // For apps category, also fetch grouped docs
  const appGroups = category === 'apps' ? await getAppsDocsGroups() : undefined;

  return (
    <DocLayout category={category} navigation={navigation} appGroups={appGroups}>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">
          {info.title}
        </h1>
        <p className="text-lg text-gray-600">
          {info.description}
        </p>
      </div>

      {/* Documentation List */}
      {category === 'apps' && appGroups ? (
        // Apps: show grouped by application
        appGroups.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-2">
              No app documentation has been published yet.
            </p>
            <p className="text-sm text-gray-500">
              Apps can provide documentation by including a <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">docs/portal/</code> directory with markdown files.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {appGroups.map((group) => (
              <div key={group.app_id}>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  {group.app_name}
                </h2>
                <div className="space-y-3">
                  {group.docs.map((doc) => (
                    <Link
                      key={doc.slug}
                      href={`/docs/apps/${doc.slug}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                    >
                      <h3 className="font-medium text-gray-900 group-hover:text-gray-700 mb-1">
                        {doc.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {doc.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Platform and Developer: flat list
        navigation.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-2">
              No documentation has been published for this category yet.
            </p>
            <p className="text-sm text-gray-500">
              Documentation files need frontmatter with <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">published: true</code> to appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {navigation.map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${category}/${doc.slug}`}
                className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
              >
                <h2 className="font-medium text-gray-900 group-hover:text-gray-700 mb-1">
                  {doc.title}
                </h2>
                <p className="text-sm text-gray-500">
                  {doc.description}
                </p>
              </Link>
            ))}
          </div>
        )
      )}

      {/* Cross-reference */}
      <div className="mt-12 pt-8 border-t border-gray-100">
        <p className="text-sm text-gray-500">
          {category === 'platform' && (
            <>Looking for technical details? <Link href="/docs/developer" className="text-gray-900 hover:underline">View developer documentation</Link></>
          )}
          {category === 'apps' && (
            <>New to Busibox? <Link href="/docs/platform" className="text-gray-900 hover:underline">Start with the platform guide</Link></>
          )}
          {category === 'administrator' && (
            <>Building integrations? <Link href="/docs/developer" className="text-gray-900 hover:underline">View developer documentation</Link></>
          )}
          {category === 'developer' && (
            <>New to Busibox? <Link href="/docs/platform" className="text-gray-900 hover:underline">Start with the platform guide</Link></>
          )}
        </p>
      </div>
    </DocLayout>
  );
}
