'use client';

import { TestHistory } from '@/components/admin/tests/TestHistory';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TestHistoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/tests"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tests
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Test History</h1>
        <p className="text-gray-600 mt-2">View past test execution results and statistics</p>
      </div>

      {/* History Component */}
      <TestHistory limit={100} />
    </div>
  );
}
