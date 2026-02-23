/**
 * Individual Documentation Page
 * 
 * Renders a single documentation file with markdown content.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { DocLayout } from '@/components/docs/DocLayout';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { getDocBySlug, getDocsNavigation, getDocNavigation, getAppsDocsGroups, type DocCategory } from '@jazzmind/busibox-app/lib/docs/client';

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

const validCategories = ['platform', 'administrator', 'apps', 'developer'] as const;

// Backward compatibility: redirect old 'user' URLs to 'platform'
const categoryRedirects: Record<string, string> = {
  user: 'platform',
};

function isValidCategory(category: string): category is DocCategory {
  return validCategories.includes(category as DocCategory);
}

export async function generateMetadata({ params }: Props) {
  const { category, slug } = await params;
  
  // Resolve redirects for metadata too
  const resolvedCategory = categoryRedirects[category] || category;
  
  if (!isValidCategory(resolvedCategory)) {
    return { title: 'Not Found' };
  }

  const doc = await getDocBySlug(resolvedCategory, slug);
  if (!doc) {
    return { title: 'Not Found' };
  }

  return {
    title: `${doc.frontmatter.title} | Busibox Docs`,
    description: doc.frontmatter.description,
  };
}

export default async function DocsPage({ params }: Props) {
  const { category, slug } = await params;
  
  // Handle backward-compatible redirects
  if (category in categoryRedirects) {
    redirect(`/docs/${categoryRedirects[category]}/${slug}`);
  }

  if (!isValidCategory(category)) {
    notFound();
  }

  const doc = await getDocBySlug(category, slug);
  if (!doc) {
    notFound();
  }

  const navigation = await getDocsNavigation(category);
  const { prev, next } = await getDocNavigation(category, slug);

  // For apps category, also fetch grouped docs for sidebar
  const appGroups = category === 'apps' ? await getAppsDocsGroups() : undefined;

  // Estimate reading time (roughly 200 words per minute)
  const wordCount = doc.content.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <DocLayout category={category} navigation={navigation} currentSlug={slug} appGroups={appGroups}>
      {/* Document Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">
          {doc.frontmatter.title}
        </h1>
        <p className="text-gray-600 mb-4">
          {doc.frontmatter.description}
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>{readingTime} min read</span>
          {doc.frontmatter.app_name && (
            <>
              <span>·</span>
              <span>{doc.frontmatter.app_name}</span>
            </>
          )}
        </div>
      </header>

      {/* Document Content */}
      <article className="mb-12">
        <MarkdownRenderer content={doc.content} />
      </article>

      {/* Navigation */}
      <nav className="flex items-center justify-between pt-8 border-t border-gray-100 text-sm">
        {prev ? (
          <Link
            href={`/docs/${category}/${prev.slug}`}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{prev.title}</span>
          </Link>
        ) : (
          <div />
        )}
        
        {next ? (
          <Link
            href={`/docs/${category}/${next.slug}`}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span>{next.title}</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </DocLayout>
  );
}
