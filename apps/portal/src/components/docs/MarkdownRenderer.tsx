/**
 * MarkdownRenderer Component
 * 
 * Renders markdown content with clean, readable styling.
 */

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram';
import { Children, isValidElement } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-gray max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks
          code({ className: codeClassName, children, ...props }) {
            const isInline = !codeClassName;
            const isMermaid = codeClassName?.includes('language-mermaid');
            
            if (isMermaid) {
              const chart = String(children).replace(/\n$/, '');
              return <MermaidDiagram chart={chart} />;
            }
            
            if (isInline) {
              return (
                <code 
                  className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" 
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            return (
              <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            // If the child is a mermaid diagram (rendered by the code handler above),
            // don't wrap it in a <pre> tag
            const child = Children.only(children);
            if (isValidElement(child) && child.type === MermaidDiagram) {
              return <>{children}</>;
            }
            return <pre className="bg-transparent p-0 overflow-visible">{children}</pre>;
          },
          // Headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold text-gray-900 mt-8 mb-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return (
              <h2 id={id} className="text-xl font-semibold text-gray-900 mt-8 mb-3 scroll-mt-20">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = String(children).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            return (
              <h3 id={id} className="text-lg font-medium text-gray-900 mt-6 mb-2 scroll-mt-20">
                {children}
              </h3>
            );
          },
          h4: ({ children }) => (
            <h4 className="font-medium text-gray-900 mt-4 mb-2">
              {children}
            </h4>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-600 leading-relaxed mb-4">
              {children}
            </p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside space-y-1 text-gray-600 mb-4 ml-5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-1 text-gray-600 mb-4 ml-5">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-600 leading-relaxed">
              {children}
            </li>
          ),
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="text-gray-900 underline decoration-gray-300 hover:decoration-gray-900 transition-colors"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-200 pl-4 my-4 text-gray-500 italic">
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-gray-200">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-gray-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-600 border-b border-gray-100">
              {children}
            </td>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-8 border-gray-200" />
          ),
          // Strong
          strong: ({ children }) => (
            <strong className="font-medium text-gray-900">
              {children}
            </strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
