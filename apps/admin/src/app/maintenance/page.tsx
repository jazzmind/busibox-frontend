/**
 * Maintenance Page
 *
 * Redirects to portal maintenance. Admin app is SSO-only; maintenance is handled by portal.
 */

'use client';

import { useEffect } from 'react';

const PORTAL_URL = process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || '';

export default function MaintenancePage() {
  useEffect(() => {
    if (PORTAL_URL) {
      window.location.href = `${PORTAL_URL}/maintenance`;
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Redirecting to portal...</p>
      </div>
    </div>
  );
}
