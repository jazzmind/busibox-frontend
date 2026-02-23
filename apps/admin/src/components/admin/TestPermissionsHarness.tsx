'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button, Input, StatusBadge } from '@jazzmind/busibox-app';

type RoleInfo = { id: string; name: string };

type DocStatus = {
  id: string;
  name: string;
  role: string;
  fileId?: string;
  status?: string;
  chunks?: number;
  vectors?: number;
  visualEmbedding?: boolean;
  error?: string;
};

type SearchResult = {
  id: string;
  title: string;
  snippet: string;
  text?: string; // Chunk text content from backend
  score: number;
  fileId?: string;
  documentId?: string;
  metadata?: Record<string, any>;
  rerank_score?: number;
  original_score?: number;
};

type Props = {
  initialRoles: RoleInfo[];
  testRoles: string[];
  initialDocs: DocStatus[];
};

type ValidationResult = {
  docId: string;
  name: string;
  role: string;
  hasRole: boolean;
  visualOk: boolean;
  searchOk: boolean;
  searchCount: number;
  status?: string;
  fileId?: string;
  error?: string;
};

type TokenInfo = {
  token: string;
  decoded: Record<string, any>;
};

export function TestPermissionsHarness({ initialRoles, testRoles, initialDocs }: Props) {
  const [roles, setRoles] = useState<RoleInfo[]>(initialRoles);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    roles.filter((r) => testRoles.includes(r.name)).map((r) => r.name)
  );
  const [docs, setDocs] = useState<DocStatus[]>(initialDocs);
  const [searchQuery, setSearchQuery] = useState('quarterly earnings');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ragQuery, setRagQuery] = useState('What are the key findings about attention mechanisms?');
  const [ragAnswer, setRagAnswer] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult[] | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [jwtLoading, setJwtLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'roles' | 'docs' | 'search' | 'rag' | 'jwt'>('roles');
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic' | 'hybrid'>('hybrid');
  const [useReranker, setUseReranker] = useState(false); // Default to false (reranker is slow)
  const [rerankerModel, setRerankerModel] = useState<'qwen3-gpu' | 'baai-gpu' | 'baai-cpu' | 'none'>('qwen3-gpu');
  const [isPending, startTransition] = useTransition();

  const normalizeStatus = (status: any): string => {
    if (!status) return 'unknown';
    if (typeof status === 'string') return status;
    if (typeof status === 'object') {
      return status.stage || status.status || status.state || 'unknown';
    }
    return String(status);
  };

  const pushLog = (msg: string) => {
    setLogs((prev) => {
      const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
      const next = [entry, ...prev];
      return next.slice(0, 100);
    });
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const applyRoles = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/tests/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles: selectedRoles }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to set roles');
        }
        setRoles(data.data.roles);
        setMessage(`Roles updated: ${selectedRoles.join(', ') || 'none'}`);
        pushLog('Roles applied, refreshing document list...');
        
        // Auto-refresh docs to show only accessible documents
        setTimeout(() => refreshDocs(), 500);
      } catch (err: any) {
        setError(err?.message || 'Failed to update roles');
      }
    });
  };

  const refreshDocs = () => {
    setMessage(null);
    setError(null);
    setValidation(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/tests/docs/status');
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to load doc status');
        }
        setDocs(data.data?.documents || []);
        pushLog('Refreshed document status');
      } catch (err: any) {
        setError(err?.message || 'Failed to refresh docs');
        pushLog(`Doc status error: ${err?.message || err}`);
      }
    });
  };

  const cleanupDocs = () => {
    setMessage(null);
    setError(null);
    setValidation(null);
    startTransition(async () => {
      try {
        pushLog('Cleaning up test documents...');
        const res = await fetch('/api/tests/docs/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to cleanup docs');
        }
        pushLog(`Cleanup complete: ${data.message || 'Done'}`);
        setMessage('Test documents cleaned up. Ready for fresh seed.');
        setTimeout(() => refreshDocs(), 1000);
      } catch (err: any) {
        setError(err?.message || 'Cleanup failed');
        pushLog(`Error: ${err?.message || err}`);
      }
    });
  };

  const seedDocs = () => {
    setMessage(null);
    setError(null);
    setValidation(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/tests/docs/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to seed docs');
        }
        setMessage('Seeding docs started. Tracking status...');
        pushLog('Seeding kicked off');
        setIsSeeding(true);
        // Poll status while seeding to show progress
        let attempts = 0;
        const poll = async () => {
          try {
            const statusRes = await fetch('/api/tests/docs/status');
            const statusData = await statusRes.json();
            if (statusData?.success) {
              const documents: DocStatus[] = statusData.data?.documents || [];
              setDocs(documents);
              const allDone = documents.every((d) => {
                const s = normalizeStatus(d.status);
                return ['completed', 'failed'].includes(s);
              });
              pushLog(
                `Status update #${attempts + 1}: ` +
                  documents
                    .map((d) => `${d.name}=${normalizeStatus(d.status)}`)
                    .join(', ')
              );
              if (allDone || attempts >= 12) {
                setIsSeeding(false);
                if (!allDone) {
                  pushLog('Stopped polling after timeout; refresh manually if needed.');
                }
                return;
              }
            } else {
              pushLog('Status poll failed; will retry');
            }
          } catch (pollErr) {
            pushLog(`Status poll error: ${pollErr}`);
          }
          attempts += 1;
          setTimeout(poll, 2500);
        };
        poll();
      } catch (err: any) {
        setError(err?.message || 'Failed to seed docs');
        pushLog(`Seed error: ${err?.message || err}`);
        setIsSeeding(false);
      }
    });
  };

  const runSearch = () => {
    setMessage(null);
    setError(null);
    setValidation(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/tests/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: searchQuery, 
            mode: searchMode, 
            useReranker,
            rerankerModel: useReranker ? rerankerModel : 'none',
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Search failed');
        }
        setSearchResults(data.data?.results || []);
        pushLog(`Search (${searchMode}) returned ${data.data?.results?.length ?? 0} results`);
      } catch (err: any) {
        setError(err?.message || 'Search failed');
        setSearchResults([]);
        pushLog(`Search error: ${err?.message || err}`);
      }
    });
  };

  const runValidation = () => {
    setMessage(null);
    setError(null);
    setValidation(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/tests/validate', {
          method: 'POST',
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Validation failed');
        }
        setValidation(data.data?.results || []);
        setMessage(data.data?.passed ? 'Validation passed' : 'Validation reported issues');
        pushLog('Automated validation completed');
      } catch (err: any) {
        setError(err?.message || 'Validation failed');
        setValidation(null);
        pushLog(`Validation error: ${err?.message || err}`);
      }
    });
  };

  const runRAG = () => {
    setMessage(null);
    setError(null);
    setRagAnswer('');
    startTransition(async () => {
      try {
        pushLog(`RAG query: "${ragQuery}"`);
        const res = await fetch('/api/tests/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: ragQuery }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'RAG failed');
        }
        setRagAnswer(data.data?.answer || 'No answer generated');
        pushLog(`RAG completed (model: ${data.data?.model || 'unknown'})`);
        if (data.data?.toolCalls?.length > 0) {
          pushLog(`Tool calls: ${data.data.toolCalls.length}`);
        }
      } catch (err: any) {
        setError(err?.message || 'RAG failed');
        setRagAnswer('');
        pushLog(`RAG error: ${err?.message || err}`);
      }
    });
  };

  const viewFileData = async (fileId: string, type: 'chunks' | 'vectors' | 'markdown' | 'source') => {
    try {
      pushLog(`Fetching ${type} for file ${fileId}...`);
      const res = await fetch(`/api/tests/file-data?fileId=${fileId}&type=${type}`);
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(error.error || `Failed to fetch ${type}`);
      }

      // For source files, trigger download
      if (type === 'source') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileId}.pdf`; // Default filename
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        pushLog(`Downloaded source file`);
      } else {
        // For JSON data, open in new window
        const data = await res.json();
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write('<html><head><title>' + type + '</title></head><body>');
          newWindow.document.write('<pre style="font-family: monospace; white-space: pre-wrap; word-wrap: break-word;">');
          newWindow.document.write(JSON.stringify(data, null, 2));
          newWindow.document.write('</pre></body></html>');
          newWindow.document.close();
        }
        pushLog(`Opened ${type} in new window`);
      }
    } catch (err: any) {
      setError(err?.message || `Failed to view ${type}`);
      pushLog(`Error viewing ${type}: ${err?.message || err}`);
    }
  };

  const fetchToken = async () => {
    setJwtLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tests/token');
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch token');
      }
      setTokenInfo(data.data);
      pushLog('Fetched service JWT for data-api');
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch token');
      setTokenInfo(null);
      pushLog(`JWT fetch error: ${err?.message || err}`);
    } finally {
      setJwtLoading(false);
    }
  };

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [selectedRoles]);

  useEffect(() => {
    fetchToken();
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div className="bg-white shadow rounded-lg p-4 border border-gray-200">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2 mb-4">
            {[
              { id: 'roles', label: 'Roles' },
              { id: 'docs', label: 'Docs & visual' },
              { id: 'search', label: 'Search' },
              { id: 'rag', label: 'RAG Agent' },
              { id: 'jwt', label: 'JWT debug' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Role toggles</h2>
                  <p className="text-sm text-gray-600">
                    Apply test-role-a/b/c and watch document visibility change immediately.
                  </p>
                </div>
                <Button variant="primary" onClick={applyRoles} loading={isPending}>
                  Apply roles
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                {testRoles.map((role) => (
                  <label
                    key={role}
                    className={`cursor-pointer border rounded-lg px-4 py-3 flex items-center gap-2 ${
                      selectedRoles.includes(role) ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    <span className="font-medium text-gray-900">{role}</span>
                  </label>
                ))}
              </div>
              <div className="text-sm text-gray-600">
                Current roles: {roles.map((r) => r.name).join(', ') || 'none'}
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Test documents</h2>
                  <p className="text-sm text-gray-600">
                    Seed docs from the shared repo, then watch status update while they data.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={cleanupDocs} loading={isPending}>
                    Cleanup & Reset
                  </Button>
                  <Button variant="secondary" onClick={seedDocs} loading={isPending || isSeeding}>
                    {isSeeding ? 'Seeding…' : 'Seed docs'}
                  </Button>
                  <Button variant="primary" onClick={refreshDocs} loading={isPending}>
                    Refresh status
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2 bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{doc.name}</div>
                        <div className="text-sm text-gray-600">Role: {doc.role}</div>
                      </div>
                      <StatusBadge
                        status={normalizeStatus(doc.status)}
                        variant={
                          normalizeStatus(doc.status) === 'completed'
                            ? 'success'
                            : normalizeStatus(doc.status) === 'failed'
                            ? 'danger'
                            : 'warning'
                        }
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      File ID: {doc.fileId || 'not ingested'}
                    </div>
                    <div className="text-sm text-gray-700">
                      Status: {normalizeStatus(doc.status)} | Chunks: {doc.chunks ?? '—'} | Vectors:{' '}
                      {doc.vectors ?? '—'} | Visual: {doc.visualEmbedding ? 'yes' : 'no'}
                    </div>
                    {doc.error && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                        {doc.error}
                      </div>
                    )}
                    {doc.fileId && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => viewFileData(doc.fileId!, 'chunks')}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          View Chunks
                        </button>
                        <button
                          onClick={() => viewFileData(doc.fileId!, 'vectors')}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                        >
                          View Vectors
                        </button>
                        <button
                          onClick={() => viewFileData(doc.fileId!, 'markdown')}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          View Markdown
                        </button>
                        <button
                          onClick={() => viewFileData(doc.fileId!, 'source')}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          View Source
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {isSeeding && (
                <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
                  Seeding in progress… status will refresh automatically for ~30s.
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Search API</h2>
                  <p className="text-sm text-gray-600">
                    Test different search modes (BM25 keyword, vector similarity, hybrid).
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={runValidation} loading={isPending}>
                    Run automated checks
                  </Button>
                  <Button variant="primary" onClick={runSearch} loading={isPending}>
                    Run search
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. attention mechanism"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Mode
                  </label>
                  <select
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value as typeof searchMode)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="keyword">Keyword (BM25)</option>
                    <option value="semantic">Semantic (Vector)</option>
                    <option value="hybrid">Hybrid (BM25 + Vector)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reranker Model
                  </label>
                  <select
                    value={rerankerModel}
                    onChange={(e) => {
                      const model = e.target.value as typeof rerankerModel;
                      setRerankerModel(model);
                      setUseReranker(model !== 'none');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="none">No Reranker</option>
                    <option value="qwen3-gpu">Qwen3 (GPU, fastest)</option>
                    <option value="baai-gpu">BAAI (GPU, most accurate)</option>
                    <option value="baai-cpu">BAAI (CPU, slowest)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    GPU rerankers are fast (~1s), CPU reranker adds 1-2 minutes
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {searchResults.length === 0 && (
                  <div className="text-sm text-gray-600">No results yet. Run a search.</div>
                )}
                {searchResults.map((r, idx) => (
                  <div key={r.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-0.5 rounded">#{idx + 1}</div>
                        <div className="font-semibold text-gray-900">{r.title}</div>
                      </div>
                      <div className="flex flex-col items-end text-xs text-gray-600">
                        {r.rerank_score !== undefined ? (
                          <>
                            <div className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              rerank: {r.rerank_score?.toFixed(3)}
                            </div>
                            <div className="text-gray-500 mt-0.5">
                              original: {r.original_score?.toFixed(3)}
                            </div>
                          </>
                        ) : (
                          <div className="bg-blue-50 px-2 py-0.5 rounded">score: {r.score?.toFixed(3)}</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Chunk excerpt */}
                    <div className="bg-white border border-gray-200 rounded p-3 mt-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">Matching Excerpt:</div>
                      <div className="text-sm text-gray-800 leading-relaxed">{r.text || r.snippet || 'No excerpt available'}</div>
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                      <span className="font-mono">file: {r.fileId || 'n/a'}</span>
                      <span className="font-mono">chunk: {r.metadata?.chunkId || r.metadata?.chunk_index || 'n/a'}</span>
                      {r.metadata?.page_number && (
                        <span>page: {r.metadata.page_number}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {validation && (
                <div className="mt-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-900">Automated checks</div>
                  {validation.map((v) => (
                    <div
                      key={v.docId}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">{v.name}</div>
                        <div className="text-xs text-gray-600">role: {v.role}</div>
                      </div>
                      <div className="text-xs text-gray-700">
                        has role: {v.hasRole ? 'yes' : 'no'} | search ok: {v.searchOk ? 'yes' : 'no'} (count{' '}
                        {v.searchCount}) | visual ok: {v.visualOk ? 'yes' : 'no'}
                      </div>
                      {v.error && <div className="text-xs text-red-600">{v.error}</div>}
                      {(!v.searchOk || !v.visualOk) && !v.error && (
                        <div className="text-xs text-amber-700">
                          Issue detected for this doc (see search/visual flags).
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">RAG Agent</h2>
                  <p className="text-sm text-gray-600">
                    Test agent-based RAG with local model orchestration via agent-server.
                  </p>
                </div>
                <Button variant="primary" onClick={runRAG} loading={isPending}>
                  Ask Agent
                </Button>
              </div>
              
              <div>
                <Input
                  label="Question"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="e.g. What are the key findings about attention mechanisms?"
                />
              </div>

              {ragAnswer && (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="text-sm font-semibold text-blue-900 mb-2">Agent Answer:</div>
                  <div className="text-sm text-blue-900 whitespace-pre-wrap">{ragAnswer}</div>
                </div>
              )}

              {!ragAnswer && !isPending && (
                <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">
                    <div className="font-semibold mb-2">How it works:</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Agent calls document-search tool with your question</li>
                      <li>Search-API finds relevant chunks (respecting your roles)</li>
                      <li>Local model (phi-4/qwen3) generates answer with citations</li>
                      <li>Response includes source filenames and page numbers</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'jwt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">JWT debug</h2>
                  <p className="text-sm text-gray-600">
                    The token sent to data (aud=data-api). Use this to debug “invalid/expired JWT”.
                  </p>
                </div>
                <Button variant="secondary" onClick={fetchToken} loading={jwtLoading}>
                  Refresh token
                </Button>
              </div>
              {tokenInfo ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Authorization header</div>
                    <div className="text-xs break-all bg-gray-50 border border-gray-200 rounded p-2">
                      Bearer {tokenInfo.token}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Decoded JWT</div>
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto">
                      {JSON.stringify(tokenInfo.decoded, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No token loaded yet.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 shrink-0 space-y-4">
        {(message || error) && (
          <div
            className={`border rounded-lg p-3 text-sm ${
              error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'
            }`}
          >
            {error || message}
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm h-full max-h-[600px] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-900">Activity log</div>
            <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
              Clear
            </Button>
          </div>
          <div className="text-xs text-gray-600 border border-gray-100 rounded-md p-2 bg-gray-50 overflow-auto h-full">
            {logs.length === 0 && <div>No events yet.</div>}
            {logs.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
