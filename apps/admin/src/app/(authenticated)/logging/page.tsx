/**
 * Admin Logging Page
 * 
 * Unified page for Audit Logs and Service Logs with tabs.
 */

'use client';

import { useState } from 'react';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { ServiceLogsViewer } from '@/components/admin/ServiceLogsViewer';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { FileText, Terminal } from 'lucide-react';

type Tab = 'audit' | 'services';

export default function AdminLoggingPage() {
  const { user } = useSession();
  const { customization } = useCustomization();
  const [activeTab, setActiveTab] = useState<Tab>('audit');

  // Check if user is admin
  if (!user) {
    window.location.href = '/portal/login';
    return null;
  }

  if (!user.roles?.includes('Admin')) {
    window.location.href = '/portal/home';
    return null;
  }

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Logging</h1>
            <p className="text-gray-600 mt-1">View audit logs and service logs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'audit'
                  ? 'border-current'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={activeTab === 'audit' ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined}
            >
              <FileText className="w-4 h-4" />
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'services'
                  ? 'border-current'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={activeTab === 'services' ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined}
            >
              <Terminal className="w-4 h-4" />
              Service Logs
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <AuditLogTable />
          </div>
        )}

        {activeTab === 'services' && (
          <ServiceLogsViewer />
        )}
      </main>
    </div>
  );
}
