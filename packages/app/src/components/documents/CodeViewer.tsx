'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, Copy, Check, WrapText, FileCode } from 'lucide-react';

interface CodeViewerProps {
  fileId: string;
  mimeType: string;
  filename: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  'application/json': 'json',
  'text/csv': 'csv',
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'application/javascript': 'javascript',
  'text/javascript': 'javascript',
  'text/css': 'css',
  'text/yaml': 'yaml',
  'application/x-yaml': 'yaml',
};

function detectLanguageFromFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const extMap: Record<string, string> = {
    json: 'json', csv: 'csv', md: 'markdown', xml: 'xml',
    html: 'html', htm: 'html', js: 'javascript', ts: 'typescript',
    css: 'css', yaml: 'yaml', yml: 'yaml', txt: 'text',
    py: 'python', sh: 'bash', sql: 'sql',
  };
  return ext ? extMap[ext] ?? null : null;
}

function syntaxHighlightJSON(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(?:\\.|[^"\\])*")\s*:/g,
    '<span class="json-key">$1</span>:'
  ).replace(
    /:\s*("(?:\\.|[^"\\])*")/g,
    ': <span class="json-string">$1</span>'
  ).replace(
    /:\s*(\d+\.?\d*([eE][+-]?\d+)?)/g,
    ': <span class="json-number">$1</span>'
  ).replace(
    /:\s*(true|false)/g,
    ': <span class="json-bool">$1</span>'
  ).replace(
    /:\s*(null)/g,
    ': <span class="json-null">$1</span>'
  );
}

export function CodeViewer({ fileId, mimeType, filename }: CodeViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const language = LANGUAGE_MAP[mimeType] ?? detectLanguageFromFilename(filename) ?? 'text';

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/documents/api/documents/${fileId}/download`);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
      const text = await response.text();
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading file content...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-4 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  let formatted = content;
  let highlighted = false;
  if (language === 'json') {
    try {
      formatted = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // content might not be valid JSON; show as-is
    }
    highlighted = true;
  }

  const lineCount = formatted.split('\n').length;

  return (
    <div className="relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .code-viewer .json-key { color: #881391; }
        .code-viewer .json-string { color: #0451a5; }
        .code-viewer .json-number { color: #098658; }
        .code-viewer .json-bool { color: #0000ff; }
        .code-viewer .json-null { color: #6e6e6e; }
        .code-viewer .line-numbers {
          position: sticky;
          left: 0;
          z-index: 1;
          user-select: none;
          padding-right: 1rem;
          text-align: right;
          color: #9ca3af;
          border-right: 1px solid #e5e7eb;
          min-width: 3.5rem;
          background: inherit;
        }
      ` }} />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileCode className="w-4 h-4" />
          <span className="font-medium">{language.toUpperCase()}</span>
          <span className="text-gray-400">|</span>
          <span>{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWrap(w => !w)}
            className={`p-1.5 rounded transition-colors ${wrap ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            title={wrap ? 'Disable word wrap' : 'Enable word wrap'}
          >
            <WrapText className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="code-viewer overflow-auto max-h-[80vh] bg-white">
        <pre
          ref={preRef}
          className={`p-4 text-sm font-mono leading-relaxed ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}
          {...(highlighted
            ? { dangerouslySetInnerHTML: { __html: syntaxHighlightJSON(formatted) } }
            : { children: formatted }
          )}
        />
      </div>
    </div>
  );
}
