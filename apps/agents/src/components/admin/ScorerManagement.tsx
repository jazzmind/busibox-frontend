'use client';

import { useState, useEffect } from 'react';
import { listScorers, deleteScorer, createScorer } from '../../lib/admin-client';
import { formatDate } from '@jazzmind/busibox-app/lib/date-utils';

interface Scorer {
  id: string;
  name: string;
  display_name?: string;
  description: string;
  scorerType: string;
  config?: any;
  scopes: string[];
  created_at: string;
  updated_at?: string;
}

export default function ScorerManagement() {
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [selectedScorer, setSelectedScorer] = useState<Scorer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScorers();
  }, []);

  const loadScorers = async () => {
    try {
      setLoading(true);
      const data = await listScorers();
      console.log('Scorers data received:', data);
      // Handle both array and object responses
      if (Array.isArray(data)) {
        setScorers(data);
      } else if (data && typeof data === 'object') {
        // If it's an object like other APIs, convert to array
        const scorersList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          name: key,
          display_name: value.name || value.display_name || key,
          description: value.description || 'No description available',
          scorerType: value.scorerType || value.type || 'unknown',
          config: value.config || {},
          scopes: value.scopes || [],
          created_at: value.created_at || new Date().toISOString(),
          updated_at: value.updated_at || new Date().toISOString()
        }));
        setScorers(scorersList);
      } else {
        setScorers([]);
      }
    } catch (err) {
      console.error('Failed to load scorers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scorers');
      // For now, set empty array if API doesn't exist yet
      setScorers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScorer = async (scorerId: string) => {
    if (!confirm('Are you sure you want to delete this scorer?')) return;
    
    try {
      await deleteScorer(scorerId);
      await loadScorers(); // Reload the list
    } catch (err) {
      console.error('Failed to delete scorer:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete scorer');
    }
  };

  const handleSaveScorer = async () => {
    if (!selectedScorer) return;
    
    try {
      // Note: updateScorer function doesn't exist yet in admin-client
      // This would need to be implemented when scorer editing is fully supported
      console.log('Save scorer:', selectedScorer);
      setIsEditing(false);
      // await loadScorers(); // Reload the list when update function is available
    } catch (err) {
      console.error('Failed to update scorer:', err);
      setError(err instanceof Error ? err.message : 'Failed to update scorer');
    }
  };

  const ScorerCard = ({ scorer }: { scorer: Scorer }) => (
    <div
      onClick={() => setSelectedScorer(scorer)}
      className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200/50 group hover:scale-[1.02]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {scorer.display_name || scorer.name}
            </h3>
            <p className="text-sm text-gray-500">{scorer.scorerType}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteScorer(scorer.id);
          }}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      
      {scorer.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{scorer.description}</p>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>{scorer.scopes?.length || 0} scopes</span>
        <div className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          Scorer
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        <span>Created {formatDate(scorer.created_at)}</span>
      </div>
    </div>
  );

  const ScorerEditor = () => {
    if (!selectedScorer) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedScorer(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedScorer.display_name || selectedScorer.name}
                </h2>
                <p className="text-sm text-gray-500">Scorer Configuration</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={isEditing ? handleSaveScorer : () => setIsEditing(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isEditing 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isEditing ? 'Save Changes' : 'Edit Scorer'}
              </button>
              <button 
                onClick={() => handleDeleteScorer(selectedScorer.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50">
            <h3 className="text-lg font-semibold text-gray-900">Scorer Configuration</h3>
          </div>
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scorer Name</label>
                <input
                  type="text"
                  value={selectedScorer.name}
                  onChange={(e) => setSelectedScorer(prev => prev ? { ...prev, name: e.target.value } : null)}
                  disabled={!isEditing}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={selectedScorer.display_name || ''}
                  onChange={(e) => setSelectedScorer(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                  disabled={!isEditing}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scorer Type</label>
                <input
                  type="text"
                  value={selectedScorer.scorerType}
                  onChange={(e) => setSelectedScorer(prev => prev ? { ...prev, scorerType: e.target.value } : null)}
                  disabled={!isEditing}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={selectedScorer.description || ''}
                onChange={(e) => setSelectedScorer(prev => prev ? { ...prev, description: e.target.value } : null)}
                disabled={!isEditing}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Brief description of what this scorer evaluates..."
              />
            </div>

            {/* Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Configuration</label>
              <textarea
                value={typeof selectedScorer.config === 'string' ? selectedScorer.config : JSON.stringify(selectedScorer.config || {}, null, 2)}
                onChange={(e) => setSelectedScorer(prev => prev ? { ...prev, config: e.target.value } : null)}
                disabled={!isEditing}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500 font-mono text-sm"
                placeholder="JSON configuration for the scorer..."
              />
            </div>

            {/* Scopes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permission Scopes</label>
              <div className="min-h-[2.5rem] p-3 border border-gray-200 rounded-lg bg-gray-50">
                {selectedScorer.scopes && selectedScorer.scopes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedScorer.scopes.map((scope, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.5-4.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        {scope}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">No scopes assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (selectedScorer) {
    return <ScorerEditor />;
  }

  if (error && !error.includes('404')) { // Don't show error for 404 since API might not exist yet
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scorers</h1>
            <p className="text-gray-600">Manage your evaluation scorers and metrics</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button 
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors text-sm"
            onClick={loadScorers}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scorers</h1>
          <p className="text-gray-600">Manage your evaluation scorers and metrics</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create Scorer</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{scorers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{scorers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Types</p>
              <p className="text-2xl font-bold text-gray-900">{new Set(scorers.map(s => s.scorerType)).size}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.5-4.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Scopes</p>
              <p className="text-2xl font-bold text-gray-900">{scorers.reduce((sum, scorer) => sum + (scorer.scopes?.length || 0), 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scorers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/80 rounded-xl p-6 shadow-lg animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : scorers.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No scorers found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first evaluation scorer</p>
          <button 
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            Create Scorer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scorers.map((scorer) => (
            <ScorerCard key={scorer.id} scorer={scorer} />
          ))}
        </div>
      )}
    </div>
  );
}