/**
 * Deployment Management Page
 * 
 * Trigger and monitor Ansible deployments to staging and production.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, CheckCircle, XCircle, Clock, ExternalLink, AlertTriangle } from 'lucide-react';

interface DeploymentTarget {
  id: string;
  name: string;
  environment: 'staging' | 'production';
  description: string;
  lastDeployed?: string;
  status: 'ready' | 'deploying' | 'success' | 'failed' | 'unknown';
}

interface DeploymentLog {
  id: string;
  environment: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'failed';
  user: string;
  target?: string;
}

const TARGETS: DeploymentTarget[] = [
  {
    id: 'all',
    name: 'Full Stack',
    environment: 'staging',
    description: 'Deploy all services to staging environment',
    status: 'ready',
  },
  {
    id: 'apps',
    name: 'Applications Only',
    environment: 'staging',
    description: 'Deploy Busibox Portal and Agent Manager',
    status: 'ready',
  },
  {
    id: 'infra',
    name: 'Infrastructure',
    environment: 'staging',
    description: 'Deploy PostgreSQL, Redis, Milvus, MinIO',
    status: 'ready',
  },
  {
    id: 'ai',
    name: 'AI Services',
    environment: 'staging',
    description: 'Deploy LiteLLM, Embedding API',
    status: 'ready',
  },
];

export default function DeploymentPage() {
  const [targets, setTargets] = useState<DeploymentTarget[]>(TARGETS);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<'staging' | 'production'>('staging');
  const [isLoading, setIsLoading] = useState(true);
  const [deployingTarget, setDeployingTarget] = useState<string | null>(null);
  const [showConfirmProduction, setShowConfirmProduction] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const fetchDeploymentStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/deploy/status?environment=${selectedEnvironment}`);
      if (response.ok) {
        const data = await response.json();
        if (data.data?.targets) {
          setTargets(data.data.targets);
        }
        if (data.data?.logs) {
          setLogs(data.data.logs);
        }
      }
    } catch (error) {
      console.error('Failed to fetch deployment status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEnvironment]);

  useEffect(() => {
    fetchDeploymentStatus();
    // Refresh every 10 seconds if there's an active deployment
    const interval = setInterval(() => {
      if (deployingTarget) {
        fetchDeploymentStatus();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDeploymentStatus, deployingTarget]);

  const handleDeploy = async (targetId: string) => {
    // Require confirmation for production
    if (selectedEnvironment === 'production') {
      setPendingTarget(targetId);
      setShowConfirmProduction(true);
      return;
    }

    await executeDeploy(targetId);
  };

  const executeDeploy = async (targetId: string) => {
    setDeployingTarget(targetId);
    setShowConfirmProduction(false);
    setPendingTarget(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetId,
          environment: selectedEnvironment,
        }),
      });

      if (!response.ok) {
        throw new Error('Deployment failed to start');
      }

      // Poll for completion
      const checkStatus = async () => {
        await fetchDeploymentStatus();
        const target = targets.find(t => t.id === targetId);
        if (target?.status === 'deploying') {
          setTimeout(checkStatus, 5000);
        } else {
          setDeployingTarget(null);
        }
      };

      setTimeout(checkStatus, 5000);
    } catch (error) {
      console.error('Deployment failed:', error);
      setDeployingTarget(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'deploying':
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ready: 'bg-gray-100 text-gray-700',
      deploying: 'bg-blue-100 text-blue-700',
      running: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      unknown: 'bg-gray-100 text-gray-500',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.unknown}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deployments</h1>
          <p className="text-gray-600 mt-1">
            Deploy services to staging and production environments
          </p>
        </div>
        <button
          onClick={fetchDeploymentStatus}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Environment Selector */}
      <div className="mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedEnvironment('staging')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedEnvironment === 'staging'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Staging
          </button>
          <button
            onClick={() => setSelectedEnvironment('production')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedEnvironment === 'production'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Production
          </button>
        </div>
      </div>

      {/* Deployment Targets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Deploy to {selectedEnvironment.charAt(0).toUpperCase() + selectedEnvironment.slice(1)}
          </h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {targets.map(target => (
            <div key={target.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-gray-900">{target.name}</h3>
                  {getStatusBadge(target.status)}
                </div>
                <p className="text-sm text-gray-600 mt-1">{target.description}</p>
                {target.lastDeployed && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last deployed: {new Date(target.lastDeployed).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDeploy(target.id)}
                disabled={deployingTarget !== null}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedEnvironment === 'production'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {deployingTarget === target.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {deployingTarget === target.id ? 'Deploying...' : 'Deploy'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Deployments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Deployments</h2>
        </div>
        
        {logs.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No deployments yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map(log => (
              <div key={log.id} className="px-6 py-4 flex items-center gap-4">
                {getStatusIcon(log.status)}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {log.target || 'Full Stack'} → {log.environment}
                  </div>
                  <div className="text-sm text-gray-500">
                    {log.user} • {new Date(log.startedAt).toLocaleString()}
                    {log.finishedAt && (
                      <span className="ml-2">
                        ({Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}s)
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={`/logging?deployment=${log.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Production Confirmation Modal */}
      {showConfirmProduction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Deploy to Production?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              You are about to deploy to the <strong>production</strong> environment. 
              This will affect all users. Are you sure you want to continue?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmProduction(false);
                  setPendingTarget(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => pendingTarget && executeDeploy(pendingTarget)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Yes, Deploy to Production
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
