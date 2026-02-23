import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Layout guard for the Admin Tests section.
 *
 * Tests (test runner, permissions harness, etc.) must never be accessible
 * in production. This server component checks the environment before
 * rendering any child page.
 *
 * Environment detection uses BUSIBOX_ENVIRONMENT (server-side only).
 * Docker dev leaves this unset, which we treat as non-production.
 */

function isProductionEnvironment(): boolean {
  const env = (process.env.BUSIBOX_ENVIRONMENT ?? '').toLowerCase();
  // Only gate when explicitly set to 'production'
  // Unset (Docker dev / local) = allowed
  return env === 'production';
}

export default function AdminTestsLayout({ children }: { children: ReactNode }) {
  if (isProductionEnvironment()) {
    redirect('/admin');
  }

  return <>{children}</>;
}
