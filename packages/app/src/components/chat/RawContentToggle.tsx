'use client';
/**
 * RawContentToggle Component
 * 
 * An inline collapsible toggle that displays raw message content.
 * Designed to be used as a debug toggle in MessageList.
 */


export interface RawContentToggleProps {
  /** The raw content to display */
  content: string;
}

/**
 * RawContentToggle - Inline collapsible display of raw message content
 * Uses native HTML details/summary for consistent behavior with other toggles
 */
export function RawContentToggle({ content }: RawContentToggleProps) {
  if (!content) return null;

  return (
    <details className="inline">
      <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
        🔍 Raw
      </summary>
      <pre className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
        {content}
      </pre>
    </details>
  );
}

export default RawContentToggle;
