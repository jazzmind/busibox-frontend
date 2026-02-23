'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@jazzmind/busibox-app/lib/date-utils';

interface RAGDatabase {
  id: string;
  name: string;
  description: string;
  vectorStore: 'chroma' | 'pinecone' | 'qdrant' | 'weaviate';
  embeddingModel: string;
  chunkSize: number;
  status: 'active' | 'inactive' | 'syncing';
  documentCount: number;
  totalSize: string;
  lastUpdated: string;
  createdAt: string;
}

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'docx' | 'md' | 'web';
  size: string;
  chunks: number;
  status: 'processed' | 'processing' | 'failed' | 'pending';
  uploadedAt: string;
  source: string;
}

export default function RAGManagement() {
  const [databases, setDatabases] = useState<RAGDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<RAGDatabase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'search' | 'settings'>('overview');

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setDatabases([
        {
          id: 'knowledge-base',
          name: 'Company Knowledge Base',
          description: 'Internal documentation, policies, and procedures',
          vectorStore: 'chroma',
          embeddingModel: 'text-embedding-3-large',
          chunkSize: 1000,
          status: 'active',
          documentCount: 247,
          totalSize: '1.2GB',
          lastUpdated: '2024-01-15T14:30:00Z',
          createdAt: '2023-12-01T10:00:00Z'
        },
        {
          id: 'technical-docs',
          name: 'Technical Documentation',
          description: 'API docs, tutorials, and technical specifications',
          vectorStore: 'pinecone',
          embeddingModel: 'text-embedding-ada-002',
          chunkSize: 800,
          status: 'syncing',
          documentCount: 156,
          totalSize: '890MB',
          lastUpdated: '2024-01-14T16:45:00Z',
          createdAt: '2023-11-15T08:30:00Z'
        },
        {
          id: 'customer-support',
          name: 'Customer Support KB',
          description: 'FAQs, troubleshooting guides, and support articles',
          vectorStore: 'qdrant',
          embeddingModel: 'text-embedding-3-small',
          chunkSize: 500,
          status: 'inactive',
          documentCount: 89,
          totalSize: '234MB',
          lastUpdated: '2024-01-10T09:20:00Z',
          createdAt: '2024-01-05T14:20:00Z'
        }
      ]);

      setDocuments([
        {
          id: 'doc-1',
          name: 'Employee Handbook 2024.pdf',
          type: 'pdf',
          size: '2.4MB',
          chunks: 156,
          status: 'processed',
          uploadedAt: '2024-01-15T10:30:00Z',
          source: 'Manual Upload'
        },
        {
          id: 'doc-2',
          name: 'API Documentation v3.2',
          type: 'web',
          size: '1.8MB',
          chunks: 89,
          status: 'processing',
          uploadedAt: '2024-01-14T15:20:00Z',
          source: 'Web Crawler'
        },
        {
          id: 'doc-3',
          name: 'Security Policies.docx',
          type: 'docx',
          size: '850KB',
          chunks: 45,
          status: 'processed',
          uploadedAt: '2024-01-13T11:15:00Z',
          source: 'Manual Upload'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const DatabaseCard = ({ database }: { database: RAGDatabase }) => (
    <div
      onClick={() => setSelectedDatabase(database)}
      className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200/50 group hover:scale-[1.02]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl">📚</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {database.name}
            </h3>
            <p className="text-sm text-gray-500">{database.vectorStore} • {database.embeddingModel}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          database.status === 'active' 
            ? 'bg-green-100 text-green-700' 
            : database.status === 'syncing'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {database.status}
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{database.description}</p>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Documents</p>
          <p className="font-medium text-gray-900">{database.documentCount}</p>
        </div>
        <div>
          <p className="text-gray-500">Total Size</p>
          <p className="font-medium text-gray-900">{database.totalSize}</p>
        </div>
        <div>
          <p className="text-gray-500">Updated</p>
          <p className="font-medium text-gray-900">{formatDate(database.lastUpdated)}</p>
        </div>
      </div>
    </div>
  );

  const DocumentRow = ({ document }: { document: Document }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            document.type === 'pdf' ? 'bg-red-100 text-red-600' :
            document.type === 'docx' ? 'bg-blue-100 text-blue-600' :
            document.type === 'web' ? 'bg-green-100 text-green-600' :
            document.type === 'md' ? 'bg-purple-100 text-purple-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {document.type === 'pdf' ? '📄' :
             document.type === 'docx' ? '📝' :
             document.type === 'web' ? '🌐' :
             document.type === 'md' ? '📋' : '📄'}
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{document.name}</h4>
            <div className="flex items-center space-x-3 text-sm text-gray-500">
              <span>{document.size}</span>
              <span>{document.chunks} chunks</span>
              <span>{document.source}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            document.status === 'processed' 
              ? 'bg-green-100 text-green-700' 
              : document.status === 'processing'
              ? 'bg-yellow-100 text-yellow-700'
              : document.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {document.status}
          </div>
          <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  const DatabaseDetailView = () => {
    if (!selectedDatabase) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedDatabase(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedDatabase.name}</h2>
                <p className="text-sm text-gray-500">Knowledge Base Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
                Add Documents
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Sync Now
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 pt-4">
            <nav className="flex space-x-8" aria-label="Tabs">
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'documents', label: 'Documents', icon: '📄' },
                { id: 'search', label: 'Search & Test', icon: '🔍' },
                { id: 'settings', label: 'Settings', icon: '⚙️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 text-xl">📄</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Documents</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedDatabase.documentCount}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 text-xl">💾</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Size</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedDatabase.totalSize}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 text-xl">🧩</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Chunk Size</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedDatabase.chunkSize}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <span className="text-orange-600 text-xl">🔗</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vector Store</p>
                        <p className="text-lg font-bold text-gray-900 capitalize">{selectedDatabase.vectorStore}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {[
                      { action: 'Document processed', item: 'Employee Handbook 2024.pdf', time: '2 minutes ago' },
                      { action: 'New document uploaded', item: 'API Guidelines v3.2.md', time: '1 hour ago' },
                      { action: 'Embedding updated', item: 'Security Policies.docx', time: '3 hours ago' },
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-medium text-gray-900">{activity.action}</p>
                          <p className="text-sm text-gray-600">{activity.item}</p>
                        </div>
                        <span className="text-sm text-gray-500">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors">
                      Filter
                    </button>
                    <button className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors">
                      Upload
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {documents.map((document) => (
                    <DocumentRow key={document.id} document={document} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'search' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Search & Test Knowledge Base</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search Query</label>
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your search query or question..."
                      />
                    </div>
                    <div className="flex items-center space-x-4">
                      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        Search
                      </button>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Results:</label>
                        <select className="border border-gray-300 rounded px-2 py-1 text-sm">
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="20">20</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-medium text-gray-900 mb-3">Search Results</h4>
                  <div className="text-center text-gray-500 py-8">
                    Enter a search query to see results
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Database Name</label>
                    <input
                      type="text"
                      value={selectedDatabase.name}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vector Store</label>
                    <select
                      value={selectedDatabase.vectorStore}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="chroma">Chroma</option>
                      <option value="pinecone">Pinecone</option>
                      <option value="qdrant">Qdrant</option>
                      <option value="weaviate">Weaviate</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={selectedDatabase.description}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Chunk Size</label>
                    <input
                      type="number"
                      value={selectedDatabase.chunkSize}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Model</label>
                    <select
                      value={selectedDatabase.embeddingModel}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                      <option value="text-embedding-3-small">text-embedding-3-small</option>
                      <option value="text-embedding-3-large">text-embedding-3-large</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (selectedDatabase) {
    return <DatabaseDetailView />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Bases</h1>
          <p className="text-gray-600">Manage your RAG databases and document collections</p>
        </div>
        <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create Knowledge Base</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-xl">📚</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Databases</p>
              <p className="text-2xl font-bold text-gray-900">{databases.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-xl">📄</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900">{databases.reduce((sum, db) => sum + db.documentCount, 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl">💾</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{databases.filter(db => db.status === 'active').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 text-xl">🔄</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Syncing</p>
              <p className="text-2xl font-bold text-gray-900">{databases.filter(db => db.status === 'syncing').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Databases Grid */}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {databases.map((database) => (
            <DatabaseCard key={database.id} database={database} />
          ))}
        </div>
      )}
    </div>
  );
}