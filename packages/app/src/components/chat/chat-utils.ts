'use client';

import React from 'react';

const DOC_LINK_RE = /^doc:(.+)$/;

export function CitationLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href) {
    const match = DOC_LINK_RE.exec(href);
    if (match) {
      const fileId = match[1];
      return React.createElement('a', {
        ...props,
        href: `/documents/${fileId}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 no-underline transition-colors border border-blue-200 dark:border-blue-700',
        title: 'Open source document',
      },
        React.createElement('svg', {
          className: 'w-3 h-3 flex-shrink-0',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 2,
            d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
          })
        ),
        children
      );
    }
  }
  return React.createElement('a', { ...props, href, target: '_blank', rel: 'noopener noreferrer' }, children);
}

export const streamingMarkdownComponents = { a: CitationLink };

const THINK_TAG_RE = /<think>[\s\S]*?<\/think>/g;

export function stripThinkTags(text: string): string {
  return text.replace(THINK_TAG_RE, '').trim();
}

export function preprocessLatex(content: string): string {
  return content
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}
