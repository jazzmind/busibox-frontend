'use client';

import { useState } from 'react';

interface ClientSession {
  clientId: string;
  clientSecret: string;
  isAuthenticated: boolean;
  accessToken?: string;
  scopes?: string[];
  selectedAgent?: string;
}

interface SessionInfoProps {
  session: ClientSession;
  onDisconnect: () => void;
}

export default function SessionInfo({ session, onDisconnect }: SessionInfoProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Connected: {session.clientId}</span>
        <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Session Details</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Client ID:</span>
                <span className="ml-2 font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded">
                  {session.clientId}
                </span>
              </div>
              
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 inline-flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-700 font-medium">Authenticated</span>
                </span>
              </div>

              <div>
                <span className="text-gray-600">Scopes ({session.scopes?.length || 0}):</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {session.scopes?.map((scope) => (
                    <span
                      key={scope}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {scope}
                    </span>
                  )) || (
                    <span className="text-gray-500 text-xs">No scopes granted</span>
                  )}
                </div>
              </div>

              {session.selectedAgent && (
                <div>
                  <span className="text-gray-600">Active Agent:</span>
                  <span className="ml-2 font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded">
                    {session.selectedAgent}
                  </span>
                </div>
              )}

              {session.accessToken && (
                <div>
                  <span className="text-gray-600">Token:</span>
                  <div className="mt-1 font-mono text-xs text-gray-700 bg-gray-50 p-2 rounded break-all">
                    {session.accessToken.substring(0, 20)}...
                    <span className="text-gray-400">[truncated]</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4">
            <button
              onClick={() => {
                setShowDetails(false);
                onDisconnect();
              }}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
