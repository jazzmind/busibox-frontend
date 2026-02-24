'use client';

import { useState } from 'react';

/**
 * Weather Demo Page
 * 
 * Demonstrates:
 * - Integration with Python agent-server
 * - Role-based access control (requires "weather" scope)
 * - Authentication token propagation
 * - Real-time agent interaction with tool calling
 */
export default function WeatherPage() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/agent/weather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to query weather agent');
      }

      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exampleQueries = [
    'What is the weather in London?',
    'Should I bring an umbrella in Tokyo today?',
    'What\'s the weather like in San Francisco?',
    'Is it raining in Paris right now?',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🌤️ Weather Agent Demo
          </h1>
          <p className="text-gray-600">
            Ask questions about the weather in any city. This demonstrates the Python agent-server
            with Pydantic AI, LiteLLM, and external API integration.
          </p>
          
          {/* Role-based access indicator */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                Role-Based Access: This page requires the "weather" scope
              </span>
            </div>
          </div>
        </div>

        {/* Query Form */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                Ask about the weather:
              </label>
              <input
                id="query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., What is the weather in Tokyo?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Asking agent...' : 'Get Weather'}
            </button>
          </form>

          {/* Example Queries */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(example)}
                  className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Response</h2>
            
            {/* Weather Response */}
            <div className="prose max-w-none mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <p className="text-gray-800 whitespace-pre-wrap">{response.response}</p>
              </div>
            </div>

            {/* Metadata */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Details</h3>
              
              {/* Authentication Info */}
              {response.clientId && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Client ID:</span> {response.clientId}
                  </p>
                  {response.scopes && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Scopes:</p>
                      <div className="flex flex-wrap gap-1">
                        {response.scopes.map((scope: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Architecture Flow */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Architecture Flow:</p>
                <div className="text-xs text-gray-600 space-y-1 font-mono">
                  <div>1. Browser → Next.js API Route (/api/agent/weather)</div>
                  <div>2. Next.js → OAuth Token Service (get admin token)</div>
                  <div>3. Next.js → Python Agent Server (with Bearer token)</div>
                  <div>4. Agent Server → LiteLLM (research model: qwen3-30b)</div>
                  <div>5. LLM → Weather Tool (get_weather)</div>
                  <div>6. Weather Tool → Open-Meteo API (real weather data)</div>
                  <div>7. LLM → Format response</div>
                  <div>8. Response → Browser</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Details</h2>
          
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">🔐 Authentication</h3>
              <p>Uses OAuth 2.0 client credentials flow with JWT tokens. The admin client token is obtained and forwarded to the agent-server.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">🤖 Agent Framework</h3>
              <p>Built with Pydantic AI, using LiteLLM as the model provider. The agent has access to the weather tool for fetching real-time data.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">🧰 Tool Calling</h3>
              <p>The LLM automatically decides when to call the weather tool based on the user's query. The tool fetches data from Open-Meteo API.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">🎯 Model</h3>
              <p>Uses the "research" model purpose (qwen3-30b) which supports tool calling and provides high-quality responses.</p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-1">🔒 Role-Based Access</h3>
              <p>This page checks for "weather", "admin", or "agent" scopes. Without proper authorization, requests will be denied.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}






