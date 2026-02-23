/**
 * ============================================
 * DEMO FILE - DELETE WHEN BUILDING REAL APP
 * ============================================
 * 
 * This file is part of the busibox-template demo.
 * Delete this entire file when starting your real app.
 * 
 * See DEMO.md for complete deletion checklist.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@jazzmind/busibox-app";
import { Trash2, Edit2, Check, X, AlertCircle, CheckCircle } from "lucide-react";

interface DemoNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function DemoPage() {
  const { authState } = useAuth();
  // During initial render (and during Next.js prerender), authState can be null.
  // Avoid hard crashes by treating "null" as unauthenticated.
  const safeAuthState = authState ?? { isAuthenticated: false, user: null };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Demo Warning Banner */}
      <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Demo Features - DELETE BEFORE PRODUCTION
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
              This page contains demo features for testing deployment. See{" "}
              <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">
                DEMO.md
              </code>{" "}
              for deletion instructions.
            </p>
          </div>
        </div>
      </div>

      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
        App Template Demo
      </h1>

      {/* Section 1: Authentication Info */}
      <AuthenticationDemo authState={safeAuthState} />

      {/* Section 2: Data API CRUD Demo */}
      <DataAPICRUDDemo />

      {/* Section 3: Agent API Demo */}
      <AgentAPIDemo />
    </div>
  );
}

// ============================================================================
// Section 1: Authentication Demo
// ============================================================================

function AuthenticationDemo({ authState }: { authState: any }) {
  const isAuthenticated = Boolean(authState?.isAuthenticated);
  const user = authState?.user ?? null;

  return (
    <section className="mb-12 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          1. SSO Authentication
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          DEMO - DELETE THIS SECTION
        </span>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-4">
        Tests Busibox SSO authentication via authz service.
      </p>

      <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status:
          </span>
          <span
            className={`px-2 py-1 rounded text-sm font-medium ${
              isAuthenticated
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {isAuthenticated ? "Authenticated" : "Not Authenticated"}
          </span>
        </div>

        {isAuthenticated && user && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email:
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {user.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                User ID:
              </span>
              <span className="text-sm text-gray-900 dark:text-white font-mono">
                {user.id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Roles:
              </span>
              <span className="text-sm text-gray-900 dark:text-white">
                {user.roles?.join(", ") || "None"}
              </span>
            </div>
          </>
        )}

        {!isAuthenticated && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please authenticate through the Busibox Portal to see your user
            information.
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section 2: Data API CRUD Demo
// ============================================================================

function DataAPICRUDDemo() {
  const [notes, setNotes] = useState<DemoNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Create note form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Get basePath for API calls
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${basePath}/api/demo/notes`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const createNote = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const response = await fetch(`${basePath}/api/demo/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: newContent }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to create note");

      setNewTitle("");
      setNewContent("");
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (note: DemoNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    try {
      setError(null);
      const response = await fetch(`${basePath}/api/demo/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to update note");

      setEditingId(null);
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update note");
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      setError(null);
      const response = await fetch(`${basePath}/api/demo/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to delete note");

      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  };

  return (
    <section className="mb-12 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          2. Data API CRUD Operations
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          DEMO - DELETE THIS SECTION
        </span>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Tests data-api CRUD operations with notes stored via the Busibox data service.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Create Note Form */}
      <div className="mb-6 bg-gray-50 dark:bg-gray-900 rounded p-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          Create New Note
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Note title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <textarea
            placeholder="Note content"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={createNote}
            disabled={creating || !newTitle.trim() || !newContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Note"}
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Your Notes ({notes.length})
        </h3>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No notes yet. Create one above!
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-4"
            >
              {editingId === note.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(note.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                      {note.title}
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(note)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    {note.content}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Created: {new Date(note.createdAt).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section 3: Agent API Demo
// ============================================================================

function AgentAPIDemo() {
  const [message, setMessage] = useState("Hello from demo app!");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Get basePath for API calls
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const callAgent = async () => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);

      // Use basePath-aware URL for fetch
      const apiUrl = `${basePath}/api/demo/agent`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        credentials: "include", // Include cookies for auth
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to call agent API");
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to call agent API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-12 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          3. Agent API Call
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          DEMO - DELETE THIS SECTION
        </span>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Tests Zero Trust token exchange and downstream service calls to
        agent-api.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Test Message
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Enter a message"
          />
        </div>

        <button
          onClick={callAgent}
          disabled={loading || !message.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Calling Agent..." : "Call Agent API"}
        </button>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {response && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                Success! ({response.duration}ms)
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              {/* User message */}
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-3">
                <span className="font-medium text-blue-800 dark:text-blue-300 block mb-1">
                  You:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {response.userMessage || message}
                </span>
              </div>
              
              {/* Agent response */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3">
                <span className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Agent:
                </span>
                <span className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {typeof response.agentResponse === 'string' 
                    ? response.agentResponse 
                    : JSON.stringify(response.agentResponse, null, 2)}
                </span>
              </div>
              
              {/* Technical details (collapsed) */}
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  Technical Details
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      API URL:
                    </span>{" "}
                    <span className="font-mono">
                      {response.agentApiUrl}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      Raw Response:
                    </span>
                    <pre className="mt-1 bg-gray-900 dark:bg-black text-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(response.rawResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
