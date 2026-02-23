/**
 * Deployment Logs Viewer
 * Real-time deployment logs display
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, StatusBadge } from '@jazzmind/busibox-app';

interface DeploymentLogsViewerProps {
  deploymentId: string;
  onClose: () => void;
}

interface DeploymentStatus {
  id: string;
  status: string;
  releaseTag: string;
  environment: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  isRollback: boolean;
}

export function DeploymentLogsViewer({ deploymentId, onClose }: DeploymentLogsViewerProps) {
  const [logs, setLogs] = useState<string>('');
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    loadLogs();
    
    // Poll for updates every 2 seconds while deployment is in progress
    const interval = setInterval(() => {
      if (status?.status === 'IN_PROGRESS' || status?.status === 'PENDING') {
        loadLogs();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [deploymentId, status?.status]);
  
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);
  
  async function loadLogs() {
    try {
      // Load status
      const statusRes = await fetch(`/api/deployments/${deploymentId}/status`);
      if (statusRes.ok) {
        const { deployment } = await statusRes.json();
        setStatus(deployment);
      }
      
      // Load logs
      const logsRes = await fetch(`/api/deployments/${deploymentId}/logs`);
      if (logsRes.ok) {
        const { logs: logsData } = await logsRes.json();
        setLogs(logsData || 'No logs available yet...');
      }
    } catch (error) {
      console.error('Failed to load deployment logs:', error);
    }
  }
  
  function handleScroll() {
    if (!logsContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setAutoScroll(isAtBottom);
  }
  
  function scrollToBottom() {
    setAutoScroll(true);
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
      case 'ROLLED_BACK':
        return 'danger';
      case 'IN_PROGRESS':
        return 'warning';
      default:
        return 'info';
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Deployment Logs
            </h2>
            {status && (
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="text-gray-600">
                  {status.releaseTag} → {status.environment}
                </span>
                <StatusBadge 
                  status={status.status} 
                  variant={getStatusVariant(status.status)}
                />
                {status.isRollback && (
                  <StatusBadge status="Rollback" variant="warning" />
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <Button
                size="sm"
                variant="secondary"
                onClick={scrollToBottom}
              >
                ↓ Scroll to Bottom
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={loadLogs}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
        
        {/* Logs Content */}
        <div 
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 bg-gray-900"
        >
          <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap break-words">
            {logs}
          </pre>
          <div ref={logsEndRef} />
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {status && (
                <>
                  Started: {new Date(status.startedAt).toLocaleString()}
                  {status.completedAt && (
                    <> • Completed: {new Date(status.completedAt).toLocaleString()}</>
                  )}
                </>
              )}
            </div>
            
            {status?.errorMessage && (
              <div className="text-red-600 font-medium">
                Error: {status.errorMessage}
              </div>
            )}
            
            {status?.status === 'IN_PROGRESS' && (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                <span>Deployment in progress...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

