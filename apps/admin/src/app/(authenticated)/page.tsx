/**
 * Admin Dashboard Page
 * 
 * Main admin dashboard with live AI usage visualization.
 * Shows real-time activity feed, model usage metrics, and service health.
 */

'use client';

import { useEffect } from 'react';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { LiveDashboard } from '@/components/admin/LiveDashboard';

export default function AdminDashboardPage() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) {
      window.location.href = '/portal/login';
      return;
    }

    if (!user.roles?.includes('Admin')) {
      window.location.href = '/portal/home';
      return;
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Real-time overview of AI activity and system health
            </p>
          </div>
        </div>
      </div>

      {/* Live Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <LiveDashboard />
      </main>
    </div>
  );
}
