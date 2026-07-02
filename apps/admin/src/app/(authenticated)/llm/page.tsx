/**
 * LLM Configuration Page - Redirect
 *
 * This page has been consolidated into the top-level AI page.
 * Redirects to /ai?tab=status
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LLMConfigurationPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ai?tab=status');
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Redirecting to AI settings...</p>
      </div>
    </div>
  );
}
