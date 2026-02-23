'use client';

interface Agent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  scopes: string[];
}

interface ClientSession {
  clientId: string;
  clientSecret: string;
  isAuthenticated: boolean;
  accessToken?: string;
  scopes?: string[];
  selectedAgent?: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
  session: ClientSession;
}

export default function AgentSelector({ agents, onSelectAgent, session }: AgentSelectorProps) {
  const getAccessStatus = (agentScopes: string[]) => {
    if (!session.scopes) return { hasAccess: false, missingScopes: agentScopes };
    
    const missingScopes = agentScopes.filter(scope => !session.scopes!.includes(scope));
    return {
      hasAccess: missingScopes.length === 0,
      missingScopes
    };
  };

  const AgentCard = ({ agent }: { agent: Agent }) => {
    const { hasAccess, missingScopes } = getAccessStatus(agent.scopes);

    return (
      <div
        onClick={() => hasAccess && onSelectAgent(agent.id)}
        className={`bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50 transition-all duration-300 ${
          hasAccess 
            ? 'hover:shadow-xl cursor-pointer hover:scale-[1.02] group' 
            : 'opacity-60 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              hasAccess 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600' 
                : 'bg-gray-400'
            }`}>
              <span className="text-white text-xl">🤖</span>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${
                hasAccess 
                  ? 'text-gray-900 group-hover:text-blue-600' 
                  : 'text-gray-600'
              } transition-colors`}>
                {agent.displayName || agent.name}
              </h3>
              <p className="text-sm text-gray-500">{agent.name}</p>
            </div>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            hasAccess 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {hasAccess ? 'Available' : 'No Access'}
          </div>
        </div>

        <p className="text-gray-600 mb-4 line-clamp-2">{agent.description}</p>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Required Scopes:</p>
            <div className="flex flex-wrap gap-1">
              {agent.scopes.map((scope) => {
                const isGranted = session.scopes?.includes(scope);
                return (
                  <span
                    key={scope}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      isGranted 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isGranted && (
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {!isGranted && (
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {scope}
                  </span>
                );
              })}
            </div>
          </div>

          {!hasAccess && missingScopes.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium mb-1">Missing Permissions</p>
              <p className="text-xs text-red-600">
                Contact your administrator to grant these scopes: {missingScopes.join(', ')}
              </p>
            </div>
          )}

          {hasAccess && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectAgent(agent.id);
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Start Chat</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const availableAgents = agents.filter(agent => getAccessStatus(agent.scopes).hasAccess);
  const unavailableAgents = agents.filter(agent => !getAccessStatus(agent.scopes).hasAccess);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select an Agent</h2>
        <p className="text-gray-600">Choose an agent to start chatting with</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-xl">🤖</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-2xl font-bold text-gray-900">{availableAgents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-gray-600 text-xl">🔒</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Your Scopes</p>
              <p className="text-lg font-bold text-gray-900">{session.scopes?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Agents */}
      {availableAgents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Agents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Unavailable Agents */}
      {unavailableAgents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Agents Requiring Additional Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unavailableAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {agents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🤖</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Agents Available</h3>
          <p className="text-gray-600 mb-4">No agents are currently available on this server.</p>
          <p className="text-sm text-gray-500">Contact your administrator to configure agents.</p>
        </div>
      )}
    </div>
  );
}
