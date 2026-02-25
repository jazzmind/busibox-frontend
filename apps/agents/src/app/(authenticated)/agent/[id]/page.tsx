'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { SimpleChatInterface } from '@jazzmind/busibox-app/components';
import { ConversationsList, RunsList, RunDetailPanel } from '@/components/conversations';
import { ToolBadgeList } from '@/components/tools';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import type { Agent } from '@/lib/types';
import { 
  ChevronLeft, 
  MessageSquare, 
  Info, 
  History, 
  GitBranch, 
  Edit, 
  Bot,
  ChevronRight,
  Terminal,
  Clock,
  FlaskConical
} from 'lucide-react';

type TabType = 'details' | 'chat' | 'api_logs' | 'workflow' | 'evals';

interface Run {
  id: string;
  agent_id: string;
  workflow_id?: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'timeout';
  input: Record<string, any>;
  output?: Record<string, any> | null;
  events: any[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

interface SidebarConversation {
  id: string;
  title: string;
  updated_at: string;
}

// Compact conversation list for sidebar
function SidebarConversationsList({
  agentId,
  token,
  selectedId,
  onSelect,
  deletedConversationId,
}: {
  agentId: string;
  token: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  deletedConversationId?: string | null;
}) {
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch(`/api/conversations?agent_id=${agentId}&limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (e) {
        console.error('Failed to load conversations:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, [agentId, token]);

  // Remove conversation from list when deleted
  useEffect(() => {
    if (deletedConversationId) {
      setConversations(prev => prev.filter(c => c.id !== deletedConversationId));
    }
  }, [deletedConversationId]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
        Loading...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
            selectedId === conv.id
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          <div className="truncate font-medium">{conv.title}</div>
          <div className="text-[10px] opacity-60">{formatTime(conv.updated_at)}</div>
        </button>
      ))}
    </div>
  );
}

export default function AgentDetailPage() {
  const { isReady, refreshKey, redirectToPortal, refreshToken } = useSession();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = params.id;
  const chatParam = searchParams.get('chat');
  const tabParam = searchParams.get('tab');

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('chat'); // Default to chat
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0); // Key to force chat remount when conversation changes
  const [deletedConversationId, setDeletedConversationId] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Determine if agent supports attachments
  const supportsAttachments = useMemo(() => {
    if (!agent) return false;
    return agent.tools?.names?.some((t: string) => ['data', 'rag'].includes(t)) || false;
  }, [agent]);

  // Determine enabled tools for chat
  const enableWebSearch = useMemo(() => {
    return agent?.tools?.names?.includes('search') || false;
  }, [agent]);

  const enableDocSearch = useMemo(() => {
    return agent?.tools?.names?.includes('rag') || false;
  }, [agent]);

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (!isReady || !agentId) {
      return;
    }
    
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Load agent details
        const res = await fetch(`/api/agents/${agentId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed to load agent (${res.status})`);
        setAgent({
          ...(data as Agent),
          is_builtin: Boolean((data as any).is_builtin),
          is_personal: !Boolean((data as any).is_builtin),
        });

        // Get auth token for chat via session refresh
        const tokenRes = await fetch('/api/auth/session', { method: 'POST' });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          setToken(tokenData.token);
          setTokenError(null);
        } else if (tokenRes.status === 401) {
          // Try to refresh the token first
          console.log('[AgentDetail] Token fetch returned 401, attempting refresh');
          const refreshed = await refreshToken();
          if (refreshed) {
            const retryRes = await fetch('/api/auth/session', { method: 'POST' });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              setToken(retryData.token);
              setTokenError(null);
            } else {
              console.log('[AgentDetail] Token fetch still failed after refresh, redirecting');
              setIsRedirecting(true);
              redirectToPortal('session_expired');
            }
          } else {
            console.log('[AgentDetail] Token refresh failed, redirecting to portal');
            setIsRedirecting(true);
            redirectToPortal('session_expired');
          }
        } else {
          setTokenError('token_fetch_failed');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load agent');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isReady, refreshKey, agentId, refreshToken, redirectToPortal]);

  // Auto-redirect when not authenticated (after a short delay to show the message)
  useEffect(() => {
    if (tokenError === 'not_authenticated' && !isRedirecting) {
      console.log('[AgentDetail] Not authenticated, auto-redirecting to portal');
      const timer = setTimeout(() => {
        setIsRedirecting(true);
        redirectToPortal('not_authenticated');
      }, 1500); // Brief delay to show the message
      return () => clearTimeout(timer);
    }
  }, [tokenError, isRedirecting, redirectToPortal]);

  // Sync activeTab with URL params
  useEffect(() => {
    if (chatParam === 'true') {
      setActiveTab('chat');
    } else if (tabParam) {
      setActiveTab(tabParam as TabType);
    } else {
      setActiveTab('chat'); // Default to chat
    }
  }, [chatParam, tabParam]);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedRunId(null); // Clear selected run when switching tabs
    const newUrl = tab === 'chat' 
      ? `/agent/${agentId}` 
      : `/agent/${agentId}?tab=${tab}`;
    router.push(newUrl, { scroll: false });
  };

  // Handle run selection
  const handleSelectRun = (run: Run) => {
    setSelectedRunId(run.id);
  };

  // Handle conversation selection - load into chat
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setChatKey(prev => prev + 1); // Force chat to remount with new conversation
    setActiveTab('chat');
    router.push(`/agent/${agentId}`, { scroll: false });
  };

  const navItems = [
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'details' as TabType, label: 'Details', icon: Info },
    { id: 'api_logs' as TabType, label: 'API Logs', icon: Terminal },
    { id: 'evals' as TabType, label: 'Evals', icon: FlaskConical },
    ...(agent?.workflow ? [{ id: 'workflow' as TabType, label: 'Workflow', icon: GitBranch }] : []),
  ];

  // Calculate height: 100vh minus header (h-16 = 4rem) minus nav (h-12 = 3rem) = 7rem total
  return (
    <div className="flex bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Sidebar */}
      <div 
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className={`flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title="Back to Agents"
            >
              <ChevronLeft className="w-5 h-5" />
              {!sidebarCollapsed && <span className="text-sm">Agents</span>}
            </Link>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {/* Agent Info */}
        {agent && !sidebarCollapsed && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {agent.display_name || agent.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {agent.is_builtin ? 'Built-in' : 'Personal'} · {agent.model}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Agent Icon */}
        {agent && sidebarCollapsed && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-center">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center" title={agent.display_name || agent.name}>
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Conversations History in Sidebar */}
        {!sidebarCollapsed && agent && token && (
          <div className="flex-1 min-h-0 flex flex-col border-t border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              Recent Chats
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              <SidebarConversationsList
                agentId={agent.id}
                token={token}
                selectedId={selectedConversationId}
                onSelect={handleSelectConversation}
                deletedConversationId={deletedConversationId}
              />
            </div>
          </div>
        )}

        {/* Edit Button */}
        {agent && !agent.is_builtin && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href={`/agent/${agent.id}/edit`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Edit Agent' : undefined}
            >
              <Edit className="w-4 h-4" />
              {!sidebarCollapsed && <span>Edit Agent</span>}
            </Link>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-600 dark:text-gray-400">Loading…</div>
          </div>
        )}
        
        {error && (
          <div className="p-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          </div>
        )}

        {agent && !loading && (
          <>
            {/* Chat Tab - Full height, pinned input */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {isRedirecting ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md px-6">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Redirecting to Busibox Portal
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Your session has expired. Redirecting you to sign in...
                      </p>
                    </div>
                  </div>
                ) : tokenError === 'not_authenticated' ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md px-6">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Redirecting to Busibox Portal
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Authentication required. Redirecting you to sign in...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        If you are not redirected automatically,{' '}
                        <button
                          onClick={() => redirectToPortal('manual_redirect')}
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          click here
                        </button>
                      </p>
                    </div>
                  </div>
                ) : tokenError === 'token_fetch_failed' ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md px-6">
                      <div className="text-6xl mb-4">⚠️</div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Unable to Load Chat
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Failed to retrieve authentication token. Please try refreshing the page.
                      </p>
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => window.location.reload()}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          Refresh Page
                        </button>
                        <button
                          onClick={() => redirectToPortal('token_error')}
                          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
                        >
                          Go to Portal
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !token ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading chat...</p>
                    </div>
                  </div>
                ) : (
                  <SimpleChatInterface
                    key={chatKey}
                    token={token || ''} // Token passed for compatibility, but proxy uses cookie auth
                    agentId={agent.id}
                    model={agent.model}
                    enableWebSearch={enableWebSearch}
                    enableDocSearch={enableDocSearch}
                    allowAttachments={supportsAttachments}
                    placeholder={`Chat with ${agent.display_name || agent.name}...`}
                    welcomeMessage={selectedConversationId ? undefined : `Hi! I'm **${agent.display_name || agent.name}**.\n\n${agent.description || 'How can I help you today?'}`}
                    useAgenticStreaming={true}
                    initialConversationId={selectedConversationId || undefined}
                    onConversationDeleted={(id) => {
                      setDeletedConversationId(id);
                      // Clear selected if it was the deleted one
                      if (selectedConversationId === id) {
                        setSelectedConversationId(null);
                      }
                    }}
                  />
                )}
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Header */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.display_name || agent.name}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">{agent.description || 'No description'}</p>
                  </div>

                  {/* Details */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="text-gray-700 dark:text-gray-300">
                        <span className="text-gray-500 dark:text-gray-400">ID:</span> {agent.id}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        <span className="text-gray-500 dark:text-gray-400">Model:</span> {agent.model}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        <span className="text-gray-500 dark:text-gray-400">Type:</span> {agent.is_builtin ? 'Built-in' : 'Personal'}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        <span className="text-gray-500 dark:text-gray-400">Status:</span> {agent.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    {/* Tools */}
                    {agent.tools && Object.keys(agent.tools).length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Available Tools</div>
                        <ToolBadgeList
                          tools={(agent.tools.names || []).map((toolName: string) => ({
                            name: toolName,
                            is_builtin: true,
                          }))}
                          size="md"
                          interactive={true}
                        />
                      </div>
                    )}

                    {/* Scopes */}
                    {agent.scopes && agent.scopes.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Required Scopes</div>
                        <div className="flex flex-wrap gap-2">
                          {agent.scopes.map((scope: string) => (
                            <span
                              key={scope}
                              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructions</div>
                      <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto text-gray-900 dark:text-gray-100">
                        {agent.instructions}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API Logs Tab */}
            {activeTab === 'api_logs' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                  {!token ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center max-w-md px-6">
                        <div className="text-6xl mb-4">🔒</div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Authentication Required
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          You need to be authenticated to view API logs.
                        </p>
                      </div>
                    </div>
                  ) : selectedRunId ? (
                    <RunDetailPanel 
                      runId={selectedRunId}
                      token={token}
                      onClose={() => setSelectedRunId(null)} 
                    />
                  ) : (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Terminal className="w-5 h-5" />
                        API Runs
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Direct executions of this agent via the API. Click on a run to see detailed logs.
                      </p>
                      <RunsList 
                        agentId={agent.id}
                        token={token}
                        onSelectRun={handleSelectRun}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Workflow Tab */}
            {activeTab === 'workflow' && agent.workflow && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <div className="text-gray-600 dark:text-gray-400">
                      Workflow view coming soon. Workflow ID: {typeof agent.workflow === 'object' ? JSON.stringify(agent.workflow) : agent.workflow}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Evals Tab */}
            {activeTab === 'evals' && (
              <AgentEvalsTab agentId={agentId} agentName={agent.name} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Agent Evals Tab ─────────────────────────────────────────────────────────

function AgentEvalsTab({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [scores, setScores] = React.useState<any[]>([]);
  const [datasets, setDatasets] = React.useState<any[]>([]);
  const [recentRuns, setRecentRuns] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const [metricsRes, scoresRes, datasetsRes, runsRes] = await Promise.all([
        fetch(`/api/evals/observability/agent/${agentId}/metrics`).then(r => r.ok ? r.json() : null),
        fetch(`/api/evals/scores?agent_id=${agentId}&days=7&limit=50`).then(r => r.ok ? r.json() : []),
        fetch(`/api/evals/datasets?agent_id=${agentName}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/evals/runs?limit=5`).then(r => r.ok ? r.json() : []),
      ]);
      setMetrics(metricsRes);
      setScores(Array.isArray(scoresRes) ? scoresRes : []);
      setDatasets(Array.isArray(datasetsRes) ? datasetsRes : []);
      setRecentRuns(Array.isArray(runsRes) ? runsRes : []);
      setLoading(false);
    }
    load();
  }, [agentId, agentName]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading evals data…</div>
      </div>
    );
  }

  const scoresByDimension: Record<string, number[]> = {};
  for (const s of scores) {
    (scoresByDimension[s.scorer_name] ??= []).push(s.score);
  }
  const avgByDimension = Object.fromEntries(
    Object.entries(scoresByDimension).map(([k, vals]) => [
      k,
      vals.reduce((a, b) => a + b, 0) / vals.length,
    ]),
  );

  const fmtPct = (v?: number) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const fmtScore = (v?: number) => (v == null ? '—' : v.toFixed(2));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Metrics */}
      {metrics && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Production Metrics (24h)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="text-xs text-gray-500">Runs</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {metrics.runs?.total ?? '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {fmtPct(metrics.runs?.success_rate)} success
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="text-xs text-gray-500">Quality Score</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {fmtScore(metrics.quality?.avg_score)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.quality?.sample_count} samples
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score dimensions */}
      {Object.keys(avgByDimension).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Eval Scores (7 days)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(avgByDimension).map(([dim, avg]) => (
              <div
                key={dim}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="text-xs text-gray-500">{dim}</div>
                <div
                  className={`text-xl font-bold mt-1 ${avg >= 0.8 ? 'text-green-600' : avg >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}
                >
                  {avg.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {scoresByDimension[dim]?.length} samples
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Datasets and run eval CTA */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Eval Datasets
          </h3>
          <Link
            href="/evals"
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            View all →
          </Link>
        </div>
        {datasets.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No datasets for this agent.{' '}
            <Link href="/evals" className="text-blue-600 hover:underline">
              Create one →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.slice(0, 5).map((ds: any) => (
              <div
                key={ds.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{ds.name}</div>
                  <div className="text-xs text-gray-500">{ds.scenario_count} scenarios</div>
                </div>
                <Link
                  href={`/evals/datasets/${ds.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Run →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
