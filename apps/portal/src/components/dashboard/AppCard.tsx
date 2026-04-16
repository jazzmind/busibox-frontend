/**
 * App Card Component
 * 
 * Displays an application tile with icon, name, and description.
 * All apps use SSO token exchange — in the monorepo each app runs
 * as a separate Next.js app with its own basePath.
 *
 * Shows contextual status for undeployed or inaccessible apps instead
 * of blindly redirecting (e.g., to a GitHub repo URL).
 */

'use client';

import { useState, useEffect } from 'react';
import type { DashboardApp } from '@/types';
import { AppIcon } from '@jazzmind/busibox-app';

export type AppCardProps = {
  app: DashboardApp;
};

type DeploymentBadge = {
  label: string;
  bgClass: string;
  textClass: string;
  icon: React.ReactNode;
};

function getDeploymentBadge(app: DashboardApp): DeploymentBadge | null {
  if (app.type !== 'EXTERNAL') return null;

  const status = app.lastDeploymentStatus;
  if (status === 'completed') return null;

  if (!status || status === 'failed') {
    return {
      label: status === 'failed' ? 'Deploy Failed' : 'Not Deployed',
      bgClass: status === 'failed' ? 'bg-red-50' : 'bg-amber-50',
      textClass: status === 'failed' ? 'text-red-700' : 'text-amber-700',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    };
  }

  if (status === 'pending' || status === 'deploying' || status === 'building') {
    return {
      label: 'Deploying...',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-700',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
    };
  }

  return null;
}

export function AppCard({ app }: AppCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLoading(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const deployBadge = getDeploymentBadge(app);
  const isNotDeployed = !!deployBadge;

  const handleSSOAppClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode(null);

    try {
      const response = await fetch('/api/auth/sso/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success && data.data.redirectUrl) {
        window.location.href = data.data.redirectUrl;
        return;
      }

      if (data.success && data.data.notDeployed) {
        setError('This app is being set up and is not available yet.');
        setErrorCode('not_deployed');
        setLoading(false);
        return;
      }

      const code = data.errorCode;
      setErrorCode(code || null);

      if (code === 'no_permission') {
        setError(data.error || 'You do not have access to this app.');
      } else if (code === 'not_deployed') {
        setError('This app is being set up and is not available yet.');
      } else {
        setError(data.error || 'Failed to launch app');
      }
      setLoading(false);
    } catch (err) {
      console.error('SSO token generation error:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const statusBadge = (() => {
    if (loading) {
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium w-full justify-center">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting...
        </div>
      );
    }

    if (deployBadge) {
      return (
        <div className={`inline-flex items-center gap-2 px-4 py-2 ${deployBadge.bgClass} ${deployBadge.textClass} rounded-lg text-xs font-medium`}>
          {deployBadge.icon}
          {deployBadge.label}
        </div>
      );
    }

    if (errorCode === 'no_permission') {
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Access Restricted
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        SSO Enabled
      </div>
    );
  })();

  const cardContent = (
    <div className={`group relative bg-white rounded-xl shadow-sm transition-all duration-300 overflow-hidden border border-gray-100 h-full ${isNotDeployed ? '' : 'hover:shadow-xl'}`}>
      <div className="p-6 flex flex-col items-center text-center h-full">
        <div className={`mb-4 transform transition-transform duration-300 ${isNotDeployed ? 'opacity-50' : 'group-hover:scale-110'}`}>
          <AppIcon 
            iconName={app.selectedIcon}
            iconUrl={app.iconUrl}
            size="lg"
            color={app.primaryColor}
          />
        </div>

        <h3 className={`text-lg font-semibold mb-2 transition-colors ${isNotDeployed ? 'text-gray-500' : 'text-gray-900 group-hover:text-blue-600'}`}>
          {app.name}
        </h3>

        {app.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
            {app.description}
          </p>
        )}

        <div className="mt-auto w-full">
          {statusBadge}
        </div>

        {error && (
          <div className={`mt-3 px-3 py-2 border rounded-lg w-full ${
            errorCode === 'no_permission'
              ? 'bg-amber-50 border-amber-200'
              : errorCode === 'not_deployed'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-xs text-center ${
              errorCode === 'no_permission'
                ? 'text-amber-700'
                : errorCode === 'not_deployed'
                ? 'text-blue-700'
                : 'text-red-600'
            }`}>
              {error}
            </p>
          </div>
        )}
      </div>

      {!isNotDeployed && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300 pointer-events-none rounded-xl" />
      )}
    </div>
  );

  if (isNotDeployed) {
    return (
      <div className="cursor-default opacity-80">
        {cardContent}
      </div>
    );
  }

  return (
    <button
      onClick={handleSSOAppClick}
      disabled={loading}
      className="block w-full text-left disabled:opacity-75 disabled:cursor-not-allowed"
    >
      {cardContent}
    </button>
  );
}
